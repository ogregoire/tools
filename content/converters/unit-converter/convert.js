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
