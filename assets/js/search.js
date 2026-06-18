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
