# QR Code Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side QR code generator as the first tool in a new "Images" category on the Hugo tools site, with selectable error-correction level, opaque fg/bg colors, live SVG render, and SVG/PNG downloads.

**Architecture:** Follows the existing tool pattern — a page bundle under `content/images/qr-code-generator/` with a co-located entry script bundled by Hugo `js.Build`. A vendored MIT QR encoder (Nayuki) is wrapped by a pure, DOM-free `qr.js` (Node-tested). WCAG color math lives in a shared, documented `assets/js/lib/color.js` (Node-tested). The homepage grid, search index, and `/tools/images/` listing pick the tool up automatically.

**Tech Stack:** Hugo (extended) 0.163.3, esbuild via `js.Build`, Node 22 `node --test`, vendored `qrcodegen` (MIT), Playwright+Firefox for live smoke.

## Global Constraints

- A tool is a page bundle `content/<category>/<slug>/index.md` with front matter `type: tools` and `layout: <slug>`; its co-located entry JS is bundled via `.Resources.GetMatch | js.Build (dict "minify" hugo.IsProduction) | fingerprint`.
- Pure logic modules use **relative imports only** (no `js/lib/...`) so Node can run them directly. Entry/DOM modules import the shared lib assets-root-relative (`js/lib/dom.js`, `js/lib/color.js`).
- **Every exported function in `assets/js/lib/` has a doc comment** explaining purpose, inputs, and output.
- **No magic-number literals for defaults** — use named constants with an explanatory comment, referenced by name everywhere (including as parameter defaults): `QUIET_ZONE = 4`, `PNG_MODULE_SIZE = 8`.
- Colors are **opaque `#RRGGBB` only** (no alpha). Invalid/typed non-opaque values are rejected and do not update the code.
- Contrast decision + thresholds live in the lib (`meetsContrast`, `WCAG_CONTRAST`); default threshold WCAG AA normal = `4.5`. Warnings are **non-blocking** (warn only; still generate/download).
- Category = content section; the only taxonomy is `tags`. No `categories` taxonomy.
- The site targets **Firefox**; UI is smoke-tested with Playwright+Firefox. The GitHub Actions deploy (official `hugo_extended` deb) is the real build gate — a local Homebrew `hugo` build is not a faithful proxy (it can pass a build the CI deb fails). Push and watch the run.
- No npm runtime dependencies; `node --test`, no test deps. Commit after every task.

---

### Task 1: Shared color lib — `assets/js/lib/color.js` (TDD)

**Files:**
- Create: `assets/js/lib/color.js`
- Test: `tests/color.test.js`

**Interfaces:**
- Produces:
  - `isHexColor(value): boolean` — true only for opaque `#RRGGBB`.
  - `relativeLuminance(hex): number` — WCAG relative luminance `0..1`.
  - `contrastRatio(a, b): number` — WCAG contrast ratio `1..21`, symmetric.
  - `WCAG_CONTRAST` — frozen `{ AA_NORMAL: 4.5, AA_LARGE: 3, AAA_NORMAL: 7, AAA_LARGE: 4.5 }`.
  - `meetsContrast(a, b, threshold = WCAG_CONTRAST.AA_NORMAL): boolean`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test — `tests/color.test.js`**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/color.test.js`
Expected: FAIL — cannot find module `../assets/js/lib/color.js`.

- [ ] **Step 3: Implement `assets/js/lib/color.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/color.test.js`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add assets/js/lib/color.js tests/color.test.js
git commit -m "Add shared WCAG color lib (hex validation, luminance, contrast)"
```

---

### Task 2: Vendor the QR encoder — `qrcodegen.js`

**Files:**
- Create: `content/images/qr-code-generator/qrcodegen.js`

**Interfaces:**
- Produces: an ES module exporting `{ qrcodegen }`, where
  `qrcodegen.QrCode.encodeText(text, ecl)` returns a `QrCode` with `.size`
  (number) and `.getModule(x, y)` (boolean), and `qrcodegen.QrCode.Ecc` has
  `.LOW/.MEDIUM/.QUARTILE/.HIGH`. `encodeText` throws on data too long.
- Consumes: nothing.

- [ ] **Step 1: Download Nayuki's MIT encoder into the bundle**

Run:
```bash
mkdir -p content/images/qr-code-generator
curl -fsSL -o content/images/qr-code-generator/qrcodegen.js \
  https://raw.githubusercontent.com/nayuki/QR-Code-generator/master/typescript-javascript/qrcodegen.js
head -5 content/images/qr-code-generator/qrcodegen.js
grep -c "var qrcodegen" content/images/qr-code-generator/qrcodegen.js
```
Expected: the file downloads; `head` shows the MIT license comment header; the grep finds the `var qrcodegen` declaration (count ≥ 1). If the URL 404s, locate `qrcodegen.js` in the `nayuki/QR-Code-generator` repo (the compiled JavaScript build) and download that instead — do not hand-write a QR encoder. Keep the license header intact.

