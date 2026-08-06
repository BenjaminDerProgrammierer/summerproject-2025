import bcrypt from 'bcrypt';
import express from 'express';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'node:crypto';
import { setupAdminSchema } from '../../shared/index.js';
import { prisma } from '../db/prisma.js';
import { setupLimiter } from '../middleware/rateLimiters.js';
import { getErrorCode } from '../utils/errors.js';
import { establishAuthenticatedSession } from '../utils/session.js';
import { parseInput } from '../utils/validation.js';

const router = express.Router();

/**
 * @route GET /api/setup/status
 * @desc Report whether the initial administrator setup is required.
 * @access Public
 */
router.get('/status', async (_req, res) => {
  try {
    res.json({ needsSetup: await prisma.user.count() === 0 });
  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/setup/create-admin
 * @desc Create the initial administrator when no users exist.
 * @access Public (only before setup is complete)
 */
router.post('/create-admin', setupLimiter, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const input = parseInput(setupAdminSchema, req.body, res);
  if (!input) return;

  const expectedKey = Buffer.from(process.env.MASTER_SIGNUP_KEY ?? '');
  const suppliedKey = Buffer.from(input.masterKey);
  if (expectedKey.length === 0 || suppliedKey.length !== expectedKey.length ||
      !timingSafeEqual(suppliedKey, expectedKey)) {
    return res.status(403).json({ message: 'Invalid setup key' });
  }

  try {
    const hashedPassword = await bcrypt.hash(input.password, 10);
    const user = await prisma.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(838104271)`;
      if (await transaction.user.count() > 0) return null;

      const role = await transaction.role.findUnique({ where: { name: 'admin' } });
      if (!role) throw new Error('Admin role not found');

      return transaction.user.create({
        data: {
          username: input.username,
          password: hashedPassword,
          email: input.email,
          roleId: role.id,
        },
        select: { id: true, username: true, email: true, authVersion: true, role: { select: { name: true } } },
      });
    });

    if (!user) return res.status(400).json({ message: 'Setup has already been completed' });
    if (!user.role) return res.status(500).json({ message: 'Admin role not found' });

    await establishAuthenticatedSession(req, {
      id: user.id,
      role: 'admin',
      authVersion: user.authVersion,
    });
    const token = jwt.sign(
      { id: user.id, username: user.username, role: 'admin', authVersion: user.authVersion },
      process.env.JWT_SECRET!,
      { expiresIn: '1d' },
    );

    return res.status(201).json({
      token,
      message: 'Admin user created successfully',
      user: { id: user.id, username: user.username, email: user.email, role: user.role.name },
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    if (getErrorCode(error) === 'P2002') {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    if (error instanceof Error && error.message === 'Admin role not found') {
      return res.status(500).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
