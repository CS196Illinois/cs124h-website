import "./global.css";
import AuthSessionProvider from "../components/AuthSessionProvider";
import { UndoProvider } from "../components/UndoProvider";
import Navbar from "../components/navbar.js";
import SiteFooter from "../components/SiteFooter";
import OnboardingTour from "./components/OnboardingTour";
import { SITE } from "../lib/siteConfig";

export const metadata = {
  title: { default: SITE.shortName, template: `%s · ${SITE.shortName}` },
  description: `${SITE.courseName} at the University of Illinois. ${SITE.tagline}`,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

// Applies a saved light/dark choice before first paint so there's no flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AuthSessionProvider>
          <UndoProvider>
            <Navbar />
            <OnboardingTour />
            {children}
            <SiteFooter />
          </UndoProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
