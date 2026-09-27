"use client";

import PublicImage from "./PublicImage";
import styles from "./ProjectCard.module.css";

export default function MediaCard({ project, href, linkLabel, icon: Icon }) {
  return (
    <div className={styles.projectCard}>
      {project.imageUrl && <PublicImage
        width={640}
        height={360}
        sizes="(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 400px"
        src={project.imageUrl}
        alt={project.title}
        className={styles.cardImage}
        onError={(e) => {
          e.currentTarget.hidden = true;
        }}
      />}
      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>{project.title}</h3>
        {Array.isArray(project.members) && project.members.length > 0 && (
          <p className={styles.cardMembers}>By: {project.members.join(", ")}</p>
        )}
        <p className={styles.cardDescription}>{project.description}</p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.githubButton}
        >
          <Icon
            size={16}
            style={{ marginRight: "8px" }}
            className={styles.githubIcon}
          />
          {linkLabel}
        </a>
      </div>
    </div>
  );
}
