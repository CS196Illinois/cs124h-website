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
  // ── Guild members / roles ─────────────────────────────────────────────────
  addRole: (userId, roleId) =>
    call(`/guilds/${guildId()}/members/${userId}/roles/${roleId}`, { method: "PUT" }),

  removeRole: (userId, roleId) =>
    call(`/guilds/${guildId()}/members/${userId}/roles/${roleId}`, { method: "DELETE" }),

  // ── Messages ───────────────────────────────────────────────────────────────
  sendMessage: (channelId, body) =>
    call(
      `/channels/${channelId}/messages`,
      { method: "POST", body: JSON.stringify(typeof body === "string" ? { content: body } : body) }
    ),
};
