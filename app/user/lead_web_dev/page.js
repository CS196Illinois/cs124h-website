import { redirect } from "next/navigation";

// The lead web developer's work here is support tickets.
export default function LeadWebDevHome() {
  redirect("/user/lead_web_dev/support");
}
