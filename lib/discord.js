const DISCORD_API = "https://discord.com/api/v10";

export async function fetchGuildScheduledEvents(guildId, botToken) {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/scheduled-events`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord API error ${res.status}: ${text}`);
  }
  return res.json();
}

export function discordEventToWebsiteEvent(discordEvent, createdBy) {
  const location =
    discordEvent.entity_metadata?.location ??
    (discordEvent.channel_id ? `Channel: ${discordEvent.channel_id}` : null);
  return {
    title: discordEvent.name,
    description: discordEvent.description || null,
    location,
    start_time: discordEvent.scheduled_start_time,
    end_time: discordEvent.scheduled_end_time || null,
    created_by: createdBy,
    audience_type: "all",
    audience_values: [],
  };
}
