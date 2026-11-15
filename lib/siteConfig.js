/**
 * Course-wide facts and links, in one place. Update this file at the start of
 * each semester instead of hunting through pages for hardcoded links.
 */
export const SITE = {
  courseName: "CS 124 Honors",
  shortName: "CS 124H",
  semester: "Spring 2027",
  // First day of classes (YYYY-MM-DD). Register shows until the end of week 4
  // of the semester. Update with the semester name each term; confirm it
  // against the registrar's academic calendar.
  semesterStart: "2027-01-19",
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

/**
 * Main navigation, in display order. `core` items stay in the top bar at
 * every width; the rest move into the menu on smaller screens. `short` is
 * the label used on the narrowest phones.
 */
export const NAV_ITEMS = [
  { href: "/", label: "Home", core: true },
  { href: "/schedule", label: "Schedule", core: true },
  { href: "/assignments", label: "Assignments", core: true },
  { href: "/resources", label: "Resources" },
  { href: "/course_staff", label: "Staff" },
  { href: "/hall_of_fame", label: "Hall of Fame" },
  { href: "/course_info", label: "Course Info", short: "Info", core: true },
];

/** Display names for the signed-in roles. */
export const ROLE_NAMES = {
  course_lead: "Course Lead",
  head_pm: "Head PM",
  lead_web_dev: "Lead Web Developer",
  pm: "PM",
  student: "Student",
};

/**
 * Extra top-bar tabs for each signed-in role, after the public pages. Events are run
 * from the Schedule and sprints and grades from Assignments, so this stays
 * short. Access is enforced by middleware.js and the APIs, not by this list.
 */
const CHECK_IN = { href: "/checkin", label: "Check in" };
export const ROLE_TOOLS = {
  student: [CHECK_IN],
  pm: [CHECK_IN, { href: "/my-group", label: "My group" }],
  head_pm: [CHECK_IN, { href: "/people", label: "People" }],
  course_lead: [CHECK_IN, { href: "/people", label: "People" }],
  lead_web_dev: [CHECK_IN, { href: "/support/tickets", label: "Support tickets" }],
};
