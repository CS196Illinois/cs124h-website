import { NextResponse } from "next/server";
import { generateLinkToken } from "../../../../lib/discordToken";

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

  // Component interactions (buttons, select menus)
  if (body.type === 3) {
    if (body.data.custom_id === "link_account") {
      return NextResponse.json(await handleLinkButton(body));
    }
  }

  return new Response("Unknown interaction type", { status: 400 });
}
