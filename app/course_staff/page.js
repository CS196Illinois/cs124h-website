"use client";

import React, { useState, useEffect } from "react";
import StaffCard from "../../components/StaffCard";
import SemesterTabs from "../../components/SemesterTabs";
import styles from "./CourseStaff.module.css";

export default function CourseStaffPage() {
  const [semestersData, setSemestersData] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedSemesterIndex, setSelectedSemesterIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const res = await fetch("/api/public/staff");
      const data = res.ok ? await res.json() : null;

      if (!mounted) return;

      if (data) {
        const semesterMap = new Map();
        data.forEach((row) => {
          if (!semesterMap.has(row.semester)) semesterMap.set(row.semester, []);
          semesterMap.get(row.semester).push({
            id: row.id,
            name: row.name,
            role: row.role,
            image: row.image_url,
            year: row.year,
            major: row.major,
            semesters: row.semesters_count,
            bio: row.bio,
            email: row.email,
          });
        });

        const semesters = [...semesterMap.entries()].map(([semester, staff]) => ({
          semester,
          staff,
        }));
        setSemestersData(semesters);
      }
      setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, []);

  // Lock scroll & enable ESC to close when modal is open
  useEffect(() => {
    if (!selectedMember) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedMember]);

  const openModal = (member) => setSelectedMember(member);
  const closeModal = () => setSelectedMember(null);

  if (loading) {
    return (
      <div className={`${styles.pageContainer} pageContainer`}>
        <main className={styles.mainContent}>
          <div className={styles.header}>
            <h1 className={`${styles.title}`}>Our Staff</h1>
          </div>
          {/* Semester tab skeletons */}
          <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", marginBottom: "3rem", flexWrap: "wrap" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ width: "130px", height: "42px", borderRadius: "8px" }} />
            ))}
          </div>
          {/* Staff card skeletons */}
          <div className={styles.staffCardContainer}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ aspectRatio: "4/5", borderRadius: "1.5rem" }} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!semestersData?.length) return null;

  const getPeople = (semesterObj) => {
    if (!semesterObj) return [];
    if (Array.isArray(semesterObj.data)) return semesterObj.data;
    if (Array.isArray(semesterObj.staff)) return semesterObj.staff;
    return [];
  };

  const semesterTitles = semestersData.map((s) => s.semester);

  // Guarded index
  const safeSemesterIndex =
    selectedSemesterIndex >= 0 && selectedSemesterIndex < semestersData.length
      ? selectedSemesterIndex
      : 0;

  const currentSemester = semestersData[safeSemesterIndex];
  const people = getPeople(currentSemester);

  return (
    <div className={`${styles.pageContainer} pageContainer`}>
      <main className={styles.mainContent}>
        <div className={styles.header}>
          <h1 className={`${styles.title} ${selectedMember ? styles.opacity20 : styles.opacity100}`}>
            Our Staff
          </h1>
        </div>

        <SemesterTabs
          semesters={semesterTitles}
          selectedSemester={safeSemesterIndex}
          onSelectSemester={(index) => {
            setSelectedSemesterIndex(index);
            if (selectedMember) closeModal();
          }}
        />

        <div
          className={`${styles.staffCardContainer} ${selectedMember ? styles.opacity20 : styles.opacity100}`}
        >
          {people.map((member) => (
            <StaffCard key={member.id ?? member.name} member={member} onClick={openModal} />
          ))}
        </div>

        {selectedMember && (
          <div
            className={styles.popup}
            onClick={closeModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-name"
          >
            <div className={styles.popupContent} onClick={(e) => e.stopPropagation()} role="document">
              <button className={styles.close} onClick={closeModal} aria-label="Close">
                &times;
              </button>

              <div className={styles.imagePopup}>
                <img src={selectedMember.image} alt={selectedMember.name} />
              </div>

              <div className={styles.textContent}>
                <h2 id="member-name">{selectedMember.name}</h2>
                <p className={styles.role}>{selectedMember.role}</p>

                <div className={styles.staffDetails}>
                  <div className={styles.detailItem}>
                    <div className={styles.label}>Year:</div>
                    <div className={styles.value}>{selectedMember.year || "N/A"}</div>
                  </div>

                  <div className={styles.detailItem}>
                    <div className={styles.label}>Major:</div>
                    <div className={styles.value}>{selectedMember.major || "N/A"}</div>
                  </div>

                  <div className={styles.detailItem}>
                    <div className={styles.label}>Semesters as PM:</div>
                    <div className={styles.value}>{selectedMember.semesters || "N/A"}</div>
                  </div>

                  {selectedMember.email && (
                    <div className={styles.detailItem}>
                      <div className={styles.label}>UIUC Email:</div>
                      <div className={styles.value}>{selectedMember.email}</div>
                    </div>
                  )}
                </div>

                <div className={styles.bioSection}>
                  <div className={styles.bio}>{selectedMember.bio}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}