- [ ] **Step 2: Append a one-line ESM export shim**

Append exactly this line (do not modify the vendored code above it):
```bash
printf '\nexport { qrcodegen };\n' >> content/images/qr-code-generator/qrcodegen.js
```

- [ ] **Step 3: Verify it imports and encodes under Node**

Run:
```bash
node --input-type=module -e "import('./content/images/qr-code-generator/qrcodegen.js').then(m => { const q = m.qrcodegen.QrCode.encodeText('hi', m.qrcodegen.QrCode.Ecc.MEDIUM); console.log('ok size=' + q.size + ' m00=' + q.getModule(0,0)); });"
```
Expected: prints something like `ok size=21 m00=true` (a real QrCode with a numeric size and boolean modules). If it errors, the export shim or download is wrong — fix before committing.

- [ ] **Step 4: Commit**

```bash
git add content/images/qr-code-generator/qrcodegen.js
git commit -m "Vendor Nayuki QR Code generator (MIT) with ESM export shim"
```

---

### Task 3: Pure QR logic — `qr.js` (TDD)

**Files:**
- Create: `content/images/qr-code-generator/qr.js`
- Test: `tests/qr.test.js`

**Interfaces:**
- Consumes: `./qrcodegen.js` (Task 2) — `qrcodegen.QrCode.encodeText`, `.Ecc`, `.size`, `.getModule`.
- Produces:
  - `QUIET_ZONE` (number, 4), `PNG_MODULE_SIZE` (number, 8), `ECC_LEVELS` (`["L","M","Q","H"]`).
  - `buildMatrix(text, eccLabel): { size: number, modules: boolean[][] }` — `modules[y][x]`, true = dark. Throws if text exceeds capacity.
  - `toSvg(matrix, { fg, bg, quietZone = QUIET_ZONE }): string` — self-contained SVG; `viewBox` is `0 0 D D` with `D = size + 2*quietZone`.

- [ ] **Step 1: Write the failing test — `tests/qr.test.js`**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/qr.test.js`
Expected: FAIL — cannot find module `qr.js`.

- [ ] **Step 3: Implement `content/images/qr-code-generator/qr.js`**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/qr.test.js`
Expected: PASS — all tests pass.

- [ ] **Step 5: Run the full JS suite (no regressions)**

Run: `node --test`
Expected: all tests pass (color + qr + existing converter/format tests).

- [ ] **Step 6: Commit**

```bash
git add content/images/qr-code-generator/qr.js tests/qr.test.js
git commit -m "Add pure QR matrix + SVG logic with named constants"
```

---

### Task 4: Tool UI — category, content, layout, entry, icon, styles

**Files:**
- Create: `content/images/_index.md`
- Create: `content/images/qr-code-generator/index.md`
- Create: `layouts/partials/icon-download.html`
- Create: `layouts/tools/qr-code-generator.html`
- Create: `content/images/qr-code-generator/qr-code-generator.js`
- Modify: `assets/css/site.css` (append QR-tool styles)

**Interfaces:**
- Consumes: `./qr.js` (`ECC_LEVELS`, `QUIET_ZONE`, `PNG_MODULE_SIZE`, `buildMatrix`, `toSvg`); `js/lib/dom.js` (`qs`, `create`, `on`, `clear`); `js/lib/color.js` (`isHexColor`, `meetsContrast`, `relativeLuminance`).
- Produces: a working tool at `/tools/images/qr-code-generator/`; auto-listed on the homepage, `/tools/images/`, and in `index.json`.

- [ ] **Step 1: Create the category section — `content/images/_index.md`**

```markdown
---
title: Images
---

Tools for generating and working with images.
```

- [ ] **Step 2: Create the tool content page — `content/images/qr-code-generator/index.md`**

```markdown
---
title: QR Code Generator
type: tools
layout: qr-code-generator
summary: Generate a QR code from text or a URL, choose error-correction level and colors, and download it as SVG or PNG — all in your browser.
tags:
  - images
  - qr
  - qr-code
  - generator
---

Generate a QR code from any text or URL. Pick the error-correction level and
colors, then download it as SVG or PNG. Everything runs in your browser.
```

- [ ] **Step 3: Create the reusable download icon — `layouts/partials/icon-download.html`**

