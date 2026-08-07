import express from 'express';
import {
  destinationSearchSchema,
  destinationWidgetSchema,
  siteSettingBodySchema,
  siteSettingParamsSchema,
} from '../../shared/index.js';
import { prisma } from '../db/prisma.js';
import { auth, getUserId, isAdmin } from '../middleware/auth.js';
import { checkSiteAccess } from '../middleware/siteAccess.js';
import { parseInput } from '../utils/validation.js';

const router = express.Router();
const destinationSettingKey = 'destination_widget';
const weatherApiBaseUrl = 'https://api.weather.com/v3';
const defaultWeatherApiKey = 'e1f10a1e78da46f5b10a1e78da96f525';
let weatherCache: { key: string; expiresAt: number; value: object } | null = null;

function getWeatherApiKey(): string {
  return process.env.WEATHER_API_KEY || defaultWeatherApiKey;
}

const emptyDestination = {
  enabled: false,
  name: 'Destination',
  country: '',
  latitude: 0,
  longitude: 0,
  placeId: 'unconfigured',
  timezone: 'UTC',
  temperatureUnit: 'celsius' as const,
  timeFormat: '24' as const,
};

async function getDestination() {
  const setting = await prisma.siteSetting.findUnique({
    where: { settingKey: destinationSettingKey },
    select: { settingValue: true },
  });
  if (!setting) return emptyDestination;

  try {
    return destinationWidgetSchema.parse(JSON.parse(setting.settingValue));
  } catch (error) {
    console.error('Invalid destination widget setting:', error);
    return emptyDestination;
  }
}

/**
 * @route GET /api/site-settings/destination
 * @desc Return the destination clock/weather configuration.
 * @access Public or authenticated, according to site visibility
 */
router.get('/destination', checkSiteAccess, async (_req, res) => {
  try {
    return res.json(await getDestination());
  } catch (error) {
    console.error('Error fetching destination settings:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/site-settings/destination/search
 * @desc Search destinations through the Weather.com location service.
 * @access Admin
 */
router.get('/destination/search', auth, isAdmin, async (req, res) => {
  const input = parseInput(destinationSearchSchema, req.query, res);
  if (!input) return;

  try {
    const params = new URLSearchParams({
      apiKey: getWeatherApiKey(),
      query: input.q,
      language: 'en-US',
      format: 'json',
      locationType: 'city',
    });
    const response = await fetch(`${weatherApiBaseUrl}/location/search?${params}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return res.status(502).json({ message: 'Destination search is temporarily unavailable' });

    const data = await response.json() as {
      location?: {
        address?: string[];
        city?: Array<string | null>;
        country?: string[];
        adminDistrict?: Array<string | null>;
        latitude?: Array<number | null>;
        longitude?: Array<number | null>;
        ianaTimeZone?: Array<string | null>;
        placeId?: string[];
      };
    };
    const location = data.location;
    if (!location?.placeId) return res.json([]);
    return res.json(location.placeId.flatMap((placeId, index) => {
      const latitude = location.latitude?.[index];
      const longitude = location.longitude?.[index];
      const timezone = location.ianaTimeZone?.[index];
      if (latitude == null || longitude == null || !timezone) return [];
      return [{
        id: placeId,
        placeId,
        name: location.city?.[index] ?? location.address?.[index] ?? input.q,
        country: location.country?.[index] ?? '',
        region: location.adminDistrict?.[index] ?? '',
        latitude,
        longitude,
        timezone,
      }];
    }));
  } catch (error) {
    console.error('Error searching destinations:', error);
    return res.status(502).json({ message: 'Destination search is temporarily unavailable' });
  }
});

/**
 * @route PUT /api/site-settings/destination
 * @desc Save destination clock/weather configuration.
 * @access Admin
 */
router.put('/destination', auth, isAdmin, async (req, res) => {
  const input = parseInput(destinationWidgetSchema, req.body, res);
  if (!input) return;
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ message: 'Authentication required' });

  try {
    const setting = await prisma.siteSetting.upsert({
      where: { settingKey: destinationSettingKey },
      create: {
        settingKey: destinationSettingKey,
        settingValue: JSON.stringify(input),
        description: 'Destination clock and weather widget configuration',
        updatedBy: userId,
      },
      update: {
        settingValue: JSON.stringify(input),
        updatedBy: userId,
        updatedAt: new Date(),
      },
    });
    weatherCache = null;
    return res.json({ ...input, updatedAt: setting.updatedAt });
  } catch (error) {
    console.error('Error updating destination settings:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route GET /api/site-settings/destination/weather
 * @desc Return current weather for the configured destination.
 * @access Public or authenticated, according to site visibility
 */
router.get('/destination/weather', checkSiteAccess, async (_req, res) => {
  try {
    const destination = await getDestination();
    if (!destination.enabled) return res.status(404).json({ message: 'Destination widget is not configured' });

    const cacheKey = `${destination.placeId}:${destination.temperatureUnit}`;
    if (weatherCache?.key === cacheKey && weatherCache.expiresAt > Date.now()) {
      res.set('Cache-Control', 'private, max-age=600');
      return res.json(weatherCache.value);
    }

    const params = new URLSearchParams({
      placeid: destination.placeId,
      language: 'en-US',
      units: destination.temperatureUnit === 'celsius' ? 'm' : 'e',
      format: 'json',
      apiKey: getWeatherApiKey(),
    });
    const response = await fetch(`${weatherApiBaseUrl}/wx/observations/current?${params}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return res.status(502).json({ message: 'Weather is temporarily unavailable' });

    const data = await response.json() as {
      temperature?: number;
      temperatureFeelsLike?: number;
      iconCode?: number;
      dayOrNight?: string;
      wxPhraseLong?: string;
    };
    if (data.temperature == null || data.iconCode == null) {
      return res.status(502).json({ message: 'Weather is temporarily unavailable' });
    }
    const currentWeather = {
      temperature: data.temperature,
      apparentTemperature: data.temperatureFeelsLike ?? data.temperature,
      weatherCode: data.iconCode,
      description: data.wxPhraseLong ?? 'Current weather',
      isDay: data.dayOrNight === 'D',
      unit: destination.temperatureUnit === 'celsius' ? '°C' : '°F',
    };
    weatherCache = { key: cacheKey, expiresAt: Date.now() + 10 * 60 * 1_000, value: currentWeather };
    res.set('Cache-Control', 'private, max-age=600');
    return res.json(currentWeather);
  } catch (error) {
    console.error('Error fetching destination weather:', error);
    return res.status(502).json({ message: 'Weather is temporarily unavailable' });
  }
});

/**
 * @route GET /api/site-settings
 * @desc List all site settings and update metadata.
 * @access Admin
 */
router.get('/', auth, isAdmin, async (_req, res) => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { settingKey: { in: ['site_visibility', 'registration_mode'] } },
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
