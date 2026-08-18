import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import { verifyLinkToken } from "../../../lib/discordToken";
import { discord } from "../../../lib/discord";
import { getSupabaseServer } from "../../../lib/supabaseServer";
import { table } from "../../../lib/tables";

const DISCORD_ROLE_IDS = {
  LEAD:     process.env.DISCORD_ROLE_LEAD,
  LEAD_WEB: process.env.DISCORD_ROLE_LEAD_WEB,
  HEAD:     process.env.DISCORD_ROLE_HEAD,
  PM:       process.env.DISCORD_ROLE_PM,
  WEB:      process.env.DISCORD_ROLE_WEB,
  STUDENT:  process.env.DISCORD_ROLE_STUDENT,
};

export default async function DiscordLinkPage({ searchParams }) {
  const { token } = await searchParams;

  if (!token) {
    return <Result error="Invalid or missing link token." />;
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/discord/link?token=${token}`)}`);
  }

  const discordUserId = await verifyLinkToken(token);
  if (!discordUserId) {
    return <Result error="This link has expired or is invalid. Please click the button in Discord again." />;
  }

  const supabase = getSupabaseServer();
  const netId = session.user.netID;

  // Ensure this Discord account isn't already bound to a different user
  const { data: conflict } = await supabase
    .from(table("users"))
    .select("net_id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (conflict && conflict.net_id !== netId) {
    return <Result error="This Discord account is already linked to a different UIUC account. Contact course staff if you believe this is a mistake." />;
  }

  const { data: user } = await supabase
    .from(table("users"))
    .select("role, name, discord_user_id")
    .eq("net_id", netId)
    .maybeSingle();

  if (!user) {
    return <Result error="Your NetID is not enrolled in CS 124 Honors. Contact course staff if you believe this is a mistake." />;
  }

  // Idempotent — already linked to this same Discord account
  if (user.discord_user_id === discordUserId) {
    return <Result name={user.name} role={user.role} alreadyLinked />;
  }

  const { error: updateError } = await supabase
    .from(table("users"))
    .update({ discord_user_id: discordUserId })
    .eq("net_id", netId);

  if (updateError) {
    console.error("[Discord link] DB update failed:", updateError);
    return <Result error="Failed to save your account link. Please try again." />;
  }

  // Assign the Discord role for their course role
  const discordRoleId = DISCORD_ROLE_IDS[user.role];
  if (discordRoleId) {
    try {
      await discord.addRole(discordUserId, discordRoleId);
    } catch (err) {
      // Non-fatal — the link is saved. Role can be resynced from the admin panel.
      console.error("[Discord link] Role assignment failed:", err);
    }
  }

  return <Result name={user.name} role={user.role} />;
}

const ROLE_LABELS = {
  LEAD: "Course Lead", LEAD_WEB: "Lead Web Dev", HEAD: "Head PM",
  PM: "PM", WEB: "Web Dev", STUDENT: "Student",
};

function Result({ name, role, alreadyLinked, error }) {
  if (error) {
    return (
      <main style={styles.container}>
        <div style={{ fontSize: 48 }}>❌</div>
        <h1 style={{ ...styles.heading, color: "#c53030" }}>Link Failed</h1>
        <p style={styles.body}>{error}</p>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <div style={{ fontSize: 48 }}>{alreadyLinked ? "✅" : "🎉"}</div>
      <h1 style={{ ...styles.heading, color: "#276749" }}>
        {alreadyLinked ? "Already Linked" : "Account Linked!"}
      </h1>
      <p style={styles.body}>
        {alreadyLinked
          ? `Your UIUC account is already connected to Discord.`
          : `Welcome, ${name ?? "there"}! Your UIUC account has been connected to Discord.`}
      </p>
      {role && <p style={styles.role}>{ROLE_LABELS[role] ?? role}</p>}
      <p style={styles.hint}>You can close this tab and return to Discord.</p>
    </main>
  );
}

const styles = {
  container: {
    fontFamily: "system-ui, sans-serif",
    maxWidth: 480,
    margin: "80px auto",
    padding: "0 24px",
    textAlign: "center",
  },
  heading: { fontSize: "1.75rem", margin: "16px 0 8px" },
  body: { color: "#444", lineHeight: 1.6 },
  role: {
    display: "inline-block",
    background: "#13294b",
    color: "#fff",
    borderRadius: 6,
    padding: "4px 12px",
    fontSize: "0.85rem",
    marginTop: 8,
  },
  hint: { color: "#888", fontSize: "0.85rem", marginTop: 24 },
};
