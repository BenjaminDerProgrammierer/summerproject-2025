import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { categorySchema, idParamsSchema, postBodySchema, postPinSchema, postsQuerySchema } from '../../shared/index.js';
import { attachmentsDir } from '../config/paths.js';
import { prisma } from '../db/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import { auth, getUserId, getUserRole, isAdmin, isWriterOrModerator } from '../middleware/auth.js';
import { checkSiteAccess } from '../middleware/siteAccess.js';
import { getErrorCode } from '../utils/errors.js';
import { notifySubscribersOfNewPost } from '../utils/post-notifications.js';
import { serializePost } from '../utils/serializers.js';
import { parseInput } from '../utils/validation.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    fs.mkdirSync(attachmentsDir, { recursive: true });
    callback(null, attachmentsDir);
  },
  filename: (_req, file, callback) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    callback(null, `${file.fieldname}-${suffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error('Error: Only images and PDFs are allowed'));
    }
  },
});

const postInclude = {
  author: { select: { id: true, username: true } },
  category: { select: { id: true, name: true } },
  attachments: { select: { id: true, filename: true } },
  tags: { include: { tag: { select: { id: true, name: true } } } },
} satisfies Prisma.PostInclude;

function serializeTag(tag: { id: number; name: string; createdAt: Date | null }) {
  return { id: tag.id, name: tag.name, created_at: tag.createdAt };
}

function serializeCategory(category: { id: number; name: string; description: string | null; createdAt: Date | null }) {
  return { id: category.id, name: category.name, description: category.description, created_at: category.createdAt };
}

function unlinkStoredFile(filename: string): void {
  const filePath = path.join(attachmentsDir, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

async function findDateSortedPostIds(
  input: Pick<ReturnType<typeof postsQuerySchema.parse>, 'author' | 'category' | 'tag' | 'page' | 'limit' | 'sortOrder'>,
): Promise<number[]> {
  const filters: Prisma.Sql[] = [];
  if (input.category) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "categories" category
      WHERE category."id" = post."category_id" AND category."name" = ${input.category}
    )`);
  }
  if (input.tag) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "post_tags" post_tag
      JOIN "tags" tag ON tag."id" = post_tag."tag_id"
      WHERE post_tag."post_id" = post."id" AND tag."name" = ${input.tag}
    )`);
  }
  if (input.author) {
    filters.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "users" author
      WHERE author."id" = post."author_id" AND author."username" = ${input.author}
    )`);
  }

  const where = filters.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(filters, ' AND ')}`
    : Prisma.empty;
  const offset = (input.page - 1) * input.limit;
  const order = input.sortOrder === 'asc'
    ? Prisma.sql`ASC NULLS LAST, post."id" ASC`
    : Prisma.sql`DESC NULLS LAST, post."id" DESC`;
  const rows = await prisma.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT post."id"
    FROM "posts" post
    ${where}
    ORDER BY post."is_pinned" DESC, COALESCE(post."custom_date", post."created_at") ${order}
    LIMIT ${input.limit} OFFSET ${offset}
  `);
  return rows.map(row => row.id);
}

/**
 * @route GET /api/posts/tags
 * @desc List all available tags.
 * @access Public or authenticated, according to site visibility
 */