```html
<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  <polyline points="7 10 12 15 17 10"/>
  <line x1="12" y1="15" x2="12" y2="3"/>
</svg>
```

- [ ] **Step 4: Create the layout — `layouts/tools/qr-code-generator.html`**

```html
{{ define "main" }}
<article class="tool">
  <h1>{{ .Title }}</h1>
  {{ .Content }}

  <div class="qr">
    <label class="qr-field">Text or URL
      <input type="text" id="qr-text" value="https://ogregoire.be/tools/" autocomplete="off">
    </label>

    <label class="qr-field">Error correction
      <select id="qr-ecc"></select>
    </label>

    <div class="qr-colors">
      <fieldset>
        <legend>Foreground</legend>
        <input type="color" id="qr-fg" value="#000000" aria-label="Foreground color picker">
        <input type="text" id="qr-fg-hex" value="#000000" maxlength="7" spellcheck="false" aria-label="Foreground hex">
      </fieldset>
      <fieldset>
        <legend>Background</legend>
        <input type="color" id="qr-bg" value="#ffffff" aria-label="Background color picker">
        <input type="text" id="qr-bg-hex" value="#ffffff" maxlength="7" spellcheck="false" aria-label="Background hex">
      </fieldset>
    </div>

    <p class="qr-warning" id="qr-warning" role="status" hidden></p>
    <div class="qr-output" id="qr-output"></div>
    <p class="qr-error" id="qr-error" role="alert" hidden></p>

    <div class="qr-actions">
      <button type="button" id="qr-dl-svg">{{ partial "icon-download.html" . }}<span>Download SVG</span></button>
      <button type="button" id="qr-dl-png">{{ partial "icon-download.html" . }}<span>Download PNG</span></button>
    </div>
  </div>
</article>
{{ end }}

{{ define "scripts" }}
  {{ $entry := .Resources.GetMatch "qr-code-generator.js" }}
  {{ $js := $entry | js.Build (dict "minify" hugo.IsProduction) | fingerprint }}
  <script type="module" src="{{ $js.RelPermalink }}"></script>
{{ end }}
```

- [ ] **Step 5: Create the entry script — `content/images/qr-code-generator/qr-code-generator.js`**

```js
import { ECC_LEVELS, QUIET_ZONE, PNG_MODULE_SIZE, buildMatrix, toSvg } from "./qr.js";
import { qs, create, on, clear } from "js/lib/dom.js";
import { isHexColor, meetsContrast, relativeLuminance } from "js/lib/color.js";

const textEl = qs("#qr-text");
const eccEl = qs("#qr-ecc");
const fgEl = qs("#qr-fg");
const fgHexEl = qs("#qr-fg-hex");
const bgEl = qs("#qr-bg");
const bgHexEl = qs("#qr-bg-hex");
const warningEl = qs("#qr-warning");
const outputEl = qs("#qr-output");
const errorEl = qs("#qr-error");
const dlSvgEl = qs("#qr-dl-svg");
const dlPngEl = qs("#qr-dl-png");

const state = { fg: "#000000", bg: "#ffffff", svg: "", matrix: null };

for (const level of ECC_LEVELS) {
  eccEl.append(create("option", { value: level, textContent: level, selected: level === "M" }));
}

function setActionsEnabled(enabled) {
  dlSvgEl.disabled = !enabled;
  dlPngEl.disabled = !enabled;
}

function showWarnings() {
  const msgs = [];
  if (!meetsContrast(state.fg, state.bg)) {
    msgs.push("Low contrast — this code may not scan reliably.");
  }
  if (relativeLuminance(state.fg) > relativeLuminance(state.bg)) {
    msgs.push("Inverted colors (light on dark) — older scanners may have trouble reading this code.");
  }
  warningEl.textContent = msgs.join(" ");
  warningEl.hidden = msgs.length === 0;
}

function render() {
  errorEl.hidden = true;
  const text = textEl.value;
  if (!text) {
    clear(outputEl);
    state.svg = "";
    state.matrix = null;
    setActionsEnabled(false);
    showWarnings();
    return;
  }
  try {
    state.matrix = buildMatrix(text, eccEl.value);
  } catch (e) {
    clear(outputEl);
    state.svg = "";
    state.matrix = null;
    setActionsEnabled(false);
    errorEl.textContent = "Text too long for a QR code at this error-correction level.";
    errorEl.hidden = false;
    showWarnings();
    return;
  }
  state.svg = toSvg(state.matrix, { fg: state.fg, bg: state.bg });
  outputEl.innerHTML = state.svg;
  setActionsEnabled(true);
  showWarnings();
}

// Bidirectional sync between a native color swatch and a #RRGGBB text field.
function bindColor(swatch, hexField, key) {
  on(swatch, "input", () => {
    state[key] = swatch.value;
    hexField.value = swatch.value;
    hexField.setCustomValidity("");
    render();
  });
  on(hexField, "input", () => {
    const v = hexField.value.trim();
    if (isHexColor(v)) {
      hexField.setCustomValidity("");
      state[key] = v.toLowerCase();
      swatch.value = state[key];
      render();
    } else {
      hexField.setCustomValidity("Use an opaque #RRGGBB color.");
    }
  });
}
bindColor(fgEl, fgHexEl, "fg");
bindColor(bgEl, bgHexEl, "bg");

on(textEl, "input", render);
on(eccEl, "change", render);

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = create("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

on(dlSvgEl, "click", () => {
  if (!state.svg) return;
  download(new Blob([state.svg], { type: "image/svg+xml" }), "qr-code.svg");
});

on(dlPngEl, "click", () => {
  if (!state.matrix || !state.svg) return;
  const dim = state.matrix.size + 2 * QUIET_ZONE;
  const px = dim * PNG_MODULE_SIZE;
  const url = URL.createObjectURL(new Blob([state.svg], { type: "image/svg+xml" }));
  const img = new Image();
  img.onload = () => {
    const canvas = create("canvas", { width: px, height: px });
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, px, px);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => { if (blob) download(blob, "qr-code.png"); }, "image/png");
  };
  img.src = url;
});

render();
```

