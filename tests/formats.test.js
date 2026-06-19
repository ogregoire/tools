import { test } from "node:test";
import assert from "node:assert/strict";
import { OUTPUT_FORMATS, MIME, isLossy, outputFilename, detectSourceType } from "../content/images/image-converter/formats.js";

const fileLike = (name, type = "") => ({ name, type });

test("OUTPUT_FORMATS and MIME", () => {
  assert.deepEqual(OUTPUT_FORMATS, ["png", "jpg", "webp"]);
  assert.equal(MIME.png, "image/png");
  assert.equal(MIME.jpg, "image/jpeg");
  assert.equal(MIME.webp, "image/webp");
});
test("isLossy: jpg/webp true, png false", () => {
  assert.equal(isLossy("jpg"), true);
  assert.equal(isLossy("webp"), true);
  assert.equal(isLossy("png"), false);
});
test("outputFilename swaps the extension", () => {
  assert.equal(outputFilename("photo.HEIC", "jpg"), "photo.jpg");
  assert.equal(outputFilename("a.b.png", "webp"), "a.b.webp");
  assert.equal(outputFilename("noext", "png"), "noext.png");
  assert.equal(outputFilename("image.jpeg", "png"), "image.png");
});
test("detectSourceType by MIME", () => {
  assert.equal(detectSourceType(fileLike("x", "image/png")), "png");
  assert.equal(detectSourceType(fileLike("x", "image/jpeg")), "jpeg");
  assert.equal(detectSourceType(fileLike("x", "image/webp")), "webp");
  assert.equal(detectSourceType(fileLike("x", "image/svg+xml")), "svg");
  assert.equal(detectSourceType(fileLike("x", "image/heic")), "heic");
  assert.equal(detectSourceType(fileLike("x", "image/heif")), "heic");
});
test("detectSourceType by extension when MIME absent", () => {
  assert.equal(detectSourceType(fileLike("a.PNG")), "png");
  assert.equal(detectSourceType(fileLike("a.jpg")), "jpeg");
  assert.equal(detectSourceType(fileLike("a.jpeg")), "jpeg");
  assert.equal(detectSourceType(fileLike("a.webp")), "webp");
  assert.equal(detectSourceType(fileLike("a.svg")), "svg");
  assert.equal(detectSourceType(fileLike("photo.heic")), "heic");
  assert.equal(detectSourceType(fileLike("photo.heif")), "heic");
});
test("detectSourceType returns null for unsupported", () => {
  assert.equal(detectSourceType(fileLike("a.gif", "image/gif")), null);
  assert.equal(detectSourceType(fileLike("a.txt")), null);
  assert.equal(detectSourceType(fileLike("noext")), null);
});
