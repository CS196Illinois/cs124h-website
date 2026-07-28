"use client";

import React, { useState, useEffect } from "react";
import styles from "./HallOfFame.module.css";
import SemesterTabs from "../../components/SemesterTabs.js";
import ProjectCard from "../../components/ProjectCard.js";

function ProjectCardSkeleton() {
  return (
    <div style={{ borderRadius: "12px", overflow: "hidden", background: "rgba(255,255,255,0.05)" }}>
      <div className="skeleton" style={{ width: "100%", aspectRatio: "3/2" }} />
      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <div className="skeleton" style={{ height: "1rem", width: "70%" }} />
        <div className="skeleton" style={{ height: "0.7rem", width: "45%" }} />
        <div className="skeleton" style={{ height: "0.7rem", width: "100%", marginTop: "0.25rem" }} />
        <div className="skeleton" style={{ height: "0.7rem", width: "85%" }} />
        <div className="skeleton" style={{ height: "0.7rem", width: "60%" }} />
        <div className="skeleton" style={{ height: "2rem", width: "100%", marginTop: "0.5rem", borderRadius: "8px" }} />
      </div>
    </div>
  );
}

export default function HallOfFamePage() {
  const [semestersData, setSemestersData] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const res = await fetch("/api/public/projects");
      const data = res.ok ? await res.json() : null;

      if (!mounted) return;

      if (data) {
        const semesterMap = new Map();
        data.forEach((row) => {
          if (!semesterMap.has(row.semester)) semesterMap.set(row.semester, []);
          semesterMap.get(row.semester).push({
            id: row.id,
            title: row.title,
            members: row.members,
            description: row.description,
            githubUrl: row.github_url,
            imageUrl: row.image_url,
          });
        });
        const result = [...semesterMap.entries()].map(([semester, data]) => ({ semester, data }));
        setSemestersData(result);
      }
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, []);

  const semesters = semestersData.map((e) => e.semester);
  const projects = semestersData[selectedSemester]?.data ?? [];

  return (
    <div className={`${styles.pageContainer} pageContainer`}>
      <main className={styles.mainContent}>
        <div className={styles.header}>
          <h1 className={styles.title}>Welcome to the Hall of Fame!</h1>
        </div>

        {loading ? (
          <>
            {/* Semester tab skeletons */}
            <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "3rem", flexWrap: "wrap" }}>
              {[1, 2].map((i) => (
                <div key={i} className="skeleton" style={{ width: "130px", height: "42px", borderRadius: "8px" }} />
              ))}
            </div>

            {/* Project card skeletons */}
            <div className={styles.projectGrid}>
              {Array.from({ length: 4 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          </>
        ) : (
          <>
            <SemesterTabs
              semesters={semesters}
              selectedSemester={selectedSemester}
              onSelectSemester={setSelectedSemester}
            />

            {projects.length > 0 ? (
              <div className={styles.projectGrid}>
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <p className={styles.noProjects}>No projects found for this semester.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
