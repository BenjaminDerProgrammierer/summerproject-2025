import express from 'express';
import { query } from '../db/db.js';
import { auth, isAdmin, getUserId } from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

/**
 * @route   GET /api/signup-keys
 * @desc    Get all signup keys (admin only)
 * @access  Private (Admin)
 */
router.get('/', auth, isAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        sk.id,
        sk.key_value,
        sk.note,
        sk.created_at,
        creator.username as created_by_username
      FROM signup_keys sk
      LEFT JOIN users creator ON sk.created_by = creator.id
      ORDER BY sk.created_at DESC
    `);
    
    res.json(result.rows);
  } catch(err) {
    console.error('Error fetching signup keys:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/signup-keys
 * @desc    Create a new signup key (admin only)
 * @access  Private (Admin)
 */
router.post('/', auth, isAdmin, async (req, res) => {
  try {
    const { note } = req.body;
    const userId = getUserId(req);
    
    // Generate a secure random key
    const keyValue = crypto.randomBytes(32).toString('hex');
    
    const result = await query(
      'INSERT INTO signup_keys (key_value, note, created_by) VALUES ($1, $2, $3) RETURNING *',
      [keyValue, note || null, userId]
    );
    
    res.status(201).json(result.rows[0]!);
  } catch(err) {
    console.error('Error creating signup key:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   DELETE /api/signup-keys/:id
 * @desc    Delete a signup key (admin only)
 * @access  Private (Admin)
 */
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if key exists
    const keyCheck = await query('SELECT id FROM signup_keys WHERE id = $1', [id]);
    if (keyCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Signup key not found' });
    }
    
    await query('DELETE FROM signup_keys WHERE id = $1', [id]);
    
    res.json({ message: 'Signup key deleted successfully' });
  } catch(err) {
    console.error('Error deleting signup key:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/signup-keys/:id
 * @desc    Update a signup key note (admin only)
 * @access  Private (Admin)
 */
router.put('/:id', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    
    // Check if key exists
    const keyCheck = await query('SELECT id FROM signup_keys WHERE id = $1', [id]);
    if (keyCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Signup key not found' });
    }
    
    const result = await query(
      'UPDATE signup_keys SET note = $1 WHERE id = $2 RETURNING *',
      [note || null, id]
    );
    
    res.json(result.rows[0]!);
  } catch(err) {
    console.error('Error updating signup key:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/signup-keys/validate
 * @desc    Validate a signup key (public)
 * @access  Public
 */
router.post('/validate', async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ message: 'Signup key is required' });
    }
    
    const result = await query(
      'SELECT id FROM signup_keys WHERE key_value = $1',
      [key]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Invalid signup key' });
    }
    
    res.json({ valid: true, keyId: result.rows[0]!.id });
  } catch(err) {
    console.error('Error validating signup key:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
