export const API_PREFIX = '/api' as const;
import { z } from 'zod';

const optionalText = z.string().trim().max(10_000).optional().nullable();
const positiveId = z.coerce.number().int().positive();

export const idParamsSchema = z.object({ id: positiveId });
export const postIdParamsSchema = z.object({ postId: positiveId });

export const credentialsSchema = z.object({
  username: z.string().trim().min(1, 'All fields are required').max(50),
  password: z.string().min(1, 'All fields are required').max(200),
});

export const signupSchema = credentialsSchema.extend({
  password: z.string().min(8, 'Password must be at least 8 characters long').max(200),
  email: z.email().max(100),
  signupKey: z.string().max(255).optional(),
  masterKey: z.string().max(512).optional(),
});

export const setupAdminSchema = signupSchema.pick({ username: true, password: true, email: true }).extend({
  masterKey: z.string().min(1, 'Setup key is required').max(512),
});

export const updateUserSchema = z.object({
  username: z.string().trim().min(1).max(50).optional(),
  email: z.email().max(100).optional(),
  roleId: positiveId.optional(),
}).refine(value => Object.keys(value).length > 0, 'No update data provided');

export const updatePasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters long').max(200),
});

export const notificationPreferencesSchema = z.object({
  emailNotifications: z.boolean(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100),
  description: optionalText,
});

const stringArray = z.preprocess(
  value => value === undefined ? [] : Array.isArray(value) ? value : [value],
  z.array(z.string().max(50)),
);

const idArray = z.preprocess(
  value => value === undefined ? [] : Array.isArray(value) ? value : [value],
  z.array(positiveId),
);

export const postBodySchema = z.object({
  title: z.string().trim().min(1, 'Title and content are required').max(200),
  content: z.string().min(1, 'Title and content are required'),
  category_id: z.preprocess(value => value === '' || value === undefined ? null : value, positiveId.nullable()),
  tags: stringArray.transform(values => [...new Set(values.map(value => value.trim()).filter(Boolean))]),
  custom_date: z.preprocess(
    value => value === '' || value === undefined ? null : value,
    z.iso.datetime({ offset: true }).or(z.iso.datetime({ local: true })).transform(value => new Date(value)).nullable(),
  ),
  removeAttachments: idArray,
});

export const postPinSchema = z.object({
  is_pinned: z.boolean(),
});

export const postsQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  tag: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.literal('date').default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const commentBodySchema = z.object({
  postId: positiveId,
  content: z.string().trim().min(1, 'Comment content cannot be empty').max(2000, 'Comment content cannot exceed 2000 characters'),
  parentId: positiveId.optional().nullable(),
});

export const updateCommentSchema = commentBodySchema.pick({ content: true });

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export const signupKeyNoteSchema = z.object({ note: optionalText });
export const validateSignupKeySchema = z.object({ key: z.string().min(1, 'Signup key is required').max(255) });

export const siteSettingParamsSchema = z.object({
  key: z.enum(['site_visibility', 'registration_mode']),
});

export const siteSettingBodySchema = z.object({ value: z.string().min(1, 'Setting value is required').max(100) });

export const destinationWidgetSchema = z.object({
  enabled: z.boolean(),
  name: z.string().trim().min(1, 'Destination name is required').max(100),
  country: z.string().trim().max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  placeId: z.string().trim().min(1, 'Weather.com place ID is required').max(255),
  timezone: z.string().trim().min(1, 'Timezone is required').max(100),
  temperatureUnit: z.enum(['celsius', 'fahrenheit']),
  timeFormat: z.enum(['12', '24']).default('24'),
});

export const destinationSearchSchema = z.object({
  q: z.string().trim().min(2, 'Enter at least two characters').max(100),
});

export const documentParamsSchema = z.object({
  filename: z.enum(['privacy', 'privacy-de', 'tos', 'tos-de']),
});

const studioSqlSchema = z.object({ sql: z.string().min(1).max(256 * 1024) }).loose();

export const studioRequestSchema = z.discriminatedUnion('procedure', [
  z.object({ procedure: z.literal('query'), query: studioSqlSchema }).loose(),
  z.object({ procedure: z.literal('sequence'), sequence: z.tuple([studioSqlSchema, studioSqlSchema]) }).loose(),
  z.object({ procedure: z.literal('transaction'), queries: z.array(studioSqlSchema).max(50) }).loose(),
  z.object({
    procedure: z.literal('sql-lint'),
    sql: z.string().max(256 * 1024),
    schema: z.string().optional(),
    schemaVersion: z.string().optional(),
  }).loose(),
]);
