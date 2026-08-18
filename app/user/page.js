import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../api/auth/[...nextauth]/route";

export default async function UserRootPage() {
  const session = await getServerSession(authOptions);

  const role = session?.user?.role;
  
  if (!role || role === "error") redirect("/unauthorized");

  redirect(`/user/${role}`);
}