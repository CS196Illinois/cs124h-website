import { decode } from "next-auth/jwt";

// next-auth's own reader (getToken / the session endpoint) joins *every* cookie
// whose name starts with the session cookie name, so one leftover chunk next to
// a valid cookie produces an undecodable token and a sign-in loop. This reads
// each candidate on its own and reports the stale cookies so the caller can
// delete them, after which next-auth's reader sees only the valid cookie.

// Every name a session cookie has had. Only the one next-auth currently reads
// (see activeBase) is accepted, so the middleware never lets a page load that
// the session endpoint would then report as signed out; the rest are stale.
// __Host- was never issued by next-auth v4, but an earlier middleware read it.
const ALL_BASES = ["__Secure-next-auth.session-token", "next-auth.session-token", "__Host-next-auth.session-token"];

/** Same rule next-auth's getToken uses to choose the cookie name. */
function activeBase() {
  const secure = process.env.NEXTAUTH_URL?.startsWith("https://") ?? !!process.env.VERCEL;
  return secure ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}

const isSessionCookie = (name) => ALL_BASES.some((base) => name === base || name.startsWith(`${base}.`));

/** Candidate token strings: the base cookie alone, then its numbered chunks joined in order. */
function candidates(cookies) {
  const base = activeBase();
  const out = [];
  const direct = cookies.find(({ name }) => name === base);
  if (direct?.value) out.push({ value: direct.value, names: [base] });
  const chunks = cookies
    .filter(({ name }) => name.startsWith(`${base}.`) && /^\d+$/.test(name.slice(base.length + 1)))
    .sort((a, b) => Number(a.name.slice(base.length + 1)) - Number(b.name.slice(base.length + 1)));
  if (chunks.length) out.push({ value: chunks.map(({ value }) => value).join(""), names: chunks.map(({ name }) => name) });
  return out;
}

/**
 * Returns `{ token, stale, present }`:
 * - token: the decoded session, or null
 * - stale: session cookie names that are not part of the decoded session (delete these)
 * - present: whether any session cookie was sent at all
 */
export async function readSession(req) {
  const cookies = req.cookies.getAll().filter(({ name }) => isSessionCookie(name));
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  for (const candidate of candidates(cookies)) {
    try {
      const token = await decode({ token: candidate.value, secret });
      if (token) return { token, stale: cookies.map(({ name }) => name).filter((name) => !candidate.names.includes(name)), present: true };
    } catch {}
  }
  return { token: null, stale: cookies.map(({ name }) => name), present: cookies.length > 0 };
}

/** Expire cookies on a response, matching the attributes next-auth sets them with. */
export function expireCookies(response, names) {
  for (const name of names) {
    response.cookies.set(name, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: name.startsWith("__") });
  }
  return response;
}
