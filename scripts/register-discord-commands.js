#!/usr/bin/env node
/**
 * One-time script to register Discord slash commands for the CS 124H bot.
 * Run with: node scripts/register-discord-commands.js
 *
 * Reads credentials from .env.local in the project root.
 */

const fs = require("fs");
const path = require("path");

// Load .env.local
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1 || line.startsWith("#")) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

const { DISCORD_BOT_TOKEN, DISCORD_APP_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_BOT_TOKEN || !DISCORD_APP_ID || !DISCORD_GUILD_ID) {
  console.error("Missing required env vars: DISCORD_BOT_TOKEN, DISCORD_APP_ID, DISCORD_GUILD_ID");
  process.exit(1);
}

const commands = [
  {
    name: "hal",
    description: "Ask H.A.L., the CS 124 Honors AI assistant",
    options: [
      {
        type: 3, // STRING
        name: "question",
        description: "What would you like to ask?",
        required: true,
      },
    ],
  },
];

async function register() {
  console.log(`Registering ${commands.length} command(s) to guild ${DISCORD_GUILD_ID}...`);

  const res = await fetch(
    `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/guilds/${DISCORD_GUILD_ID}/commands`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("Failed:", err?.message ?? res.status);
    process.exit(1);
  }

  const registered = await res.json();
  console.log("Registered:", registered.map((c) => `/${c.name}`).join(", "));
}

register();
