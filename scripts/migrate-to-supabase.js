/**
 * Migration script: uploads local images to Supabase Storage and seeds
 * the staff, projects, and resources tables from the local JSON data files.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-to-supabase.js
 *
 * Run scripts/supabase-setup.sql in the Supabase SQL editor first.
 */

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".JPG": "image/jpeg",
  ".JPEG": "image/jpeg",
  ".png": "image/png",
  ".PNG": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const STORAGE_BASE = `${supabaseUrl}/storage/v1/object/public`;

/**
 * Given a JSON image path like /images/staff-images/spring-2026/mg90.webp,
 * returns { bucket, storagePath, localPath } or null for external/placeholder URLs.
 */
function resolveImage(jsonPath) {
  if (!jsonPath || jsonPath.startsWith("http")) return null;

  const rel = jsonPath.startsWith("/") ? jsonPath.slice(1) : jsonPath;
  const localPath = path.join(PUBLIC_DIR, rel);

  if (rel.startsWith("images/staff-images/")) {
    const storagePath = rel.replace("images/staff-images/", "");
    return { bucket: "staff-images", storagePath, localPath };
  }
  if (rel.startsWith("images/video-thumbnails/")) {
    const storagePath = rel.replace("images/", "");
    return { bucket: "site-images", storagePath, localPath };
  }
  if (rel.startsWith("images/")) {
    const filename = path.basename(rel);
    return { bucket: "site-images", storagePath: `projects/${filename}`, localPath };
  }
  return null;
}

async function uploadImage(bucket, storagePath, localPath) {
  if (!fs.existsSync(localPath)) {
    console.warn(`  SKIP (not found): ${localPath}`);
    return null;
  }

  const ext = path.extname(localPath);
  const contentType = MIME[ext] || "application/octet-stream";
  const fileBuffer = fs.readFileSync(localPath);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, { contentType, upsert: true });

  if (error) {
    console.error(`  ERROR uploading ${storagePath}: ${error.message}`);
    return null;
  }

  return `${STORAGE_BASE}/${bucket}/${storagePath}`;
}

async function resolveAndUpload(jsonPath) {
  const info = resolveImage(jsonPath);
  if (!info) return jsonPath; // keep external URLs as-is
  const url = await uploadImage(info.bucket, info.storagePath, info.localPath);
  return url ?? jsonPath; // fall back to original if upload failed
}

async function ensureBucket(name) {
  const { error } = await supabase.storage.createBucket(name, { public: true });
  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw new Error(`Failed to create bucket '${name}': ${error.message}`);
  }
  console.log(`Bucket '${name}' ready`);
}

async function clearTable(table) {
  const { error } = await supabase.from(table).delete().gte("id", 0);
  if (error) throw new Error(`Failed to clear '${table}': ${error.message}`);
}

// ── Staff ────────────────────────────────────────────────────────────────────

async function migrateStaff() {
  console.log("\n=== Staff ===");
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "staff_data.json"), "utf-8"));
  const semesters = raw.data;

  await clearTable("staff");

  for (let semIdx = 0; semIdx < semesters.length; semIdx++) {
    const { semester, staff } = semesters[semIdx];
    console.log(`Semester: ${semester}`);

    for (let memIdx = 0; memIdx < staff.length; memIdx++) {
      const m = staff[memIdx];
      const imageUrl = await resolveAndUpload(m.image);

      const { error } = await supabase.from("staff").insert({
        semester,
        semester_order: semIdx,
        member_order: memIdx,
        name: m.name,
        role: m.role || null,
        image_url: imageUrl || null,
        year: m.year || null,
        major: m.major || null,
        semesters_count: m.semesters || null,
        bio: m.bio || null,
        email: m.email || null,
      });

      if (error) console.error(`  ERROR: ${m.name} — ${error.message}`);
      else console.log(`  ✓ ${m.name}`);
    }
  }
}

// ── Projects ─────────────────────────────────────────────────────────────────

async function migrateProjects() {
  console.log("\n=== Projects ===");
  const projectsData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "projects_data.json"), "utf-8"));

  await clearTable("projects");

  for (let semIdx = 0; semIdx < projectsData.length; semIdx++) {
    const { semester, data: projects } = projectsData[semIdx];
    console.log(`Semester: ${semester}`);

    for (let projIdx = 0; projIdx < projects.length; projIdx++) {
      const p = projects[projIdx];
      const imageUrl = await resolveAndUpload(p.imageUrl);

      const { error } = await supabase.from("projects").insert({
        semester,
        semester_order: semIdx,
        project_order: projIdx,
        title: p.title,
        members: p.members ?? [],
        description: p.description || null,
        github_url: p.githubUrl || null,
        image_url: imageUrl || null,
      });

      if (error) console.error(`  ERROR: ${p.title} — ${error.message}`);
      else console.log(`  ✓ ${p.title}`);
    }
  }
}

// ── Resources ────────────────────────────────────────────────────────────────

async function migrateResources() {
  console.log("\n=== Resources ===");
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "lecture_content_data.json"), "utf-8"));

  await clearTable("resources");

  const blogPosts = raw["Blog Posts"] ?? [];
  for (let i = 0; i < blogPosts.length; i++) {
    const p = blogPosts[i];
    const imageUrl = await resolveAndUpload(p.imageUrl);

    const { error } = await supabase.from("resources").insert({
      type: "blog_post",
      item_order: i,
      title: p.title,
      members: p.members ?? [],
      description: p.description || null,
      external_url: p.githubUrl || null,
      image_url: imageUrl || null,
    });

    if (error) console.error(`  ERROR: ${p.title} — ${error.message}`);
    else console.log(`  ✓ [blog] ${p.title}`);
  }

  const presentations = raw["Staff Technical Presentations"] ?? [];
  for (let i = 0; i < presentations.length; i++) {
    const p = presentations[i];
    const imageUrl = await resolveAndUpload(p.imageUrl);

    const { error } = await supabase.from("resources").insert({
      type: "presentation",
      item_order: i,
      title: p.title,
      members: p.members ?? [],
      description: null,
      external_url: p.videoUrl || null,
      image_url: imageUrl || null,
    });

    if (error) console.error(`  ERROR: ${p.title} — ${error.message}`);
    else console.log(`  ✓ [pres] ${p.title}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Starting Supabase migration…");

  await ensureBucket("staff-images");
  await ensureBucket("site-images");

  await migrateStaff();
  await migrateProjects();
  await migrateResources();

  console.log("\n✅ Migration complete!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
