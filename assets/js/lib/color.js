// WCAG color math shared across tools. All inputs are opaque #RRGGBB strings.

/**
 * Whether `value` is an opaque 6-digit hex color string (e.g. "#1a2b3c").
 * @param {unknown} value
 * @returns {boolean} true only for a leading "#" followed by exactly 6 hex digits.
 */
export function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/**
 * WCAG relative luminance of an opaque #RRGGBB color.
 * @param {string} hex - an opaque "#RRGGBB" color.
 * @returns {number} luminance in the range 0 (black) to 1 (white).
 */
export function relativeLuminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/**
 * WCAG contrast ratio between two opaque #RRGGBB colors. Symmetric in a/b.
 * @param {string} a - an opaque "#RRGGBB" color.
 * @param {string} b - an opaque "#RRGGBB" color.
 * @returns {number} ratio from 1 (identical) to 21 (black vs white).
 */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Standard WCAG 2.x minimum contrast ratios, by conformance level and text size.
 * Frozen so callers cannot mutate the shared thresholds.
 */
export const WCAG_CONTRAST = Object.freeze({
  AA_NORMAL: 4.5,
  AA_LARGE: 3,
  AAA_NORMAL: 7,
  AAA_LARGE: 4.5,
});

/**
 * Whether two colors meet or exceed a contrast threshold.
 * @param {string} a - an opaque "#RRGGBB" color.
 * @param {string} b - an opaque "#RRGGBB" color.
 * @param {number} [threshold=WCAG_CONTRAST.AA_NORMAL] - minimum acceptable ratio.
 * @returns {boolean} true when contrastRatio(a, b) >= threshold.
 */
export function meetsContrast(a, b, threshold = WCAG_CONTRAST.AA_NORMAL) {
  return contrastRatio(a, b) >= threshold;
}
