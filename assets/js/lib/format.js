// Format a number to at most `sigDigits` significant digits,
// trimming trailing zeros. Returns a string ("" for non-finite, "0" for zero).
export function formatNumber(value, sigDigits = 6) {
  if (!Number.isFinite(value)) return "";
  if (value === 0) return "0";
  return String(Number(value.toPrecision(sigDigits)));
}
