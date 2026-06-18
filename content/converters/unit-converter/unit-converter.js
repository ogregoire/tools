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
