-- Schema upgrade for the release that introduces privacy.encryptUserEmail.
--
-- WHY THIS FILE IS HAND-WRITTEN
--
-- This repository has never committed a generated migration baseline: there is
-- no drizzle/ or core/db/migrations/ directory, and `db:push` is what actually
-- puts schema on a database. `drizzle-kit migrate` therefore has nothing to
-- replay, and `drizzle-kit generate` cannot produce a first migration that is
-- safe for an install whose schema it has never snapshotted.
--
-- So this is the explicit DDL for the delta, for operators who would rather
-- read and apply statements than let `db:push --force` diff a live database.
-- Establishing a real migration baseline is a separate piece of work and is
-- still outstanding.
--
--   psql "$DATABASE_URL" -f scripts/sql/upgrade-email-storage.sql
--
-- or, equivalently for most installs:
--
--   npm run db:push
--
-- ORDER MATTERS. Run this BEFORE `npm run db:migrate-email-storage`: that
-- script writes email_hash and relies on email being nullable, neither of which
-- is true until this has run.
--
-- DESTRUCTIVE. The DROP COLUMN statements below discard data permanently. Every
-- one of them is a *_encrypted column that no code path ever read, so nothing
-- is lost that anything could use — but take a backup first regardless.

BEGIN;

-- ── users ───────────────────────────────────────────────────────────────────
-- email becomes nullable: encrypted mode leaves it NULL and puts the address in
-- email_encrypted. Until this runs, NOT NULL makes encrypted mode unable to
-- insert a user at all.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- The keyed lookup index for encrypted mode. Uniqueness moves here, since in
-- encrypted mode the email column is NULL for every row and enforces nothing.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash varchar(64);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_hash_unique ON users (email_hash);

-- Written beside users.name and read by nothing.
ALTER TABLE users DROP COLUMN IF EXISTS name_encrypted;

-- ── verification_tokens ─────────────────────────────────────────────────────
-- Same switch as users. No email_hash: this table is only ever found by
-- token_hash, and an index nothing queries is the defect being removed here.
ALTER TABLE verification_tokens ALTER COLUMN email DROP NOT NULL;
ALTER TABLE verification_tokens DROP COLUMN IF EXISTS token_encrypted;

-- ── team_invitations ────────────────────────────────────────────────────────
-- This one IS looked up by address (the duplicate-invitation check), so it gets
-- an index. Not unique: the same person may be invited to several teams.
ALTER TABLE team_invitations ALTER COLUMN email DROP NOT NULL;
ALTER TABLE team_invitations ADD COLUMN IF NOT EXISTS email_hash varchar(64);
ALTER TABLE team_invitations DROP COLUMN IF EXISTS token_encrypted;

-- ── sessions ────────────────────────────────────────────────────────────────
-- A reversible copy of every live session token, never read. Dropping it is the
-- single largest reduction in this file.
ALTER TABLE sessions DROP COLUMN IF EXISTS token_encrypted;

-- ── files ───────────────────────────────────────────────────────────────────
-- Each sat next to the plaintext column it encrypted.
ALTER TABLE files DROP COLUMN IF EXISTS filename_encrypted;
ALTER TABLE files DROP COLUMN IF EXISTS original_name_encrypted;
ALTER TABLE files DROP COLUMN IF EXISTS storage_key_encrypted;

-- ── subscriptions ───────────────────────────────────────────────────────────
-- Webhook handling keys on the subscription id rather than the customer, so it
-- has to be unique; last_event_at is what lets a late delivery be discarded
-- instead of rolling plan and status back.
--
-- The unique index will fail if duplicate stripe_subscription_id rows already
-- exist — that is the bug this replaced, where a second subscription overwrote
-- the first. Resolve duplicates before running if it errors here.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_event_at timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_unique
  ON subscriptions (stripe_subscription_id);

-- ── webhook_events (new) ────────────────────────────────────────────────────
-- The idempotency ledger. The event id is the primary key, which makes the
-- insert itself the concurrency control.
CREATE TABLE IF NOT EXISTS webhook_events (
  event_id     varchar(255) PRIMARY KEY,
  provider     varchar(50)  NOT NULL,
  type         varchar(100) NOT NULL,
  processed_at timestamptz  NOT NULL DEFAULT now()
);

-- ── api_keys (new) ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id      uuid REFERENCES teams(id) ON DELETE CASCADE,
  name         varchar(255) NOT NULL,
  prefix       varchar(20)  NOT NULL,
  key_hash     varchar(64)  NOT NULL UNIQUE,
  scopes       jsonb        NOT NULL DEFAULT '["*"]'::jsonb,
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- ── ai_usage / prompt_templates (new) ───────────────────────────────────────
-- These were referenced by code but never exported from the schema barrel, so
-- no migration ever built them and /api/ai failed at runtime with "relation
-- does not exist".
CREATE TABLE IF NOT EXISTS ai_usage (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model             varchar(100) NOT NULL,
  provider          varchar(50)  NOT NULL,
  prompt_tokens     integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens      integer NOT NULL DEFAULT 0,
  cost_cents        integer NOT NULL DEFAULT 0,
  latency_ms        integer NOT NULL DEFAULT 0,
  metadata          jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Both usage queries filter by user and order by time, on a per-request path.
CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx
  ON ai_usage (user_id, created_at);

CREATE TABLE IF NOT EXISTS prompt_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar(100) NOT NULL,
  description text DEFAULT '',
  template    text NOT NULL,
  variables   jsonb DEFAULT '[]'::jsonb,
  model       varchar(100) NOT NULL,
  temperature integer,
  max_tokens  integer,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMIT;

-- NEXT STEP: with the application still stopped, move the stored addresses into
-- the columns the configured mode uses:
--
--   npm run db:migrate-email-storage
--
-- Then confirm with GET /api/health, which reports `piiStorage: unhealthy` if
-- any of the three tables still holds rows written the other way.
