import express from 'express';
import { query, getClient } from '../db/db.js';
import { auth, isWriterOrModerator, getUserId, getUserRole } from '../middleware/auth.js';
import { checkSiteAccess } from '../middleware/siteAccess.js';
import { getErrorCode } from '../utils/errors.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { attachmentsDir } from '../config/paths.js';

const router = express.Router();

// Configure multer for file uploads in the application storage directory.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = attachmentsDir;
      
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  }, 
  filename: (req, file, cb) => { 
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9); 
    const ext = path.extname(file.originalname); 
    cb(null, file.fieldname + '-' + uniqueSuffix + ext); 
  }
}); 

const upload = multer({
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => { 
    const filetypes = /jpeg|jpg|png|gif|webp|pdf/; 
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase()); 
    const mimetype = filetypes.test(file.mimetype); 
    
    if (mimetype && extname) { 
      return cb(null, true); 
    } else { 
      cb(new Error('Error: Only images and PDFs are allowed')); 
    } 
  }
});

// =====================
// TAGS ENDPOINTS
// =====================

/**
 * @route   GET /api/posts/tags
 * @desc    Get all available tags
 * @access  Public 
 */
router.get('/tags', async (req, res) => {
  try {
    const result = await query('SELECT * FROM tags ORDER BY name');
    res.json(result.rows);
  } catch(err) {
    console.error('Error fetching tags:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/** 
 * @route   GET /api/posts/tags/:id 
 * @desc    Get a single tag by ID 
 * @access  Public 
 */
router.get('/tags/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM tags WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Tag not found' });
    }
    
    res.json(result.rows[0]!);
  } catch(err) {
    console.error('Error fetching tag:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// =====================
// CATEGORIES ENDPOINTS
// =====================

/** 
 * @route   GET /api/posts/categories 
 * @desc    Get all categories 
 * @access  Public 
 */
router.get('/categories', async (req, res) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch(err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/** 
 * @route   GET /api/posts/categories/:id 
 * @desc    Get a single category by ID 
 * @access  Public 
 */
router.get('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if id is a valid integer
    const categoryId = parseInt(id);
    if (isNaN(categoryId)) {
      return res.status(400).json({ message: 'Invalid category ID, must be a number' });
    }
    
    const result = await query('SELECT * FROM categories WHERE id = $1', [categoryId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(result.rows[0]!);
  } catch(err) {
    console.error('Error fetching category:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/** 
 * @route   POST /api/posts/categories 
 * @desc    Create new category (writer or admin) 
 * @access  Private (Writer, Admin) 
 */
router.post('/categories', auth, isWriterOrModerator, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Validate input
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Category name is required' });
    }
    
    // Check if category already exists
    const existingCategory = await query(
      'SELECT id FROM categories WHERE name = $1',
      [name]
    );
    
    if (existingCategory.rows.length > 0) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }
    
    // Insert new category
    const result = await query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || '']
    );
    
    res.status(201).json(result.rows[0]!);
  } catch(err) {
    console.error('Error creating category:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/** 
 * @route   PUT /api/posts/categories/:id 
 * @desc    Update a category (writer or admin) 
 * @access  Private (Writer, Admin) 
 */
router.put('/categories/:id', auth, isWriterOrModerator, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    // Validate input
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Category name is required' });
    }
    
    // Check if category exists
    const categoryCheck = await query('SELECT id FROM categories WHERE id = $1', [id]);
    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Update category
    const result = await query(
      'UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description || '', id]
    );
    
    res.json(result.rows[0]!);
  } catch(err) {
    console.error('Error updating category:', err);
    
    if (getErrorCode(err) === '23505') {
      return res.status(400).json({ message: 'Category name already exists' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

// =====================
// POSTS ENDPOINTS
// =====================

/** 
 * @route   GET /api/posts 
 * @desc    Get all posts with filters, pagination, and sorting
 * @access  Public/Private (based on site settings)
 */
router.get('/', checkSiteAccess, async (req, res) => {
  try {
    // Extract query parameters for filtering, pagination, and sorting
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
    const author = typeof req.query.author === 'string' ? req.query.author : undefined;
    const page = typeof req.query.page === 'string' ? req.query.page : '1';
    const limit = typeof req.query.limit === 'string' ? req.query.limit : '20';
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'date';
    const sortOrder = typeof req.query.sortOrder === 'string' ? req.query.sortOrder : 'desc';
    
    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 posts per page
    const offset = (pageNum - 1) * limitNum;
    
    // Validate sort parameters
    const validSortBy = ['date', 'title', 'author'];
    const validSortOrder = ['asc', 'desc'];
    const sortColumn = validSortBy.includes(sortBy) ? sortBy : 'date';
    const sortDirection = validSortOrder.includes(sortOrder) ? sortOrder : 'desc';
    
    let sqlQuery = `
      SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.custom_date,
        p.created_at, 
        p.updated_at,
        u.username as author,
        u.id as author_id,
        c.id as category_id,
        c.name as category_name,
        COALESCE(json_agg(DISTINCT t) FILTER (WHERE t.id IS NOT NULL), '[]') as tags,
        (
          SELECT json_agg(json_build_object('id', a.id, 'filename', a.filename))
          FROM attachments a
          WHERE a.post_id = p.id
        ) as attachments
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN post_tags pt ON p.id = pt.post_id
      LEFT JOIN (
        SELECT id, name FROM tags
      ) t ON pt.tag_id = t.id
    `;
    
    const queryParams = [];
    const whereConditions = [];
    
    // Add category filter if specified
    if (category) {
      queryParams.push(category);
      whereConditions.push(`c.name = $${queryParams.length}`);
    }
    
    // Add tag filter if specified
    if (tag) {
      queryParams.push(tag);
      whereConditions.push(`
        p.id IN (
          SELECT pt.post_id 
          FROM post_tags pt 
          JOIN tags t ON pt.tag_id = t.id 
          WHERE t.name = $${queryParams.length}
        )
      `);
    }
    
    // Add author filter if specified
    if (author) {
      queryParams.push(author);
      whereConditions.push(`u.username = $${queryParams.length}`);
    }
    
    // Add WHERE clause if we have conditions
    if (whereConditions.length > 0) {
      sqlQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    // Complete the query with GROUP BY and ORDER BY
    sqlQuery += `
      GROUP BY p.id, u.username, u.id, c.id, c.name
    `;
    
    // Add sorting
    if (sortColumn === 'date') {
      sqlQuery += ` ORDER BY COALESCE(p.custom_date, p.created_at) ${sortDirection.toUpperCase()}`;
    } else if (sortColumn === 'title') {
      sqlQuery += ` ORDER BY p.title ${sortDirection.toUpperCase()}`;
    } else if (sortColumn === 'author') {
      sqlQuery += ` ORDER BY u.username ${sortDirection.toUpperCase()}`;
    }
    
    // Add pagination
    queryParams.push(limitNum);
    sqlQuery += ` LIMIT $${queryParams.length}`;
    
    queryParams.push(offset);
    sqlQuery += ` OFFSET $${queryParams.length}`;
    
    const result = await query(sqlQuery, queryParams);
    
    // Get total count for pagination info
    let countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN post_tags pt ON p.id = pt.post_id
      LEFT JOIN tags t ON pt.tag_id = t.id
    `;
    
    const countParams = [];
    const countWhereConditions = [];
    
    // Apply same filters for count
    if (category) {
      countParams.push(category);
      countWhereConditions.push(`c.name = $${countParams.length}`);
    }
    
    if (tag) {
      countParams.push(tag);
      countWhereConditions.push(`
        p.id IN (
          SELECT pt.post_id 
          FROM post_tags pt 
          JOIN tags t ON pt.tag_id = t.id 
          WHERE t.name = $${countParams.length}
        )
      `);
    }
    
    if (author) {
      countParams.push(author);
      countWhereConditions.push(`u.username = $${countParams.length}`);
    }
    
    if (countWhereConditions.length > 0) {
      countQuery += ` WHERE ${countWhereConditions.join(' AND ')}`;
    }
    
    const countResult = await query(countQuery, countParams);
    const totalPosts = parseInt(countResult.rows[0]!.total);
    const totalPages = Math.ceil(totalPosts / limitNum);
    
    res.json({
      posts: result.rows,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalPosts,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        limit: limitNum
      },
      sorting: {
        sortBy: sortColumn,
        sortOrder: sortDirection
      }
    });
  } catch(err) {
    console.error('Error fetching posts:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/** 
 * @route   POST /api/posts 
 * @desc    Create a new post with attachments, category, and tags 
 * @access  Private (Writer, Admin) 
 */
router.post('/', auth, isWriterOrModerator, upload.array('attachments', 5), async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const { title, content, category_id, tags, custom_date } = req.body;
    const userId = getUserId(req);
    
    // Validate input
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }
    
    // Validate and parse custom_date if provided
    let parsedCustomDate = null;
    if (custom_date) {
      try {
        parsedCustomDate = new Date(custom_date);
        if (isNaN(parsedCustomDate.getTime())) {
          return res.status(400).json({ message: 'Invalid date format' });
        }
        // Keep as ISO string for PostgreSQL TIMESTAMP type
        parsedCustomDate = parsedCustomDate.toISOString();
      } catch (err) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
    }
    
    // Insert post with category and custom date
    const postResult = await client.query(
      'INSERT INTO posts (title, content, author_id, category_id, custom_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, content, userId, category_id || null, parsedCustomDate]
    );
    
    const postId = postResult.rows[0]!.id;
    const files = Array.isArray(req.files) ? req.files : [];
    
    // Insert attachments with metadata
    for (const file of files) {
      await client.query(
        'INSERT INTO attachments (post_id, filename, original_filename, file_size, mime_type) VALUES ($1, $2, $3, $4, $5)',
        [postId, file.filename, file.originalname, file.size, file.mimetype]
      );
    }
    
    // Process tags
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      
      for (const tagName of tagList) {
        // Skip empty tag names
        if (!tagName || tagName.trim() === '') continue;
        
        // First check if tag exists, if not create it
        let tagResult = await client.query('SELECT id FROM tags WHERE name = $1', [tagName.trim()]);
        let tagId;
        
        if (tagResult.rows.length === 0) {
          // Create new tag
          tagResult = await client.query(
            'INSERT INTO tags (name) VALUES ($1) RETURNING id',
            [tagName.trim()]
          );
        }
        
        tagId = tagResult.rows[0]!.id;
        
        // Link tag to post
        await client.query(
          'INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [postId, tagId]
        );
      }
    }
    
    await client.query('COMMIT');
    
    // Get the complete post with attachments, category, and tags
    const completePostResult = await query(`
      SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.custom_date,
        p.created_at, 
        p.updated_at,
        u.username as author,
        u.id as author_id,
        c.id as category_id,
        c.name as category_name,
        COALESCE(json_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '[]') as tags,
        (
          SELECT json_agg(json_build_object('id', a.id, 'filename', a.filename))
          FROM attachments a
          WHERE a.post_id = p.id
        ) as attachments
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN post_tags pt ON p.id = pt.post_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE p.id = $1
      GROUP BY p.id, u.username, u.id, c.id, c.name
    `, [postId]);
    
    res.status(201).json(completePostResult.rows[0]!);
  } catch(err) {
    await client.query('ROLLBACK');
    console.error('Error creating post:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

/** 
 * @route   GET /api/posts/:id 
 * @desc    Get a single post with attachments, category, and tags 
 * @access  Public/Private (based on site settings)
 */
router.get('/:id', checkSiteAccess, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.custom_date,
        p.created_at, 
        p.updated_at,
        u.username as author,
        u.id as author_id,
        c.id as category_id,
        c.name as category_name,
        COALESCE(json_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '[]') as tags,
        (
          SELECT json_agg(json_build_object('id', a.id, 'filename', a.filename))
          FROM attachments a
          WHERE a.post_id = p.id
        ) as attachments
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN post_tags pt ON p.id = pt.post_id
      LEFT JOIN tags t ON pt.tag_id = t.id
      WHERE p.id = $1
      GROUP BY p.id, u.username, u.id, c.id, c.name
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    res.json(result.rows[0]!);
  } catch(err) {
    console.error('Error fetching post:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/** 
 * @route   PUT /api/posts/:id 
 * @desc    Update a post (writer can update own posts, admin can update any) 
 * @access  Private 
 */
router.put('/:id', auth, upload.array('attachments', 5), async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { title, content, category_id, removeAttachments, tags, custom_date } = req.body;
    const userId = getUserId(req);
    const userRole = getUserRole(req);
    
    // Check if post exists and get author ID
    const postCheck = await client.query(
      'SELECT author_id FROM posts WHERE id = $1',
      [id]
    );
    
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const postAuthorId = postCheck.rows[0]!.author_id;
    
    // Check if user is authorized to edit this post
    // Writers can only edit their own posts, moderators and admins can edit any post
    if (userRole === 'writer' && postAuthorId !== userId) {
      return res.status(403).json({ message: 'Not authorized to edit this post' });
    }
    
    // Validate input
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }
    
    // Validate and parse custom_date if provided
    let parsedCustomDate = null;
    if (custom_date) {
      try {
        parsedCustomDate = new Date(custom_date);
        if (isNaN(parsedCustomDate.getTime())) {
          return res.status(400).json({ message: 'Invalid date format' });
        }
        // Keep as ISO string for PostgreSQL TIMESTAMP type
        parsedCustomDate = parsedCustomDate.toISOString();
      } catch (err) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
    }
    
    // Update post with category and custom date
    await client.query(
      `UPDATE posts 
       SET title = $1, content = $2, category_id = $3, custom_date = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [title, content, category_id || null, parsedCustomDate, id]
    );
    
    // Handle attachments
    const files = Array.isArray(req.files) ? req.files : [];
    
    // Remove attachments if specified
    if (removeAttachments && Array.isArray(removeAttachments)) {
      for (const fileId of removeAttachments) {
        // Get the attachment record
        const attachmentResult = await client.query(
          'SELECT filename FROM attachments WHERE id = $1 AND post_id = $2',
          [fileId, id]
        );
        
        if (attachmentResult.rows.length > 0) {
          const filename = attachmentResult.rows[0]!.filename;
          
          // Delete the file from filesystem
          const filepath = path.join(attachmentsDir, filename);
            
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
          }
          
          // Delete the record
          await client.query('DELETE FROM attachments WHERE id = $1', [fileId]);

          // Remove attachment from the post
          await client.query(
            'UPDATE posts SET attachments = array_remove(attachments, $1) WHERE id = $2',
            [fileId, id]
          );
        }
      }
    }
    
    // Add new attachments
    for (const file of files) {
      await client.query(
        'INSERT INTO attachments (post_id, filename, original_filename, file_size, mime_type) VALUES ($1, $2, $3, $4, $5)',
        [id, file.filename, file.originalname, file.size, file.mimetype]
      );
    }
    
    // Handle tags - first remove all existing tags
    await client.query('DELETE FROM post_tags WHERE post_id = $1', [id]);
    
    // Then add the new tags
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      
      for (const tagName of tagList) {
        // Skip empty tag names
        if (!tagName || tagName.trim() === '') continue;
        
        // First check if tag exists, if not create it
        let tagResult = await client.query('SELECT id FROM tags WHERE name = $1', [tagName.trim()]);
        let tagId;
        
        if (tagResult.rows.length === 0) {
          // Create new tag
          tagResult = await client.query(
            'INSERT INTO tags (name) VALUES ($1) RETURNING id',
            [tagName.trim()]
          );
        }
        
        tagId = tagResult.rows[0]!.id;
        
        // Link tag to post
        await client.query(
          'INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, tagId]
        );
      }
    }
    
    await client.query('COMMIT');
    
    res.json({ message: 'Post updated successfully' });
  } catch(err) {
    await client.query('ROLLBACK');
    console.error('Error updating post:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete a post (writer can delete own posts, admin can delete any)
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const userId = getUserId(req);
    const userRole = getUserRole(req);
    
    // Check if post exists and get author ID
    const postCheck = await client.query(
      'SELECT author_id FROM posts WHERE id = $1',
      [id]
    );
    
    if (postCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const postAuthorId = postCheck.rows[0]!.author_id;
    
    // Check if user is authorized to delete this post
    // Writers can only delete their own posts, moderators and admins can delete any post
    if (userRole === 'writer' && postAuthorId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }
    
    // Get all attachments before deleting
    const attachmentsResult = await client.query(
      'SELECT filename FROM attachments WHERE post_id = $1',
      [id]
    );
    
    // Delete post (this will cascade to post_tags and attachments)
    await client.query('DELETE FROM posts WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    
    // Delete attachment files from filesystem
    for (const attachment of attachmentsResult.rows) {
      const filepath = path.join(attachmentsDir, attachment.filename);
        
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }
    
    res.json({ message: 'Post deleted successfully' });
  } catch(err) {
    await client.query('ROLLBACK');
    console.error('Error deleting post:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
