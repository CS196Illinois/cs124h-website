/**
 * Short-lived HMAC-signed tokens for the Discord account linking flow.
 * A token encodes the user's Discord user ID and a timestamp, signed
 * with DISCORD_LINK_SECRET so it can't be forged or tampered with.
 *
 * Tokens expire after 15 minutes — enough time to open the link and log in.
 */

const TOKEN_TTL_MS = 15 * 60 * 1000;

function secret() {
  const s = process.env.DISCORD_LINK_SECRET;
  if (!s) throw new Error("DISCORD_LINK_SECRET is not set");
  return new TextEncoder().encode(s);
}

async function hmacKey(usage) {
  return crypto.subtle.importKey("raw", secret(), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function generateLinkToken(discordUserId) {
  const payload = `${discordUserId}:${Date.now()}`;
  const key = await hmacKey("sign");
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return Buffer.from(`${payload}:${sigHex}`).toString("base64url");
}

/** Returns the Discord user ID if the token is valid and unexpired, otherwise null. */
export async function verifyLinkToken(token) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");

    // Format: <discordUserId>:<timestamp>:<sigHex>
    // discordUserId itself won't contain ':', but timestamp and sigHex won't either.
    // Split from the right so the userId (which is a snowflake with no colons) is safe.
    const lastColon = decoded.lastIndexOf(":");
    const secondLastColon = decoded.lastIndexOf(":", lastColon - 1);
    if (lastColon === -1 || secondLastColon === -1) return null;

    const discordUserId = decoded.slice(0, secondLastColon);
    const timestamp = parseInt(decoded.slice(secondLastColon + 1, lastColon), 10);
    const sigHex = decoded.slice(lastColon + 1);

    if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_TTL_MS) return null;

    const key = await hmacKey("verify");
    const payload = `${discordUserId}:${timestamp}`;
    const sig = Uint8Array.from(sigHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
    const valid = await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(payload));

    return valid ? discordUserId : null;
  } catch {
    return null;
  }
}
