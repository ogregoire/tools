# Tools Site + Unit Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Hugo static site of categorized, tagged, id-searchable tools deployed to `ogregoire.be/tools`, with a unit converter as the first tool.

**Architecture:** Hugo generates the site; the category is a content section (`/tools/converters/`) and `tags` is the only taxonomy. Each tool is a page bundle (`content/<category>/<slug>/index.md`) with co-located JS. Pure conversion/formatting logic lives in dependency-free ES modules tested with Node's built-in runner; DOM wiring imports a shared `assets/js/lib/` library and is bundled by Hugo's `js.Build` (esbuild).

**Tech Stack:** Hugo (extended) 0.163.3, Node 22 (`node --test`, native ESM), esbuild via Hugo Pipes `js.Build`, GitHub Actions → GitHub Pages.

## Global Constraints

- Hugo **extended**, version **0.163.3** (matches the deploy workflow's `HUGO_VERSION`).
- `baseURL = "https://ogregoire.be/tools/"` — never hardcode absolute `/tools/...` paths in templates; use `.RelPermalink` / `relURL`.
- Node test runner only — **no npm dependencies**. `package.json` has `"type": "module"`.
- Only taxonomy is `tags`. Category = content section; there is **no `categories` taxonomy**.
- Tool **id = slug = page-bundle folder name** (`.File.ContentBaseName`). The same id is used in cards (`data-id`) and `index.json`.
- Pure logic modules (`units.js`, `convert.js`, `format.js`) use **relative imports only** (no `lib/` imports) so Node can run them directly. DOM/entry modules may use assets-relative `lib/...` imports (resolved by esbuild only).
- Precision rule: numbers shown to ≤6 significant digits, trailing zeros trimmed (`formatNumber`).
- Dropdown unit groups ordered **metric → imperial → us → nautical**; labels: "Metric (SI)", "Imperial", "US customary", "Nautical".
- Commit after every task.

---

### Task 1: Repo scaffold & buildable empty Hugo site

**Files:**
- Create: `hugo.toml`
- Create: `content/_index.md`
- Create: `layouts/_default/baseof.html`
- Create: `layouts/_default/home.html`
- Create: `layouts/partials/head.html`
- Create: `layouts/partials/header.html`
- Create: `layouts/partials/footer.html`
- Create: `assets/css/site.css`

**Interfaces:**
- Produces: a Hugo project that builds to `public/index.html`; base template with `main` and `scripts` blocks; CSS pipeline via `resources.Get "css/site.css"`.

- [ ] **Step 1: Ensure Hugo extended is installed**

Run: `hugo version || brew install hugo`
Expected: prints a version line containing `v0.163.3` and `+extended` (install if missing).

- [ ] **Step 2: Create `hugo.toml`**

```toml
baseURL = "https://ogregoire.be/tools/"
languageCode = "en-us"
title = "Tools"
enableRobotsTXT = true

# Only `tags` — overriding the defaults drops the `categories` taxonomy.
[taxonomies]
  tag = "tags"

[outputs]
  home = ["HTML", "JSON"]

[markup.goldmark.renderer]
  unsafe = true
```

- [ ] **Step 3: Create `content/_index.md`**

```markdown
---
title: Tools
---
```

- [ ] **Step 4: Create `layouts/_default/baseof.html`**

```html
<!DOCTYPE html>
<html lang="{{ site.LanguageCode }}">
<head>
  {{ partial "head.html" . }}
</head>
<body>
  {{ partial "header.html" . }}
  <main>
    {{ block "main" . }}{{ end }}
  </main>
  {{ partial "footer.html" . }}
  {{ block "scripts" . }}{{ end }}
</body>
</html>
```

- [ ] **Step 5: Create the three partials**

`layouts/partials/head.html`:
```html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ if .IsHome }}{{ site.Title }}{{ else }}{{ .Title }} · {{ site.Title }}{{ end }}</title>
{{ with .Description }}<meta name="description" content="{{ . }}">{{ end }}
{{ $css := resources.Get "css/site.css" | minify | fingerprint }}
<link rel="stylesheet" href="{{ $css.RelPermalink }}">
```

`layouts/partials/header.html`:
```html
<header class="site-header">
  <a class="site-title" href="{{ "/" | relURL }}">{{ site.Title }}</a>
</header>
```

`layouts/partials/footer.html`:
```html
<footer class="site-footer">
  <p>{{ site.Title }}</p>
</footer>
```

- [ ] **Step 6: Create `layouts/_default/home.html` (temporary placeholder)**

```html
{{ define "main" }}
<section class="home">
  <h1>{{ site.Title }}</h1>
</section>
{{ end }}
```

- [ ] **Step 7: Create `assets/css/site.css`**

```css
:root {
  --max-width: 56rem;
  --fg: #1a1a1a;
  --muted: #666;
  --accent: #2563eb;
  --border: #e2e2e2;
  --bg-soft: #f6f7f9;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; color: var(--fg); line-height: 1.5; }
main { max-width: var(--max-width); margin: 0 auto; padding: 1.5rem; }
.site-header, .site-footer {
  max-width: var(--max-width); margin: 0 auto; padding: 1rem 1.5rem;
}
.site-footer { color: var(--muted); border-top: 1px solid var(--border); margin-top: 3rem; }
.site-title { font-weight: 700; text-decoration: none; color: var(--fg); }
a { color: var(--accent); }

#tool-search {
  width: 100%; padding: 0.6rem 0.8rem; font-size: 1rem;
  border: 1px solid var(--border); border-radius: 8px; margin: 1rem 0 1.5rem;
}
.tool-grid { list-style: none; padding: 0; margin: 0; display: grid;
  gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); }
.tool-card { border: 1px solid var(--border); border-radius: 10px; }
.tool-card a { display: block; padding: 1rem; text-decoration: none; color: inherit; }
.tool-card h2 { margin: 0 0 0.25rem; font-size: 1.1rem; }
.tool-category { font-size: 0.8rem; color: var(--muted); }
.tags { list-style: none; padding: 0; margin: 0.5rem 0 0; display: flex; flex-wrap: wrap; gap: 0.3rem; }
.tags li { font-size: 0.7rem; background: var(--bg-soft); border-radius: 999px; padding: 0.1rem 0.5rem; }

.converter-types { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1rem 0; }
.type-btn { padding: 0.4rem 0.8rem; border: 1px solid var(--border); background: #fff;
  border-radius: 999px; cursor: pointer; }
.type-btn.is-active { background: var(--accent); color: #fff; border-color: var(--accent); }
.converter-row { display: flex; flex-wrap: wrap; align-items: end; gap: 1rem; }
.converter-row label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.9rem; }
.converter-row input, .converter-row select { padding: 0.5rem; font-size: 1rem;
  border: 1px solid var(--border); border-radius: 8px; }
#swap { align-self: center; padding: 0.5rem 0.7rem; cursor: pointer;
  border: 1px solid var(--border); border-radius: 8px; background: #fff; }
```

- [ ] **Step 8: Build to verify the site compiles**

Run: `hugo --gc`
Expected: exits 0; `public/index.html` exists (verify with `test -f public/index.html && echo OK`).

- [ ] **Step 9: Commit**

```bash
git add hugo.toml content layouts assets
git commit -m "Scaffold buildable Hugo site with base layout and styles"
```

---

### Task 2: Node test harness + `formatNumber` (TDD)

**Files:**
- Create: `package.json`
- Create: `assets/js/lib/format.js`
- Test: `tests/format.test.js`

**Interfaces:**
- Produces: `formatNumber(value: number, sigDigits = 6): string` — ≤`sigDigits` significant digits, trailing zeros trimmed, `""` for non-finite, `"0"` for zero.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tools",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write the failing test — `tests/format.test.js`**

```js
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/format.test.js`
Expected: FAIL — cannot find module `../assets/js/lib/format.js`.

- [ ] **Step 4: Implement `assets/js/lib/format.js`**

```js
// Format a number to at most `sigDigits` significant digits,
// trimming trailing zeros. Returns a string ("" for non-finite, "0" for zero).
export function formatNumber(value, sigDigits = 6) {
  if (!Number.isFinite(value)) return "";
  if (value === 0) return "0";
  return String(Number(value.toPrecision(sigDigits)));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/format.test.js`
Expected: PASS — 7 tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json assets/js/lib/format.js tests/format.test.js
git commit -m "Add Node test harness and formatNumber helper"
```

---

### Task 3: Conversion engine — `units.js` + `convert.js` (TDD)

**Files:**
- Create: `content/converters/unit-converter/units.js`
- Create: `content/converters/unit-converter/convert.js`
- Test: `tests/convert.test.js`

**Interfaces:**
- Produces:
  - `UNITS` — object: `type -> { label, units: [{ id, label, system, factor? }] }`.
  - `TYPES: string[]` — `["length","area","weight","temperature","volume","speed"]`.
  - `SYSTEM_ORDER`, `SYSTEM_LABELS` — group ordering/labels.
  - `convert(type, value, fromId, toId): number`.
  - `unitsByGroup(type): [{ system, label, units }]` — non-empty groups in canonical order.
- Consumes: nothing external (relative imports only).

- [ ] **Step 1: Create `content/converters/unit-converter/units.js`**

```js
// Unit definitions. Each type has a base unit; `factor` is how many base
// units one of this unit equals (baseValue = value * factor). Temperature
// has no factors and is special-cased in convert.js.

export const SYSTEM_ORDER = ["metric", "imperial", "us", "nautical"];

export const SYSTEM_LABELS = {
  metric: "Metric (SI)",
  imperial: "Imperial",
  us: "US customary",
  nautical: "Nautical",
};

export const UNITS = {
  length: {
    label: "Length",
    units: [
      { id: "mm", label: "millimeter (mm)", system: "metric", factor: 0.001 },
      { id: "cm", label: "centimeter (cm)", system: "metric", factor: 0.01 },
      { id: "m", label: "meter (m)", system: "metric", factor: 1 },
      { id: "km", label: "kilometer (km)", system: "metric", factor: 1000 },
      { id: "in", label: "inch (in)", system: "imperial", factor: 0.0254 },
      { id: "ft", label: "foot (ft)", system: "imperial", factor: 0.3048 },
      { id: "yd", label: "yard (yd)", system: "imperial", factor: 0.9144 },
      { id: "mi", label: "mile (mi)", system: "imperial", factor: 1609.344 },
      { id: "nmi", label: "nautical mile (nmi)", system: "nautical", factor: 1852 },
    ],
  },
  area: {
    label: "Area",
    units: [
      { id: "mm2", label: "square millimeter (mm²)", system: "metric", factor: 0.000001 },
      { id: "cm2", label: "square centimeter (cm²)", system: "metric", factor: 0.0001 },
      { id: "m2", label: "square meter (m²)", system: "metric", factor: 1 },
      { id: "are", label: "are (a)", system: "metric", factor: 100 },
      { id: "ha", label: "hectare (ha)", system: "metric", factor: 10000 },
      { id: "km2", label: "square kilometer (km²)", system: "metric", factor: 1000000 },
      { id: "in2", label: "square inch (in²)", system: "imperial", factor: 0.00064516 },
      { id: "ft2", label: "square foot (ft²)", system: "imperial", factor: 0.09290304 },
      { id: "yd2", label: "square yard (yd²)", system: "imperial", factor: 0.83612736 },
      { id: "acre", label: "acre", system: "imperial", factor: 4046.8564224 },
      { id: "mi2", label: "square mile (mi²)", system: "imperial", factor: 2589988.110336 },
    ],
  },
  weight: {
    label: "Weight",
    units: [
      { id: "mg", label: "milligram (mg)", system: "metric", factor: 0.000001 },
      { id: "g", label: "gram (g)", system: "metric", factor: 0.001 },
      { id: "kg", label: "kilogram (kg)", system: "metric", factor: 1 },
      { id: "t", label: "tonne (t)", system: "metric", factor: 1000 },
      { id: "oz", label: "ounce (oz)", system: "imperial", factor: 0.028349523125 },
      { id: "lb", label: "pound (lb)", system: "imperial", factor: 0.45359237 },
      { id: "st", label: "stone (st)", system: "imperial", factor: 6.35029318 },
    ],
  },
  temperature: {
    label: "Temperature",
    units: [
      { id: "C", label: "Celsius (°C)", system: "metric" },
      { id: "K", label: "Kelvin (K)", system: "metric" },
      { id: "F", label: "Fahrenheit (°F)", system: "imperial" },
    ],
  },
  volume: {
    label: "Volume",
    units: [
      { id: "ml", label: "milliliter (mL)", system: "metric", factor: 0.001 },
      { id: "l", label: "liter (L)", system: "metric", factor: 1 },
      { id: "m3", label: "cubic meter (m³)", system: "metric", factor: 1000 },
      { id: "tsp", label: "teaspoon (tsp)", system: "us", factor: 0.00492892159375 },
      { id: "tbsp", label: "tablespoon (tbsp)", system: "us", factor: 0.01478676478125 },
      { id: "floz", label: "fluid ounce (fl oz)", system: "us", factor: 0.0295735295625 },
      { id: "cup", label: "cup", system: "us", factor: 0.2365882365 },
      { id: "pt", label: "pint (pt)", system: "us", factor: 0.473176473 },
      { id: "qt", label: "quart (qt)", system: "us", factor: 0.946352946 },
      { id: "gal", label: "gallon (gal)", system: "us", factor: 3.785411784 },
    ],
  },
  speed: {
    label: "Speed",
    units: [
      { id: "m_s", label: "meter/second (m/s)", system: "metric", factor: 1 },
      { id: "km_s", label: "kilometer/second (km/s)", system: "metric", factor: 1000 },
      { id: "km_h", label: "kilometer/hour (km/h)", system: "metric", factor: 0.2777777777777778 },
      { id: "ft_s", label: "foot/second (ft/s)", system: "imperial", factor: 0.3048 },
      { id: "mi_s", label: "mile/second (mi/s)", system: "imperial", factor: 1609.344 },
      { id: "mph", label: "mile/hour (mph)", system: "imperial", factor: 0.44704 },
      { id: "kn", label: "knot (kn)", system: "nautical", factor: 0.5144444444444445 },
    ],
  },
};

export const TYPES = Object.keys(UNITS);
```

- [ ] **Step 2: Write the failing test — `tests/convert.test.js`**

```js
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/convert.test.js`
Expected: FAIL — cannot find module `convert.js`.

- [ ] **Step 4: Implement `content/converters/unit-converter/convert.js`**

```js
import { UNITS, SYSTEM_ORDER, SYSTEM_LABELS } from "./units.js";

function toCelsius(value, unit) {
  switch (unit) {
    case "C": return value;
    case "K": return value - 273.15;
    case "F": return (value - 32) * 5 / 9;
    default: throw new Error(`Unknown temperature unit: ${unit}`);
  }
}
function fromCelsius(value, unit) {
  switch (unit) {
    case "C": return value;
    case "K": return value + 273.15;
    case "F": return value * 9 / 5 + 32;
    default: throw new Error(`Unknown temperature unit: ${unit}`);
  }
}

function findUnit(type, id) {
  const def = UNITS[type];
  if (!def) throw new Error(`Unknown type: ${type}`);
  const unit = def.units.find((u) => u.id === id);
  if (!unit) throw new Error(`Unknown unit '${id}' for type '${type}'`);
  return unit;
}

// Convert `value` of unit `fromId` to unit `toId` within `type`.
export function convert(type, value, fromId, toId) {
  if (type === "temperature") {
    return fromCelsius(toCelsius(value, fromId), toId);
  }
  const from = findUnit(type, fromId);
  const to = findUnit(type, toId);
  return (value * from.factor) / to.factor;
}

// Units grouped by system, canonical order, for building <optgroup>s.
export function unitsByGroup(type) {
  const def = UNITS[type];
  if (!def) throw new Error(`Unknown type: ${type}`);
  return SYSTEM_ORDER
    .map((system) => ({
      system,
      label: SYSTEM_LABELS[system],
      units: def.units.filter((u) => u.system === system),
    }))
    .filter((group) => group.units.length > 0);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/convert.test.js`
Expected: PASS — all tests pass.

- [ ] **Step 6: Commit**

```bash
git add content/converters/unit-converter/units.js content/converters/unit-converter/convert.js tests/convert.test.js
git commit -m "Add unit definitions and pure conversion engine"
```

---

### Task 4: Shared DOM helpers — `assets/js/lib/dom.js`

**Files:**
- Create: `assets/js/lib/dom.js`

**Interfaces:**
- Produces: `qs(selector, root?)`, `qsa(selector, root?): Element[]`, `create(tag, props?, children?): Element`, `on(el, event, handler)`, `clear(el)`.
- Note: DOM-dependent; verified through the converter browser smoke test in Task 5, not Node unit tests.

- [ ] **Step 1: Create `assets/js/lib/dom.js`**

```js
// Tiny DOM helpers shared across tools.

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

// Create an element. `props` keys: `class`, `dataset` (object), any element
// property (e.g. textContent, value, type), else falls back to setAttribute.
// `children` may be a node, string, or array thereof.
export function create(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "dataset") {
      Object.assign(el.dataset, value);
    } else if (key === "class") {
      el.className = value;
    } else if (key in el) {
      el[key] = value;
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    el.append(child);
  }
  return el;
}

export const on = (el, event, handler) => el.addEventListener(event, handler);

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}
```

- [ ] **Step 2: Lint-check it parses under Node (syntax only)**

Run: `node --check assets/js/lib/dom.js`
Expected: exits 0, no output.

- [ ] **Step 3: Commit**

```bash
git add assets/js/lib/dom.js
git commit -m "Add shared DOM helper library"
```

---

### Task 5: Unit converter UI — layout, content, entry script

**Files:**
- Create: `content/converters/unit-converter/index.md`
- Create: `content/converters/unit-converter/unit-converter.js`
- Create: `layouts/tools/unit-converter.html`

**Interfaces:**
- Consumes: `convert`, `unitsByGroup`, `UNITS`, `TYPES` (Task 3); `qs`, `create`, `on`, `clear` (Task 4); `formatNumber` (Task 2).
- Produces: a working converter at `/tools/converters/unit-converter/`. **Validates the spec's open question:** that a content-bundle entry can import from `assets/js/lib/` through `js.Build`.

- [ ] **Step 1: Create `content/converters/unit-converter/index.md`**

```markdown
---
title: Unit Converter
type: tools
layout: unit-converter
summary: Convert length, area, weight, temperature, volume, and speed between metric, imperial, US, and nautical units.
tags:
  - units
  - length
  - area
  - weight
  - temperature
  - volume
  - speed
