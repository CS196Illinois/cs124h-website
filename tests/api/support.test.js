import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { asAnonymous, asRole } from "../helpers/mockAuth";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), sendMail: vi.fn(), transport: vi.fn() }));
vi.mock("../../lib/supabaseServer", () => ({ supabaseServer: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("support-mailer", () => ({ default: { createTransport: mocks.transport } }));
import { parseSupportForm, notifySupportTicket, limitSupportSubmission } from "../../lib/supportServer";
import { ticketEmail, SUPPORT_BODY_LIMIT } from "../../lib/support";
import { POST, GET } from "../../app/api/support/route";
import { GET as GET_TICKET, PATCH } from "../../app/api/support/[id]/route";

function request(overrides = {}, files = []) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ request_id: randomUUID(), net_id: "student1", full_name: "Test Student", category: "Login / access", subject: "Cannot log in", description: "I return to sign-in after authenticating.", ...overrides })) form.set(key, value);
  for (const file of files) form.append("screenshots", file);
  return new Request("https://course.example/api/support", { method: "POST", headers: { origin: "https://course.example" }, body: form });
}
const png = new File([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")], "screen.png", { type: "image/png" });
function query(result) {
  const chain = { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
  for (const method of ["insert", "update", "eq", "or", "select", "maybeSingle", "order", "range"]) chain[method] = vi.fn(() => chain);
  return chain;
}
beforeEach(() => {
  vi.clearAllMocks();
  asAnonymous();
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.transport.mockReturnValue({ sendMail: mocks.sendMail });
});
afterEach(() => vi.unstubAllEnvs());

it("accepts a signed-out student's report and screenshot, normalizing NetID", async () => {
  const ticket = await parseSupportForm(request({ net_id: "Student1" }, [png]));
  expect(ticket.net_id).toBe("student1");
  expect(ticket.attachments[0]).toMatchObject({ filename: "screenshot-1.png", contentType: "image/png" });
});
it.each([{ net_id: "evil@example.org" }, { full_name: "" }, { subject: "Bad\r\nHeader" }, { description: "" }, { category: "unrecognized" }, { website: "bot" }])("rejects invalid required fields: %j", async (fields) => {
  await expect(parseSupportForm(request(fields))).rejects.toThrow();
});
it("rejects disguised executable content and too many screenshots", async () => {
  await expect(parseSupportForm(request({}, [new File(["<script>bad</script>"], "screen.png", { type: "image/png" })]))).rejects.toThrow(/valid PNG/);
  await expect(parseSupportForm(request({}, [png, png, png, png]))).rejects.toThrow(/up to 3/);
});
it("enforces the streamed body limit without trusting Content-Length", async () => {
  const req = new Request("https://course.example/api/support", { method: "POST", body: new Uint8Array(SUPPORT_BODY_LIMIT + 1), headers: { "content-type": "multipart/form-data; boundary=test" } });
  await expect(parseSupportForm(req)).rejects.toMatchObject({ status: 413 });
});
it("escapes student content in HTML email and preserves plain-text details", () => {
  const email = ticketEmail({ id: "ticket", full_name: "<img src=x>", subject: "A < B", description: "<script>alert(1)</script>\nNext line", attachments: [], net_id: "student1" });
  expect(email.html).not.toContain("<script>");
  expect(email.html).toContain("&lt;img src=x&gt;");
  expect(email.text).toContain("Next line");
  expect(email.text).toContain("identity has not been verified");
});

it("builds a real multipart email with text, HTML, Reply-To, and a screenshot", async () => {
  const actual = await vi.importActual("support-mailer");
  const ticket = { ...(await parseSupportForm(request({}, [png]))), created_at: "2026-09-19T12:00:00Z" };
  const transport = actual.default.createTransport({ streamTransport: true, buffer: true });
  const email = await transport.sendMail({ from: "course@example.org", to: "lead@illinois.edu", replyTo: `${ticket.net_id}@illinois.edu`, subject: "CS 124H support", ...ticketEmail(ticket), attachments: ticket.attachments.map((file) => ({ ...file, encoding: "base64" })) });
  const mime = email.message.toString();
  expect(mime).toContain("Reply-To: student1@illinois.edu");
  expect(mime).toContain("Content-Type: text/plain");
  expect(mime).toContain("Content-Type: text/html");
  expect(mime).toContain("Content-Type: image/png");
  expect(mime).toContain("screenshot-1.png");
});
it("enforces persistent submission limits and fails closed when limits cannot be checked", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: false });
  await expect(limitSupportSubmission({ net_id: "student1" }, request())).rejects.toMatchObject({ status: 429 });
  mocks.rpc.mockResolvedValueOnce({ error: { code: "unavailable" } });
  await expect(limitSupportSubmission({ net_id: "student1" }, request())).rejects.toMatchObject({ status: 503 });
});
it("saves a public ticket even when SMTP is unconfigured", async () => {
  const ticket = await parseSupportForm(request());
  mocks.from.mockReturnValueOnce(query({ error: null })).mockReturnValueOnce(query({ data: { ...ticket, created_at: new Date().toISOString() } })).mockReturnValue(query({ error: null }));
  const response = await POST(request({ request_id: ticket.id }));
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ id: ticket.id, saved: true, notification: "pending" });
  expect(mocks.sendMail).not.toHaveBeenCalled();
});
it("does not resend a duplicate submission or claim success when persistence fails", async () => {
  mocks.from.mockReturnValueOnce(query({ error: { code: "23505" } }));
  expect((await POST(request())).status).toBe(200);
  expect(mocks.from).toHaveBeenCalledTimes(1);
  mocks.from.mockReturnValueOnce(query({ error: { code: "unavailable" } }));
  expect((await POST(request())).status).toBe(503);
});
it("sends to currently assigned lead web developers with student Reply-To and screenshots", async () => {
  vi.stubEnv("USE_TEST_TABLES", "false"); // DB and SMTP fully mocked; no network calls.
  vi.stubEnv("SMTP_USER", "course@example.org"); vi.stubEnv("SMTP_PASSWORD", "test-only");
  const ticket = await parseSupportForm(request({}, [png]));
  const claimed = query({ data: { ...ticket, created_at: new Date().toISOString() } });
  const saved = query({ error: null });
  mocks.from.mockReturnValueOnce(claimed).mockReturnValueOnce(query({ data: [{ net_id: "leadone" }, { net_id: "leadtwo" }] })).mockReturnValueOnce(saved);
  mocks.sendMail.mockResolvedValue({ accepted: ["leadone@illinois.edu", "leadtwo@illinois.edu"], rejected: [] });
  expect(await notifySupportTicket(ticket.id)).toBe("sent");
  expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: ["leadone@illinois.edu", "leadtwo@illinois.edu"], replyTo: "student1@illinois.edu", attachments: [expect.objectContaining({ filename: "screenshot-1.png", encoding: "base64" })] }));
  expect(saved.update).toHaveBeenCalledWith(expect.objectContaining({ notification_status: "sent" }));
});
it("does not send a notification already claimed or sent", async () => {
  mocks.from.mockReturnValue(query({ data: null }));
  expect(await notifySupportTicket(randomUUID())).toBe("unchanged");
  expect(mocks.sendMail).not.toHaveBeenCalled();
});
it.each([null, "student", "pm", "course_lead", "web_dev"])("protects private tickets, screenshots, and mutations from %s", async (role) => {
  if (role) asRole(role, "test");
  expect((await GET(new Request("https://course.example/api/support"))).status).toBe(403);
  expect((await GET_TICKET(new Request("https://course.example/api/support/id"), { params: { id: "id" } })).status).toBe(403);
  expect((await PATCH(new Request("https://course.example/api/support/id", { method: "PATCH" }), { params: { id: "id" } })).status).toBe(403);
  expect(mocks.from).not.toHaveBeenCalled();
});
it("allows the lead developer to resolve a ticket", async () => {
  asRole("lead_web_dev", "leadone");
  mocks.from.mockReturnValue(query({ data: { id: "ticket", status: "resolved" } }));
  const response = await PATCH(new Request("https://course.example/api/support/ticket", { method: "PATCH", headers: { origin: "https://course.example", "content-type": "application/json" }, body: JSON.stringify({ status: "resolved" }) }), { params: { id: "ticket" } });
  expect(response.status).toBe(200);
});
