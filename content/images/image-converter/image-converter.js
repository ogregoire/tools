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
    statusEl.hidden = true;
    if (seq !== convertSeq) return;
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
