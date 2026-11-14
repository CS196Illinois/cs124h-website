-- Run in Supabase SQL editor before deploying event categories.
-- Safe to run more than once.
-- category: one of lib/eventCategories.js EVENT_CATEGORIES ids (workshop,
-- group_meeting, info_session, social, staff_meeting, other). Null means
-- "work it out from the audience" (see eventCategory()).

-- Production events
ALTER TABLE events ADD COLUMN IF NOT EXISTS category text;

-- Test events (for automated test suite)
ALTER TABLE test_events ADD COLUMN IF NOT EXISTS category text;

-- series_id: shared by every event created together as a weekly recurring
-- series, so the series can be found (and removed) as a unit. Null for
-- one-off events.
ALTER TABLE events ADD COLUMN IF NOT EXISTS series_id uuid;
ALTER TABLE test_events ADD COLUMN IF NOT EXISTS series_id uuid;
CREATE INDEX IF NOT EXISTS events_series_id_idx ON events (series_id);
