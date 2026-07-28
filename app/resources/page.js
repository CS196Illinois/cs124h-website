import styles from "./Resources.module.css";
import BlogPostCard from "../../components/BlogPostCard.js";
import VideoCard from "../../components/VideoCard.js";
import { getSupabaseServer } from "../../lib/supabaseServer";
import { table } from "../../lib/tables";

export default async function ResourcesPage() {
  const supabase = getSupabaseServer();
  const { data } = await supabase
    .from(table("resources"))
    .select("*")
    .order("item_order", { ascending: true });

  const rows = data ?? [];

  const blogPosts = rows
    .filter((r) => r.type === "blog_post")
    .map((r) => ({
      id: r.id,
      title: r.title,
      members: r.members,
      description: r.description,
      githubUrl: r.external_url,
      imageUrl: r.image_url,
    }));

  const staffPresentations = rows
    .filter((r) => r.type === "presentation")
    .map((r) => ({
      id: r.id,
      title: r.title,
      members: r.members,
      videoUrl: r.external_url,
      imageUrl: r.image_url,
    }));

  return (
    <div className={`${styles.pageContainer} pageContainer`}>
      <main className={styles.mainContent}>
        <div className={styles.resourceSection}>
          <div className={styles.header}>
            <h1 className={styles.title}>Lecture Videos</h1>
          </div>

          <div className={styles.projectGrid}>
            {staffPresentations.map((project) => (
              <VideoCard key={project.id} project={project} />
            ))}
          </div>
        </div>

        <div className={styles.resourceSection}>
          <div className={styles.header}>
            <h1 className={styles.title}>Blog Posts</h1>
          </div>

          <div className={styles.projectGrid}>
            {blogPosts.map((project) => (
              <BlogPostCard key={project.id} project={project} />
            ))}
          </div>
        </div>

        <div className={styles.resourceVault}>
          <div className={styles.header}>
            <h1 className={styles.title}>Resource Vault</h1>
            <p className={styles.vaultDescription}>
              {" "}
              The CS124 Honors resource vault is a Notion page created to keep
              track of useful external resources that Project Managers and their
              students have accumulated in various subtopics over the semesters.
              This Notion page is publicly accessible{" "}
              <a
                href="https://typhoon-lifter-1e1.notion.site/CS124H-Resource-Vault-1adbec204dee8026a3ccd51e7e260f04"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#0070f3", textDecoration: "underline" }}
              >
                here.
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
