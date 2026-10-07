import { getServerSession } from "next-auth";
import { authOptions } from "../app/api/auth/[...nextauth]/route";

/** The signed-in caller's role and NetID; both undefined when signed out. */
export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  return { role: session?.user?.role, netID: session?.user?.netID };
}