---

Convert between units of length, area, weight, temperature, volume, and speed.
```

- [ ] **Step 2: Create `layouts/tools/unit-converter.html`**

```html
{{ define "main" }}
<article class="tool">
  <h1>{{ .Title }}</h1>
  {{ .Content }}

  <div class="converter" id="converter">
    <div class="converter-types" id="converter-types" role="tablist" aria-label="Measurement type"></div>

    <div class="converter-row">
      <label>From
        <input type="number" id="from-value" value="1" step="any">
        <select id="from-unit" aria-label="From unit"></select>
      </label>
      <button type="button" id="swap" aria-label="Swap units">⇄</button>
      <label>To
        <input type="number" id="to-value" step="any">
        <select id="to-unit" aria-label="To unit"></select>
      </label>
    </div>
  </div>
</article>
{{ end }}

{{ define "scripts" }}
  {{ $entry := .Resources.GetMatch "unit-converter.js" }}
  {{ $js := $entry | js.Build (dict "minify" hugo.IsProduction) | fingerprint }}
  <script type="module" src="{{ $js.RelPermalink }}"></script>
{{ end }}
```

- [ ] **Step 3: Create `content/converters/unit-converter/unit-converter.js`**

```js
import { TYPES, UNITS } from "./units.js";
import { convert, unitsByGroup } from "./convert.js";
import { qs, create, on, clear } from "js/lib/dom.js";
import { formatNumber } from "js/lib/format.js";

