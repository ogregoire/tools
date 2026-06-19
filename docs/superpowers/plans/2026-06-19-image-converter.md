# Image Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side image converter to the Images category that converts a single image to PNG/JPG/WebP from PNG/JPG/WebP/SVG/HEIC sources.

**Architecture:** A page bundle under `content/images/image-converter/`. Every source is decoded onto a `<canvas>` then encoded once via `canvas.toBlob(mime, quality)`. HEIC is decoded with `libheif-js` (ASM.js, vendored in `static/`, lazy `import()` only on first HEIC use). Pure format helpers live in a Node-tested `formats.js`; the canvas/DOM pipeline lives in the entry and is verified by a Firefox smoke test.

**Tech Stack:** Hugo (extended) 0.163.3, esbuild via `js.Build`, Node 22 `node --test`, vendored `libheif-js` ASM.js build, Playwright+Firefox for live smoke.

## Global Constraints

- Tool = page bundle `content/images/image-converter/index.md` with `type: tools`, `layout: image-converter`; co-located entry JS bundled via `.Resources.GetMatch "image-converter.js" | js.Build (dict "minify" hugo.IsProduction) | fingerprint`.
- Pure logic modules: **relative imports only** (Node-runnable). Entry imports the shared lib assets-root-relative (`js/lib/dom.js`).
- **Outputs:** PNG, JPG, WebP only. **Sources:** PNG, JPG, WebP, SVG, HEIC. SVG/HEIC are input-only.
- **Single file**; **quality slider** (1–100, default 90) shown only for JPG/WebP; PNG lossless. Output keeps source pixel dimensions (SVG: intrinsic → `viewBox` → 512×512).
- **HEIC:** `libheif-js` ASM.js build, vendored verbatim at `static/vendor/libheif/libheif.js` (+ ESM export shim, license header preserved). Lazy `import(url)` only on first HEIC conversion; URL passed via a `data-libheif-src` attribute. No `.wasm`, no CDN, fully offline.
- Reuse `layouts/partials/icon-download.html` and the global `.type-btn`/`is-active` styles. Category = section (Images section already exists); only `tags` taxonomy.
- Site targets **Firefox**; the GitHub Actions deploy (official `hugo_extended` deb) is the real build gate — local Homebrew `hugo` can pass a build the deb fails; push and watch the run.
- No npm runtime deps in the bundle; `node --test`, no test deps. Commit after every task.

---

### Task 1: Pure format helpers — `formats.js` (TDD)

**Files:**
- Create: `content/images/image-converter/formats.js`
- Test: `tests/formats.test.js`

**Interfaces:**
- Produces: `OUTPUT_FORMATS` (`["png","jpg","webp"]`), `MIME` (`{png,jpg,webp}` → mime), `isLossy(format)`, `outputFilename(inputName, format)`, `detectSourceType(file)` → `"png"|"jpeg"|"webp"|"svg"|"heic"|null`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test — `tests/formats.test.js`**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/formats.test.js`
Expected: FAIL — cannot find module `formats.js`.

- [ ] **Step 3: Implement `content/images/image-converter/formats.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/formats.test.js`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add content/images/image-converter/formats.js tests/formats.test.js
git commit -m "Add pure image-format helpers (mime, lossy, filename, detection)"
```

---

### Task 2: Vendor libheif-js + HEIC fixture

**Files:**
- Create: `static/vendor/libheif/libheif.js` (vendored ASM.js + ESM export shim)
- Create: `tests/fixtures/sample.heic` (tiny HEIC for smoke/verify)

**Interfaces:**
- Produces: an ES module at `static/vendor/libheif/libheif.js` whose import yields `{ libheif }` (also `default`), where `new libheif.HeifDecoder().decode(uint8)` returns an array of images with `.get_width()`, `.get_height()`, and `.display(imageData, cb)`.
- Consumes: nothing.

- [ ] **Step 1: Obtain the libheif-js ASM.js build**

