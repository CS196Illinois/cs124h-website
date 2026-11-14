"use client";

import MediaCard from "./MediaCard";

export default function ProjectCard({ project }) {
  return <MediaCard project={project} href={project.githubUrl} linkLabel="View on GitHub" />;
}
