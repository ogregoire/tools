# QR Code Generator — Design

**Date:** 2026-06-19
**Status:** In review (design phase)

## Goal

Add a **QR code generator** as the first tool in a new **Images** category on the
tools site (ogregoire.be/tools). It generates a QR code from text/URL input
entirely client-side, with selectable error-correction level and opaque
foreground/background colors, renders live as SVG, and downloads as SVG or PNG.

## Fit With Existing Architecture

Follows the established tool pattern (see the unit converter):
- A tool is a **page bundle** under `content/<category>/<slug>/` with
  `type: tools` and a co-located entry JS bundled by Hugo `js.Build`.
- Pure logic lives in dependency-free ES modules (relative imports only) so it is
  unit-testable with Node's built-in `node --test`.
- Shared, reusable helpers live in `assets/js/lib/` and are imported
  assets-root-relative (e.g. `js/lib/color.js`).
- A new category is just a new content **section**; the homepage grid, the
  `index.json` search index, and the `/tools/<category>/` listing pick it up
  automatically. Category = section (no `categories` taxonomy); only `tags` is a
  taxonomy.
- The site targets **Firefox**; UI is smoke-tested with Playwright + Firefox. The
  GitHub Actions deploy (official `hugo_extended` deb) is the real build gate —
  a local Homebrew `hugo` build is not a faithful proxy.

## File Structure

```
content/images/
├── _index.md                          # category "Images" (title only)
└── qr-code-generator/                  # page bundle
    ├── index.md                       # front matter: type tools, layout, tags
    ├── qrcodegen.js                   # VENDORED MIT encoder + ESM export shim
    ├── qr.js                          # pure: matrix + SVG (no DOM)
    └── qr-code-generator.js           # entry: DOM wiring, render, downloads
assets/js/lib/
└── color.js                           # WCAG color helpers (shared, commented)
layouts/
├── tools/qr-code-generator.html        # markup + js.Build script include
└── partials/icon-download.html         # reusable inline-SVG download icon
tests/
├── qr.test.js                         # buildMatrix / toSvg
└── color.test.js                      # color lib
```

## Vendored Encoder

- Use **Nayuki's QR Code generator** (MIT licensed), a single dependency-free
  file. Obtain it from the official repository (raw download), preserving the
  MIT license header verbatim.
- Source: `nayuki/QR-Code-generator`, the plain-JavaScript build
  (`qrcodegen.js`, which defines a `qrcodegen` module-pattern object).
- Append a one-line ESM export (`export { qrcodegen };`) so esbuild (`js.Build`)
  can import it. No other modification to the vendored code.
- `qr.js` is the only module that imports `qrcodegen.js`; the rest of the tool
  depends on `qr.js`, not the vendored internals.

## Pure Logic — `qr.js`

No DOM. Imports only `./qrcodegen.js`.

**Named, commented constants — no magic numbers inline.** Every default value is
a named constant with an explanatory comment, referenced by name everywhere
(including as a parameter default), e.g.:

```js
/* Quiet zone: the blank margin (in modules) required around a QR code so
   scanners can isolate it. The QR spec mandates at least 4 modules. */
export const QUIET_ZONE = 4;

/* PNG export resolution: pixels rendered per QR module when rasterizing the
   SVG to a raster image. Larger = sharper/bigger file. */
export const PNG_MODULE_SIZE = 8;
```

Functions take these as parameters defaulting to the constant — never a bare
literal:

- `buildMatrix(text, eccLabel)` → `{ size, modules }` where `modules` is a
  `size × size` array of booleans (true = dark). `eccLabel` is one of
  `"L" | "M" | "Q" | "H"`. Throws if `text` exceeds QR capacity at that level.
- `toSvg(matrix, { fg, bg, quietZone = QUIET_ZONE })` → a self-contained SVG
  string. `viewBox` in module units (size + 2 × `quietZone`);
  `shape-rendering: crispEdges`; a background `rect` (bg) plus one `rect` per
  dark module (fg). Colors are the validated `#RRGGBB` strings passed in.
- `ECC_LEVELS` — exported ordered list `["L","M","Q","H"]` for the UI selector,
  with `"M"` as the default.

## Shared Color Lib — `assets/js/lib/color.js`

Standard WCAG color math, reusable across tools (not QR-specific). **Every
exported function has a doc comment** explaining purpose, inputs, and output.

- `isHexColor(value)` → boolean. True only for an opaque `#RRGGBB` string
  (leading `#`, exactly 6 hex digits). Rejects `#RGB`, `#RRGGBBAA`, `rgba()`,
  named colors, and bad lengths/characters.
- `relativeLuminance(hex)` → number `0..1`. WCAG relative luminance of an
  opaque `#RRGGBB` color (sRGB linearization, Rec. 709 weights).
