import React from "react";
import "../styles/global.css";
import "../styles/Homepage.css";
import dynamic from "next/dynamic";

import NavbarWrapper from "../components/navbarWrapper";

// add a button under the description that says "Syllabus" and links to the syllabus page
export default function Home() {
  return (
    <div>
      <NavbarWrapper />
      <main className="main-container">
        <div className="text-wrapper">
          <h1 className="home-title">CS124Honors@Illinois</h1>
          <p className="subtitle">
            Illinois' premier freshman honors class run by students, for
            students.
          </p>
          <div className="button-container">
            {/* TODO: update Syllabus links */}
            <a
              href="https://docs.google.com/document/d/1lHpa58z_1aBfJp9-xF67Vrtl1iysw3ND2Mznd1p1hyY/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="syllabus-button"
            >
              Syllabus
            </a>
            <a href="#register" className="register-button">
              Register Now
            </a>
          </div>
        </div>
      </main>

      <section className="about-section">
        <div className="about-content">
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

          {/* TODO: update with new intro video for Spring 2026*/}
          {/* <div className="video-wrapper">
            <iframe
              width="100%"
              height="400"
              src="https://www.youtube.com/embed/9AiOHVYOYNk?si=ce5BFqwtK4au4XTU"
              title="CS124 Honors Overview"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div> */}

          <br></br>
          <br></br>

          <hr />
          <br></br>
          <br></br>

          <h2 id="register">How To Register</h2>
          <br />
          
          {/* TODO: comment this out */}
          {/* <p>To be announced! Please check back later.</p> */}

          {/* TODO: update links and uncomment this */}
          <h3>Step 1:</h3>
          <h4>If You’re a James Scholar:</h4>
          <p>
            If you are a James Scholar or are taking the course for honors
            credit, you should complete an Honors Credit Learning Agreement
            (HCLA) form. On your HCLA, state that you are completing the extra
            work for CS 124 honors credit.{" "}
            <span className="imp-text">Do not enroll in CS 199 124</span> if you
            are a James Scholar.
          </p>
          <br />
          <br />
          <h4>If You’re Not a James Scholar:</h4>
          <p>
            If you are not a James Scholar or not taking the course for honors
            credit, you should enroll in CS 199 124 (CRN: 54574) on
            self-service. The course is zero credit hours and S (satisfactory) /
            U (unsatisfactory) graded, but you will need to participate to earn
            the S grade!
          </p>

          <br />
          <br />

          <h3>Step 2:</h3>
          <p>
            Please fill in the enrollment confirmation form:{" "}
            <a href="https://forms.gle/WbRu3s2gcwAHacdT9">
            https://forms.gle/WbRu3s2gcwAHacdT9.
            </a>{" "}
            <span className="imp-text">
              Failure to fill in the enrollment confirmation form will result in
              an unsatisfactory grade in the course.
            </span>
          </p>

          <br />
          <br />

          <h3>Step 3:</h3>
          <p>
            Join the Discord:{" "}
            <a href="https://discord.gg/yFWdHqax9A">
            https://discord.gg/yFWdHqax9A
            </a>
          </p>

          <br />
          <br />
          <hr />
          <br />
          <br />
          <p>
            Questions? Contact aasiyam2@illinois.edu or aryan15@illinois.edu
          </p>
        </div>
      </section>
    </div>
  );
}
