/**
 * Course-wide facts and links, in one place. Update this file at the start of
 * each semester instead of hunting through pages for hardcoded links.
 */
export const SITE = {
  courseName: "CS 124 Honors",
  shortName: "CS 124H",
  semester: "Spring 2027",
  tagline: "Illinois' premier freshman honors class, run by students, for students.",
  motto: "You get what you put in.",
  // Course time zone: dates and deadlines are shown in Chicago time.
  timeZone: "America/Chicago",
  crn: "67084",
  links: {
    syllabus: "https://docs.google.com/document/d/1Ntqjf5bQSoQJixR7SjGQp51i3ACZR5M7C1evNctvolM/edit?tab=t.0#heading=h.4jjz7jor04lz",
    discord: "https://discord.gg/HBZ2thqde",
    enrollmentForm: "https://forms.gle/mqTVoWHZyCsHbCT58",
    googleAppsSetup: "https://answers.uillinois.edu/illinois/page.php?id=47599",
    calendar: "https://calendar.google.com/calendar/embed?src=cs124honors%40gmail.com&ctz=America%2FChicago",
    resourceVault: "https://typhoon-lifter-1e1.notion.site/CS124H-Resource-Vault-1adbec204dee8026a3ccd51e7e260f04",
    overviewVideo: "https://www.youtube.com/embed/QcWdjkM-utQ",
  },
};

/** Main navigation, in display order. */
export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/schedule", label: "Schedule" },
  { href: "/assignments", label: "Assignments" },
  { href: "/resources", label: "Resources" },
  { href: "/course_staff", label: "Staff" },
  { href: "/hall_of_fame", label: "Hall of Fame" },
  { href: "/course_info", label: "Course Info" },
];
