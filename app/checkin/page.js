import CheckInPanel from "../../components/staff/CheckInPanel";

export const metadata = { title: "Check in" };

// Any signed-in role can check in (middleware.js). Event QR codes link here
// with ?event=<id>.
export default function CheckInPage() {
  return (
    <main className="page">
      <CheckInPanel />
    </main>
  );
}