- `contrastRatio(a, b)` → number `1..21`. WCAG contrast ratio between two
  `#RRGGBB` colors; symmetric in its arguments.
- `WCAG_CONTRAST` → frozen object of standard thresholds:
  `{ AA_NORMAL: 4.5, AA_LARGE: 3, AAA_NORMAL: 7, AAA_LARGE: 4.5 }`.
- `meetsContrast(a, b, threshold = WCAG_CONTRAST.AA_NORMAL)` → boolean.
  Whether the pair's contrast ratio meets/exceeds the threshold. The threshold
  and the decision live here; tools only decide how to react.

## Entry / DOM — `qr-code-generator.js`

Imports `qr.js` (relative) and `js/lib/dom.js`, `js/lib/color.js` (assets-root).

- **Inputs:** a text/URL field (live), an error-correction `<select>` (L/M/Q/H,
  default M), and two color controls (foreground, background).
- **Color control (each):** a native opaque color picker (clickable swatch,
  `#RRGGBB` only) **synced bidirectionally** with a `#RRGGBB` text field. Typing
  a valid `#RRGGBB` updates the swatch and re-renders; an invalid or non-opaque
  value is rejected (marked, no update). Defaults: fg `#000000`, bg `#FFFFFF`.
- **Render:** on any change, recolor or (for text/ECC changes) rebuild then
  render the SVG into the page live. Empty input → neutral empty state. Capacity
  overflow (thrown by `buildMatrix`) → friendly inline message, no crash.
- **Warnings (non-blocking, warn only — the code is still generated and
  downloadable):**
  - *Low contrast:* call `meetsContrast(fg, bg)`; when `false`, show "Low
    contrast — this code may not scan reliably."
  - *Inverted colors:* when the foreground is lighter than the background
    (`relativeLuminance(fg) > relativeLuminance(bg)`, using the lib's luminance),
    show "Inverted colors (light on dark) — older scanners may have trouble
    reading this code." This is independent of contrast (a perfectly
    high-contrast inverted code still warns). Both warnings can show at once.
- **Downloads:** two buttons, each showing a **download icon** (inline SVG)
  next to its label. "Download SVG" → a Blob (`image/svg+xml`) saved as
  `qr-code.svg`; "Download PNG" → draw the SVG onto a canvas sized at
  `PNG_MODULE_SIZE` pixels per module (imported from `qr.js`, not a literal),
  `canvas.toBlob` saved as `qr-code.png`. Both fully client-side. The icon is a
  reusable Hugo partial (`layouts/partials/icon-download.html`) holding an inline
  SVG glyph — no external image asset — so other tools can reuse it.

## Layout

`layouts/tools/qr-code-generator.html` — front-matter `layout: qr-code-generator`,
`type: tools`. Markup for the input, ECC select, the two color controls, the
contrast warning region, the SVG output container, and the two download buttons
(each rendering the `icon-download.html` partial plus a text label).
Script include uses the same
`.Resources.GetMatch "qr-code-generator.js" | js.Build (dict "minify" hugo.IsProduction) | fingerprint`
pattern as the converter. No card/layout changes are needed; the new tool is
picked up automatically as a `type: tools` page in the `images` section.

## Testing

- **`tests/color.test.js` (Node):** `contrastRatio("#000000","#FFFFFF") === 21`;
  equal colors → `1`; symmetry (`contrastRatio(a,b) === contrastRatio(b,a)`);
  `isHexColor` accepts `#RRGGBB`, rejects `#RGB` / `#RRGGBBAA` / `rgba(...)` /
  named / wrong length / non-hex; `meetsContrast` true at/above and false below
  threshold; `WCAG_CONTRAST.AA_NORMAL === 4.5`.
- **`tests/qr.test.js` (Node):** `buildMatrix` returns the expected `size` and
  stable module values for a known `(text, ecc)` (deterministic encoder);
  `buildMatrix` throws on text that exceeds capacity; `toSvg` returns a string
  whose `viewBox` accounts for size + 2 × `QUIET_ZONE` modules and that contains
  the provided fg/bg colors.
- **Build:** `hugo --gc --minify` clean; the tool page and a fingerprinted JS
  bundle are emitted; `/tools/images/` lists the tool; `index.json` includes it.
- **Live Firefox smoke (Playwright):** entering text renders an SVG with the
  expected module grid; changing ECC re-renders; changing fg/bg recolors the
  SVG; a low-contrast pair shows the low-contrast warning; an inverted pair
  (light fg on dark bg) shows the inverted-colors warning; the SVG and PNG
  download controls produce downloads. Verified against the deployed site after
  release.

## Out of Scope (for now)

- Size/scale and quiet-zone controls (fixed sensible defaults).
- Non-opaque (alpha) colors.
- Logo/image embedding, batch generation, other QR data modes (vCard, WiFi).
