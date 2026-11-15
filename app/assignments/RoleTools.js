"use client";

import SprintsManager from "../../components/SprintsManager";
import UnderstandingCheckPanel from "../../components/UnderstandingCheckPanel";
import GradebookAll from "../../components/staff/GradebookAll";
import GradebookGroup from "../../components/staff/GradebookGroup";
import styles from "./Assignments.module.css";

/**
 * Staff tools on the Assignments page. Course leads and head PMs work across
 * every group; a PM works with their own group. The APIs enforce the same
 * limits; this only decides what to show.
 */
export default function RoleTools({ role }) {
  const allGroups = role === "course_lead" || role === "head_pm";
  if (!allGroups && role !== "pm") return null;

  return (
    <>
      <section id="manage-sprints" className={styles.tool} aria-labelledby="manage-sprints-heading">
        <h2 id="manage-sprints-heading">Manage sprints</h2>
        <p className={styles.toolLede}>
          {role === "course_lead"
            ? "Create and edit sprints, their goals, and understanding check questions. Open and grade checks for any group."
            : role === "head_pm"
              ? "Edit sprints and grade any group's understanding checks."
              : "Open your group's understanding check during your weekly meeting, then grade it. You can add your own questions."}
        </p>
        <SprintsManager
          canManage={allGroups}
          canManageQuestions={allGroups || role === "pm"}
          canManageQuestionBank={role === "course_lead"}
          renderExtra={(sprint) => <UnderstandingCheckPanel sprint={sprint} scope={allGroups ? "all-groups" : "my-group"} />}
        />
      </section>

      <section id="gradebook" className={styles.tool}>
        {allGroups ? <GradebookAll /> : <GradebookGroup />}
      </section>
    </>
  );
}