const state = { type: TYPES[0] };

const typesEl = qs("#converter-types");
const fromValue = qs("#from-value");
const toValue = qs("#to-value");
const fromUnit = qs("#from-unit");
const toUnit = qs("#to-unit");
const swapBtn = qs("#swap");

function buildOptions(select) {
  clear(select);
  for (const group of unitsByGroup(state.type)) {
    const og = create("optgroup", { label: group.label });
    for (const u of group.units) {
      og.append(create("option", { value: u.id, textContent: u.label }));
    }
    select.append(og);
  }
}

function buildTypes() {
  clear(typesEl);
  for (const type of TYPES) {
    const btn = create("button", {
      type: "button",
      class: "type-btn" + (type === state.type ? " is-active" : ""),
      textContent: UNITS[type].label,
      dataset: { type },
    });
    on(btn, "click", () => selectType(type));
    typesEl.append(btn);
  }
}

function recalc() {
  const v = parseFloat(fromValue.value);
  if (Number.isNaN(v)) { toValue.value = ""; return; }
  toValue.value = formatNumber(convert(state.type, v, fromUnit.value, toUnit.value));
}

function selectType(type) {
  state.type = type;
  buildTypes();
  buildOptions(fromUnit);
  buildOptions(toUnit);
  const units = UNITS[type].units;
  fromUnit.value = units[0].id;
  toUnit.value = (units[1] || units[0]).id;
  recalc();
}

