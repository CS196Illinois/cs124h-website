"use client";

import styles from "./ProjectCard.module.css";
import { NoteIcon } from "@phosphor-icons/react";

export default function BlogPostCard({ project }) {
  return (
    <div className={styles.projectCard}>
      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>{project.title}</h3>
        <p className={styles.cardMembers}>By: {project.members.join(", ")}</p>
        <p className={styles.cardDescription}>{project.description}</p>
        <a
          href={project.githubUrl}
          target="_blank" // just opens the link in a new tab
          rel="noopener noreferrer"
          className={styles.githubButton}
        >
          {/* Use inline style for icon size/margin or wrap in a styled span if needed */}
          <NoteIcon
            size={16}
            style={{ marginRight: "8px", transform: "scale(1)" }}
            className={styles.githubIcon}
          />
          View on Medium
        </a>
      </div>
    </div>
  );
};