import { test } from "node:test";
import assert from "node:assert/strict";
import { QUIET_ZONE, PNG_MODULE_SIZE, ECC_LEVELS, buildMatrix, toSvg } from "../content/images/qr-code-generator/qr.js";

// Standard QR top-left finder pattern (1 = dark).
const FINDER = [
  [1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1],
  [1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1],
];

test("constants have expected values", () => {
  assert.equal(QUIET_ZONE, 4);
  assert.equal(PNG_MODULE_SIZE, 8);
  assert.deepEqual(ECC_LEVELS, ["L", "M", "Q", "H"]);
});

test("buildMatrix returns a square boolean matrix sized >= 21 and odd", () => {
  const { size, modules } = buildMatrix("hello", "M");
  assert.ok(size >= 21 && size % 2 === 1);
  assert.equal(modules.length, size);
  for (const row of modules) {
    assert.equal(row.length, size);
    for (const cell of row) assert.equal(typeof cell, "boolean");
  }
});

test("buildMatrix renders the standard top-left finder pattern", () => {
  const { modules } = buildMatrix("hello", "M");
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++)
      assert.equal(modules[y][x], FINDER[y][x] === 1, `finder mismatch at ${x},${y}`);
  // separator immediately right of and below the finder is light
  assert.equal(modules[0][7], false);
  assert.equal(modules[7][0], false);
});

test("buildMatrix throws when text exceeds capacity", () => {
  assert.throws(() => buildMatrix("A".repeat(3000), "H"));
});

test("toSvg embeds colors and a viewBox accounting for the quiet zone", () => {
  const matrix = buildMatrix("hello", "M");
  const svg = toSvg(matrix, { fg: "#112233", bg: "#ffeedd" });
  const d = matrix.size + 2 * QUIET_ZONE;
  assert.ok(svg.includes(`viewBox="0 0 ${d} ${d}"`));
  assert.ok(svg.includes("#112233"));
  assert.ok(svg.includes("#ffeedd"));
  assert.ok(svg.trimStart().startsWith("<svg"));
});
