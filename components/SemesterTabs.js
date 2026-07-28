import styles from "./SemesterTabs.module.css";

export default function SemesterTabs({ semesters, selectedSemester, onSelectSemester }) {
  return (
    <div className={styles.tabsContainer}>
      {semesters.map((semester, index) => (
        <button
          key={semester}
          onClick={() => onSelectSemester(index)}
          className={`${styles.tabButton} ${
            selectedSemester === index ? styles.activeTab : ""
          }`}
        >
          {semester}
        </button>
      ))}
    </div>
  );
};