- [ ] **Step 6: Append QR styles to `assets/css/site.css`**

Append this block to the end of `assets/css/site.css`:
```css
.qr { display: flex; flex-direction: column; gap: 1rem; max-width: 28rem; }
.qr-field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.9rem; }
.qr-field input, .qr-field select { padding: 0.5rem; font-size: 1rem;
  border: 1px solid var(--border); border-radius: 8px; }
.qr-colors { display: flex; gap: 1rem; flex-wrap: wrap; }
.qr-colors fieldset { border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 0.8rem; }
.qr-colors legend { font-size: 0.8rem; color: var(--muted); }
.qr-colors input[type="color"] { width: 2.5rem; height: 2rem; vertical-align: middle; }
.qr-colors input[type="text"] { width: 6rem; margin-left: 0.4rem; padding: 0.3rem;
  border: 1px solid var(--border); border-radius: 6px; font-family: monospace; }
.qr-warning { color: #92400e; background: #fef3c7; border-radius: 8px; padding: 0.5rem 0.8rem; margin: 0; }
.qr-error { color: #991b1b; background: #fee2e2; border-radius: 8px; padding: 0.5rem 0.8rem; margin: 0; }
.qr-output svg { width: min(320px, 80vw); height: auto; display: block; }
.qr-actions { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.qr-actions button { display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 0.9rem; border: 1px solid var(--border); border-radius: 8px;
  background: #fff; cursor: pointer; }
.qr-actions button:disabled { opacity: 0.5; cursor: not-allowed; }
.qr-actions .icon { display: block; }
```

- [ ] **Step 7: Build and verify the tool, listing, and search index**

Run:
```bash
hugo --gc --minify
test -f public/images/qr-code-generator/index.html && echo "page OK"
grep -l "QR Code Generator" public/images/index.html public/index.html
grep -o '"id":"qr-code-generator"' public/index.json
```
Expected: exit 0 with no esbuild "could not resolve" error; "page OK"; the tool appears on both the Images category page and the homepage; `index.json` contains the `qr-code-generator` entry. (If esbuild cannot resolve `./qr.js`/`./qrcodegen.js` or `js/lib/...`, confirm the `content`→`assets` `files = "**/*.js"` mount in `hugo.toml` is present.)

- [ ] **Step 8: Run the full JS suite (no regressions)**

Run: `node --test`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add content/images layouts/tools/qr-code-generator.html layouts/partials/icon-download.html assets/css/site.css
git commit -m "Add QR code generator tool UI in new Images category"
```

---

## Notes for the Implementer

- **Browser smoke test is run by the controller** (Playwright + Firefox), not inside a task. After Task 4, the controller verifies live: text renders an SVG grid; ECC change re-renders; fg/bg changes recolor; a low-contrast pair shows the low-contrast warning; an inverted pair (light fg on dark bg) shows the inverted-colors warning; SVG and PNG download buttons produce files.
- **Deploy is already automated.** Once merged to `main` and pushed, the existing `.github/workflows/deploy.yml` builds and deploys to GitHub Pages. The CI deb build is the real gate — watch the run with `gh run watch`.
- Do not add size/quiet-zone UI controls or alpha colors (out of scope).
