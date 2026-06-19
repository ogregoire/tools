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
  img.onerror = () => { URL.revokeObjectURL(url); };
  img.src = url;
});

render();
