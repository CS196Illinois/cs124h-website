-- Production schema for the tables introduced by the cs124h-dev-site port.
--
-- This is the real-table counterpart to test-schema.sql. It never existed
-- before - the production tables (user-testing, action_items, events, etc.)
-- were created by hand at some point during the port, and drifted out of
-- sync with what the app code actually needs. Confirmed drift as of writing:
-- action_items was missing is_gradable, max_score, grade, grade_note,
-- graded_by, graded_at, and batch_id, which broke assigning/grading action
-- items entirely ("Could not find the 'batch_id' column of 'action_items'
-- in the schema cache").
--
-- Idempotent and safe to re-run at any time:
--   - CREATE TABLE IF NOT EXISTS handles a table that doesn't exist yet.
--   - ALTER TABLE ... ADD COLUMN IF NOT EXISTS (run for every column on
--     every table, regardless of whether the table is brand new or already
--     existed) self-heals any table that exists but is missing columns -
--     which is the actual bug this script was written to fix.
--
-- Run this once in the Supabase SQL editor against the production project.

-- ── People / roster ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user-testing" (
  net_id            text PRIMARY KEY
);
ALTER TABLE "user-testing" ADD COLUMN IF NOT EXISTS group_number    integer;
ALTER TABLE "user-testing" ADD COLUMN IF NOT EXISTS role            text NOT NULL DEFAULT 'STUDENT';
ALTER TABLE "user-testing" ADD COLUMN IF NOT EXISTS sub             text UNIQUE;
ALTER TABLE "user-testing" ADD COLUMN IF NOT EXISTS name            text;
ALTER TABLE "user-testing" ADD COLUMN IF NOT EXISTS discord_user_id text;
ALTER TABLE "user-testing" ADD COLUMN IF NOT EXISTS sandbox_mode    text NOT NULL DEFAULT 'off';
ALTER TABLE "user-testing" ALTER COLUMN role DROP DEFAULT;
DO $$ BEGIN
  ALTER TABLE "user-testing" ADD CONSTRAINT user_testing_sandbox_mode_check CHECK (sandbox_mode IN ('off', 'ephemeral', 'persistent'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- ── Action items (incl. grading + bulk-batch columns) ────────────────────────
CREATE TABLE IF NOT EXISTS action_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS net_id            text NOT NULL DEFAULT '';
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS title             text NOT NULL DEFAULT '';
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS description       text;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS is_done           boolean NOT NULL DEFAULT false;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS created_at        timestamptz NOT NULL DEFAULT now();
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS due_date          timestamptz;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS additional_info   jsonb;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS completion_date   timestamptz;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS assigned_by       text;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS is_gradable       boolean NOT NULL DEFAULT false;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS max_score         numeric;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS grade             numeric;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS grade_note        text;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS graded_by         text;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS graded_at         timestamptz;
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS batch_id          uuid;
ALTER TABLE action_items ALTER COLUMN net_id DROP DEFAULT;
ALTER TABLE action_items ALTER COLUMN title DROP DEFAULT;
CREATE INDEX IF NOT EXISTS action_items_batch_id_idx ON action_items (batch_id);

-- ── Web-dev role-view requests ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_view_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE role_view_requests ADD COLUMN IF NOT EXISTS requester_net_id    text NOT NULL DEFAULT '';
ALTER TABLE role_view_requests ADD COLUMN IF NOT EXISTS requested_role      text NOT NULL DEFAULT '';
ALTER TABLE role_view_requests ADD COLUMN IF NOT EXISTS status              text NOT NULL DEFAULT 'pending';
ALTER TABLE role_view_requests ADD COLUMN IF NOT EXISTS reviewed_by         text;
ALTER TABLE role_view_requests ADD COLUMN IF NOT EXISTS reviewed_at         timestamptz;
ALTER TABLE role_view_requests ADD COLUMN IF NOT EXISTS expires_at          timestamptz;
ALTER TABLE role_view_requests ADD COLUMN IF NOT EXISTS created_at          timestamptz NOT NULL DEFAULT now();
ALTER TABLE role_view_requests ALTER COLUMN requester_net_id DROP DEFAULT;
ALTER TABLE role_view_requests ALTER COLUMN requested_role DROP DEFAULT;

-- ── Events + check-ins ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE events ADD COLUMN IF NOT EXISTS title                 text NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS description           text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS location              text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS presenter             text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time            timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time              timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS point_value           integer DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_code_secret        text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS join_link             text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS checked_in_students   jsonb DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_active             boolean NOT NULL DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at            timestamptz NOT NULL DEFAULT now();
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at            timestamptz NOT NULL DEFAULT now();
ALTER TABLE events ADD COLUMN IF NOT EXISTS check_in_open         boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS check_in_opened_at    timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by            text;
ALTER TABLE events ALTER COLUMN title DROP DEFAULT;

CREATE TABLE IF NOT EXISTS event_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE event_checkins ADD COLUMN IF NOT EXISTS event_id        uuid REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE event_checkins ADD COLUMN IF NOT EXISTS net_id          text NOT NULL DEFAULT '';
ALTER TABLE event_checkins ADD COLUMN IF NOT EXISTS checked_in_at   timestamptz NOT NULL DEFAULT now();
ALTER TABLE event_checkins ALTER COLUMN net_id DROP DEFAULT;
DO $$ BEGIN
  ALTER TABLE event_checkins ADD CONSTRAINT event_checkins_event_id_net_id_key UNIQUE (event_id, net_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- ── Sprints + per-student completions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sprints (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS number        integer NOT NULL DEFAULT 0;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS goal          text;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS start_date    date;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS end_date      date;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS created_at    timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS sprint_completions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE sprint_completions ADD COLUMN IF NOT EXISTS sprint_id         uuid REFERENCES sprints(id) ON DELETE CASCADE;
ALTER TABLE sprint_completions ADD COLUMN IF NOT EXISTS student_net_id    text NOT NULL DEFAULT '';
ALTER TABLE sprint_completions ADD COLUMN IF NOT EXISTS marked_by         text;
ALTER TABLE sprint_completions ADD COLUMN IF NOT EXISTS completed_at      timestamptz NOT NULL DEFAULT now();
ALTER TABLE sprint_completions ALTER COLUMN student_net_id DROP DEFAULT;
DO $$ BEGIN
  ALTER TABLE sprint_completions ADD CONSTRAINT sprint_completions_sprint_id_student_net_id_key UNIQUE (sprint_id, student_net_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- ── Dashboard sandbox overlay (web_dev / lead_web_dev) ────────────────────────
-- One row per real-or-virtual row a sandboxed user has touched in a given
-- in-scope table. Reads merge this diff onto the real table; writes from a
-- sandboxed session land here instead of the real table. Deliberately scoped
-- to content tables only (action_items, events, event_checkins, sprints,
-- sprint_completions) - users and role_view_requests are never sandboxed.
CREATE TABLE IF NOT EXISTS sandbox_overlay (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE sandbox_overlay ADD COLUMN IF NOT EXISTS owner_net_id  text NOT NULL DEFAULT '';
ALTER TABLE sandbox_overlay ADD COLUMN IF NOT EXISTS table_key     text NOT NULL DEFAULT '';
ALTER TABLE sandbox_overlay ADD COLUMN IF NOT EXISTS row_pk        text NOT NULL DEFAULT '';
ALTER TABLE sandbox_overlay ADD COLUMN IF NOT EXISTS op            text NOT NULL DEFAULT 'insert';
ALTER TABLE sandbox_overlay ADD COLUMN IF NOT EXISTS row_data      jsonb;
ALTER TABLE sandbox_overlay ADD COLUMN IF NOT EXISTS created_at    timestamptz NOT NULL DEFAULT now();
ALTER TABLE sandbox_overlay ADD COLUMN IF NOT EXISTS updated_at    timestamptz NOT NULL DEFAULT now();
ALTER TABLE sandbox_overlay ALTER COLUMN owner_net_id DROP DEFAULT;
ALTER TABLE sandbox_overlay ALTER COLUMN table_key DROP DEFAULT;
ALTER TABLE sandbox_overlay ALTER COLUMN row_pk DROP DEFAULT;
ALTER TABLE sandbox_overlay ALTER COLUMN op DROP DEFAULT;
DO $$ BEGIN
  ALTER TABLE sandbox_overlay ADD CONSTRAINT sandbox_overlay_op_check CHECK (op IN ('insert', 'update', 'delete'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE sandbox_overlay ADD CONSTRAINT sandbox_overlay_owner_table_row_key UNIQUE (owner_net_id, table_key, row_pk);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS sandbox_overlay_owner_table_idx ON sandbox_overlay (owner_net_id, table_key);

-- ── Public content (site pages, not auth-scoped) ──────────────────────────────
-- staff, resources, and projects already exist with the correct shape in
-- production (verified against the app's actual usage) - included here only
-- so a from-scratch bootstrap of this project would still produce them.
CREATE TABLE IF NOT EXISTS staff (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  semester          text,
  semester_order    integer,
  member_order      integer,
  name              text,
  role              text,
  image_url         text,
  year              text,
  major             text,
  semesters_count   text,
  bio               text,
  email             text
);

CREATE TABLE IF NOT EXISTS resources (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type          text,
  item_order    integer,
  title         text,
  members       jsonb,
  description   text,
  external_url  text,
  image_url     text
);

CREATE TABLE IF NOT EXISTS projects (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title             text,
  description       text,
  members           jsonb,
  github_url        text,
  image_url         text,
  semester          text,
  hall_of_fame      boolean DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  semester_order    integer,
  project_order     integer
);

-- ── RLS ────────────────────────────────────────────────────────────────────────
-- Every Supabase call in this app goes through the service-role key
-- (lib/supabaseServer.js) - nothing reads these tables with the anon key -
-- so RLS doesn't gate anything here either way, but disabling it explicitly
-- avoids surprises if a client-side read is ever added later.
ALTER TABLE "user-testing"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE action_items        DISABLE ROW LEVEL SECURITY;
ALTER TABLE role_view_requests  DISABLE ROW LEVEL SECURITY;
ALTER TABLE events              DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_checkins      DISABLE ROW LEVEL SECURITY;
ALTER TABLE sprints              DISABLE ROW LEVEL SECURITY;
ALTER TABLE sprint_completions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_overlay     DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff               DISABLE ROW LEVEL SECURITY;
ALTER TABLE resources           DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects            DISABLE ROW LEVEL SECURITY;
