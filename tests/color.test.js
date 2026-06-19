import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isHexColor, relativeLuminance, contrastRatio, WCAG_CONTRAST, meetsContrast,
} from "../assets/js/lib/color.js";

test("isHexColor accepts opaque #RRGGBB", () => {
  assert.equal(isHexColor("#000000"), true);
  assert.equal(isHexColor("#AbCdEf"), true);
});
test("isHexColor rejects non-opaque / malformed", () => {
  for (const bad of ["#000", "#00000000", "#12345g", "000000", "#1234567", "rgba(0,0,0,1)", "black", "", null, 123]) {
    assert.equal(isHexColor(bad), false, `should reject ${String(bad)}`);
  }
});
test("relativeLuminance: black 0, white 1", () => {
  assert.ok(Math.abs(relativeLuminance("#000000") - 0) < 1e-9);
  assert.ok(Math.abs(relativeLuminance("#ffffff") - 1) < 1e-9);
});
test("contrastRatio black/white is 21", () => {
  assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 1e-9);
});
test("contrastRatio equal colors is 1", () => {
  assert.ok(Math.abs(contrastRatio("#123456", "#123456") - 1) < 1e-9);
});
test("contrastRatio is symmetric", () => {
  assert.ok(Math.abs(contrastRatio("#111111", "#eeeeee") - contrastRatio("#eeeeee", "#111111")) < 1e-12);
});
test("WCAG_CONTRAST.AA_NORMAL is 4.5", () => {
  assert.equal(WCAG_CONTRAST.AA_NORMAL, 4.5);
});
test("meetsContrast true at/above, false below threshold", () => {
  assert.equal(meetsContrast("#000000", "#ffffff"), true);
  assert.equal(meetsContrast("#777777", "#888888"), false);
});
test("meetsContrast honors a custom threshold", () => {
  // black/white contrast is exactly 21
  assert.equal(meetsContrast("#000000", "#ffffff", 21), true);
  assert.equal(meetsContrast("#000000", "#ffffff", 21.001), false);
  // a named stricter threshold still passes at maximum contrast
  assert.equal(meetsContrast("#000000", "#ffffff", WCAG_CONTRAST.AAA_NORMAL), true);
  // a low-contrast pair fails an explicit threshold
  assert.equal(meetsContrast("#777777", "#888888", WCAG_CONTRAST.AA_LARGE), false);
});
