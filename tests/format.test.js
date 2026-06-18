import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNumber } from "../assets/js/lib/format.js";

test("trims to 6 significant digits", () => {
  assert.equal(formatNumber(328.0839895), "328.084");
});
test("keeps whole numbers clean", () => {
  assert.equal(formatNumber(100), "100");
});
test("trims trailing zeros", () => {
  assert.equal(formatNumber(1609.344), "1609.34");
});
test("zero is '0'", () => {
  assert.equal(formatNumber(0), "0");
});
test("small decimals preserved", () => {
  assert.equal(formatNumber(0.0254), "0.0254");
});
test("repeating decimal capped at 6 sig digits", () => {
  assert.equal(formatNumber(1 / 3), "0.333333");
});
test("non-finite returns empty string", () => {
  assert.equal(formatNumber(NaN), "");
});
