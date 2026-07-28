import { after, NextResponse } from "next/server";
import { discord } from "../../../../lib/discord";
import { generateLinkToken } from "../../../../lib/discordToken";
import { buildSystemPrompt, callGemini } from "../../../../lib/hal";
import { getSupabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";

// Maps DB role IDs to Discord server role IDs (configured per-server in env)
const DISCORD_ROLE_IDS = {
  LEAD:     process.env.DISCORD_ROLE_LEAD,
  LEAD_WEB: process.env.DISCORD_ROLE_LEAD_WEB,
  HEAD:     process.env.DISCORD_ROLE_HEAD,
  PM:       process.env.DISCORD_ROLE_PM,
  WEB:      process.env.DISCORD_ROLE_WEB,
  STUDENT:  process.env.DISCORD_ROLE_STUDENT,
};

const DB_TO_MAPPED_ROLE = {
  LEAD: "course_lead", LEAD_WEB: "lead_web_dev", HEAD: "head_pm",
  PM: "pm", WEB: "web_dev", STUDENT: "student",
};

// ── Signature verification ────────────────────────────────────────────────────

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes;
}

async function verifySignature(signature, timestamp, rawBody) {
  if (!signature || !timestamp) return false;
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw", hexToBytes(publicKey), { name: "Ed25519" }, false, ["verify"]
    );
    return crypto.subtle.verify(
      "Ed25519", key,
      hexToBytes(signature),
      new TextEncoder().encode(timestamp + rawBody)
    );
  } catch {
    return false;
  }
}

// ── /hal slash command ────────────────────────────────────────────────────────

async function handleHalCommand(interaction) {
  const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
  const question = interaction.data.options?.find((o) => o.name === "question")?.value ?? "";

  const supabase = getSupabaseServer();
  const [userResult, leadsResult] = await Promise.all([
    supabase.from(table("users")).select("role, name").eq("discord_user_id", discordUserId).maybeSingle(),
    supabase.from(table("users")).select("net_id, name").eq("role", "LEAD"),
  ]);

  const user = userResult.data;
  const systemPrompt = buildSystemPrompt(
    { role: user ? DB_TO_MAPPED_ROLE[user.role] : null, name: user?.name },
    leadsResult.data ?? []
  );

  try {
    const content = await callGemini([{ role: "user", content: question }], systemPrompt);
    await discord.editInteractionResponse(interaction.application_id, interaction.token, { content });
  } catch (err) {
    console.error("[H.A.L. Discord]", err);
    await discord.editInteractionResponse(interaction.application_id, interaction.token, {
      content: "Sorry, I ran into an error. Please try again or contact course staff.",
    }).catch(() => {});
  }
}

// ── link_account button ───────────────────────────────────────────────────────

async function handleLinkButton(interaction) {
  const discordUserId = interaction.member?.user?.id ?? interaction.user?.id;
  const token = await generateLinkToken(discordUserId);
  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  const linkUrl = `${baseUrl}/discord/link?token=${token}`;

  return {
    type: 4,
    data: {
      flags: 64, // EPHEMERAL — only visible to the user who clicked
      content: `Click the link below to connect your UIUC account:\n${linkUrl}\n\n*This link expires in 15 minutes.*`,
    },
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  if (!(await verifySignature(signature, timestamp, rawBody))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // Discord PING — required during endpoint registration
  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // Slash commands
  if (body.type === 2) {
    if (body.data.name === "hal") {
      // Respond immediately with a loading state, then follow up asynchronously
      after(() => handleHalCommand(body));
      return NextResponse.json({ type: 5 }); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
    }
  }

  // Component interactions (buttons, select menus)
  if (body.type === 3) {
    if (body.data.custom_id === "link_account") {
      return NextResponse.json(await handleLinkButton(body));
    }
  }

  return new Response("Unknown interaction type", { status: 400 });
}
