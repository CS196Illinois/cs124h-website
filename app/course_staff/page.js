"use client";

import { useState, useEffect, useRef } from "react";
import PublicImage from "../../components/PublicImage";
import StaffCard from "../../components/StaffCard";
import SemesterTabs from "../../components/SemesterTabs";
import styles from "./CourseStaff.module.css";

// Leads come first, in this order; everyone else is a Project Manager.
const LEAD_ROLES = ["Course Lead", "Head Project Manager", "Lead Web Developer", "Web Developer"];
const leadRank = (role) => {
  const i = LEAD_ROLES.indexOf(role);
  return i === -1 ? LEAD_ROLES.length : i;
};

function toMember(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    image: row.image_url,
    year: row.year,
    major: row.major,
    semesters: row.semesters_count,
    bio: row.bio,
    email: row.email,
  };
}

function StaffDialog({ member, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => { closeRef.current?.focus(); }, []);

  const details = [
    ["Year", member.year],
    ["Major", member.major],
    ["Semesters on staff", member.semesters],
    ["Email", member.email && <a href={`mailto:${member.email}`}>{member.email}</a>],
  ].filter(([, value]) => value);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="member-name" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close">
          &times;
        </button>
        {member.image && (
          <div className={styles.dialogPhoto}>
            <PublicImage src={member.image} alt={member.name} width={480} height={600} sizes="(max-width: 700px) 60vw, 260px" />
          </div>
        )}
        <div className={styles.dialogText}>
          <h2 id="member-name">{member.name}</h2>
          <p className={styles.dialogRole}>{member.role}</p>
          {details.length > 0 && (
            <dl className={styles.details}>
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {member.bio && <p className={styles.bio}>{member.bio}</p>}
        </div>
      </div>
    </div>
  );
}

export default function CourseStaffPage() {
  const [semestersData, setSemestersData] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedSemesterIndex, setSelectedSemesterIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await fetch("/api/public/staff").catch(() => null);
      const data = res?.ok ? await res.json() : null;
      if (!mounted) return;
      if (data) {
        const bySemester = new Map();
        for (const row of data) {
          if (!bySemester.has(row.semester)) bySemester.set(row.semester, []);
          bySemester.get(row.semester).push(toMember(row));
        }
        setSemestersData([...bySemester.entries()].map(([semester, staff]) => ({ semester, staff })));
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // Escape closes the dialog; the page behind it doesn't scroll.
  useEffect(() => {
    if (!selectedMember) return;
    const onKeyDown = (e) => e.key === "Escape" && setSelectedMember(null);
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedMember]);

  const index = selectedSemesterIndex < semestersData.length ? selectedSemesterIndex : 0;
  const people = semestersData[index]?.staff ?? [];
  const leads = people.filter((m) => leadRank(m.role) < LEAD_ROLES.length).sort((a, b) => leadRank(a.role) - leadRank(b.role));
  const pms = people.filter((m) => leadRank(m.role) === LEAD_ROLES.length);

  return (
    <main className="page">
      <header className="pageHeading">
        <h1>Course Staff</h1>
        <p>The students who run CS 124 Honors. Select anyone to learn more about them.</p>
      </header>

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton" style={{ aspectRatio: "4/5", borderRadius: "8px", marginBottom: "0.5rem" }} />
              <div className="skeleton" style={{ height: "0.9rem", width: "70%" }} />
            </div>
          ))}
        </div>
      ) : semestersData.length === 0 ? (
        <p className={styles.empty}>The staff list hasn&apos;t been posted yet.</p>
      ) : (
        <>
          <SemesterTabs
            semesters={semestersData.map((s) => s.semester)}
            selectedSemester={index}
            onSelectSemester={(i) => { setSelectedSemesterIndex(i); setSelectedMember(null); }}
          />

          {leads.length > 0 && (
            <section aria-labelledby="leads-heading" className={styles.group}>
              <h2 id="leads-heading">Leads</h2>
              <div className={styles.grid}>
                {leads.map((m) => <StaffCard key={m.id ?? m.name} member={m} onClick={setSelectedMember} showRole />)}
              </div>
            </section>
          )}

          {pms.length > 0 && (
            <section aria-labelledby="pms-heading" className={styles.group}>
              <h2 id="pms-heading">Project managers <span>{pms.length}</span></h2>
              <div className={styles.grid}>
                {pms.map((m) => <StaffCard key={m.id ?? m.name} member={m} onClick={setSelectedMember} />)}
              </div>
            </section>
          )}
        </>
      )}

      {selectedMember && <StaffDialog member={selectedMember} onClose={() => setSelectedMember(null)} />}
    </main>
  );
}
