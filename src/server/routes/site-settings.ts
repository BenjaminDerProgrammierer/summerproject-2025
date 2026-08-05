import express from 'express';
import { siteSettingBodySchema, siteSettingParamsSchema } from '../../shared/index.js';
import { prisma } from '../db/prisma.js';
import { auth, getUserId, isAdmin } from '../middleware/auth.js';
import { parseInput } from '../utils/validation.js';

const router = express.Router();

/**
 * @route GET /api/site-settings
 * @desc List all site settings and update metadata.
 * @access Admin
 */
router.get('/', auth, isAdmin, async (_req, res) => {
  try {
    const settings = await prisma.siteSetting.findMany({
      orderBy: { settingKey: 'asc' },
      include: { updater: { select: { username: true } } },
    });
    res.json(settings.map(setting => ({
      id: setting.id,
      setting_key: setting.settingKey,
      setting_value: setting.settingValue,
      description: setting.description,
      updated_at: setting.updatedAt,
      updated_by_username: setting.updater?.username ?? null,
    })));
  } catch (error) {
    console.error('Error fetching site settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/site-settings/public
 * @desc Return the public visibility and registration settings.
 * @access Public
 */
router.get('/public', async (_req, res) => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { settingKey: { in: ['site_visibility', 'registration_mode'] } },
      select: { settingKey: true, settingValue: true },
    });
    res.json(Object.fromEntries(settings.map(setting => [setting.settingKey, setting.settingValue])));
  } catch (error) {
    console.error('Error fetching public site settings:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route PUT /api/site-settings/:key
 * @desc Update an allowlisted site setting.
 * @access Admin
 */
router.put('/:key', auth, isAdmin, async (req, res) => {
  const params = parseInput(siteSettingParamsSchema, req.params, res);
  const input = parseInput(siteSettingBodySchema, req.body, res);
  if (!params || !input) return;

  if (params.key === 'site_visibility' && !['public', 'private'].includes(input.value)) {
    return res.status(400).json({ message: 'Site visibility must be "public" or "private"' });
  }
  if (params.key === 'registration_mode' && !['open', 'invite_only', 'closed'].includes(input.value)) {
    return res.status(400).json({ message: 'Registration mode must be "open", "invite_only", or "closed"' });
  }
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: 'Authentication required' });

  try {
    const setting = await prisma.siteSetting.findUnique({ where: { settingKey: params.key }, select: { id: true } });
    if (!setting) return res.status(404).json({ message: 'Setting not found' });
    const updated = await prisma.siteSetting.update({
      where: { settingKey: params.key },
      data: { settingValue: input.value, updatedBy: userId, updatedAt: new Date() },
    });
    return res.json({
      id: updated.id,
      setting_key: updated.settingKey,
      setting_value: updated.settingValue,
      description: updated.description,
      updated_by: updated.updatedBy,
      updated_at: updated.updatedAt,
    });
  } catch (error) {
    console.error('Error updating site setting:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
