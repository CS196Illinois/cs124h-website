"use client";

import { GithubLogo } from "@phosphor-icons/react";
import MediaCard from "./MediaCard";

export default function ProjectCard({ project }) {
  return <MediaCard project={project} href={project.githubUrl} linkLabel="View on GitHub" icon={GithubLogo} />;
}
