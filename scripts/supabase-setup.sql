-- Run this in the Supabase SQL editor BEFORE running the migration script.

-- Staff members per semester
CREATE TABLE IF NOT EXISTS staff (
  id BIGSERIAL PRIMARY KEY,
  semester TEXT NOT NULL,
  semester_order INTEGER NOT NULL DEFAULT 0,
  member_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  role TEXT,
  image_url TEXT,
  year TEXT,
  major TEXT,
  semesters_count TEXT,
  bio TEXT,
  email TEXT
);

-- Hall of Fame projects per semester
CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  semester TEXT NOT NULL,
  semester_order INTEGER NOT NULL DEFAULT 0,
  project_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  members TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  github_url TEXT,
  image_url TEXT
);

-- Resources: blog posts and staff presentations
CREATE TABLE IF NOT EXISTS resources (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('blog_post', 'presentation')),
  item_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  members TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  external_url TEXT,
  image_url TEXT
);

-- Enable RLS
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "public_read_staff" ON staff FOR SELECT USING (true);
CREATE POLICY "public_read_projects" ON projects FOR SELECT USING (true);
CREATE POLICY "public_read_resources" ON resources FOR SELECT USING (true);
