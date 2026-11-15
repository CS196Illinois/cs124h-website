import MyGroup from "../../components/staff/MyGroup";

export const metadata = { title: "My group" };

// PMs only (middleware.js); the API scopes everything to their own group.
export default function MyGroupPage() {
  return (
    <main className="page">
      <MyGroup />
    </main>
  );
}
