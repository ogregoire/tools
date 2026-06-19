import { qrcodegen } from "./qrcodegen.js";

/* Quiet zone: the blank margin (in modules) required around a QR code so
   scanners can isolate it. The QR spec mandates at least 4 modules. */
export const QUIET_ZONE = 4;

/* PNG export resolution: pixels rendered per QR module when rasterizing the
   SVG to a raster image. Larger = sharper/bigger file. */
export const PNG_MODULE_SIZE = 8;

/* Error-correction levels in increasing order of redundancy, for the UI. */
export const ECC_LEVELS = ["L", "M", "Q", "H"];

const ECC_BY_LABEL = {
  L: qrcodegen.QrCode.Ecc.LOW,
  M: qrcodegen.QrCode.Ecc.MEDIUM,
  Q: qrcodegen.QrCode.Ecc.QUARTILE,
  H: qrcodegen.QrCode.Ecc.HIGH,
};

/**
 * Encode text into a QR module matrix.
 * @param {string} text
 * @param {"L"|"M"|"Q"|"H"} eccLabel - error-correction level (defaults to M if unknown).
 * @returns {{ size: number, modules: boolean[][] }} modules[y][x], true = dark.
 * @throws if the text is too long to encode at the given level.
 */
export function buildMatrix(text, eccLabel) {
  const ecc = ECC_BY_LABEL[eccLabel] ?? ECC_BY_LABEL.M;
  const qr = qrcodegen.QrCode.encodeText(text, ecc);
  const size = qr.size;
  const modules = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) row.push(qr.getModule(x, y));
    modules.push(row);
  }
  return { size, modules };
}

/**
 * Render a module matrix to a self-contained SVG string.
 * @param {{ size: number, modules: boolean[][] }} matrix
 * @param {{ fg: string, bg: string, quietZone?: number }} opts - opaque #RRGGBB colors; quietZone defaults to QUIET_ZONE.
 * @returns {string} SVG markup with viewBox "0 0 D D", D = size + 2*quietZone.
 */
export function toSvg(matrix, { fg, bg, quietZone = QUIET_ZONE }) {
  const { size, modules } = matrix;
  const dim = size + 2 * quietZone;
  let rects = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) {
        rects += `<rect x="${x + quietZone}" y="${y + quietZone}" width="1" height="1"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">`
    + `<rect width="${dim}" height="${dim}" fill="${bg}"/>`
    + `<g fill="${fg}">${rects}</g></svg>`;
}
