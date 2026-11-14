-- Run in Supabase SQL editor after deploying the code that removes the web
-- developer role, sandbox mode, and role-view requests. Safe to run more
-- than once.
--
-- Removes the tables and column only those features used, and makes the
-- database reject any role the app doesn't know (WEB included).

-- Role-view requests (web devs asking to preview other roles' dashboards)
DROP TABLE IF EXISTS role_view_requests;
DROP TABLE IF EXISTS test_role_view_requests;

-- Sandbox overlay (web devs' private copies of rows)
DROP TABLE IF EXISTS sandbox_overlay;
DROP TABLE IF EXISTS test_sandbox_overlay;

-- Per-user sandbox setting
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_sandbox_mode_check;
ALTER TABLE users DROP COLUMN IF EXISTS sandbox_mode;
ALTER TABLE test_users DROP CONSTRAINT IF EXISTS test_users_sandbox_mode_check;
ALTER TABLE test_users DROP COLUMN IF EXISTS sandbox_mode;

-- Only known roles. Fails (and changes nothing) if any WEB account is left;
-- remove or reassign it first.
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('LEAD', 'LEAD_WEB', 'HEAD', 'PM', 'STUDENT'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE test_users ADD CONSTRAINT test_users_role_check CHECK (role IN ('LEAD', 'LEAD_WEB', 'HEAD', 'PM', 'STUDENT'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
