import React from "react";
import "./global.css";
import styles from "./home.module.css";
import Image from "next/image";
import Link from "next/link";
import { getSupabaseServer } from "../lib/supabaseServer";
import { table } from "../lib/tables";

// Server-rendered from Supabase at build time; without this, roster changes
// (e.g. a new course lead) would need a full redeploy to ever show up here -
// which is exactly what caused this to go stale after the last deploy.
export const revalidate = 60;

export default async function Home() {
  let leadContacts = "";
  try {
    const { data } = await getSupabaseServer()
      .from(table("users"))
      .select("net_id, name")
      .eq("role", "LEAD");
    if (data?.length) {
      leadContacts = data
        .map((u) => `${u.name || u.net_id} (${u.net_id}@illinois.edu)`)
        .join(" or ");
    }
  } catch {
    // fall back to empty string silently
  }
  return (
    <div>
      <main className={styles.mainContainer}>
        <div className={styles.textWrapper}>
          <Link href="/" aria-label="CS124H Home">
            <Image
              src="/images/cs124h-logo.png"
              alt="CS124H Logo"
              width={240}
              height={240}
              className={styles.heroLogo}
              priority
            />
          </Link>
          <h1 className={styles.homeTitle}>CS124Honors@Illinois</h1>
          <p className={styles.subtitle}>
            Illinois' premier freshman honors class run by students, for
            students.
          </p>
          <div className={styles.buttonContainer}>
            <a
              href="https://docs.google.com/document/d/1Ntqjf5bQSoQJixR7SjGQp51i3ACZR5M7C1evNctvolM/edit?tab=t.0#heading=h.4jjz7jor04lz"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.syllabusButton}
            >
              Syllabus
            </a>
            <a href="#register" className={styles.registerButton}>
              Register Now
            </a>
          </div>
        </div>
      </main>

      <section className={styles.aboutSection}>
        <div className={styles.aboutContent}>
          <h2>About Us</h2>
          <p>
            CS124 Honors is an add-on to CS 124 that lets you blend creativity
            and learning through a hands-on, project-based experience. You will
            work under the support of Project Managers and collaborate closely
            with other students.
            <br />
            <br />
            You will be a part of a welcoming community and expand your network
            and expertise through workshops, events, and other enriching
            opportunities. At the end of this journey, you will have brought a
            project to life from start to finish!
          </p>

          <div className={styles.videoWrapper}>
            <iframe
              width="100%"
              height="400"
              src="https://www.youtube.com/embed/QcWdjkM-utQ"
              title="CS124 Honors Overview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>

          <br></br>
          <br></br>

          <hr />
          <br></br>
          <br></br>

          <h2 id="register">How To Register</h2>
          <br />
          <h3>Step 1:</h3>
          <h4>If You're a James Scholar:</h4>
          <p>
            If you are a James Scholar or are taking the course for honors
            credit, you should complete an Honors Credit Learning Agreement
            (HCLA) form. On your HCLA, state that you are completing the extra
            work for CS 124 honors credit.{" "}
            <span className={styles.impText}>Do not enroll in CS 199 124</span> if you
            are a James Scholar.
          </p>
          <br />
          <br />
          <h4>If You're Not a James Scholar:</h4>
          <p>
            If you are not a James Scholar or not taking the course for honors
            credit, you should enroll in CS 199 124 (CRN: 67084) on
            self-service. The course is zero credit hours and S (satisfactory) /
            U (unsatisfactory) graded, but you will need to participate to earn
            the S grade!
          </p>

          <br />
          <br />

          <h3>Step 2:</h3>
          <p>
            Set up your Google Apps @ Illinois account with your NetID@illinois.edu
            email:{" "}
            <a href="https://answers.uillinois.edu/illinois/page.php?id=47599">
              https://answers.uillinois.edu/illinois/page.php?id=47599
            </a>
          </p>

          <br />
          <br />

          <h3>Step 3:</h3>
          <p>
            Please fill in the enrollment confirmation form:{" "}
            <a href="https://forms.gle/mqTVoWHZyCsHbCT58">
              https://forms.gle/mqTVoWHZyCsHbCT58.
            </a>{" "}
            <span className={styles.impText}>
              Failure to fill in the enrollment confirmation form will result in
              an unsatisfactory grade in the course.
            </span>
          </p>

          <br />
          <br />

          <h3>Step 4:</h3>
          <p>
            Join the Discord:{" "}
            <a href="https://discord.gg/HBZ2thqde">
              https://discord.gg/HBZ2thqde
            </a>
          </p>

          <br />
          <br />
          <hr />
          <br />
          <br />
          <p>
            {leadContacts ? `Questions? Contact ${leadContacts}` : "Questions? Contact the course leads."}
          </p>
        </div>
      </section>
    </div>
  );
}
