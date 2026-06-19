# Image Converter — Design

**Date:** 2026-06-19
**Status:** In review (design phase)

## Goal

Add an **image converter** to the **Images** category on the tools site
(ogregoire.be/tools). It converts a single image between formats entirely
client-side: **outputs** PNG, JPG, WebP; **sources** PNG, JPG, WebP, SVG, and
HEIC. SVG and HEIC are input-only. A quality slider controls lossy outputs
(JPG/WebP). Output keeps the source's pixel dimensions.

## Fit With Existing Architecture

Follows the established tool pattern (see the QR generator and unit converter):
- A tool is a **page bundle** under `content/images/<slug>/` with `type: tools`
  and a co-located entry JS bundled by Hugo `js.Build`.
- Pure logic lives in dependency-free ES modules (relative imports only),
  unit-tested with Node's built-in `node --test`.
- The homepage grid, the `index.json` search index, and the `/tools/images/`
  listing pick the tool up automatically. Category = section; only `tags` is a
  taxonomy.
- The site targets **Firefox**; UI is smoke-tested with Playwright + Firefox.
  The GitHub Actions deploy (official `hugo_extended` deb) is the real build
  gate — a local Homebrew `hugo` build is not a faithful proxy.
- Reuses the existing `layouts/partials/icon-download.html` and the `.type-btn`
  segmented-control styles.

## Scope

- **Outputs:** PNG, JPG, WebP. (No SVG output, no HEIC output.)
- **Sources:** PNG, JPG, WebP, SVG, HEIC/HEIF. (SVG and HEIC are input-only.)
- **Single file** at a time.
- **Quality slider** (0–100, default 90) shown only for JPG/WebP outputs; PNG is
  lossless (no slider).
- **Dimensions:** output matches the source's pixel dimensions. For SVG with no
  intrinsic size, fall back to its `viewBox`, else a default of 512×512. No
  resize controls.

## File Structure

```
content/images/image-converter/
├── index.md                  # front matter: type tools, layout, tags
├── formats.js                # pure: MIME/ext maps, isLossy, outputFilename, detectSourceType
└── image-converter.js        # entry: DOM, canvas pipeline, lazy HEIC decode
layouts/tools/
└── image-converter.html      # markup + js.Build include + libheif URL data-attr
static/vendor/libheif/
└── libheif.js                # VENDORED libheif-js ASM.js build + ESM export shim
tests/
└── formats.test.js           # pure-logic tests
```

## Conversion Pipeline (unified canvas)

Every source is decoded onto a `<canvas>`, then encoded once to the target:

1. User selects a file → `detectSourceType(file)` (MIME, falling back to
   extension — HEIC often has an empty/again unreliable MIME).
2. **Decode → canvas:**
   - **PNG/JPG/WebP:** `createImageBitmap(file)` → `drawImage` onto a canvas
     sized to the bitmap.
   - **SVG:** load as `<img>` from an object URL; size = `naturalWidth/Height`
     if present, else parsed `viewBox`, else 512×512; `drawImage`.
   - **HEIC:** lazy-load libheif (see below), decode to `ImageData`,
     `putImageData` onto the canvas.
3. **Encode:** `canvas.toBlob(MIME[format], quality)` where `quality` is
   `sliderValue / 100` for JPG/WebP and omitted for PNG.
4. **Result:** preview the output, show output filename + byte size, and a
   **Download** button (filename = source name with the new extension).

## HEIC via libheif-js (direct, lazy, vendored)

- **Library:** `libheif-js` (LGPL/MIT components; the emscripten **ASM.js**
  build — pure JavaScript, ~1.3 MB, **no `.wasm` file to host**). This is the
  same library family brevio.pro uses for in-browser HEIC.
- **Hosting:** vendored verbatim at `static/vendor/libheif/libheif.js` with a
  one-line **ESM export shim** appended (exposing the `libheif` object), so it
  can be dynamically imported as a module. Served from our origin (offline; no
  CDN). Provenance + license header preserved.
- **Lazy load:** the layout emits the vendored file's URL as a data attribute
  (`data-libheif-src`, via `relURL`). The entry calls `import(url)` **only on
  the first HEIC conversion**, caching the module. Non-HEIC conversions never
  fetch it.
