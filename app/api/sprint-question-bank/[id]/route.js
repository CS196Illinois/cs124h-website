import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";

const EDIT_ROLES = ["course_lead"];
export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!EDIT_ROLES.includes(session?.user?.role)) return NextResponse.json({ error: "Only course leads can edit the shared question bank." }, { status: 403 });
  const question = String((await request.json().catch(() => null))?.question ?? "").trim();
  if (!question || question.length > 500) return NextResponse.json({ error: "Enter a question of 1 to 500 characters." }, { status: 400 });
  const { data, error } = await supabaseServer.from(table("sprintQuestionBank")).update({ question }).eq("id", (await params).id).select().single();
  if (error?.code === "23505") return NextResponse.json({ error: "That question is already in the bank." }, { status: 409 });
  if (error) return NextResponse.json({ error: "The question could not be updated. Please try again." }, { status: 500 });
  return NextResponse.json(data);
}
export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!EDIT_ROLES.includes(session?.user?.role)) return NextResponse.json({ error: "Only course leads can remove shared questions." }, { status: 403 });
  const { error } = await supabaseServer.from(table("sprintQuestionBank")).delete().eq("id", (await params).id);
  if (error) return NextResponse.json({ error: "The question could not be removed. Please try again." }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
