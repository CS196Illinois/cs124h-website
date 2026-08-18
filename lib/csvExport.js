/**
 * Client-side CSV export helper. Safe to call only in the browser (uses Blob + document).
 */

function escapeCsvValue(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * @param {string} filename
 * @param {{ key: string, label: string, value?: (row: any) => any }[]} columns
 * @param {any[]} rows
 */
export function downloadCsv(filename, columns, rows) {
  const header = columns.map((c) => escapeCsvValue(c.label));
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvValue(c.value ? c.value(row) : row[c.key]))
  );
  const csv = [header, ...lines].map((line) => line.join(",")).join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
