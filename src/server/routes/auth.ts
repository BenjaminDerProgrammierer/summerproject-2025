import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query, getClient } from '../db/db.js';
import { auth, isAdmin, getUserId } from '../middleware/auth.js';
import { getErrorCode, getErrorMessage } from '../utils/errors.js';

const router = express.Router();

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user (protected by signup key)
 * @access  Protected by signup key or master key
 */
router.post('/signup', async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const { username, password, email, signupKey, masterKey } = req.body;
    
    // Check site settings first
    const siteSettings = await client.query(
      'SELECT setting_value FROM site_settings WHERE setting_key = $1',
      ['registration_mode']
    );
    
    const registrationMode = siteSettings.rows[0]!?.setting_value || 'invite_only';
    
    if (registrationMode === 'closed') {
      return res.status(403).json({ message: 'Registration is currently closed' });
    }
    
    let signupKeyRecord = null;
    
    // For invite_only mode, validate signup key or master key
    if (registrationMode === 'invite_only') {
      if (masterKey && masterKey === process.env.MASTER_SIGNUP_KEY) {
        // Master key is valid, allow signup
      } else if (signupKey) {
        // Validate signup key
        const keyResult = await client.query(
          'SELECT id, note FROM signup_keys WHERE key_value = $1',
          [signupKey]
        );
        
        if (keyResult.rows.length === 0) {
          return res.status(401).json({ message: 'Invalid signup key' });
        }
        
        signupKeyRecord = keyResult.rows[0]!;
      } else {
        return res.status(401).json({ message: 'Signup key or master key required' });
      }
    }

    // Validate input
    if (!username || !password || !email) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }

    // Check if username or email already exists
    const existingUser = await client.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Get user role ID (default to 'user' role)
    const roleResult = await client.query('SELECT id FROM roles WHERE name = $1', ['user']);
    if (roleResult.rows.length === 0) {
      return res.status(500).json({ message: 'User role not found' });
    }
    const userRoleId = roleResult.rows[0]!.id;
    
    // Insert new user
    const result = await client.query(
      'INSERT INTO users (username, password, email, role_id, signup_note) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role_id',
      [username, hashedPassword, email, userRoleId, signupKeyRecord?.note || null]
    );
    
    // Delete signup key if one was provided (one-time use)
    if (signupKeyRecord) {
      await client.query(
        'DELETE FROM signup_keys WHERE id = $1',
        [signupKeyRecord.id]
      );
    }
    
    await client.query('COMMIT');
    
    // Verify role name for the response
    const userWithRole = await query(
      'SELECT u.id, u.username, u.email, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1',
      [result.rows[0]!.id]
    );
    
    // Create session
    req.session.userId = result.rows[0]!.id;
    req.session.role = 'user';
    
    // Create JWT token
    const payload = {
      id: result.rows[0]!.id,
      username: result.rows[0]!.username,
      role: 'user'
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET!,
      { expiresIn: '1d' }
    );
    
    res.status(201).json({
      token,
      message: 'User registered successfully',
      user: {
        id: userWithRole.rows[0]!.id,
        username: userWithRole.rows[0]!.username,
        email: userWithRole.rows[0]!.email,
        role: userWithRole.rows[0]!.role
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error registering user:', err);
    
    if (getErrorCode(err) === '23505') {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user exists
    const userResult = await query(
      `SELECT u.*, r.name as role_name 
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.username = $1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = userResult.rows[0]!;

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create session
    req.session.userId = user.id;
    req.session.role = user.role_name;

    // Create JWT token
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role_name
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET!,
      { expiresIn: '1d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role_name
      }
    });
  } catch (err) {
    console.error('Login error:', getErrorMessage(err));
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user's profile
 * @access  Private
 */
router.get('/me', auth, async (req, res) => {
  try {
    const userId = getUserId(req);
    
    const userResult = await query(
      `SELECT u.id, u.username, u.email, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(userResult.rows[0]!);
  } catch (err) {
    console.error('Error getting user profile:', getErrorMessage(err));
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and clear session
 * @access  Private
 */
router.post('/logout', auth, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

/**
 * @route   GET /api/auth/users
 * @desc    Get all users (admin only)
 * @access  Admin
 */
router.get('/users', auth, isAdmin, async (req, res) => {
  try {
    const usersResult = await query(
      `SELECT u.id, u.username, u.email, u.created_at, r.name as role 
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );
    
    res.json(usersResult.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PUT /api/auth/users/:id
 * @desc    Update user details (admin only)
 * @access  Admin
 */
router.put('/users/:id', auth, isAdmin, async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { username, email, roleId } = req.body;
    
    // Validate inputs
    if (!username && !email && !roleId) {
      return res.status(400).json({ message: 'No update data provided' });
    }
    
    // Check if user exists
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update query parts
    const updates = [];
    const values = [];
    
    if (username) {
      updates.push(`username = $${updates.length + 1}`);
      values.push(username);
    }
    
    if (email) {
      updates.push(`email = $${updates.length + 1}`);
      values.push(email);
    }
    
    if (roleId) {
      // Check if role exists
      const roleCheck = await client.query('SELECT id FROM roles WHERE id = $1', [roleId]);
      if (roleCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Role not found' });
      }
      
      updates.push(`role_id = $${updates.length + 1}`);
      values.push(roleId);
    }
    
    updates.push(`updated_at = $${updates.length + 1}`);
    values.push(new Date());
    
    // Add user ID as the last parameter
    values.push(id);
    
    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${values.length}
      RETURNING id
    `;
    
    await client.query(updateQuery, values);
    await client.query('COMMIT');
    
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating user:', err);
    
    if (getErrorCode(err) === '23505') {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

/**
 * @route   PUT /api/auth/users/:id/password
 * @desc    Update user password (admin only)
 * @access  Admin
 */
router.put('/users/:id/password', auth, isAdmin, async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { password } = req.body;
    
    // Validate inputs
    if (!password) {
      return res.status(400).json({ message: 'No update data provided' });
    }
    
    // Check if user exists
    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update query parts
    const updates = [];
    const values = [];
    
    updates.push(`password = $${updates.length + 1}`);
    values.push(hashedPassword);
    
    
    updates.push(`updated_at = $${updates.length + 1}`);
    values.push(new Date());
    
    // Add user ID as the last parameter
    values.push(id);
    
    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${values.length}
      RETURNING id
    `;
    
    await client.query(updateQuery, values);
    await client.query('COMMIT');
    
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating user:', err);
    
    res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

/**
 * @route   DELETE /api/auth/users/:id
 * @desc    Delete a user (admin only)
 * @access  Admin
 */
router.delete('/users/:id', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = getUserId(req);
    
    // Prevent admin from deleting themselves
    if (parseInt(String(id)) === adminId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }
    
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/auth/roles
 * @desc    Get all available roles (admin only)
 * @access  Admin
 */
router.get('/roles', auth, isAdmin, async (req, res) => {
  try {
    const rolesResult = await query('SELECT * FROM roles ORDER BY id');
    res.json(rolesResult.rows);
  } catch (err) {
    console.error('Error fetching roles:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
