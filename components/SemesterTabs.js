import styles from "./SemesterTabs.module.css";

export default function SemesterTabs({ semesters, selectedSemester, onSelectSemester }) {
  return (
    <div className={styles.tabs} aria-label="Semester">
      {semesters.map((semester, index) => (
        <button
          key={semester}
          type="button"
          onClick={() => onSelectSemester(index)}
          aria-pressed={selectedSemester === index}
          className={`${styles.tab} ${selectedSemester === index ? styles.active : ""}`}
        >
          {semester}
        </button>
      ))}
    </div>
  );
}
