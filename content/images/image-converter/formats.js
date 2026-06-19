// Pure image-format helpers. No DOM, no imports.

/** Output formats the converter can produce, in display order. */
export const OUTPUT_FORMATS = ["png", "jpg", "webp"];

/** MIME type for each output format key. */
export const MIME = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

/**
 * Whether an output format is lossy (and thus takes a quality setting).
 * @param {string} format - output format key ("png" | "jpg" | "webp").
 * @returns {boolean} true for jpg/webp, false for png.
 */
export function isLossy(format) {
  return format === "jpg" || format === "webp";
}

/**
 * Derive the output filename: the input base name with its last extension
 * replaced by ".<format>".
 * @param {string} inputName
 * @param {string} format - output format key.
 * @returns {string}
 */
export function outputFilename(inputName, format) {
  const base = inputName.includes(".")
    ? inputName.slice(0, inputName.lastIndexOf("."))
    : inputName;
  return `${base}.${format}`;
}

/**
 * Detect the source image type from a File — MIME first, then file extension
 * (HEIC files often have an empty or unreliable MIME type in browsers).
 * @param {{ name: string, type?: string }} file
 * @returns {"png"|"jpeg"|"webp"|"svg"|"heic"|null} null if unsupported.
 */
export function detectSourceType(file) {
  const mime = (file.type || "").toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpeg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/heic" || mime === "image/heif") return "heic";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return {
    png: "png", jpg: "jpeg", jpeg: "jpeg", webp: "webp",
    svg: "svg", heic: "heic", heif: "heic",
  }[ext] || null;
}
