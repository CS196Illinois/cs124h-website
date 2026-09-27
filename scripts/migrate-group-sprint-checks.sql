-- Run after migrate-sprint-question-bank.sql, before deploying the application.
-- Existing shared sprint questions are retained: their authors were not recorded.

BEGIN;

-- Group-scoped PM additions; shared sprint questions remain course-wide.
CREATE TABLE IF NOT EXISTS sprint_group_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id uuid NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  group_number integer NOT NULL,
  additional_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (sprint_id, group_number)
);
ALTER TABLE sprint_group_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprint_question_bank ADD COLUMN IF NOT EXISTS group_number integer;
ALTER TABLE sprint_question_bank DROP CONSTRAINT IF EXISTS sprint_question_bank_question_key;
CREATE UNIQUE INDEX IF NOT EXISTS sprint_question_bank_shared_question
  ON sprint_question_bank (question) WHERE group_number IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sprint_question_bank_group_question
  ON sprint_question_bank (group_number, question) WHERE group_number IS NOT NULL;

-- Group-scoped PM additions; shared sprint questions remain course-wide.
CREATE TABLE IF NOT EXISTS test_sprint_group_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id uuid NOT NULL REFERENCES test_sprints(id) ON DELETE CASCADE,
  group_number integer NOT NULL,
  additional_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (sprint_id, group_number)
);
ALTER TABLE test_sprint_group_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_sprint_question_bank ADD COLUMN IF NOT EXISTS group_number integer;
ALTER TABLE test_sprint_question_bank DROP CONSTRAINT IF EXISTS test_sprint_question_bank_question_key;
CREATE UNIQUE INDEX IF NOT EXISTS test_sprint_question_bank_shared_question
  ON test_sprint_question_bank (question) WHERE group_number IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS test_sprint_question_bank_group_question
  ON test_sprint_question_bank (group_number, question) WHERE group_number IS NOT NULL;

-- Previously bank authors were recorded, so their questions can be scoped to
-- their currently assigned group. Shared sprint arrays have no authorship data.
UPDATE sprint_question_bank q SET group_number = u.group_number
FROM users u WHERE q.created_by = u.net_id AND u.role IN ('PM', 'WEB')
  AND u.group_number IS NOT NULL AND q.group_number IS NULL;
UPDATE test_sprint_question_bank q SET group_number = u.group_number
FROM test_users u WHERE q.created_by = u.net_id AND u.role IN ('PM', 'WEB')
  AND u.group_number IS NOT NULL AND q.group_number IS NULL;

COMMIT;
