import crypto from 'node:crypto';
import express from 'express';
import { idParamsSchema, signupKeyNoteSchema, validateSignupKeySchema } from '../../shared/index.js';
import { prisma } from '../db/prisma.js';
import { auth, getUserId, isAdmin } from '../middleware/auth.js';
import { signupKeyValidationLimiter } from '../middleware/rateLimiters.js';
import { parseInput } from '../utils/validation.js';

const router = express.Router();

/**
 * @route GET /api/signup-keys
 * @desc List signup keys and their creators.
 * @access Admin
 */
router.get('/', auth, isAdmin, async (_req, res) => {
  try {
    const keys = await prisma.signupKey.findMany({
      orderBy: { createdAt: 'desc' },
      include: { creator: { select: { username: true } } },
    });
    res.json(keys.map(key => ({
      id: key.id,
      key_value: key.keyValue,
      note: key.note,
      created_at: key.createdAt,
      created_by_username: key.creator?.username ?? null,
    })));
  } catch (error) {
    console.error('Error fetching signup keys:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/signup-keys
 * @desc Generate a one-time signup key.
 * @access Admin
 */
router.post('/', auth, isAdmin, async (req, res) => {
  const input = parseInput(signupKeyNoteSchema, req.body, res);
  if (!input) return;
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: 'Authentication required' });
  try {
    const key = await prisma.signupKey.create({
      data: {
        keyValue: crypto.randomBytes(32).toString('hex'),
        note: input.note || null,
        createdBy: userId,
      },
    });
    res.status(201).json({
      id: key.id, key_value: key.keyValue, note: key.note,
      created_by: key.createdBy, created_at: key.createdAt,
    });
  } catch (error) {
    console.error('Error creating signup key:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route DELETE /api/signup-keys/:id
 * @desc Delete a signup key.
 * @access Admin
 */
router.delete('/:id', auth, isAdmin, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  if (!params) return;
  try {
    const result = await prisma.signupKey.deleteMany({ where: { id: params.id } });
    if (result.count === 0) return res.status(404).json({ message: 'Signup key not found' });
    return res.json({ message: 'Signup key deleted successfully' });
  } catch (error) {
    console.error('Error deleting signup key:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/signup-keys/:id
 * @desc Update a signup key's note.
 * @access Admin
 */
router.put('/:id', auth, isAdmin, async (req, res) => {
  const params = parseInput(idParamsSchema, req.params, res);
  const input = parseInput(signupKeyNoteSchema, req.body, res);
  if (!params || !input) return;
  try {
    const exists = await prisma.signupKey.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!exists) return res.status(404).json({ message: 'Signup key not found' });
    const key = await prisma.signupKey.update({ where: { id: params.id }, data: { note: input.note || null } });
    return res.json({
      id: key.id, key_value: key.keyValue, note: key.note,
      created_by: key.createdBy, created_at: key.createdAt,
    });
  } catch (error) {
    console.error('Error updating signup key:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route POST /api/signup-keys/validate
 * @desc Validate a signup key without consuming it.
 * @access Public
 */
router.post('/validate', signupKeyValidationLimiter, async (req, res) => {
  const input = parseInput(validateSignupKeySchema, req.body, res);
  if (!input) return;
  try {
    const key = await prisma.signupKey.findUnique({ where: { keyValue: input.key }, select: { id: true } });
    if (!key) return res.status(404).json({ message: 'Invalid signup key' });
    return res.json({ valid: true, keyId: key.id });
  } catch (error) {
    console.error('Error validating signup key:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
