/**
 * Minimal, dependency-free CSV encoder with formula-injection protection: any cell
 * whose text would start with =, +, -, @, a tab, or a carriage return is prefixed
 * with a leading apostrophe so spreadsheet applications treat it as plain text
 * instead of executing it as a formula.
 */
function sanitiseForFormulaInjection(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCsvField(raw: string | number | null | undefined): string {
  const text = raw === null || raw === undefined ? "" : String(raw);
  const sanitised = sanitiseForFormulaInjection(text);
  if (/[",\n\r]/.test(sanitised)) {
    return `"${sanitised.replace(/"/g, '""')}"`;
  }
  return sanitised;
}

export function toCsv(headers: string[], rows: Array<Record<string, string | number | null | undefined>>): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvField(row[header])).join(","));
  }
  return lines.join("\r\n");
}