Run:
```bash
mkdir -p static/vendor/libheif tests/fixtures
TMP=$(mktemp -d); ( cd "$TMP" && npm pack libheif-js >/dev/null 2>&1 && tar xzf libheif-js-*.tgz )
# The ASM.js (pure-JS, no .wasm) build lives at package/libheif/libheif.js
ls "$TMP/package/libheif/"
cp "$TMP/package/libheif/libheif.js" static/vendor/libheif/libheif.js
head -20 static/vendor/libheif/libheif.js   # confirm license/header
wc -l static/vendor/libheif/libheif.js
( cd "$TMP/package" && node -p "require('./package.json').version" )   # record version
```
Expected: the file copies (~1 MB+, pure JS). If `package/libheif/libheif.js` isn't present, inspect the tarball (`find "$TMP/package" -name '*.js' | xargs wc -l | sort -n`) and pick the self-contained ASM.js build (the large pure-JS one, NOT a `-wasm` variant that needs a `.wasm`). Do not hand-write a decoder. Record the version used in the report.

- [ ] **Step 2: Determine how the vendored file exposes `libheif`, then append an ESM shim**

Inspect the tail/top-level of `static/vendor/libheif/libheif.js` to see the binding it defines:
```bash
tail -30 static/vendor/libheif/libheif.js
grep -nE "module.exports|exports\.|^var libheif|globalThis.libheif|self.libheif|return libheif" static/vendor/libheif/libheif.js | tail -10
```
Append the shim that matches what it defines. If it assigns a top-level `var libheif` (or `globalThis.libheif`), append:
```js

export { libheif };
export default libheif;
```
If it uses `module.exports = libheif` (CommonJS), instead append a binding first:
```js

const libheif = (typeof module !== "undefined" && module.exports) ? module.exports : globalThis.libheif;
export { libheif };
export default libheif;
```
Pick the ONE form that matches the file; do not modify the vendored body above the shim.

- [ ] **Step 3: Create a tiny HEIC fixture with `sips` (macOS)**

Run:
```bash
SRC="/System/Library/CoreServices/PowerChime.app/Contents/Resources/battery_icon.png"
[ -f "$SRC" ] || SRC=$(find /System/Library/CoreServices -name '*.png' 2>/dev/null | head -1)
sips -s format heic --resampleWidth 64 "$SRC" --out tests/fixtures/sample.heic >/dev/null
ls -la tests/fixtures/sample.heic; file tests/fixtures/sample.heic
```
Expected: a small (~few KB) file reported as `HEIF Image`. (If `sips` is unavailable, obtain any small `.heic` and place it at `tests/fixtures/sample.heic`.)

- [ ] **Step 4: Verify the vendored module loads and decodes under Node**

Run:
```bash
node --input-type=module -e "
import mod from './static/vendor/libheif/libheif.js';
import { readFileSync } from 'node:fs';
const libheif = mod.libheif ?? mod;
const buf = new Uint8Array(readFileSync('tests/fixtures/sample.heic'));
const imgs = new libheif.HeifDecoder().decode(buf);
const im = imgs[0];
console.log('images=' + imgs.length + ' w=' + im.get_width() + ' h=' + im.get_height());
"
```
Expected: prints something like `images=1 w=64 h=...` with width/height > 0. If the module fails to load or `HeifDecoder` is undefined, the shim/build is wrong — fix Step 2 (or re-pick the build in Step 1). If it loads but the ASM.js needs async init in Node and can't decode headlessly, report DONE_WITH_CONCERNS noting Node couldn't exercise decode, so the in-browser HEIC path must be confirmed in Task 3's smoke (do NOT proceed silently).

- [ ] **Step 5: Commit**

```bash
git add static/vendor/libheif/libheif.js tests/fixtures/sample.heic
git commit -m "Vendor libheif-js ASM.js build + ESM shim and a HEIC test fixture"
```

---

### Task 3: Tool UI — content, layout, entry, styles

**Files:**
- Create: `content/images/image-converter/index.md`
- Create: `layouts/tools/image-converter.html`
- Create: `content/images/image-converter/image-converter.js`
- Modify: `assets/css/site.css` (append image-converter styles)

