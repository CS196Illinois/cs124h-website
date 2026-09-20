import { createHash } from "node:crypto";
// Alias avoids NextAuth v4's optional Nodemailer 7 peer pin. CILogon does not
// use that email provider; support mail uses the current patched mailer.
import nodemailer from "support-mailer";
import { supabaseServer } from "./supabaseServer";
import { table } from "./tables";
import { SUPPORT_BODY_LIMIT, SUPPORT_MAX_BYTES, SUPPORT_MAX_FILES, SUPPORT_TYPES, SUPPORT_CATEGORIES, ticketEmail } from "./support";

export class SupportError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export async function parseSupportForm(request) {
  // Enforce the limit while streaming, including for chunked requests with no
  // Content-Length. Parsing formData first would allow unbounded allocations.
  if (Number(request.headers.get("content-length")) > SUPPORT_BODY_LIMIT) throw new SupportError("Screenshots must total 3 MB or less.", 413);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new SupportError("Please submit the support form.");
  const reader = request.body?.getReader();
  if (!reader) throw new SupportError("The support form is empty.");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > SUPPORT_BODY_LIMIT) { await reader.cancel(); throw new SupportError("Screenshots must total 3 MB or less.", 413); }
    chunks.push(value);
  }
  let form;
  try { form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") } }).formData(); }
  catch { throw new SupportError("The form could not be read. Please try again."); }
  if (form.get("website")) throw new SupportError("The form could not be submitted.");
  const value = (key) => typeof form.get(key) === "string" ? form.get(key).trim() : "";
  const id = value("request_id");
  const net_id = value("net_id").toLowerCase();
  const full_name = value("full_name");
  const category = value("category");
  const subject = value("subject");
  const description = value("description");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new SupportError("Refresh the page and try again.");
  if (!/^[a-z][a-z0-9]{1,15}$/.test(net_id)) throw new SupportError("Enter your NetID without @illinois.edu.");
  if (full_name.length < 2 || full_name.length > 120 || /[\r\n\x00]/.test(full_name)) throw new SupportError("Enter your full name (2–120 characters).");
  if (!SUPPORT_CATEGORIES.includes(category)) throw new SupportError("Choose an issue category.");
  if (subject.length < 3 || subject.length > 160 || /[\r\n\x00]/.test(subject)) throw new SupportError("Enter a subject of 3–160 characters.");
  if (description.length < 10 || description.length > 10000 || description.includes("\x00")) throw new SupportError("Describe your issue in 10–10,000 characters.");
  const files = form.getAll("screenshots").filter((file) => typeof file !== "string" && file.size > 0);
  if (files.length > SUPPORT_MAX_FILES || files.reduce((total, file) => total + file.size, 0) > SUPPORT_MAX_BYTES) throw new SupportError("Attach up to 3 screenshots totaling at most 3 MB.", 413);
  const attachments = [];
  for (const [index, file] of files.entries()) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    const type = png ? "image/png" : jpg ? "image/jpeg" : webp ? "image/webp" : null;
    if (!SUPPORT_TYPES.includes(file.type) || type !== file.type) throw new SupportError("Screenshots must be valid PNG, JPEG, or WebP images.");
    const extension = type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
    attachments.push({ filename: `screenshot-${index + 1}.${extension}`, contentType: type, content: bytes.toString("base64"), size: bytes.length });
  }
  return { id, net_id, full_name, category, subject, description, attachments };
}

export async function limitSupportSubmission(ticket, request) {
  // DB-backed counters remain effective across serverless instances. A global
  // ceiling also covers hosts without a trusted, platform-provided IP header.
  const keys = [["global", 100], [`netid:${ticket.net_id}`, 5]];
  if (process.env.VERCEL && request.headers.get("x-vercel-forwarded-for")) keys.push([`ip:${request.headers.get("x-vercel-forwarded-for").split(",")[0].trim()}`, 20]);
  for (const [key, limit] of keys) {
    const { data, error } = await supabaseServer.rpc(table("supportRateLimit"), { bucket_key: createHash("sha256").update(key).digest("hex"), max_requests: limit });
    if (error) throw new SupportError("Support is temporarily unavailable. Please try again later.", 503);
    if (!data) throw new SupportError("Too many support requests. Please try again in an hour.", 429);
  }
}

export async function notifySupportTicket(id) {
  // Claim a delivery attempt atomically. A crashed sender can be retried after
  // two minutes; successful deliveries are never deliberately sent twice.
  const now = new Date().toISOString();
  const expired = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: ticket, error } = await supabaseServer.from(table("supportTickets"))
    .update({ notification_status: "sending", notification_attempted_at: now })
    .eq("id", id).or(`notification_status.eq.pending,and(notification_status.eq.sending,notification_attempted_at.lt.${expired})`)
    .select().maybeSingle();
  if (error) throw new Error("Could not claim ticket notification");
  if (!ticket) return "unchanged";
  try {
    if (process.env.USE_TEST_TABLES === "true") throw new Error("Live email is disabled for test tables");
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) throw new Error("SMTP is not configured");
    const { data: leads, error: leadError } = await supabaseServer.from(table("users")).select("net_id").eq("role", "LEAD_WEB");
    if (leadError) throw new Error("Could not look up lead web developers");
    const recipients = [...new Set((leads || []).map((lead) => lead.net_id).filter((netID) => /^[a-z][a-z0-9]{1,15}$/i.test(netID)).map((netID) => `${netID}@illinois.edu`))];
    if (!recipients.length) throw new Error("No lead web developer assigned");
    const port = Number(process.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com", port, secure: port === 465,
      requireTLS: port !== 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    const result = await transport.sendMail({
      from: { name: "CS 124H Support", address: process.env.SMTP_USER },
      to: recipients, replyTo: `${ticket.net_id}@illinois.edu`,
      subject: `[CS 124H Support #${id.slice(0, 8)}] ${ticket.subject}`,
      messageId: `<support-${id}@${process.env.SMTP_USER.split("@")[1]}>`,
      ...ticketEmail(ticket),
      attachments: ticket.attachments.map(({ filename, contentType, content }) => ({ filename, contentType, content, encoding: "base64" })),
    });
    if (result.rejected?.length || !result.accepted?.length) throw new Error("SMTP did not accept all recipients");
    const { error: saveError } = await supabaseServer.from(table("supportTickets")).update({ notification_status: "sent", notified_at: new Date().toISOString() }).eq("id", id);
    if (saveError) throw new Error("Could not record notification delivery");
    return "sent";
  } catch {
    // Keep report and attachments intact. Never log student content or SMTP credentials.
    console.error("Support notification pending", { ticketId: id });
    await supabaseServer.from(table("supportTickets")).update({ notification_status: "pending" }).eq("id", id);
    return "pending";
  }
}
