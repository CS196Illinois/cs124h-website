-- Shared understanding-check question bank. Run against both test and
-- production Supabase schemas before using the bank UI.
CREATE TABLE IF NOT EXISTS test_sprint_question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL UNIQUE,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sprint_question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL UNIQUE,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sprint_question_bank ENABLE ROW LEVEL SECURITY;
INSERT INTO sprint_question_bank (question, created_by) VALUES
 ('What design decisions did you make this week, and why?', 'system'),
 ('What alternative approaches did you consider, and why didn''t you choose them?', 'system'),
 ('How well did your work this week integrate with the rest of your group''s work?', 'system')
ON CONFLICT DO NOTHING;
INSERT INTO test_sprint_question_bank (question, created_by)
SELECT question, created_by FROM sprint_question_bank
ON CONFLICT DO NOTHING;
