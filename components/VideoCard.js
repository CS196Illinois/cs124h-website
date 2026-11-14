"use client";

import MediaCard from "./MediaCard";

export default function VideoCard({ project }) {
  return <MediaCard project={project} href={project.videoUrl} linkLabel="Watch the video" />;
}
