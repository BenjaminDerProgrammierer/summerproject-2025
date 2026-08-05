import express from 'express';
import { query } from '../db/db.js';
import { auth, isAdmin, getUserId } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/site-settings
 * @desc    Get all site settings (admin only)
 * @access  Private (Admin)
 */
router.get('/', auth, isAdmin, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        ss.id,
        ss.setting_key,
        ss.setting_value,
        ss.description,
        ss.updated_at,
        u.username as updated_by_username
      FROM site_settings ss
      LEFT JOIN users u ON ss.updated_by = u.id
      ORDER BY ss.setting_key
    `);
    
    res.json(result.rows);
  } catch(err) {
    console.error('Error fetching site settings:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/site-settings/public
 * @desc    Get public site settings (for checking site visibility)
 * @access  Public
 */
router.get('/public', async (req, res) => {
  try {
    const result = await query(`
      SELECT setting_key, setting_value 
      FROM site_settings 
      WHERE setting_key IN ('site_visibility', 'registration_mode')
    `);
    
    const settings: Record<string, string> = {};
    result.rows.forEach(row => {
      settings[String(row.setting_key)] = String(row.setting_value);
    });
    
    res.json(settings);
  } catch(err) {
    console.error('Error fetching public site settings:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/site-settings/:key
 * @desc    Update a site setting (admin only)
 * @access  Private (Admin)
 */
router.put('/:key', auth, isAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const userId = getUserId(req);
    
    if (!value) {
      return res.status(400).json({ message: 'Setting value is required' });
    }
    
    // Validate specific settings
    if (key === 'site_visibility' && !['public', 'private'].includes(value)) {
      return res.status(400).json({ message: 'Site visibility must be "public" or "private"' });
    }
    
    if (key === 'registration_mode' && !['open', 'invite_only', 'closed'].includes(value)) {
      return res.status(400).json({ message: 'Registration mode must be "open", "invite_only", or "closed"' });
    }
    
    const result = await query(
      `UPDATE site_settings 
       SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE setting_key = $3 
       RETURNING *`,
      [value, userId, key]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    
    res.json(result.rows[0]!);
  } catch(err) {
    console.error('Error updating site setting:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
