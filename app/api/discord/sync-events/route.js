import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../auth/[...nextauth]/route";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { table } from "../../../../lib/tables";
import { fetchGuildScheduledEvents, discordEventToWebsiteEvent } from "../../../../lib/discord";

const ALLOWED_ROLES = ["course_lead", "lead_web_dev", "head_pm"];

export async function POST() {
  const session = await getServerSession(authOptions);
  const userRole = session?.user?.role;
  const netID = session?.user?.netID;

  if (!ALLOWED_ROLES.includes(userRole)) {
    return NextResponse.json({ error: "Only staff can sync Discord events." }, { status: 403 });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!botToken || !guildId) {
    return NextResponse.json(
      { error: "Discord is not configured. Set DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in your environment." },
      { status: 503 }
    );
  }

  let discordEvents;
  try {
    discordEvents = await fetchGuildScheduledEvents(guildId, botToken);
  } catch (err) {
    return NextResponse.json({ error: err.message || "Failed to fetch events from Discord." }, { status: 502 });
  }

  // Only consider events that haven't ended yet
  const now = new Date().toISOString();
  const upcoming = discordEvents.filter(
    (e) => (e.scheduled_end_time ?? e.scheduled_start_time) >= now
  );

  if (!upcoming.length) {
    return NextResponse.json({ synced: 0, message: "No upcoming Discord events found." });
  }

  // Deduplicate against existing events by title + start_time
  const { data: existing, error: fetchError } = await supabaseServer
    .from(table("events"))
    .select("title, start_time");

  if (fetchError) {
    return NextResponse.json({ error: "Could not check existing events. Please try again." }, { status: 500 });
  }

  const existingKeys = new Set(
    (existing || []).map((e) => `${e.title}|${e.start_time}`)
  );

  const toCreate = upcoming
    .map((e) => discordEventToWebsiteEvent(e, netID))
    .filter((e) => !existingKeys.has(`${e.title}|${e.start_time}`));

  if (!toCreate.length) {
    return NextResponse.json({ synced: 0, message: "All Discord events are already on the calendar." });
  }

  const { data: created, error: insertError } = await supabaseServer
    .from(table("events"))
    .insert(toCreate)
    .select("id, title");

  if (insertError) {
    return NextResponse.json(
      { error: "Events could not be saved. " + insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ synced: created.length, events: created });
}
