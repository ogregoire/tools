import { test } from "node:test";
import assert from "node:assert/strict";
import { convert, unitsByGroup } from "../content/converters/unit-converter/convert.js";

test("length: 1 mile is 1609.344 meters", () => {
  assert.equal(convert("length", 1, "mi", "m"), 1609.344);
});
test("length: 100 cm is 1 m", () => {
  assert.equal(convert("length", 100, "cm", "m"), 1);
});
test("temperature: 100 C is 212 F", () => {
  assert.equal(convert("temperature", 100, "C", "F"), 212);
});
test("temperature: 0 C is 273.15 K", () => {
  assert.equal(convert("temperature", 0, "C", "K"), 273.15);
});
test("temperature: 32 F is 0 C", () => {
  assert.equal(convert("temperature", 32, "F", "C"), 0);
});
test("area: 1 are is 100 m2", () => {
  assert.equal(convert("area", 1, "are", "m2"), 100);
});
test("volume: 1 US gallon is 3.785411784 L", () => {
  assert.equal(convert("volume", 1, "gal", "l"), 3.785411784);
});
test("speed: 1 mi/s is 1609.344 m/s", () => {
  assert.equal(convert("speed", 1, "mi_s", "m_s"), 1609.344);
});
test("speed: 1 knot is 1.852 km/h", () => {
  assert.ok(Math.abs(convert("speed", 1, "kn", "km_h") - 1.852) < 1e-9);
});
test("round-trip stays within tolerance", () => {
  const there = convert("length", 12.34, "m", "ft");
  const back = convert("length", there, "ft", "m");
  assert.ok(Math.abs(back - 12.34) < 1e-9);
});
test("unknown unit throws", () => {
  assert.throws(() => convert("length", 1, "nope", "m"));
});
test("unitsByGroup: metric first, only non-empty groups", () => {
  const groups = unitsByGroup("length");
  assert.deepEqual(groups.map((g) => g.system), ["metric", "imperial", "nautical"]);
  assert.equal(groups[0].label, "Metric (SI)");
});
