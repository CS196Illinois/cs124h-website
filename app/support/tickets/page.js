import SupportTickets from "../../../components/staff/SupportTickets";

export const metadata = { title: "Support tickets" };

// Lead web developers only (middleware.js and the support API).
export default function SupportTicketsPage() {
  return (
    <main className="page">
      <SupportTickets />
    </main>
  );
}
