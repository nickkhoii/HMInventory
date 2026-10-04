export function csvCell(value: string | number) {
  const s = String(value);
  // Spreadsheet importers can ignore leading whitespace before a formula.
  const formula = /^[\s]*[=+\-@]/.test(s) || /^[\t\r\n]/.test(s);
  return `"${(formula ? "'" : "") + s.replaceAll('"', '""')}"`;
}
