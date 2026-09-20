import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";

const EDIT_ROLES = ["course_lead", "head_pm", "pm", "web_dev", "lead_web_dev"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || session.user.role === "student") return NextResponse.json({ error: "Sign in to view the question bank." }, { status: 401 });
  const { data, error } = await supabaseServer.from(table("sprintQuestionBank")).select("*").order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Question bank could not be loaded. Please try again." }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!EDIT_ROLES.includes(session?.user?.role)) return NextResponse.json({ error: "Only course leads, head PMs, and PMs can add shared questions." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const question = String(body?.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "Enter a question before adding it to the bank." }, { status: 400 });
  if (question.length > 500) return NextResponse.json({ error: "Questions must be 500 characters or fewer." }, { status: 400 });
  const { data, error } = await supabaseServer.from(table("sprintQuestionBank")).insert({ question, created_by: session.user.netID }).select().single();
  if (error?.code === "23505") return NextResponse.json({ error: "That question is already in the bank." }, { status: 409 });
  if (error) return NextResponse.json({ error: "The question could not be added. Please try again." }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
