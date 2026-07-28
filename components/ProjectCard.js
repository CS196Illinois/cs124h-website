import styles from "./ProjectCard.module.css";
import { GithubLogo } from "@phosphor-icons/react";

export default function ProjectCard({ project }) {
  return (
    <div className={styles.projectCard}>
      <img
        src={project.imageUrl}
        alt={`${project.title} Placeholder`}
        className={styles.cardImage}
        // Basic fallback using placeholder service URL structure
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = `https://placehold.co/600x400/cccccc/ffffff?text=Image+Error`;
        }}
      />
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
          <GithubLogo
            size={16}
            style={{ marginRight: "8px", transform: "scale(1)" }}
            className={styles.githubIcon}
          />
          View on GitHub
        </a>
      </div>
    </div>
  );
};