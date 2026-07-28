import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/route";
import { supabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";
import { buildSystemPrompt, callGemini } from "../../../lib/hal";

export async function POST(request) {
  const [session, leadsResult, bodyResult] = await Promise.all([
    getServerSession(authOptions),
    supabaseServer.from(table("users")).select("net_id, name").eq("role", "LEAD"),
    request.json().catch(() => null),
  ]);

  if (!bodyResult) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { messages } = bodyResult;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Chat is not configured" }, { status: 503 });
  }

  const systemPrompt = buildSystemPrompt(
    { role: session?.user?.role, name: session?.user?.name },
    leadsResult.data ?? []
  );

  try {
    const content = await callGemini(messages, systemPrompt);
    return NextResponse.json({ content });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}
