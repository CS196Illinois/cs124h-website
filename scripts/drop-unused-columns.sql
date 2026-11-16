-- Removes event columns nothing reads any more, and tidies two kinds of
-- stale "open" flags. Run in the Supabase SQL editor. Safe to run more than once.
--
-- ORDER MATTERS: run this only after the live site is on code that no longer
-- reads these columns (this branch, or main with the production-state fix).
-- Older main code selects point_value when listing events and would break.

-- ── Unused event columns ───────────────────────────────────────────────────
-- point_value:          attendance points were never used; nothing reads it.
-- qr_code_secret:       check-in codes are derived from ATTENDANCE_SECRET.
-- checked_in_students:  check-ins live in event_checkins.
-- is_active:            never set to false; events are deleted instead.
-- join_link:            never set.
ALTER TABLE events DROP COLUMN IF EXISTS point_value;
ALTER TABLE events DROP COLUMN IF EXISTS qr_code_secret;
ALTER TABLE events DROP COLUMN IF EXISTS checked_in_students;
ALTER TABLE events DROP COLUMN IF EXISTS is_active;
ALTER TABLE events DROP COLUMN IF EXISTS join_link;
ALTER TABLE test_events DROP COLUMN IF EXISTS point_value;
ALTER TABLE test_events DROP COLUMN IF EXISTS qr_code_secret;
ALTER TABLE test_events DROP COLUMN IF EXISTS checked_in_students;
ALTER TABLE test_events DROP COLUMN IF EXISTS is_active;
ALTER TABLE test_events DROP COLUMN IF EXISTS join_link;

-- ── Stale open flags ───────────────────────────────────────────────────────
-- The app already treats these as closed (check-in closes an hour after an
-- event ends; an understanding check closes 3 hours after it's opened). This
-- just makes the stored rows say so too.
UPDATE events SET check_in_open = false
  WHERE check_in_open AND end_time + interval '1 hour' <= now();
UPDATE sprint_check_windows SET is_open = false, closed_at = opened_at + interval '3 hours', closed_by = 'auto'
  WHERE is_open AND (opened_at IS NULL OR opened_at + interval '3 hours' <= now());