on(fromValue, "input", recalc);
on(fromUnit, "change", recalc);
on(toUnit, "change", recalc);
on(swapBtn, "click", () => {
  const u = fromUnit.value;
  fromUnit.value = toUnit.value;
  toUnit.value = u;
  recalc();
});

selectType(state.type);
```

- [ ] **Step 4: Build — verifies esbuild resolves the `lib/` imports from a content bundle**

Run: `hugo --gc`
Expected: exits 0 (no "could not resolve" esbuild error). esbuild resolves bare specifiers from the **assets root**, so `js/lib/dom.js` → `assets/js/lib/dom.js`. If it reports it cannot resolve `js/lib/...`, confirm the import specifiers are assets-root-relative (`js/lib/dom.js`, not `lib/dom.js` or `./lib/dom.js`) and that the files exist at `assets/js/lib/`. Re-run `hugo --gc` and confirm it exits 0.

- [ ] **Step 5: Confirm the tool page and bundled script were generated**

Run: `test -f public/converters/unit-converter/index.html && ls public/js/*.js | head`
Expected: the HTML exists and at least one fingerprinted JS file is emitted.

- [ ] **Step 6: Browser smoke test**

Use the agent-browser skill against `hugo server` (`http://localhost:1313/tools/converters/unit-converter/`):
- Default Length, From `1` `meter` → switch To `foot`: To shows ≈ `3.28084`.
- Enter From `100` `meter`, To `foot`: To shows `328.084`.
- Click a type button "Temperature": units repopulate; From `100` `Celsius`, To `Fahrenheit` → `212`.
- Click swap (⇄): From/To units exchange and the result updates.
Expected: all behaviors hold.

- [ ] **Step 7: Commit**

```bash
git add content/converters/unit-converter/index.md content/converters/unit-converter/unit-converter.js layouts/tools/unit-converter.html hugo.toml
git commit -m "Add unit converter UI, content, and entry script"
```

---

### Task 6: Category section + homepage directory + tool cards

**Files:**
- Create: `content/converters/_index.md`
- Create: `layouts/_default/list.html`
- Create: `layouts/partials/tool-card.html`
- Modify: `layouts/_default/home.html`

**Interfaces:**
- Consumes: tool pages where `Type == "tools"`.
- Produces: alphabetical category listing at `/tools/converters/`; homepage grid of tool cards each carrying `data-id` = slug.

- [ ] **Step 1: Create `content/converters/_index.md`**

```markdown
---
title: Converters
---

Tools for converting between units and formats.
```

- [ ] **Step 2: Create `layouts/partials/tool-card.html`**

```html
<li class="tool-card" data-id="{{ .File.ContentBaseName }}">
  <a href="{{ .RelPermalink }}">
    <h2>{{ .Title }}</h2>
    <span class="tool-category">{{ .CurrentSection.Title }}</span>
    {{ with .Summary }}<p>{{ . | plainify | truncate 120 }}</p>{{ end }}
    <ul class="tags">
      {{ range .Params.tags }}<li>{{ . }}</li>{{ end }}
    </ul>
  </a>
</li>
```

- [ ] **Step 3: Create `layouts/_default/list.html`**

```html
{{ define "main" }}
<section class="listing">
  <h1>{{ .Title }}</h1>
  {{ with .Content }}{{ . }}{{ end }}
  <ul class="tool-grid">
    {{ range .Pages.ByTitle }}
      {{ partial "tool-card.html" . }}
    {{ end }}
  </ul>
</section>
{{ end }}
```

- [ ] **Step 4: Replace `layouts/_default/home.html`**

```html
{{ define "main" }}
<section class="home">
  <h1>{{ site.Title }}</h1>
  <input type="search" id="tool-search" placeholder="Search tools by name, id, or tag…" autocomplete="off">
  <ul class="tool-grid" id="tool-grid">
    {{ range (where site.RegularPages "Type" "tools").ByTitle }}
      {{ partial "tool-card.html" . }}
    {{ end }}
  </ul>
  <p class="no-results" id="no-results" hidden>No tools match your search.</p>
</section>
{{ end }}
```

- [ ] **Step 5: Build and verify listings render the converter**

Run: `hugo --gc && grep -l "Unit Converter" public/converters/index.html public/index.html`
Expected: both files listed (the converter card appears on the category page and the homepage).

- [ ] **Step 6: Commit**

```bash
git add content/converters/_index.md layouts/_default/list.html layouts/partials/tool-card.html layouts/_default/home.html
git commit -m "Add category listing, homepage directory, and tool cards"
```

---

### Task 7: Search index + client-side search

**Files:**
- Create: `layouts/index.json`
- Create: `assets/js/search.js`

**Interfaces:**
- Consumes: tool pages (`Type == "tools"`); the homepage `#tool-search` input and `.tool-card[data-id]` elements (Task 6).
- Produces: `/tools/index.json` (array of `{id,title,category,url,tags,summary}`); live filtering that toggles card visibility by matching id/title/category/tags.

- [ ] **Step 1: Create `layouts/index.json`**

```go-html-template
{{- $list := slice -}}
{{- range where site.RegularPages "Type" "tools" -}}
  {{- $list = $list | append (dict
      "id" .File.ContentBaseName
      "title" .Title
      "category" .CurrentSection.Title
      "url" .RelPermalink
      "tags" .Params.tags
      "summary" (.Summary | plainify)) -}}
{{- end -}}
{{- $list | jsonify -}}
```

- [ ] **Step 2: Create `assets/js/search.js`**

```js
import { qsa } from "js/lib/dom.js";

const input = document.getElementById("tool-search");
const cards = qsa(".tool-card");
const noResults = document.getElementById("no-results");

let index = null;

async function loadIndex() {
  if (index) return index;
  const res = await fetch(new URL("index.json", document.baseURI));
  index = await res.json();
  return index;
}

function matches(entry, q) {
  return [entry.id, entry.title, entry.category, ...(entry.tags || [])]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

async function filter() {
  const q = input.value.trim().toLowerCase();
  const data = await loadIndex();
  const allowed = new Set(
    q ? data.filter((e) => matches(e, q)).map((e) => e.id) : data.map((e) => e.id)
  );
  let visible = 0;
  for (const card of cards) {
    const show = allowed.has(card.dataset.id);
    card.hidden = !show;
    if (show) visible++;
  }
  if (noResults) noResults.hidden = visible !== 0;
}

if (input) input.addEventListener("input", filter);
```

- [ ] **Step 3: Wire `search.js` into the homepage — append to `layouts/_default/home.html`**

Add this block at the end of the file (after the `main` block):
```html
{{ define "scripts" }}
  {{ $js := resources.Get "js/search.js" | js.Build (dict "minify" hugo.IsProduction) | fingerprint }}
  <script type="module" src="{{ $js.RelPermalink }}"></script>
{{ end }}
```

- [ ] **Step 4: Build and verify the index contains the converter**

Run: `hugo --gc && cat public/index.json`
Expected: valid JSON array including an entry with `"id":"unit-converter"`, `"category":"Converters"`, and the tags list. If `public/index.json` is missing, the home JSON layout was not matched — rename the template to `layouts/_default/home.json` and rebuild (both are valid lookup paths for the home page's JSON output; `layouts/index.json` is tried first).

- [ ] **Step 5: Browser smoke test of search**

Use the agent-browser skill against `hugo server` (`http://localhost:1313/tools/`):
- Type `length` → the Unit Converter card stays visible.
- Type `zzz` → card hides, "No tools match your search." appears.
- Clear the box → card visible again.
Expected: all behaviors hold.

- [ ] **Step 6: Commit**

```bash
git add layouts/index.json assets/js/search.js layouts/_default/home.html
git commit -m "Add JSON search index and client-side tool search"
```

---

### Task 8: GitHub Actions deploy to Pages

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: a workflow that builds with Hugo extended 0.163.3 on push to `main` and deploys `public/` to GitHub Pages. baseURL comes from `hugo.toml` (the custom domain `ogregoire.be/tools/`), not overridden.

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy Hugo site to Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

defaults:
  run:
    shell: bash

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      HUGO_VERSION: 0.163.3
    steps:
      - name: Install Hugo CLI
        run: |
          wget -O "${{ runner.temp }}/hugo.deb" \
            "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.deb"
          sudo dpkg -i "${{ runner.temp }}/hugo.deb"
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Build with Hugo
        env:
          HUGO_ENVIRONMENT: production
        run: hugo --gc --minify
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./public

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Validate the production build locally (mirrors the workflow)**

Run: `hugo --gc --minify`
Expected: exits 0; `public/` regenerated with `index.html`, `converters/unit-converter/index.html`, and `index.json`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "Add GitHub Actions workflow to deploy to GitHub Pages"
```

- [ ] **Step 4: Final full-suite verification**

Run: `node --test && hugo --gc --minify`
Expected: all Node tests pass and Hugo builds cleanly.

---

## Notes for the Implementer

- **Repo settings (manual, outside this plan):** in GitHub repo Settings → Pages, set Source = "GitHub Actions". The site is served at `ogregoire.be/tools/` only because the `ogregoire.github.io` repo holds the `ogregoire.be` custom domain; no CNAME belongs in this repo.
- **Why logic lives in `content/.../`:** the converter's pure modules are co-located with the tool (page bundle). Node tests import them by relative path; esbuild bundles them at build time. Keep these modules free of `lib/` imports so Node can run them.
