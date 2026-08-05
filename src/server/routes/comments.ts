import express from 'express';
import { query, getClient } from '../db/db.js';
import { auth, getUserId, getUserRole, checkRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/comments/post/:postId
 * @desc    Get all comments for a post with nested replies
 * @access  Public
 */
router.get('/post/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    // Validate post exists
    const postCheck = await query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Get all comments for the post
    const result = await query(`
      SELECT 
        c.id,
        c.content,
        c.parent_id,
        c.created_at,
        c.updated_at,
        c.is_deleted,
        u.username as author,
        u.id as author_id
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `, [postId]);
    
    // Transform flat list into nested structure
    const comments = result.rows;
    type NestedComment = Record<string, unknown> & { replies: NestedComment[] };
    const commentMap = new Map<unknown, NestedComment>();
    const topLevelComments: NestedComment[] = [];
    
    // First pass: create all comment objects with empty replies array
    comments.forEach(comment => {
      commentMap.set(comment.id, {
        ...comment,
        replies: []
      });
    });
    
    // Second pass: organize into parent-child relationships
    comments.forEach(comment => {
      const commentObj = commentMap.get(comment.id);
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          if (commentObj) parent.replies.push(commentObj);
        }
      } else {
        if (commentObj) topLevelComments.push(commentObj);
      }
    });
    
    res.json(topLevelComments);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/comments
 * @desc    Create a new comment
 * @access  Private (authenticated users)
 */
router.post('/', auth, async (req, res) => {
  try {
    const { postId, content, parentId } = req.body;
    const userId = getUserId(req);
    
    // Validate input
    if (!postId || !content) {
      return res.status(400).json({ message: 'Post ID and content are required' });
    }
    
    if (content.trim().length === 0) {
      return res.status(400).json({ message: 'Comment content cannot be empty' });
    }
    
    if (content.length > 2000) {
      return res.status(400).json({ message: 'Comment content cannot exceed 2000 characters' });
    }
    
    // Validate post exists
    const postCheck = await query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Validate parent comment exists if specified
    if (parentId) {
      const parentCheck = await query(
        'SELECT id FROM comments WHERE id = $1 AND post_id = $2',
        [parentId, postId]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Parent comment not found' });
      }
    }
    
    // Create comment
    const result = await query(`
      INSERT INTO comments (post_id, author_id, content, parent_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [postId, userId, content.trim(), parentId || null]);
    
    // Get comment with author info
    const commentResult = await query(`
      SELECT 
        c.id,
        c.content,
        c.parent_id,
        c.created_at,
        c.updated_at,
        c.is_deleted,
        u.username as author,
        u.id as author_id
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE c.id = $1
    `, [result.rows[0]!.id]);
    
    res.status(201).json(commentResult.rows[0]!);
  } catch (err) {
    console.error('Error creating comment:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/comments/:id
 * @desc    Update a comment (author only or admin/moderator)
 * @access  Private
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = getUserId(req);
    const userRole = getUserRole(req);
    
    // Validate input
    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }
    
    if (content.trim().length === 0) {
      return res.status(400).json({ message: 'Comment content cannot be empty' });
    }
    
    if (content.length > 2000) {
      return res.status(400).json({ message: 'Comment content cannot exceed 2000 characters' });
    }
    
    // Check if comment exists and get author
    const commentCheck = await query(
      'SELECT author_id, is_deleted FROM comments WHERE id = $1',
      [id]
    );
    
    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    const comment = commentCheck.rows[0]!;
    
    if (comment.is_deleted) {
      return res.status(400).json({ message: 'Cannot edit deleted comment' });
    }
    
    // Check permissions
    const canEdit = comment.author_id === userId || 
                   ['admin', 'moderator'].includes(userRole ?? '');
    
    if (!canEdit) {
      return res.status(403).json({ message: 'Not authorized to edit this comment' });
    }
    
    // Update comment
    await query(
      'UPDATE comments SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [content.trim(), id]
    );
    
    // Get updated comment with author info
    const updatedResult = await query(`
      SELECT 
        c.id,
        c.content,
        c.parent_id,
        c.created_at,
        c.updated_at,
        c.is_deleted,
        u.username as author,
        u.id as author_id
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE c.id = $1
    `, [id]);
    
    res.json(updatedResult.rows[0]!);
  } catch (err) {
    console.error('Error updating comment:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/comments/:id
 * @desc    Delete a comment (soft delete - author only or admin/moderator)
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const userId = getUserId(req);
    const userRole = getUserRole(req);
    
    // Check if comment exists and get author
    const commentCheck = await client.query(
      'SELECT author_id, is_deleted FROM comments WHERE id = $1',
      [id]
    );
    
    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    const comment = commentCheck.rows[0]!;
    
    if (comment.is_deleted) {
      return res.status(400).json({ message: 'Comment already deleted' });
    }
    
    // Check permissions
    const canDelete = comment.author_id === userId || 
                     ['admin', 'moderator'].includes(userRole ?? '');
    
    if (!canDelete) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }
    
    // Soft delete the comment
    await client.query(
      'UPDATE comments SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    await client.query('COMMIT');
    
    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting comment:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

/**
 * @route   GET /api/comments/stats/:postId
 * @desc    Get comment statistics for a post
 * @access  Public
 */
router.get('/stats/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    
    const result = await query(`
      SELECT 
        COUNT(*) as total_comments,
        COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as top_level_comments,
        COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as replies
      FROM comments 
      WHERE post_id = $1 AND is_deleted = FALSE
    `, [postId]);
    
    res.json(result.rows[0]!);
  } catch (err) {
    console.error('Error fetching comment stats:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/comments/recent
 * @desc    Get recent comments for admin dashboard
 * @access  Admin/Moderator only
 */
router.get('/recent', auth, checkRole(['admin', 'moderator']), async (req, res) => {
  try {
    const limit = parseInt(String(req.query.limit ?? '10')) || 10;
    const offset = parseInt(String(req.query.offset ?? '0')) || 0;
    
    const result = await query(`
      SELECT 
        c.id,
        c.content,
        c.created_at,
        c.is_deleted,
        p.title as post_title,
        p.id as post_id,
        u.username as author
      FROM comments c
      LEFT JOIN posts p ON c.post_id = p.id
      LEFT JOIN users u ON c.author_id = u.id
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent comments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
