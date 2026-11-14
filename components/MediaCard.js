"use client";

import PublicImage from "./PublicImage";
import styles from "./ProjectCard.module.css";

// Seeded rows use placehold.co stand-ins; show those as "no image".
const realImage = (src) => (src && !/placehold\.co/.test(src) ? src : null);

/** A project or video: image, title, people, description, one link. */
export default function MediaCard({ project, href, linkLabel }) {
  const image = realImage(project.imageUrl);
  return (
    <article className={styles.card}>
      <div className={styles.media}>
        {image ? (
          <PublicImage
            width={640}
            height={400}
            sizes="(max-width: 640px) 100vw, (max-width: 1040px) 50vw, 340px"
            src={image}
            alt=""
            onError={(e) => { e.currentTarget.hidden = true; }}
          />
        ) : (
          <span className={styles.noImage} aria-hidden="true">{project.title.slice(0, 1)}</span>
        )}
      </div>
      <h3 className={styles.title}>{project.title}</h3>
      {Array.isArray(project.members) && project.members.length > 0 && (
        <p className={styles.members}>{project.members.join(", ")}</p>
      )}
      {project.description && <p className={styles.description}>{project.description}</p>}
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>
          {linkLabel}
        </a>
      )}
    </article>
  );
}
