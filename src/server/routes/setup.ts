import express from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db/db.js';
import jwt from 'jsonwebtoken';
import { getErrorCode } from '../utils/errors.js';

const router = express.Router();

/**
 * @route   GET /api/setup/status
 * @desc    Check if initial setup is required (no users exist)
 * @access  Public
 */
router.get('/status', async (req, res) => {
  try {
    const result = await query('SELECT COUNT(*) FROM users');
    const needsSetup = parseInt(result.rows[0]!.count) === 0;
    res.json({ needsSetup });
  } catch (err) {
    console.error('Error checking setup status:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/setup/create-admin
 * @desc    Create initial admin user
 * @access  Public (only works when no users exist)
 */
router.post('/create-admin', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    // Check if any users already exist
    const checkResult = await query('SELECT COUNT(*) FROM users');
    if (parseInt(checkResult.rows[0]!.count) > 0) {
      return res.status(400).json({ message: 'Setup has already been completed' });
    }
    
    // Validate input
    if (!username || !password || !email) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Get admin role ID
    const roleResult = await query('SELECT id FROM roles WHERE name = $1', ['admin']);
    if (roleResult.rows.length === 0) {
      return res.status(500).json({ message: 'Admin role not found' });
    }
    const adminRoleId = roleResult.rows[0]!.id;
    
    // Insert admin user
    const result = await query(
      'INSERT INTO users (username, password, email, role_id) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role_id',
      [username, hashedPassword, email, adminRoleId]
    );
    
    // Verify role name for the response
    const userWithRole = await query(
      'SELECT u.id, u.username, u.email, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
      [result.rows[0]!.id]
    );
    
    // Create session
    req.session.userId = result.rows[0]!.id;
    req.session.role = 'admin';
    
    // Create JWT token
    const payload = {
      id: result.rows[0]!.id,
      username: result.rows[0]!.username,
      role: 'admin'
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET!,
      { expiresIn: '1d' }
    );
    
    res.status(201).json({ 
      token,
      message: 'Admin user created successfully',
      user: {
        id: userWithRole.rows[0]!.id,
        username: userWithRole.rows[0]!.username,
        email: userWithRole.rows[0]!.email,
        role: userWithRole.rows[0]!.role
      }
    });
  } catch (err) {
    console.error('Error creating admin user:', err);
    
    if (getErrorCode(err) === '23505') {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