**Interfaces:**
- Consumes: `./formats.js` (`OUTPUT_FORMATS`, `MIME`, `isLossy`, `outputFilename`, `detectSourceType`); `js/lib/dom.js` (`qs`, `qsa`, `create`, `on`, `clear`); the vendored libheif module via `data-libheif-src`.
- Produces: a working tool at `/tools/images/image-converter/`; auto-listed on the homepage, `/tools/images/`, and in `index.json`.

- [ ] **Step 1: Create the content page — `content/images/image-converter/index.md`**

```markdown
---
title: Image Converter
type: tools
layout: image-converter
summary: Convert images to PNG, JPG, or WebP (from PNG, JPG, WebP, SVG, or HEIC) right in your browser — pick a format and quality, then download.
tags:
  - images
  - converter
  - png
  - jpg
  - webp
  - heic
  - svg
---

Convert an image to PNG, JPG, or WebP. Accepts PNG, JPG, WebP, SVG, and HEIC
sources. Everything runs in your browser — nothing is uploaded.
```

- [ ] **Step 2: Create the layout — `layouts/tools/image-converter.html`**

```html
{{ define "main" }}
<article class="tool">
  <h1>{{ .Title }}</h1>
  {{ .Content }}

  <div class="image-converter" id="image-converter" data-libheif-src="{{ "vendor/libheif/libheif.js" | relURL }}">
    <div class="ic-drop" id="ic-drop" tabindex="0" role="button" aria-label="Choose or drop an image">
      <input type="file" id="ic-file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml,image/heic,image/heif,.png,.jpg,.jpeg,.webp,.svg,.heic,.heif">
      <p>Drop an image here, or click to choose</p>
      <p class="ic-hint">PNG, JPG, WebP, SVG, HEIC → PNG, JPG, or WebP</p>
    </div>

    <div class="ic-controls">
      <div class="qr-field">
        <span>Output format</span>
        <div class="ic-format" id="ic-format" role="group" aria-label="Output format"></div>
      </div>
      <div class="qr-field" id="ic-quality-row" hidden>
        <label for="ic-quality">Quality: <span id="ic-quality-val">90</span></label>
        <input type="range" id="ic-quality" min="1" max="100" value="90">
      </div>
    </div>

    <p class="ic-status" id="ic-status" role="status" hidden></p>
    <p class="ic-error" id="ic-error" role="alert" hidden></p>
    <p class="ic-source" id="ic-source" hidden></p>
    <div class="ic-preview" id="ic-preview"></div>
    <div class="ic-actions">
      <button type="button" id="ic-download" disabled>{{ partial "icon-download.html" . }}<span>Download</span></button>
    </div>
  </div>
</article>
{{ end }}

{{ define "scripts" }}
  {{ $entry := .Resources.GetMatch "image-converter.js" }}
  {{ $js := $entry | js.Build (dict "minify" hugo.IsProduction) | fingerprint }}
  <script type="module" src="{{ $js.RelPermalink }}"></script>
{{ end }}
```

- [ ] **Step 3: Create the entry — `content/images/image-converter/image-converter.js`**

