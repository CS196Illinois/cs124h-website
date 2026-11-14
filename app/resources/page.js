import styles from "./Resources.module.css";
import VideoCard from "../../components/VideoCard.js";
import { getSupabaseServer } from "../../lib/supabaseServer";
import { table } from "../../lib/tables";
import { SITE } from "../../lib/siteConfig";

export const metadata = { title: "Resources" };

// Server-rendered from Supabase at build time; without this, edits to the
// resources table would need a full redeploy to ever show up.
export const revalidate = 60;

const external = { target: "_blank", rel: "noopener noreferrer" };

async function getResources() {
  try {
    const { data } = await getSupabaseServer()
      .from(table("resources"))
      .select("*")
      .order("item_order", { ascending: true });
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function ResourcesPage() {
  const rows = await getResources();

  const videos = rows
    .filter((r) => r.type === "presentation")
    .map((r) => ({ id: r.id, title: r.title, members: r.members, videoUrl: r.external_url, imageUrl: r.image_url }));
  const posts = rows.filter((r) => r.type === "blog_post");

  return (
    <main className="page">
      <header className="pageHeading">
        <h1>Resources</h1>
        <p>Lecture videos, blog posts, and links collected by PMs and students.</p>
      </header>

      <section aria-labelledby="videos-heading" className={styles.section}>
        <h2 id="videos-heading">Lecture videos</h2>
        {videos.length ? (
          <div className={styles.videoGrid}>
            {videos.map((video) => <VideoCard key={video.id} project={video} />)}
          </div>
        ) : (
          <p className={styles.empty}>No lecture videos have been posted yet.</p>
        )}
      </section>

      <section aria-labelledby="posts-heading" className={styles.section}>
        <h2 id="posts-heading">Blog posts</h2>
        {posts.length ? (
          <ul className={styles.posts}>
            {posts.map((post) => (
              <li key={post.id}>
                <a href={post.external_url} {...external} className={styles.postTitle}>{post.title}</a>
                {Array.isArray(post.members) && post.members.length > 0 && (
                  <span className={styles.postBy}>{post.members.join(", ")}</span>
                )}
                {post.description && <p>{post.description}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>No blog posts have been posted yet.</p>
        )}
      </section>

      <section aria-labelledby="vault-heading" className={styles.section}>
        <h2 id="vault-heading">Resource vault</h2>
        <p className={styles.vault}>
          A public Notion page of outside resources that PMs and students have collected over the semesters, sorted by
          topic. <a href={SITE.links.resourceVault} {...external}>Open the resource vault</a>.
        </p>
      </section>
    </main>
  );
}
