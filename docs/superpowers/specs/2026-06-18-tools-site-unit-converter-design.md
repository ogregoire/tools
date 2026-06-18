# Tools Site + Unit Converter — Design

**Date:** 2026-06-18
**Status:** In review (design phase)

## Goal

A static website of small, self-contained web tools, published to
`https://ogregoire.be/tools/` via GitHub Pages. Tools are **categorized**,
**tagged**, and **searchable by id**. The first tool is a **unit converter** in
the **Converters** category.

## Stack & Deployment

- **Hugo** (static site generator). Chosen for native sections/taxonomies (the
  category is a content section; `tags` is a taxonomy), a JSON output for
  client-side search, and simple GitHub Pages deployment.
- **Hosting:** a dedicated project repo (`tools`). The user's
  `ogregoire.github.io` repo holds the `ogregoire.be` custom domain, so this
  project repo is automatically served at `ogregoire.be/tools/`. No CNAME is
  needed in this repo.
- `baseURL = "https://ogregoire.be/tools/"`.
- Deployment via a GitHub Actions workflow that builds Hugo and publishes to
  GitHub Pages.

## Repository Structure

```
tools/
├── hugo.toml                       # baseURL, tags taxonomy, output formats
├── content/
│   ├── _index.md                   # homepage: directory + search
│   └── converters/                 # category section → /tools/converters/
│       ├── _index.md               # category landing page (lists tools A→Z)
│       └── unit-converter/          # PAGE BUNDLE for the tool (folder = slug)
│           ├── index.md            # front matter: id, title, tags, layout
│           └── unit-converter.js   # co-located JS (page resource)
├── layouts/
│   ├── _default/
│   │   ├── home.html               # directory grid + search box
│   │   ├── single.html             # generic tool page wrapper
│   │   ├── list.html               # section/taxonomy listing (sorted A→Z)
│   │   └── index.json              # search index template (JSON output)
│   ├── tools/
│   │   └── unit-converter.html     # converter markup (layout = "unit-converter", type = "tools")
│   └── partials/                   # tool-card, search, header, footer
├── assets/
│   ├── css/site.css
│   └── js/
│       ├── lib/                     # shared JS library (ES modules)
│       │   ├── dom.js              # DOM helpers: select, create, bind events
│       │   └── format.js           # number formatting (significant digits)
│       └── search.js               # site-wide search; imports from lib/
├── data/                           # optional: shared unit definitions
└── .github/workflows/deploy.yml    # build + deploy to Pages
```

## URL Scheme

- Tool URLs follow `/tools/<category>/<slug>`. Because `baseURL` already ends in
  `/tools/`, this is achieved by organizing content into **category sections**,
  with each tool as a page bundle: `content/<category>/<slug>/index.md`.
- The first tool: `content/converters/unit-converter/index.md` →
  `https://ogregoire.be/tools/converters/unit-converter/`.
- The category landing page (`content/converters/_index.md`) is served at
  `https://ogregoire.be/tools/converters/` and lists the tools in that category
  in **alphabetical order by title** (`.Pages.ByTitle` in `list.html`).
- Each tool is a **page bundle**: a folder named after the slug containing
  `index.md` plus its co-located assets (e.g. `unit-converter.js`). The bundle
  folder name is the slug, so the URL is unchanged.

## Per-Tool Asset Handling

- Each tool's JavaScript lives **next to its `index.md`** inside the page bundle
  (e.g. `converters/unit-converter/unit-converter.js`).
- The tool layout retrieves it as a page resource and runs it through Hugo
  Pipes, emitting a fingerprinted `<script>` tag:
  ```
  {{ $js := .Resources.GetMatch "*.js" | js.Build (dict "minify" true) | fingerprint }}
  <script src="{{ $js.RelPermalink }}"></script>
  ```
  This keeps logic colocated with its page while still getting minification and
  cache-busting.
- Site-wide JS (search) stays in `assets/js/` and is processed the same way from
  the home/base layout.

## Shared JS Library

- A small library of reusable ES modules lives in `assets/js/lib/`. Both the
  site-wide search and every tool import from it, so common DOM and formatting
  logic is written once.
- Modules consume it with assets-relative imports, e.g.
  `import { create, on } from 'lib/dom.js'`. `js.Build` (esbuild) resolves these
  against the `assets` directory and bundles them into each entry point's
  fingerprinted output — no separate `<script>` and no global namespace.
