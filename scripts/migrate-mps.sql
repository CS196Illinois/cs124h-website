-- Run in Supabase SQL editor before deploying the MP list.
-- Safe to run more than once.
-- One row per MP. The home page shows an MP as current between release_at
-- and due_at, and lists its due date under deadlines. Times are timestamptz;
-- enter them in Chicago time (e.g. '2027-02-14 23:59 America/Chicago').

-- Production MPs
CREATE TABLE IF NOT EXISTS mps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,       -- shown as "MP <name>", e.g. "MP NeuralNet"
  release_at        timestamptz,
  due_at            timestamptz NOT NULL,
  prairielearn_url  text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Test MPs (for automated test suite)
CREATE TABLE IF NOT EXISTS test_mps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,       -- shown as "MP <name>", e.g. "MP NeuralNet"
  release_at        timestamptz,
  due_at            timestamptz NOT NULL,
  prairielearn_url  text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
