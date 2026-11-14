import { permanentRedirect } from "next/navigation";

// The Google Calendar embed that lived here was replaced by /schedule.
export default function TimelinePage() {
  permanentRedirect("/schedule");
}