```js
import { OUTPUT_FORMATS, MIME, isLossy, outputFilename, detectSourceType } from "./formats.js";
import { qs, qsa, create, on } from "js/lib/dom.js";

const root = qs("#image-converter");
const fileInput = qs("#ic-file");
const dropZone = qs("#ic-drop");
const formatToggle = qs("#ic-format");
const qualityRow = qs("#ic-quality-row");
const qualityInput = qs("#ic-quality");
const qualityVal = qs("#ic-quality-val");
const sourceInfo = qs("#ic-source");
const previewEl = qs("#ic-preview");
const statusEl = qs("#ic-status");
const errorEl = qs("#ic-error");
const dlBtn = qs("#ic-download");

const LIBHEIF_SRC = root.dataset.libheifSrc;
const state = { file: null, type: null, format: "png", quality: 90, blob: null, filename: "", previewUrl: "" };

// Lazy-load the vendored libheif module on first HEIC conversion only.
let libheifPromise = null;
function loadLibheif() {
  if (!libheifPromise) libheifPromise = import(LIBHEIF_SRC).then((m) => m.libheif ?? m.default);
  return libheifPromise;
}

// Output-format toggle (segmented buttons, like the converter's type selector).
for (const f of OUTPUT_FORMATS) {
  const btn = create("button", {
    type: "button",
    class: "type-btn ic-format-btn" + (f === state.format ? " is-active" : ""),
    textContent: f.toUpperCase(),
    dataset: { format: f },
    "aria-pressed": String(f === state.format),
  });
  on(btn, "click", () => selectFormat(f));
  formatToggle.append(btn);
}
function selectFormat(f) {
  state.format = f;
  for (const btn of qsa(".ic-format-btn", formatToggle)) {
    const active = btn.dataset.format === f;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  }
  qualityRow.hidden = !isLossy(f);
  convert();
}

on(qualityInput, "input", () => {
  state.quality = Number(qualityInput.value);
  qualityVal.textContent = String(state.quality);
  convert();
});

// File selection (input + drag-and-drop).
function setFile(file) {
  errorEl.hidden = true;
  const type = detectSourceType(file);
  if (!type) { showError(`Unsupported file type: ${file.name}`); return; }
  state.file = file;
  state.type = type;
  convert();
}
on(fileInput, "change", () => { if (fileInput.files[0]) setFile(fileInput.files[0]); });
on(dropZone, "click", () => fileInput.click());
on(dropZone, "keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
on(dropZone, "dragover", (e) => { e.preventDefault(); dropZone.classList.add("is-over"); });
on(dropZone, "dragleave", () => dropZone.classList.remove("is-over"));
on(dropZone, "drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("is-over");
  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
  statusEl.hidden = true;
  setDownload(false);
}
function setDownload(enabled) { dlBtn.disabled = !enabled; }

function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("could not load image"));
    img.src = url;
  });
}

async function decodeToCanvas(file, type) {
  if (type === "heic") {
    statusEl.textContent = "Decoding HEIC…";
    statusEl.hidden = false;
    const libheif = await loadLibheif();
    const images = new libheif.HeifDecoder().decode(new Uint8Array(await file.arrayBuffer()));
    if (!images || !images.length) throw new Error("no image found in HEIC file");
    const image = images[0];
    const w = image.get_width(), h = image.get_height();
    const canvas = create("canvas", { width: w, height: h });
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(w, h);
    await new Promise((res, rej) =>
      image.display(imageData, (d) => (d ? res() : rej(new Error("HEIC decode failed")))));
    ctx.putImageData(imageData, 0, 0);
    statusEl.hidden = true;
    return canvas;
  }
  if (type === "svg") {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const w = img.naturalWidth || 512, h = img.naturalHeight || 512;
      const canvas = create("canvas", { width: w, height: h });
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      return canvas;
    } finally { URL.revokeObjectURL(url); }
  }
  const bitmap = await createImageBitmap(file);
  const canvas = create("canvas", { width: bitmap.width, height: bitmap.height });
  canvas.getContext("2d").drawImage(bitmap, 0, 0);
  if (bitmap.close) bitmap.close();
  return canvas;
}

let convertSeq = 0;
async function convert() {
  if (!state.file) return;
  const seq = ++convertSeq;
  errorEl.hidden = true;
  try {
    const canvas = await decodeToCanvas(state.file, state.type);
    if (seq !== convertSeq) return;
    const mime = MIME[state.format];
    const quality = isLossy(state.format) ? state.quality / 100 : undefined;
    const blob = await new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("encoding failed"))), mime, quality));
    if (seq !== convertSeq) return;
    showResult(canvas, blob);
  } catch (e) {
    if (seq !== convertSeq) return;
    statusEl.hidden = true;
    showError(`Could not convert this file: ${e.message}`);
  }
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function showResult(canvas, blob) {
  state.blob = blob;
  state.filename = outputFilename(state.file.name, state.format);
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = URL.createObjectURL(blob);
  previewEl.innerHTML = "";
  previewEl.append(create("img", { src: state.previewUrl, alt: "Converted preview" }));
  sourceInfo.textContent =
    `${state.file.name} · ${state.type.toUpperCase()} · ${canvas.width}×${canvas.height}`
    + ` → ${state.filename} · ${formatBytes(blob.size)}`;
  sourceInfo.hidden = false;
  setDownload(true);
}

on(dlBtn, "click", () => {
  if (!state.blob) return;
  const url = URL.createObjectURL(state.blob);
  const a = create("a", { href: url, download: state.filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// Initial state: png default → no quality slider, download disabled.
qualityVal.textContent = String(state.quality);
qualityRow.hidden = !isLossy(state.format);
setDownload(false);
```