- Initial, intentionally minimal surface (grow only when real duplication
  appears):
  - `dom.js` — `qs`/`qsa` (querySelector helpers), `create(tag, props, children)`
    for building elements, `on(el, event, handler)` for event binding,
    `clear(el)` for emptying a node.
  - `format.js` — `formatNumber(value, sigDigits)` implementing the
    "~6 significant digits, trailing zeros trimmed" rule used by the converter.
- **Build verification:** the implementation must confirm that a content-bundle
  tool JS file (`converters/unit-converter/unit-converter.js`) successfully
  imports from `assets/js/lib/` through `js.Build`. If assets-relative
  resolution from a content bundle proves unreliable, the fallback is to keep
  the import working via a Hugo module mount for `assets`; this is validated
  during the build step, not assumed.

## Tool Directory, Categorization & Search

- **Category** is the content section (the parent directory, e.g. `converters`
  → displayed as "Converters"), which also drives the URL. The section's list
  page at `/tools/converters/` is the canonical category page. There is **no
  `categories` taxonomy** — this avoids a duplicate `/categories/...` listing.
- **Tags** are the only taxonomy. The first tool's tags include e.g.
  `units`, `length`, `weight`, `temperature`, `volume`, `area`, `speed`.
- Each tool's **id** is its slug (e.g. `unit-converter`).
- **Search:** Hugo emits `index.json` (a custom output format) listing every
  tool's `id`, `title`, `category`, `tags`, and `summary`. `search.js` fetches
  this once and filters live on the homepage. Search matches **id**, title, and
  tags. No backend.
- The **homepage** renders a grid of tool cards (title, category, tags,
  short description) plus the search box.

## Unit Converter

### UX

Single page, live conversion:

- A **measurement-type selector** (segmented control / radio): Length, Area,
  Weight, Temperature, Volume, Speed. Selecting a type repopulates the From/To
  unit dropdowns and reconverts.
- **From** value + unit dropdown, **To** value + unit dropdown.
- Editing either value or either dropdown reconverts live.
- A **swap** button flips From and To.

### Conversion Model

- Every type **except temperature** uses a base unit + multiplicative factor.
  `convert = value × fromFactor ÷ toFactor`.
- **Temperature** is handled by a dedicated function (offsets, not pure
  factors): °C, °F, K.
- Units are defined as a data structure: each type → ordered list of
  `{ id, label, factor, system }`, where `system` is one of `metric`,
  `imperial`, `us`, `nautical`. Conversion logic is **pure functions**
  (`convert(type, value, from, to)`) so they are unit-testable independently of
  the DOM.

### Unit Grouping in Dropdowns

Within each From/To dropdown, units are grouped by `system` using HTML
`<optgroup>`. Group order is always: **Metric (SI)** first, then **Imperial**,
then any others (**US customary**, **Nautical**). Within a group, units follow
the order defined in the data structure (smallest → largest). The group
header labels are: "Metric (SI)", "Imperial", "US customary", "Nautical".

### Precision

Show up to ~6 significant digits, trimming trailing zeros. Easy to adjust.

### Unit Coverage

Listed by group, in dropdown order (Metric first, then Imperial, then others):

- **Length:**
  - Metric: mm, cm, m, km
  - Imperial: in, ft, yd, mi
  - Nautical: nmi
- **Area:**
  - Metric: mm², cm², m², are (a), ha, km²
  - Imperial: in², ft², yd², acre, mi²
- **Weight/Mass:**
  - Metric: mg, g, kg, t (tonne)
  - Imperial: oz, lb, st (stone)
- **Temperature:**
  - Metric (SI): °C, K
  - Imperial: °F
- **Volume:**
  - Metric: mL, L, m³
  - US customary: tsp, tbsp, fl oz, cup, pt, qt, gal
- **Speed:**
  - Metric: m/s, km/s, km/h
  - Imperial: ft/s, mi/s (miles per second), mph
  - Nautical: knot

## Testing

- Pure conversion functions tested directly: known-value round-trips per type
  (e.g. 1 mi = 1609.344 m; 100 °C = 212 °F; 1 are = 100 m²; 1 mi/s = 1609.344
  m/s). Round-trip convert-and-back stays within precision tolerance.
- Build verification: `hugo` builds cleanly; `index.json` is generated and
  contains the converter entry.

## Out of Scope (for now)

- UK/imperial volume variants (US only initially).
- Additional tools beyond the unit converter (architecture supports adding them
  later as new content pages).
- Visual/theme polish beyond a clean, usable baseline.
