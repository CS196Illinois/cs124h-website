-- Run in Supabase SQL editor before deploying event hosts.
-- Safe to run more than once.
-- hosts: NetIDs of staff who can open/close check-in, see the code and
-- attendees, and do manual check-ins alongside the event's creator.

-- Production events
ALTER TABLE events ADD COLUMN IF NOT EXISTS hosts jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Test events (for automated test suite)
ALTER TABLE test_events ADD COLUMN IF NOT EXISTS hosts jsonb NOT NULL DEFAULT '[]'::jsonb;
