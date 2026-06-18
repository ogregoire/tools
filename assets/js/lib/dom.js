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
