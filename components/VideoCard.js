"use client";

import { VideoIcon } from "@phosphor-icons/react";
import MediaCard from "./MediaCard";

export default function VideoCard({ project }) {
  return <MediaCard project={project} href={project.videoUrl} linkLabel="Watch Video" icon={VideoIcon} />;
}
