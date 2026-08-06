import express from 'express';
import { commentBodySchema, idParamsSchema, paginationQuerySchema, postIdParamsSchema, updateCommentSchema } from '../../shared/index.js';
import { prisma } from '../db/prisma.js';
import { auth, checkRole, getUserId, getUserRole } from '../middleware/auth.js';
import { checkSiteAccess } from '../middleware/siteAccess.js';
import { serializeComment } from '../utils/serializers.js';
import { parseInput } from '../utils/validation.js';

const router = express.Router();

/**
 * @route GET /api/comments/post/:postId
 * @desc Return a post's comments as a nested reply tree.
 * @access Public or authenticated, according to site visibility
 */
router.get('/post/:postId', checkSiteAccess, async (req, res) => {
  const params = parseInput(postIdParamsSchema, req.params, res);
  if (!params) return;
  try {
    if (!await prisma.post.findUnique({ where: { id: params.postId }, select: { id: true } })) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const records = await prisma.comment.findMany({
      where: { postId: params.postId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { username: true } } },
    });
    type NestedComment = ReturnType<typeof serializeComment> & { replies: NestedComment[] };
    const map = new Map<number, NestedComment>();
    const topLevel: NestedComment[] = [];
    for (const record of records) map.set(record.id, { ...serializeComment(record), replies: [] });
    for (const record of records) {
      const comment = map.get(record.id)!;
      const parent = record.parentId ? map.get(record.parentId) : undefined;
      if (parent) parent.replies.push(comment);
      else topLevel.push(comment);
    }
    return res.json(topLevel);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/comments
 * @desc Create a top-level comment or reply.
 * @access Private
 */
router.post('/', auth, async (req, res) => {
  const input = parseInput(commentBodySchema, req.body, res);
  if (!input) return;
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: 'Authentication required' });
  try {
    const outcome = await prisma.$transaction(async transaction => {
      if (!await transaction.post.findUnique({ where: { id: input.postId }, select: { id: true } })) return 'missing-post';
      if (input.parentId && !await transaction.comment.findFirst({
        where: { id: input.parentId, postId: input.postId }, select: { id: true },
      })) return 'missing-parent';
      return transaction.comment.create({
        data: { postId: input.postId, authorId: userId, content: input.content, parentId: input.parentId ?? null },
        include: { author: { select: { username: true } } },
      });
    });
    if (outcome === 'missing-post') return res.status(404).json({ message: 'Post not found' });
    if (outcome === 'missing-parent') return res.status(404).json({ message: 'Parent comment not found' });
    return res.status(201).json(serializeComment(outcome));
  } catch (error) {
    console.error('Error creating comment:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/comments/:id
 * @desc Update a comment as its author, moderator, or administrator.
 * @access Private
 */
router.put('/:id', auth, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  const input = parseInput(updateCommentSchema, req.body, res);
  if (!params || !input) return;
  try {
    const comment = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.isDeleted) return res.status(400).json({ message: 'Cannot edit deleted comment' });
    if (comment.authorId !== getUserId(req) && !['admin', 'moderator'].includes(getUserRole(req) ?? '')) {
      return res.status(403).json({ message: 'Not authorized to edit this comment' });
    }
    const updated = await prisma.comment.update({
      where: { id: params.id },
      data: { content: input.content, updatedAt: new Date() },
      include: { author: { select: { username: true } } },
    });
    return res.json(serializeComment(updated));
  } catch (error) {
    console.error('Error updating comment:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route DELETE /api/comments/:id
 * @desc Soft-delete a comment as its author, moderator, or administrator.
 * @access Private
 */
router.delete('/:id', auth, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  if (!params) return;
  try {
    const comment = await prisma.comment.findUnique({ where: { id: params.id } });
    if (!comment) return res.status(404).json({ message: 'Comment not found' });
    if (comment.isDeleted) return res.status(400).json({ message: 'Comment already deleted' });
    if (comment.authorId !== getUserId(req) && !['admin', 'moderator'].includes(getUserRole(req) ?? '')) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }
    await prisma.comment.update({ where: { id: params.id }, data: { isDeleted: true, updatedAt: new Date() } });
    return res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/comments/stats/:postId
 * @desc Return non-deleted comment totals for a post.
 * @access Public or authenticated, according to site visibility
 */
router.get('/stats/:postId', checkSiteAccess, async (req, res) => {
  const params = parseInput(postIdParamsSchema, req.params, res);
  if (!params) return;
  try {
    const [total, topLevel] = await Promise.all([
      prisma.comment.count({ where: { postId: params.postId, isDeleted: false } }),
      prisma.comment.count({ where: { postId: params.postId, isDeleted: false, parentId: null } }),
    ]);
    return res.json({
      total_comments: String(total),
      top_level_comments: String(topLevel),
      replies: String(total - topLevel),
    });
  } catch (error) {
    console.error('Error fetching comment stats:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/comments/recent
 * @desc Return recent comments for moderation.
 * @access Moderator or Admin
 */
router.get('/recent', auth, checkRole(['admin', 'moderator']), async (req, res) => {
  const query = parseInput(paginationQuerySchema, req.query, res);
  if (!query) return;
  try {
    const comments = await prisma.comment.findMany({
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
      include: { author: { select: { username: true } }, post: { select: { id: true, title: true } } },
    });
    return res.json(comments.map(comment => ({
      id: comment.id,
      content: comment.content,
      created_at: comment.createdAt,
      is_deleted: comment.isDeleted,
      post_title: comment.post?.title ?? null,
      post_id: comment.postId,
      author: comment.author?.username ?? null,
    })));
  } catch (error) {
    console.error('Error fetching recent comments:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
