/** Builds a standard Request object matching what Next.js route handlers receive. */
export function makeRequest(url, { method = "GET", body, headers } = {}) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
