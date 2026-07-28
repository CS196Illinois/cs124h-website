import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { discord } from "../../../../lib/discord";

const ALLOWED_ROLES = ["course_lead", "lead_web_dev"];

// Posts (or refreshes) the welcome message with the "Link UIUC Account" button
// in the configured welcome channel. Safe to call multiple times — each call
// posts a new message; delete old ones manually from Discord if needed.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!ALLOWED_ROLES.includes(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const welcomeChannelId = process.env.DISCORD_WELCOME_CHANNEL_ID;
  if (!welcomeChannelId) {
    return NextResponse.json({ error: "DISCORD_WELCOME_CHANNEL_ID is not set" }, { status: 500 });
  }

  const message = {
    embeds: [
      {
        title: "Welcome to CS 124 Honors!",
        description:
          "To access your course channels, connect your UIUC account by clicking the button below.\n\n" +
          "You'll sign in with your NetID. Once verified, you'll automatically receive access to the channels for your role and group.",
        color: 0x13294b, // Illinois blue
        footer: { text: "CS 124 Honors · University of Illinois Urbana-Champaign" },
      },
    ],
    components: [
      {
        type: 1, // ACTION_ROW
        components: [
          {
            type: 2,    // BUTTON
            style: 1,   // PRIMARY (blurple)
            label: "Link UIUC Account",
            custom_id: "link_account",
          },
        ],
      },
    ],
  };

  try {
    const msg = await discord.sendMessage(welcomeChannelId, message);
    return NextResponse.json({ success: true, message_id: msg.id });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
