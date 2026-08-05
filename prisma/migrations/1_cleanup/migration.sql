-- Unique constraints already provide equivalent indexes for these columns.
DROP INDEX IF EXISTS "idx_post_tags_post_id";
DROP INDEX IF EXISTS "idx_signup_keys_key_value";
DROP INDEX IF EXISTS "idx_site_settings_key";

-- Application secrets must be supplied by the environment, never restored as data.
DELETE FROM "system_settings"
WHERE "key" IN ('JWT_SECRET', 'MASTER_SIGNUP_KEY');
