-- Understanding-check feature migration. Idempotent (IF NOT EXISTS
-- throughout) - safe to run more than once.
-- Run the TEST block first (unblocks local dev/testing), PRODUCTION block
-- when ready to ship.

-- ============================================================
-- TEST
-- ============================================================
ALTER TABLE test_action_items ADD COLUMN IF NOT EXISTS sprint_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS test_action_items_sprint_id_net_id_key ON test_action_items (sprint_id, net_id) WHERE sprint_id IS NOT NULL;

ALTER TABLE test_sprints ADD COLUMN IF NOT EXISTS check_questions jsonb;
ALTER TABLE test_sprints ADD COLUMN IF NOT EXISTS check_max_score numeric;

CREATE TABLE IF NOT EXISTS test_sprint_check_windows (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id       uuid REFERENCES test_sprints(id) ON DELETE CASCADE,
  group_number    integer NOT NULL,
  is_open         boolean NOT NULL DEFAULT false,
  opened_at       timestamptz,
  opened_by       text,
  closed_at       timestamptz,
  closed_by       text,
  UNIQUE (sprint_id, group_number)
);
ALTER TABLE test_sprint_check_windows DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- PRODUCTION
-- ============================================================
ALTER TABLE action_items ADD COLUMN IF NOT EXISTS sprint_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS action_items_sprint_id_net_id_key ON action_items (sprint_id, net_id) WHERE sprint_id IS NOT NULL;

ALTER TABLE sprints ADD COLUMN IF NOT EXISTS check_questions jsonb;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS check_max_score numeric;

CREATE TABLE IF NOT EXISTS sprint_check_windows (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id       uuid REFERENCES sprints(id) ON DELETE CASCADE,
  group_number    integer NOT NULL,
  is_open         boolean NOT NULL DEFAULT false,
  opened_at       timestamptz,
  opened_by       text,
  closed_at       timestamptz,
  closed_by       text,
  UNIQUE (sprint_id, group_number)
);
ALTER TABLE sprint_check_windows DISABLE ROW LEVEL SECURITY;
