import bcrypt from 'bcrypt';
import express from 'express';
import jwt from 'jsonwebtoken';
import { credentialsSchema, idParamsSchema, signupSchema, updatePasswordSchema, updateUserSchema } from '../../shared/index.js';
import { prisma } from '../db/prisma.js';
import { auth, getUserId, isAdmin } from '../middleware/auth.js';
import { USER_ROLES, type UserRole } from '../types/security.js';
import { getErrorCode, getErrorMessage } from '../utils/errors.js';
import { parseInput } from '../utils/validation.js';

const router = express.Router();

function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

/**
 * @route POST /api/auth/signup
 * @desc Register a user using the configured registration policy.
 * @access Public (signup key or master key may be required)
 */
router.post('/signup', async (req, res) => {
  const input = parseInput(signupSchema, req.body, res);
  if (!input) return;

  try {
    const hashedPassword = await bcrypt.hash(input.password, 10);
    const outcome = await prisma.$transaction(async transaction => {
      const registration = await transaction.siteSetting.findUnique({
        where: { settingKey: 'registration_mode' },
        select: { settingValue: true },
      });
      const mode = registration?.settingValue ?? 'invite_only';
      if (mode === 'closed') return { error: 'closed' as const };

      let signupKey: { id: number; note: string | null } | null = null;
      if (mode === 'invite_only' && input.masterKey !== process.env.MASTER_SIGNUP_KEY) {
        if (!input.signupKey) return { error: 'key-required' as const };
        signupKey = await transaction.signupKey.findUnique({
          where: { keyValue: input.signupKey },
          select: { id: true, note: true },
        });
        if (!signupKey) return { error: 'invalid-key' as const };
      }

      const duplicate = await transaction.user.findFirst({
        where: { OR: [{ username: input.username }, { email: input.email }] },
        select: { id: true },
      });
      if (duplicate) return { error: 'duplicate' as const };

      const role = await transaction.role.findUnique({ where: { name: 'user' }, select: { id: true, name: true } });
      if (!role) return { error: 'missing-role' as const };

      const user = await transaction.user.create({
        data: {
          username: input.username,
          password: hashedPassword,
          email: input.email,
          roleId: role.id,
          signupNote: signupKey?.note ?? null,
        },
        select: { id: true, username: true, email: true },
      });
      if (signupKey) await transaction.signupKey.delete({ where: { id: signupKey.id } });
      return { user, role: role.name };
    });

    if ('error' in outcome) {
      if (outcome.error === 'closed') return res.status(403).json({ message: 'Registration is currently closed' });
      if (outcome.error === 'key-required') return res.status(401).json({ message: 'Signup key or master key required' });
      if (outcome.error === 'invalid-key') return res.status(401).json({ message: 'Invalid signup key' });
      if (outcome.error === 'duplicate') return res.status(400).json({ message: 'Username or email already exists' });
      return res.status(500).json({ message: 'User role not found' });
    }

    req.session.userId = outcome.user.id;
    req.session.role = 'user';
    const token = jwt.sign(
      { id: outcome.user.id, username: outcome.user.username, role: 'user' },
      process.env.JWT_SECRET!,
      { expiresIn: '1d' },
    );
    return res.status(201).json({
      token,
      message: 'User registered successfully',
      user: { ...outcome.user, role: outcome.role },
    });
  } catch (error) {
    console.error('Error registering user:', error);
    if (getErrorCode(error) === 'P2002') {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/auth/login
 * @desc Authenticate a user and create a session and JWT.
 * @access Public
 */
router.post('/login', async (req, res) => {
  const input = parseInput(credentialsSchema, req.body, res);
  if (!input) return;
  try {
    const user = await prisma.user.findUnique({
      where: { username: input.username },
      include: { role: { select: { name: true } } },
    });
    if (!user?.role || !await bcrypt.compare(input.password, user.password) || !isUserRole(user.role.name)) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    req.session.role = user.role.name;
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role.name },
      process.env.JWT_SECRET!,
      { expiresIn: '1d' },
    );
    return res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role.name },
    });
  } catch (error) {
    console.error('Login error:', getErrorMessage(error));
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/auth/me
 * @desc Return the authenticated user's profile.
 * @access Private
 */
router.get('/me', auth, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'Authentication required' });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, role: { select: { name: true } } },
    });
    if (!user?.role) return res.status(404).json({ message: 'User not found' });
    return res.json({ id: user.id, username: user.username, email: user.email, role: user.role.name });
  } catch (error) {
    console.error('Error getting user profile:', getErrorMessage(error));
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/auth/logout
 * @desc Destroy the authenticated user's session.
 * @access Private
 */
router.post('/logout', auth, (req, res) => {
  req.session.destroy(error => {
    if (error) return res.status(500).json({ message: 'Could not log out' });
    res.clearCookie('connect.sid');
    return res.json({ message: 'Logged out successfully' });
  });
});

/**
 * @route GET /api/auth/users
 * @desc List users with their roles.
 * @access Admin
 */
router.get('/users', auth, isAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, username: true, email: true, createdAt: true, role: { select: { name: true } } },
    });
    res.json(users.filter(user => user.role).map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.createdAt,
      role: user.role!.name,
    })));
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/auth/users/:id
 * @desc Update a user's identity or role.
 * @access Admin
 */
router.put('/users/:id', auth, isAdmin, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  const input = parseInput(updateUserSchema, req.body, res);
  if (!params || !input) return;
  try {
    const result = await prisma.$transaction(async transaction => {
      if (!await transaction.user.findUnique({ where: { id: params.id }, select: { id: true } })) return 'missing-user';
      if (input.roleId && !await transaction.role.findUnique({ where: { id: input.roleId }, select: { id: true } })) return 'missing-role';
      await transaction.user.update({
        where: { id: params.id },
        data: {
          ...(input.username !== undefined ? { username: input.username } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.roleId !== undefined ? { roleId: input.roleId } : {}),
          updatedAt: new Date(),
        },
      });
      return 'updated';
    });
    if (result === 'missing-user') return res.status(404).json({ message: 'User not found' });
    if (result === 'missing-role') return res.status(404).json({ message: 'Role not found' });
    return res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    if (getErrorCode(error) === 'P2002') return res.status(400).json({ message: 'Username or email already exists' });
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/auth/users/:id/password
 * @desc Replace a user's password.
 * @access Admin
 */
router.put('/users/:id/password', auth, isAdmin, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  const input = parseInput(updatePasswordSchema, req.body, res);
  if (!params || !input) return;
  try {
    const exists = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!exists) return res.status(404).json({ message: 'User not found' });
    await prisma.user.update({
      where: { id: params.id },
      data: { password: await bcrypt.hash(input.password, 10), updatedAt: new Date() },
    });
    return res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route DELETE /api/auth/users/:id
 * @desc Delete a user while preventing self-deletion.
 * @access Admin
 */
router.delete('/users/:id', auth, isAdmin, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  if (!params) return;
  if (params.id === getUserId(req)) return res.status(400).json({ message: 'Cannot delete your own account' });
  try {
    const result = await prisma.user.deleteMany({ where: { id: params.id } });
    if (result.count === 0) return res.status(404).json({ message: 'User not found' });
    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/auth/roles
 * @desc List available user roles.
 * @access Admin
 */
router.get('/roles', auth, isAdmin, async (_req, res) => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { id: 'asc' } });
    res.json(roles.map(role => ({
      id: role.id, name: role.name, description: role.description, created_at: role.createdAt,
    })));
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
