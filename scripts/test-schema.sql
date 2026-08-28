-- Test-table schema for the automated test suite (Vitest + Playwright).
--
-- These are test_-prefixed twins of every production table, living in the
-- same Supabase project. lib/tables.js resolves every app query to these
-- names instead of the real tables whenever USE_TEST_TABLES=true (server)
-- or NEXT_PUBLIC_USE_TEST_TABLES=true (client) is set - see that file for
-- the resolver. Tests never touch the real tables as long as every query
-- goes through table().
--
-- Run this once in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS).
-- RLS is left disabled to match Postgres defaults for a fresh CREATE TABLE -
-- fine for a test-only project, since both the service-role key (server)
-- and anon key (the few client-side reads) need unrestricted access here.

-- ── People / roster ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "test_user-testing" (
  net_id            text PRIMARY KEY,
  group_number      integer,
  role              text NOT NULL,
  sub               text UNIQUE,
  name              text,
  discord_user_id   text
);
-- ADD COLUMN IF NOT EXISTS rather than inline above: this table already
-- exists in most environments by the time this line is added, and
-- CREATE TABLE IF NOT EXISTS is a no-op against an existing table - an
-- inline column definition would never actually apply. Self-heals instead.
ALTER TABLE "test_user-testing" ADD COLUMN IF NOT EXISTS sandbox_mode text NOT NULL DEFAULT 'off';
DO $$ BEGIN
  ALTER TABLE "test_user-testing" ADD CONSTRAINT test_user_testing_sandbox_mode_check CHECK (sandbox_mode IN ('off', 'ephemeral', 'persistent'));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- ── Action items (incl. grading + bulk-batch columns) ────────────────────────
CREATE TABLE IF NOT EXISTS test_action_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  net_id            text NOT NULL,
  title             text NOT NULL,
  description       text,
  is_done           boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  due_date          timestamptz,
  additional_info   jsonb,
  completion_date   timestamptz,
  assigned_by       text,
  is_gradable       boolean NOT NULL DEFAULT false,
  max_score         numeric,
  grade             numeric,
  grade_note        text,
  graded_by         text,
  graded_at         timestamptz,
  batch_id          uuid
);
CREATE INDEX IF NOT EXISTS test_action_items_batch_id_idx ON test_action_items (batch_id);

-- ── Web-dev role-view requests ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_role_view_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_net_id    text NOT NULL,
  requested_role      text NOT NULL,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by         text,
  reviewed_at         timestamptz,
  expires_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Events + check-ins ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 text NOT NULL,
  description           text,
  location              text,
  presenter             text,
  start_time            timestamptz,
  end_time              timestamptz,
  point_value           integer DEFAULT 0,
  qr_code_secret        text,
  join_link             text,
  checked_in_students   jsonb DEFAULT '[]'::jsonb,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  check_in_open         boolean NOT NULL DEFAULT false,
  check_in_opened_at    timestamptz,
  created_by            text
);

CREATE TABLE IF NOT EXISTS test_event_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES test_events(id) ON DELETE CASCADE,
  net_id          text NOT NULL,
  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, net_id)
);

-- ── Sprints + per-student completions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_sprints (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number        integer NOT NULL,
  goal          text,
  start_date    date,
  end_date      date,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS test_sprint_completions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id         uuid NOT NULL REFERENCES test_sprints(id) ON DELETE CASCADE,
  student_net_id    text NOT NULL,
  marked_by         text,
  completed_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sprint_id, student_net_id)
);

-- ── Dashboard sandbox overlay (web_dev / lead_web_dev) ────────────────────────
-- See production-schema.sql for the full explanation of this table's shape.
CREATE TABLE IF NOT EXISTS test_sandbox_overlay (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_net_id    text NOT NULL,
  table_key       text NOT NULL,
  row_pk          text NOT NULL,
  op              text NOT NULL CHECK (op IN ('insert', 'update', 'delete')),
  row_data        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_net_id, table_key, row_pk)
);
CREATE INDEX IF NOT EXISTS test_sandbox_overlay_owner_table_idx ON test_sandbox_overlay (owner_net_id, table_key);

-- ── Public content (site pages, not auth-scoped) ──────────────────────────────
CREATE TABLE IF NOT EXISTS test_staff (
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

CREATE TABLE IF NOT EXISTS test_resources (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type          text,
  item_order    integer,
  title         text,
  members       jsonb,
  description   text,
  external_url  text,
  image_url     text
);

CREATE TABLE IF NOT EXISTS test_projects (
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

-- ── Attendance / leaderboard points ───────────────────────────────────────────
-- Mirrors cs124h-website's actual current table: mixed-case column names
-- (quoted here to preserve that, since unquoted CREATE TABLE folds to
-- lowercase) - the app's leaderboard route resolves them case-insensitively
-- anyway, but the test table should reflect prod's real shape, not a
-- convenient guess. Semester-specific; will need a new table name/twin next
-- semester (see lib/tables.js).
CREATE TABLE IF NOT EXISTS test_event_attendance_sp26 (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "NAME"    text,
  "NETID"   text,
  "GROUP"   integer,
  "Total"   integer
);

-- ── RLS ────────────────────────────────────────────────────────────────────────
-- This project apparently enables RLS by default on freshly created tables
-- (confirmed empirically: the anon/publishable key got a clean 200 with zero
-- rows against data that demonstrably existed - RLS silently filtering, not a
-- grant error). A few of these tables are read through the anon key directly
-- from client components (leaderboard, course_staff, hall_of_fame), so leaving
-- RLS on with no policies would make those pages always render empty during
-- tests. Disable it explicitly rather than relying on assumed defaults.
ALTER TABLE "test_user-testing"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_action_items        DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_role_view_requests  DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_events              DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_event_checkins      DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_sprints             DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_sprint_completions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_sandbox_overlay     DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_staff               DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_resources           DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_projects            DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_event_attendance_sp26 DISABLE ROW LEVEL SECURITY;