router.get('/tags', checkSiteAccess, async (_req, res) => {
  try {
    res.json((await prisma.tag.findMany({ orderBy: { name: 'asc' } })).map(serializeTag));
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/posts/tags/:id
 * @desc Return a tag by ID.
 * @access Public or authenticated, according to site visibility
 */
router.get('/tags/:id', checkSiteAccess, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  if (!params) return;
  try {
    const tag = await prisma.tag.findUnique({ where: { id: params.id } });
    if (!tag) return res.status(404).json({ message: 'Tag not found' });
    return res.json(serializeTag(tag));
  } catch (error) {
    console.error('Error fetching tag:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/posts/categories
 * @desc List all post categories.
 * @access Public or authenticated, according to site visibility
 */
router.get('/categories', checkSiteAccess, async (_req, res) => {
  try {
    res.json((await prisma.category.findMany({ orderBy: { name: 'asc' } })).map(serializeCategory));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/posts/categories/:id
 * @desc Return a category by ID.
 * @access Public or authenticated, according to site visibility
 */
router.get('/categories/:id', checkSiteAccess, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  if (!params) return;
  try {
    const category = await prisma.category.findUnique({ where: { id: params.id } });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    return res.json(serializeCategory(category));
  } catch (error) {
    console.error('Error fetching category:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/posts/categories
 * @desc Create a category.
 * @access Writer, Moderator, or Admin
 */
router.post('/categories', auth, isWriterOrModerator, async (req, res) => {
  const input = parseInput(categorySchema, req.body, res);
  if (!input) return;
  try {
    if (await prisma.category.findUnique({ where: { name: input.name }, select: { id: true } })) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }
    const category = await prisma.category.create({
      data: { name: input.name, description: input.description || '' },
    });
    return res.status(201).json(serializeCategory(category));
  } catch (error) {
    console.error('Error creating category:', error);
    if (getErrorCode(error) === 'P2002') return res.status(400).json({ message: 'Category with this name already exists' });
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/posts/categories/:id
 * @desc Update a category.
 * @access Writer, Moderator, or Admin
 */
router.put('/categories/:id', auth, isWriterOrModerator, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  const input = parseInput(categorySchema, req.body, res);
  if (!params || !input) return;
  try {
    if (!await prisma.category.findUnique({ where: { id: params.id }, select: { id: true } })) {
      return res.status(404).json({ message: 'Category not found' });
    }
    const category = await prisma.category.update({
      where: { id: params.id },
      data: { name: input.name, description: input.description || '' },
    });
    return res.json(serializeCategory(category));
  } catch (error) {
    console.error('Error updating category:', error);
    if (getErrorCode(error) === 'P2002') return res.status(400).json({ message: 'Category name already exists' });
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/posts
 * @desc List posts with filtering, sorting, and pagination.
 * @access Public or authenticated, according to site visibility
 */
router.get('/', checkSiteAccess, async (req, res) => {
  const input = parseInput(postsQuerySchema, req.query, res);
  if (!input) return;
  try {
    const where: Prisma.PostWhereInput = {
      ...(input.category ? { category: { name: input.category } } : {}),
      ...(input.tag ? { tags: { some: { tag: { name: input.tag } } } } : {}),
      ...(input.author ? { author: { username: input.author } } : {}),
    };
    const [dateSortedIds, totalPosts] = await Promise.all([
      findDateSortedPostIds(input),
      prisma.post.count({ where }),
    ]);
    const posts = await prisma.post.findMany({ where: { id: { in: dateSortedIds } }, include: postInclude })
      .then(found => {
        const positions = new Map(dateSortedIds.map((id, index) => [id, index]));
        return found.sort((a, b) => positions.get(a.id)! - positions.get(b.id)!);
      });
    const totalPages = Math.ceil(totalPosts / input.limit);
    return res.json({
      posts: posts.map(serializePost),
      pagination: {
        currentPage: input.page,
        totalPages,
        totalPosts,
        hasNextPage: input.page < totalPages,
        hasPrevPage: input.page > 1,
        limit: input.limit,
      },
      sorting: { sortBy: 'date', sortOrder: input.sortOrder },
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/posts
 * @desc Create a post with category, tags, and attachment metadata.
 * @access Writer, Moderator, or Admin
 */
router.post('/', auth, isWriterOrModerator, upload.array('attachments', 5), async (req, res) => {
  const input = parseInput(postBodySchema, req.body, res);
  const files = Array.isArray(req.files) ? req.files : [];
  if (!input) {
    files.forEach(file => unlinkStoredFile(file.filename));
    return;
  }
  const userId = getUserId(req);
  if (!userId) {
    files.forEach(file => unlinkStoredFile(file.filename));
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    const post = await prisma.post.create({
      data: {
        title: input.title,
        content: input.content,
        authorId: userId,
        categoryId: input.category_id,
        customDate: input.custom_date,
        attachments: {
          create: files.map(file => ({
            filename: file.filename,
            originalFilename: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype,
          })),
        },
        tags: {
          create: input.tags.map(name => ({
            tag: { connectOrCreate: { where: { name }, create: { name } } },
          })),
        },
      },
      include: postInclude,
    });
    await notifySubscribersOfNewPost(post).catch(error => {
      console.error('Error sending new-post notifications:', error);
    });
    return res.status(201).json({
      ...serializePost(post),
      tags: post.tags.map(({ tag }) => tag.name),
    });
  } catch (error) {
    files.forEach(file => unlinkStoredFile(file.filename));
    console.error('Error creating post:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/posts/:id
 * @desc Return a post with its category, tags, and attachments.
 * @access Public or authenticated, according to site visibility
 */
router.get('/:id', checkSiteAccess, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  if (!params) return;
  try {
    const post = await prisma.post.findUnique({ where: { id: params.id }, include: postInclude });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    return res.json({ ...serializePost(post), tags: post.tags.map(({ tag }) => tag.name) });
  } catch (error) {
    console.error('Error fetching post:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PATCH /api/posts/:id/pin
 * @desc Pin or unpin a post.
 * @access Admin
 */
router.patch('/:id/pin', auth, isAdmin, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  const input = parseInput(postPinSchema, req.body, res);
  if (!params || !input) return;
  try {
    const post = await prisma.post.update({
      where: { id: params.id },
      data: { isPinned: input.is_pinned, updatedAt: new Date() },
      include: postInclude,
    });
    return res.json(serializePost(post));
  } catch (error) {
    if (getErrorCode(error) === 'P2025') return res.status(404).json({ message: 'Post not found' });
    console.error('Error updating pinned post:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/posts/:id
 * @desc Update an authorized post and synchronize tags and attachments.
 * @access Owning Writer, Moderator, or Admin
 */
router.put('/:id', auth, upload.array('attachments', 5), async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  const input = parseInput(postBodySchema, req.body, res);
  const files = Array.isArray(req.files) ? req.files : [];
  if (!params || !input) {
    files.forEach(file => unlinkStoredFile(file.filename));
    return;
  }
  try {
    const current = await prisma.post.findUnique({ where: { id: params.id }, select: { authorId: true } });
    if (!current) {
      files.forEach(file => unlinkStoredFile(file.filename));
      return res.status(404).json({ message: 'Post not found' });
    }
    const role = getUserRole(req);
    const allowed = role === 'admin' || role === 'moderator' || (role === 'writer' && current.authorId === getUserId(req));
    if (!allowed) {
      files.forEach(file => unlinkStoredFile(file.filename));
      return res.status(403).json({ message: 'Not authorized to edit this post' });
    }

    const removed = await prisma.attachment.findMany({
      where: { id: { in: input.removeAttachments }, postId: params.id },
      select: { filename: true },
    });
    await prisma.$transaction(async transaction => {
      await transaction.post.update({
        where: { id: params.id },
        data: {
          title: input.title,
          content: input.content,
          categoryId: input.category_id,
          customDate: input.custom_date,
          updatedAt: new Date(),
          attachments: {
            deleteMany: { id: { in: input.removeAttachments } },
            create: files.map(file => ({
              filename: file.filename,
              originalFilename: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype,
            })),
          },
          tags: {
            deleteMany: {},
            create: input.tags.map(name => ({
              tag: { connectOrCreate: { where: { name }, create: { name } } },
            })),
          },
        },
      });
    });
    removed.forEach(attachment => unlinkStoredFile(attachment.filename));
    return res.json({ message: 'Post updated successfully' });
  } catch (error) {
    files.forEach(file => unlinkStoredFile(file.filename));
    console.error('Error updating post:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route DELETE /api/posts/:id
 * @desc Delete an authorized post and its stored attachment files.
 * @access Owning Writer, Moderator, or Admin
 */
router.delete('/:id', auth, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  if (!params) return;
  try {
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      select: { authorId: true, attachments: { select: { filename: true } } },
    });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    const role = getUserRole(req);
    const allowed = role === 'admin' || role === 'moderator' || (role === 'writer' && post.authorId === getUserId(req));
    if (!allowed) return res.status(403).json({ message: 'Not authorized to delete this post' });
    await prisma.post.delete({ where: { id: params.id } });
    post.attachments.forEach(attachment => unlinkStoredFile(attachment.filename));
    return res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