- **Decode (direct to pixels):**
  ```js
  const { libheif } = await loadLibheif();
  const images = new libheif.HeifDecoder().decode(uint8Array);
  const image = images[0];
  const w = image.get_width(), h = image.get_height();
  const imageData = new ImageData(w, h);
  await new Promise((res, rej) =>
    image.display(imageData, (d) => (d ? res() : rej(new Error("HEIC decode failed")))));
  // putImageData(imageData) onto the canvas, then encode via toBlob
  ```
- **Primary implementation risk (verify early):** that the vendored ASM.js
  module loads via runtime `import(url)` from `static/`, works **offline** in
  Firefox, and decodes a real HEIC. Fallback if dynamic-import of the static
  file proves unreliable: build it as a fingerprinted `js.Build` resource and
  import its `RelPermalink` instead. Validated during implementation, not
  assumed.

## Pure Logic — `formats.js`

No DOM. No imports.

- `OUTPUT_FORMATS = ["png", "jpg", "webp"]`.
- `MIME = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" }`.
- `isLossy(format)` → `true` for `jpg`/`webp`, `false` for `png`.
- `outputFilename(inputName, format)` → input base name with the extension
  replaced by `.<format>` (jpg uses `.jpg`). Handles no-extension, multi-dot,
  and uppercase extensions. e.g. `("photo.HEIC","jpg") → "photo.jpg"`,
  `("a.b.png","webp") → "a.b.webp"`, `("noext","png") → "noext.png"`.
- `detectSourceType(file)` → one of `"png" | "jpeg" | "webp" | "svg" | "heic"`,
  or `null` if unsupported. Uses `file.type` when present, else the filename
  extension (`.jpg/.jpeg → jpeg`, `.heic/.heif → heic`, `.svg → svg`, etc.).

## Entry / DOM — `image-converter.js`

Imports `formats.js` (relative) and `js/lib/dom.js`. Lazy-imports the vendored
libheif module on demand.

- **Inputs:** a file input + a drag-and-drop zone accepting the five source
  types; a segmented **output-format toggle** (PNG/JPG/WebP, `.type-btn`); a
  **quality slider** (shown only for JPG/WebP).
- **Flow:** on file-select / format change / quality change, run the pipeline
  and update the preview. Show a *"Decoding HEIC…"* state while the lazy module
  loads/decodes. Empty/no-file → neutral state with the download disabled.
- **Result:** preview image, source info (name, detected format, W×H), output
  filename + byte size, **Download** button (reuses `icon-download.html`).
- **Errors (inline, non-blocking):** unsupported file type; decode failure
  (corrupt/unreadable); HEIC decode error. The tool never crashes.

## Layout

`layouts/tools/image-converter.html` — front matter `layout: image-converter`,
`type: tools`. Markup for the drop zone/file input, source info, the format
toggle, the quality slider, the preview, and the download button. The script
include uses the same `.Resources.GetMatch "image-converter.js" | js.Build
(dict "minify" hugo.IsProduction) | fingerprint` pattern. A
`data-libheif-src="{{ "vendor/libheif/libheif.js" | relURL }}"` attribute gives
the entry the lazy-import URL.

## Testing

- **`tests/formats.test.js` (Node):** `MIME` mapping; `isLossy` (jpg/webp true,
  png false); `outputFilename` (extension swap, no-extension, multi-dot,
  uppercase input); `OUTPUT_FORMATS`; `detectSourceType` for each source type
  (by MIME and by extension) and `null` for unsupported.
- **Build:** `hugo --gc --minify` clean; tool page + fingerprinted JS emitted;
  the vendored `libheif.js` published under `vendor/libheif/`; `/tools/images/`
  lists the tool; `index.json` includes it.
- **Live Firefox smoke (Playwright, controller-run):** PNG→WebP, PNG→JPG
  (quality slider appears), JPG→PNG (no slider), SVG→PNG, and **HEIC→JPG** using
  a tiny committed `.heic` fixture (generated with `sips`); each produces a
  downloadable file; the slider shows/hides with the format; confirm the
  libheif module is fetched only for the HEIC conversion. Verified against the
  deployed site after release.

## Out of Scope (for now)

- SVG and HEIC as outputs.
- Batch / multiple-file conversion and zip download.
- Resize/scale controls.
- Stripping/preserving EXIF metadata, color-profile management.
