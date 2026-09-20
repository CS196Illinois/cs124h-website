// Shared limits keep the browser and server in agreement. Images are stored
// privately with the ticket; they never receive a public storage URL.
export const SUPPORT_MAX_FILES = 3;
export const SUPPORT_MAX_BYTES = 3 * 1024 * 1024;
export const SUPPORT_BODY_LIMIT = SUPPORT_MAX_BYTES + 64 * 1024;
export const SUPPORT_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const SUPPORT_CATEGORIES = ["Login / access", "Grades / assignments", "Sprint checks", "Website issue", "Other"];

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

export function ticketEmail(ticket) {
  const rows = [["Ticket", ticket.id], ["Submitted", ticket.created_at], ["Full name", ticket.full_name], ["NetID", ticket.net_id], ["Category", ticket.category], ["Subject", ticket.subject], ["Screenshots", String(ticket.attachments?.length || 0)]];
  const text = `New CS 124H support ticket\n\n${rows.map(([key, value]) => `${key}: ${value}`).join("\n")}\n\n${ticket.description}\n\nSubmitted through the public support form. The student's identity has not been verified. Reply to ${ticket.net_id}@illinois.edu to follow up.`;
  const html = `<div style="background:#f2f5fa;padding:28px;font-family:Arial,sans-serif;color:#18253d"><div style="max-width:640px;margin:auto;background:#fff;border-radius:12px;overflow:hidden"><div style="padding:24px;background:#112a67;color:white"><p style="color:#ffd184;font-size:12px;letter-spacing:2px">CS 124H · SUPPORT</p><h1 style="font-size:24px;margin:12px 0">New support ticket</h1><p>${escapeHtml(ticket.subject)}</p></div><div style="padding:24px"><table style="width:100%;border-collapse:collapse">${rows.map(([key, value]) => `<tr><th align="left" style="padding:10px 12px 10px 0;border-bottom:1px solid #e5eaf2;vertical-align:top">${key}</th><td style="padding:10px 0;border-bottom:1px solid #e5eaf2;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`).join("")}</table><h2 style="font-size:18px;margin-top:24px">What happened</h2><div style="white-space:pre-wrap;line-height:1.6;overflow-wrap:anywhere">${escapeHtml(ticket.description)}</div><p style="font-size:12px;color:#536078;margin-top:24px">Submitted through the public support form; identity is unverified. Reply to this email to follow up with ${escapeHtml(ticket.net_id)}@illinois.edu. Screenshots are attached.</p></div></div></div>`;
  return { text, html };
}