- [ ] **Step 4: Append styles to `assets/css/site.css`**

Append at the end of `assets/css/site.css`:
```css
.image-converter { display: flex; flex-direction: column; gap: 1rem; max-width: 32rem; }
.ic-drop { border: 2px dashed var(--border); border-radius: 10px; padding: 1.5rem;
  text-align: center; cursor: pointer; color: var(--muted); }
.ic-drop.is-over { border-color: var(--accent); background: var(--bg-soft); }
.ic-drop p { margin: 0; }
.ic-hint { font-size: 0.8rem; margin-top: 0.3rem !important; }
.ic-controls { display: flex; gap: 1.5rem; flex-wrap: wrap; align-items: start; }
.ic-format { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.ic-source { font-size: 0.85rem; color: var(--muted); margin: 0; }
.ic-status { color: var(--muted); margin: 0; }
.ic-error { color: #991b1b; background: #fee2e2; border-radius: 8px; padding: 0.5rem 0.8rem; margin: 0; }
.ic-preview img { max-width: min(360px, 90vw); height: auto; display: block;
  border: 1px solid var(--border); border-radius: 8px; }
.ic-actions button { display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 0.9rem; border: 1px solid var(--border); border-radius: 8px;
  background: #fff; cursor: pointer; }
.ic-actions button:disabled { opacity: 0.5; cursor: not-allowed; }
.ic-actions .icon { display: block; }
```

- [ ] **Step 5: Build and verify the tool, listing, search index, and vendored asset**

Run:
```bash
hugo --gc --minify
test -f public/images/image-converter/index.html && echo "page OK"
test -f public/vendor/libheif/libheif.js && echo "libheif published OK"
grep -l "Image Converter" public/images/index.html public/index.html
grep -o '"id":"image-converter"' public/index.json
```
Expected: exit 0 (esbuild may warn that the dynamic `import(LIBHEIF_SRC)` will not be bundled — that is EXPECTED and desired; it stays a runtime import. There must be no "could not resolve" error for `./formats.js` or `js/lib/dom.js`.) "page OK"; "libheif published OK"; the tool listed on both the Images page and the homepage; `index.json` contains `image-converter`.

- [ ] **Step 6: Run the full JS suite (no regressions)**

Run: `node --test`
Expected: all tests pass (formats + existing color/qr/convert/format suites).

- [ ] **Step 7: Commit**

```bash
git add content/images/image-converter layouts/tools/image-converter.html assets/css/site.css
git commit -m "Add image converter tool UI (canvas pipeline + lazy HEIC)"
```

---

## Notes for the Implementer

- **Browser smoke test is run by the controller** (Playwright + Firefox) after Task 3, against a local server: PNG→WebP, PNG→JPG (quality slider appears), JPG→PNG (no slider), SVG→PNG, and HEIC→JPG using `tests/fixtures/sample.heic`; each produces a downloadable blob; confirm the libheif module is requested ONLY during the HEIC conversion (lazy), and that everything works offline in Firefox.
- **Deploy is already automated.** Merging to `main` and pushing triggers `.github/workflows/deploy.yml`. The CI deb build is the real gate — watch the run with `gh run watch`.
- Do not add resize controls, batch conversion, or SVG/HEIC outputs (out of scope).
