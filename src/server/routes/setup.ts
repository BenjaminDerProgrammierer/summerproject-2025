import bcrypt from 'bcrypt';
import express from 'express';
import jwt from 'jsonwebtoken';
import { setupAdminSchema } from '../../shared/index.js';
import { prisma } from '../db/prisma.js';
import { getErrorCode } from '../utils/errors.js';
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
router.post('/create-admin', async (req, res) => {
  const input = parseInput(setupAdminSchema, req.body, res);
  if (!input) return;

  try {
    const hashedPassword = await bcrypt.hash(input.password, 10);
    const user = await prisma.$transaction(async transaction => {
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
        select: { id: true, username: true, email: true, role: { select: { name: true } } },
      });
    });

    if (!user) return res.status(400).json({ message: 'Setup has already been completed' });
    if (!user.role) return res.status(500).json({ message: 'Admin role not found' });

    req.session.userId = user.id;
    req.session.role = 'admin';
    const token = jwt.sign(
      { id: user.id, username: user.username, role: 'admin' },
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
