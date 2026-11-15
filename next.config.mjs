const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const storage = storageUrl ? new URL(storageUrl) : null;

export default {
  // The e2e suite builds into its own folder (NEXT_DIST_DIR=.next-e2e, see
  // playwright.config.mjs) so it can run while `npm run dev` is using .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // The old /user dashboards were folded into the main site. Keep their URLs
  // (bookmarks, printed QR codes) working; the query string carries through.
  async redirects() {
    return [
      { source: "/user/checkin", destination: "/checkin", permanent: false },
      { source: "/user/student/attendance", destination: "/checkin", permanent: false },
      { source: "/user/pm/students", destination: "/my-group", permanent: false },
      { source: "/user/:role(course_lead|head_pm)/people", destination: "/people", permanent: false },
      { source: "/user/lead_web_dev/support", destination: "/support/tickets", permanent: false },
      { source: "/user/:role/events", destination: "/schedule#manage-events", permanent: false },
      { source: "/user/:role/sprints", destination: "/assignments#manage-sprints", permanent: false },
      { source: "/user/:role/gradebook", destination: "/assignments#gradebook", permanent: false },
      { source: "/user/pm/guide", destination: "/resources#pm-guide", permanent: false },
      { source: "/user", destination: "/", permanent: false },
      { source: "/user/:path*", destination: "/", permanent: false },
    ];
  },
  images: {
    // Cache optimized public photos across visitors instead of downloading
    // originals from Supabase for every page view. Use a new URL on replacement.
    minimumCacheTTL: 86400,
    remotePatterns: storage ? ["staff-images", "site-images"].map((bucket) => ({
      protocol: storage.protocol.slice(0, -1),
      hostname: storage.hostname,
      port: storage.port,
      pathname: `/storage/v1/object/public/${bucket}/**`,
    })) : [],
  },
};
