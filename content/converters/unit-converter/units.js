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
