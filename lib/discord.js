/**
 * Discord REST API helper. Server-only — never import in client components.
 * All calls are authenticated with the bot token.
 */

const BASE = "https://discord.com/api/v10";

function token() {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) throw new Error("DISCORD_BOT_TOKEN is not set");
  return t;
}

function guildId() {
  const id = process.env.DISCORD_GUILD_ID;
  if (!id) throw new Error("DISCORD_GUILD_ID is not set");
  return id;
}

async function call(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${token()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? `Discord API ${res.status} on ${path}`);
  return data;
}

export const discord = {
  // ── Guild members ──────────────────────────────────────────────────────────
  getMember: (userId) =>
    call(`/guilds/${guildId()}/members/${userId}`),

  addRole: (userId, roleId) =>
    call(`/guilds/${guildId()}/members/${userId}/roles/${roleId}`, { method: "PUT" }),

  removeRole: (userId, roleId) =>
    call(`/guilds/${guildId()}/members/${userId}/roles/${roleId}`, { method: "DELETE" }),

  // ── Channels ───────────────────────────────────────────────────────────────
  createChannel: (body) =>
    call(`/guilds/${guildId()}/channels`, { method: "POST", body: JSON.stringify(body) }),

  deleteChannel: (channelId) =>
    call(`/channels/${channelId}`, { method: "DELETE" }),

  editChannelPermissions: (channelId, overwriteId, body) =>
    call(`/channels/${channelId}/permissions/${overwriteId}`, { method: "PUT", body: JSON.stringify(body) }),

  // ── Messages ───────────────────────────────────────────────────────────────
  sendMessage: (channelId, body) =>
    call(
      `/channels/${channelId}/messages`,
      { method: "POST", body: JSON.stringify(typeof body === "string" ? { content: body } : body) }
    ),

  // ── Scheduled events ───────────────────────────────────────────────────────
  createScheduledEvent: (body) =>
    call(`/guilds/${guildId()}/scheduled-events`, { method: "POST", body: JSON.stringify(body) }),

  deleteScheduledEvent: (eventId) =>
    call(`/guilds/${guildId()}/scheduled-events/${eventId}`, { method: "DELETE" }),

  // ── Interaction follow-ups ─────────────────────────────────────────────────
  editInteractionResponse: (appId, interactionToken, body) =>
    call(
      `/webhooks/${appId}/${interactionToken}/messages/@original`,
      { method: "PATCH", body: JSON.stringify(body) }
    ),

  // ── Guild info ─────────────────────────────────────────────────────────────
  getRoles: () =>
    call(`/guilds/${guildId()}/roles`),
};
