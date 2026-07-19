/**
 * Periodic Table Reference — pure logic.
 *
 * 118 element data table + search, filter, format, compare, neighbor,
 * isotope, compound validation, render (text/CSV/JSON), history,
 * shareable URL, summary stats. Pure functions only.
 */

export type ElementCategory =
  | "alkali-metal"
  | "alkaline-earth-metal"
  | "transition-metal"
  | "post-transition-metal"
  | "metalloid"
  | "nonmetal"
  | "halogen"
  | "noble-gas"
  | "lanthanide"
  | "actinide"
  | "unknown";

export interface Element {
  z: number;            // atomic number
  symbol: string;
  name: string;
  mass: number;         // standard atomic weight
  category: ElementCategory;
  config: string;       // electron configuration (short form)
  electronegativity: number | null; // Pauling scale
  atomicRadius: number | null;      // pm (calculated)
  meltingPoint: number | null;      // K
  boilingPoint: number | null;      // K
  density: number | null;           // g/cm^3
  discoveredYear: number | string;  // year or "Ancient"
  period: number;
  group: number;        // 1-18, 0 for lanthanides/actinides (f-block)
  isotopes: { mass: number; abundance: number }[];
}

export const CATEGORY_LABELS: Record<ElementCategory, string> = {
  "alkali-metal": "Alkali Metal",
  "alkaline-earth-metal": "Alkaline Earth Metal",
  "transition-metal": "Transition Metal",
  "post-transition-metal": "Post-Transition Metal",
  "metalloid": "Metalloid",
  "nonmetal": "Nonmetal",
  "halogen": "Halogen",
  "noble-gas": "Noble Gas",
  "lanthanide": "Lanthanide",
  "actinide": "Actinide",
  "unknown": "Unknown",
};

export const CATEGORY_COLORS: Record<ElementCategory, string> = {
  "alkali-metal": "#ff6b6b",
  "alkaline-earth-metal": "#ffa94d",
  "transition-metal": "#ffd43b",
  "post-transition-metal": "#a9e34b",
  "metalloid": "#69db7c",
  "nonmetal": "#4dabf7",
  "halogen": "#74c0fc",
  "noble-gas": "#b197fc",
  "lanthanide": "#f783ac",
  "actinide": "#e599f7",
  "unknown": "#adb5bd",
};

// All 118 elements. Data compressed for size; standard reference values.
export const ELEMENTS: Element[] = [
  { z: 1, symbol: "H", name: "Hydrogen", mass: 1.008, category: "nonmetal", config: "1s1", electronegativity: 2.20, atomicRadius: 53, meltingPoint: 13.99, boilingPoint: 20.271, density: 0.00008988, discoveredYear: 1766, period: 1, group: 1, isotopes: [{ mass: 1, abundance: 99.985 }, { mass: 2, abundance: 0.015 }] },
  { z: 2, symbol: "He", name: "Helium", mass: 4.0026, category: "noble-gas", config: "1s2", electronegativity: null, atomicRadius: 31, meltingPoint: 0.95, boilingPoint: 4.222, density: 0.0001785, discoveredYear: 1868, period: 1, group: 18, isotopes: [{ mass: 3, abundance: 0.000137 }, { mass: 4, abundance: 99.999863 }] },
  { z: 3, symbol: "Li", name: "Lithium", mass: 6.94, category: "alkali-metal", config: "[He] 2s1", electronegativity: 0.98, atomicRadius: 167, meltingPoint: 453.65, boilingPoint: 1603, density: 0.534, discoveredYear: 1817, period: 2, group: 1, isotopes: [{ mass: 6, abundance: 7.59 }, { mass: 7, abundance: 92.41 }] },
  { z: 4, symbol: "Be", name: "Beryllium", mass: 9.0122, category: "alkaline-earth-metal", config: "[He] 2s2", electronegativity: 1.57, atomicRadius: 112, meltingPoint: 1560, boilingPoint: 2742, density: 1.85, discoveredYear: 1798, period: 2, group: 2, isotopes: [{ mass: 9, abundance: 100 }] },
  { z: 5, symbol: "B", name: "Boron", mass: 10.81, category: "metalloid", config: "[He] 2s2 2p1", electronegativity: 2.04, atomicRadius: 87, meltingPoint: 2349, boilingPoint: 4200, density: 2.34, discoveredYear: 1808, period: 2, group: 13, isotopes: [{ mass: 10, abundance: 19.9 }, { mass: 11, abundance: 80.1 }] },
  { z: 6, symbol: "C", name: "Carbon", mass: 12.011, category: "nonmetal", config: "[He] 2s2 2p2", electronegativity: 2.55, atomicRadius: 67, meltingPoint: 3823, boilingPoint: 4098, density: 2.267, discoveredYear: "Ancient", period: 2, group: 14, isotopes: [{ mass: 12, abundance: 98.93 }, { mass: 13, abundance: 1.07 }] },
  { z: 7, symbol: "N", name: "Nitrogen", mass: 14.007, category: "nonmetal", config: "[He] 2s2 2p3", electronegativity: 3.04, atomicRadius: 56, meltingPoint: 63.15, boilingPoint: 77.355, density: 0.0012506, discoveredYear: 1772, period: 2, group: 15, isotopes: [{ mass: 14, abundance: 99.636 }, { mass: 15, abundance: 0.364 }] },
  { z: 8, symbol: "O", name: "Oxygen", mass: 15.999, category: "nonmetal", config: "[He] 2s2 2p4", electronegativity: 3.44, atomicRadius: 48, meltingPoint: 54.36, boilingPoint: 90.188, density: 0.001429, discoveredYear: 1774, period: 2, group: 16, isotopes: [{ mass: 16, abundance: 99.762 }, { mass: 17, abundance: 0.038 }, { mass: 18, abundance: 0.200 }] },
  { z: 9, symbol: "F", name: "Fluorine", mass: 18.998, category: "halogen", config: "[He] 2s2 2p5", electronegativity: 3.98, atomicRadius: 42, meltingPoint: 53.48, boilingPoint: 85.03, density: 0.001696, discoveredYear: 1886, period: 2, group: 17, isotopes: [{ mass: 19, abundance: 100 }] },
  { z: 10, symbol: "Ne", name: "Neon", mass: 20.180, category: "noble-gas", config: "[He] 2s2 2p6", electronegativity: null, atomicRadius: 38, meltingPoint: 24.56, boilingPoint: 27.104, density: 0.0008999, discoveredYear: 1898, period: 2, group: 18, isotopes: [{ mass: 20, abundance: 90.48 }, { mass: 21, abundance: 0.27 }, { mass: 22, abundance: 9.25 }] },
  { z: 11, symbol: "Na", name: "Sodium", mass: 22.990, category: "alkali-metal", config: "[Ne] 3s1", electronegativity: 0.93, atomicRadius: 190, meltingPoint: 370.944, boilingPoint: 1156.09, density: 0.971, discoveredYear: 1807, period: 3, group: 1, isotopes: [{ mass: 23, abundance: 100 }] },
  { z: 12, symbol: "Mg", name: "Magnesium", mass: 24.305, category: "alkaline-earth-metal", config: "[Ne] 3s2", electronegativity: 1.31, atomicRadius: 145, meltingPoint: 923, boilingPoint: 1363, density: 1.738, discoveredYear: 1755, period: 3, group: 2, isotopes: [{ mass: 24, abundance: 78.99 }, { mass: 25, abundance: 10.00 }, { mass: 26, abundance: 11.01 }] },
  { z: 13, symbol: "Al", name: "Aluminum", mass: 26.982, category: "post-transition-metal", config: "[Ne] 3s2 3p1", electronegativity: 1.61, atomicRadius: 118, meltingPoint: 933.47, boilingPoint: 2792, density: 2.70, discoveredYear: 1825, period: 3, group: 13, isotopes: [{ mass: 27, abundance: 100 }] },
  { z: 14, symbol: "Si", name: "Silicon", mass: 28.085, category: "metalloid", config: "[Ne] 3s2 3p2", electronegativity: 1.90, atomicRadius: 111, meltingPoint: 1687, boilingPoint: 3538, density: 2.3296, discoveredYear: 1824, period: 3, group: 14, isotopes: [{ mass: 28, abundance: 92.223 }, { mass: 29, abundance: 4.685 }, { mass: 30, abundance: 3.092 }] },
  { z: 15, symbol: "P", name: "Phosphorus", mass: 30.974, category: "nonmetal", config: "[Ne] 3s2 3p3", electronegativity: 2.19, atomicRadius: 98, meltingPoint: 317.3, boilingPoint: 550, density: 1.82, discoveredYear: 1669, period: 3, group: 15, isotopes: [{ mass: 31, abundance: 100 }] },
  { z: 16, symbol: "S", name: "Sulfur", mass: 32.06, category: "nonmetal", config: "[Ne] 3s2 3p4", electronegativity: 2.58, atomicRadius: 88, meltingPoint: 388.36, boilingPoint: 717.87, density: 2.067, discoveredYear: "Ancient", period: 3, group: 16, isotopes: [{ mass: 32, abundance: 94.99 }, { mass: 33, abundance: 0.75 }, { mass: 34, abundance: 4.25 }, { mass: 36, abundance: 0.01 }] },
  { z: 17, symbol: "Cl", name: "Chlorine", mass: 35.45, category: "halogen", config: "[Ne] 3s2 3p5", electronegativity: 3.16, atomicRadius: 79, meltingPoint: 171.6, boilingPoint: 239.11, density: 0.003214, discoveredYear: 1774, period: 3, group: 17, isotopes: [{ mass: 35, abundance: 75.78 }, { mass: 37, abundance: 24.22 }] },
  { z: 18, symbol: "Ar", name: "Argon", mass: 39.95, category: "noble-gas", config: "[Ne] 3s2 3p6", electronegativity: null, atomicRadius: 71, meltingPoint: 83.81, boilingPoint: 87.302, density: 0.0017837, discoveredYear: 1894, period: 3, group: 18, isotopes: [{ mass: 36, abundance: 0.334 }, { mass: 38, abundance: 0.063 }, { mass: 40, abundance: 99.604 }] },
  { z: 19, symbol: "K", name: "Potassium", mass: 39.098, category: "alkali-metal", config: "[Ar] 4s1", electronegativity: 0.82, atomicRadius: 243, meltingPoint: 336.7, boilingPoint: 1032, density: 0.862, discoveredYear: 1807, period: 4, group: 1, isotopes: [{ mass: 39, abundance: 93.2581 }, { mass: 40, abundance: 0.0117 }, { mass: 41, abundance: 6.7302 }] },
  { z: 20, symbol: "Ca", name: "Calcium", mass: 40.078, category: "alkaline-earth-metal", config: "[Ar] 4s2", electronegativity: 1.00, atomicRadius: 194, meltingPoint: 1115, boilingPoint: 1757, density: 1.54, discoveredYear: 1808, period: 4, group: 2, isotopes: [{ mass: 40, abundance: 96.941 }, { mass: 42, abundance: 0.647 }, { mass: 43, abundance: 0.135 }, { mass: 44, abundance: 2.086 }] },
  { z: 21, symbol: "Sc", name: "Scandium", mass: 44.956, category: "transition-metal", config: "[Ar] 3d1 4s2", electronegativity: 1.36, atomicRadius: 184, meltingPoint: 1814, boilingPoint: 3109, density: 2.989, discoveredYear: 1879, period: 4, group: 3, isotopes: [{ mass: 45, abundance: 100 }] },
  { z: 22, symbol: "Ti", name: "Titanium", mass: 47.867, category: "transition-metal", config: "[Ar] 3d2 4s2", electronegativity: 1.54, atomicRadius: 176, meltingPoint: 1941, boilingPoint: 3560, density: 4.54, discoveredYear: 1791, period: 4, group: 4, isotopes: [{ mass: 46, abundance: 8.25 }, { mass: 47, abundance: 7.44 }, { mass: 48, abundance: 73.72 }, { mass: 49, abundance: 5.41 }, { mass: 50, abundance: 5.18 }] },
  { z: 23, symbol: "V", name: "Vanadium", mass: 50.942, category: "transition-metal", config: "[Ar] 3d3 4s2", electronegativity: 1.63, atomicRadius: 171, meltingPoint: 2183, boilingPoint: 3680, density: 6.11, discoveredYear: 1801, period: 4, group: 5, isotopes: [{ mass: 50, abundance: 0.250 }, { mass: 51, abundance: 99.750 }] },
  { z: 24, symbol: "Cr", name: "Chromium", mass: 51.996, category: "transition-metal", config: "[Ar] 3d5 4s1", electronegativity: 1.66, atomicRadius: 166, meltingPoint: 2180, boilingPoint: 2944, density: 7.15, discoveredYear: 1797, period: 4, group: 6, isotopes: [{ mass: 52, abundance: 83.789 }, { mass: 53, abundance: 9.501 }, { mass: 54, abundance: 2.365 }] },
  { z: 25, symbol: "Mn", name: "Manganese", mass: 54.938, category: "transition-metal", config: "[Ar] 3d5 4s2", electronegativity: 1.55, atomicRadius: 161, meltingPoint: 1519, boilingPoint: 2334, density: 7.44, discoveredYear: 1774, period: 4, group: 7, isotopes: [{ mass: 55, abundance: 100 }] },
  { z: 26, symbol: "Fe", name: "Iron", mass: 55.845, category: "transition-metal", config: "[Ar] 3d6 4s2", electronegativity: 1.83, atomicRadius: 156, meltingPoint: 1811, boilingPoint: 3134, density: 7.874, discoveredYear: "Ancient", period: 4, group: 8, isotopes: [{ mass: 54, abundance: 5.845 }, { mass: 56, abundance: 91.754 }, { mass: 57, abundance: 2.119 }, { mass: 58, abundance: 0.282 }] },
  { z: 27, symbol: "Co", name: "Cobalt", mass: 58.933, category: "transition-metal", config: "[Ar] 3d7 4s2", electronegativity: 1.88, atomicRadius: 152, meltingPoint: 1768, boilingPoint: 3200, density: 8.86, discoveredYear: 1735, period: 4, group: 9, isotopes: [{ mass: 59, abundance: 100 }] },
  { z: 28, symbol: "Ni", name: "Nickel", mass: 58.693, category: "transition-metal", config: "[Ar] 3d8 4s2", electronegativity: 1.91, atomicRadius: 149, meltingPoint: 1728, boilingPoint: 3186, density: 8.912, discoveredYear: 1751, period: 4, group: 10, isotopes: [{ mass: 58, abundance: 68.077 }, { mass: 60, abundance: 26.223 }, { mass: 61, abundance: 1.140 }, { mass: 62, abundance: 3.634 }] },
  { z: 29, symbol: "Cu", name: "Copper", mass: 63.546, category: "transition-metal", config: "[Ar] 3d10 4s1", electronegativity: 1.90, atomicRadius: 145, meltingPoint: 1357.77, boilingPoint: 2835, density: 8.96, discoveredYear: "Ancient", period: 4, group: 11, isotopes: [{ mass: 63, abundance: 69.15 }, { mass: 65, abundance: 30.85 }] },
  { z: 30, symbol: "Zn", name: "Zinc", mass: 65.38, category: "transition-metal", config: "[Ar] 3d10 4s2", electronegativity: 1.65, atomicRadius: 142, meltingPoint: 692.88, boilingPoint: 1180, density: 7.134, discoveredYear: 1746, period: 4, group: 12, isotopes: [{ mass: 64, abundance: 48.63 }, { mass: 66, abundance: 27.90 }, { mass: 67, abundance: 4.10 }, { mass: 68, abundance: 18.75 }] },
  { z: 31, symbol: "Ga", name: "Gallium", mass: 69.723, category: "post-transition-metal", config: "[Ar] 3d10 4s2 4p1", electronegativity: 1.81, atomicRadius: 136, meltingPoint: 302.9146, boilingPoint: 2673, density: 5.907, discoveredYear: 1875, period: 4, group: 13, isotopes: [{ mass: 69, abundance: 60.108 }, { mass: 71, abundance: 39.892 }] },
  { z: 32, symbol: "Ge", name: "Germanium", mass: 72.630, category: "metalloid", config: "[Ar] 3d10 4s2 4p2", electronegativity: 2.01, atomicRadius: 125, meltingPoint: 1211.40, boilingPoint: 3106, density: 5.323, discoveredYear: 1886, period: 4, group: 14, isotopes: [{ mass: 70, abundance: 20.84 }, { mass: 72, abundance: 27.54 }, { mass: 73, abundance: 7.73 }, { mass: 74, abundance: 36.28 }] },
  { z: 33, symbol: "As", name: "Arsenic", mass: 74.922, category: "metalloid", config: "[Ar] 3d10 4s2 4p3", electronegativity: 2.18, atomicRadius: 114, meltingPoint: 1090, boilingPoint: 887, density: 5.776, discoveredYear: 1250, period: 4, group: 15, isotopes: [{ mass: 75, abundance: 100 }] },
  { z: 34, symbol: "Se", name: "Selenium", mass: 78.971, category: "nonmetal", config: "[Ar] 3d10 4s2 4p4", electronegativity: 2.55, atomicRadius: 103, meltingPoint: 494, boilingPoint: 958, density: 4.809, discoveredYear: 1817, period: 4, group: 16, isotopes: [{ mass: 74, abundance: 0.89 }, { mass: 76, abundance: 9.37 }, { mass: 77, abundance: 7.63 }, { mass: 78, abundance: 23.77 }] },
  { z: 35, symbol: "Br", name: "Bromine", mass: 79.904, category: "halogen", config: "[Ar] 3d10 4s2 4p5", electronegativity: 2.96, atomicRadius: 94, meltingPoint: 265.8, boilingPoint: 332.0, density: 3.122, discoveredYear: 1826, period: 4, group: 17, isotopes: [{ mass: 79, abundance: 50.69 }, { mass: 81, abundance: 49.31 }] },
  { z: 36, symbol: "Kr", name: "Krypton", mass: 83.798, category: "noble-gas", config: "[Ar] 3d10 4s2 4p6", electronegativity: 3.00, atomicRadius: 88, meltingPoint: 115.79, boilingPoint: 119.93, density: 0.003733, discoveredYear: 1898, period: 4, group: 18, isotopes: [{ mass: 78, abundance: 0.355 }, { mass: 80, abundance: 2.286 }, { mass: 82, abundance: 11.593 }, { mass: 83, abundance: 11.500 }] },
  { z: 37, symbol: "Rb", name: "Rubidium", mass: 85.468, category: "alkali-metal", config: "[Kr] 5s1", electronegativity: 0.82, atomicRadius: 265, meltingPoint: 312.45, boilingPoint: 961, density: 1.532, discoveredYear: 1861, period: 5, group: 1, isotopes: [{ mass: 85, abundance: 72.17 }, { mass: 87, abundance: 27.83 }] },
  { z: 38, symbol: "Sr", name: "Strontium", mass: 87.62, category: "alkaline-earth-metal", config: "[Kr] 5s2", electronegativity: 0.95, atomicRadius: 219, meltingPoint: 1050, boilingPoint: 1655, density: 2.64, discoveredYear: 1790, period: 5, group: 2, isotopes: [{ mass: 84, abundance: 0.56 }, { mass: 86, abundance: 9.86 }, { mass: 87, abundance: 7.00 }, { mass: 88, abundance: 82.58 }] },
  { z: 39, symbol: "Y", name: "Yttrium", mass: 88.906, category: "transition-metal", config: "[Kr] 4d1 5s2", electronegativity: 1.22, atomicRadius: 212, meltingPoint: 1799, boilingPoint: 3609, density: 4.469, discoveredYear: 1794, period: 5, group: 3, isotopes: [{ mass: 89, abundance: 100 }] },
  { z: 40, symbol: "Zr", name: "Zirconium", mass: 91.224, category: "transition-metal", config: "[Kr] 4d2 5s2", electronegativity: 1.33, atomicRadius: 206, meltingPoint: 2128, boilingPoint: 4682, density: 6.506, discoveredYear: 1789, period: 5, group: 4, isotopes: [{ mass: 90, abundance: 51.45 }, { mass: 91, abundance: 11.22 }, { mass: 92, abundance: 17.15 }, { mass: 94, abundance: 17.38 }] },
  { z: 41, symbol: "Nb", name: "Niobium", mass: 92.906, category: "transition-metal", config: "[Kr] 4d4 5s1", electronegativity: 1.6, atomicRadius: 198, meltingPoint: 2750, boilingPoint: 5017, density: 8.57, discoveredYear: 1801, period: 5, group: 5, isotopes: [{ mass: 93, abundance: 100 }] },
  { z: 42, symbol: "Mo", name: "Molybdenum", mass: 95.95, category: "transition-metal", config: "[Kr] 4d5 5s1", electronegativity: 2.16, atomicRadius: 190, meltingPoint: 2896, boilingPoint: 4912, density: 10.22, discoveredYear: 1781, period: 5, group: 6, isotopes: [{ mass: 92, abundance: 14.84 }, { mass: 94, abundance: 9.25 }, { mass: 95, abundance: 15.92 }, { mass: 96, abundance: 16.68 }] },
  { z: 43, symbol: "Tc", name: "Technetium", mass: 98, category: "transition-metal", config: "[Kr] 4d5 5s2", electronegativity: 1.9, atomicRadius: 183, meltingPoint: 2430, boilingPoint: 4538, density: 11, discoveredYear: 1937, period: 5, group: 7, isotopes: [{ mass: 97, abundance: 0 }, { mass: 98, abundance: 0 }] },
  { z: 44, symbol: "Ru", name: "Ruthenium", mass: 101.07, category: "transition-metal", config: "[Kr] 4d7 5s1", electronegativity: 2.2, atomicRadius: 178, meltingPoint: 2607, boilingPoint: 4423, density: 12.37, discoveredYear: 1844, period: 5, group: 8, isotopes: [{ mass: 102, abundance: 31.55 }, { mass: 104, abundance: 18.62 }] },
  { z: 45, symbol: "Rh", name: "Rhodium", mass: 102.91, category: "transition-metal", config: "[Kr] 4d8 5s1", electronegativity: 2.28, atomicRadius: 173, meltingPoint: 2237, boilingPoint: 3968, density: 12.41, discoveredYear: 1803, period: 5, group: 9, isotopes: [{ mass: 103, abundance: 100 }] },
  { z: 46, symbol: "Pd", name: "Palladium", mass: 106.42, category: "transition-metal", config: "[Kr] 4d10", electronegativity: 2.20, atomicRadius: 169, meltingPoint: 1828.05, boilingPoint: 3236, density: 12.02, discoveredYear: 1803, period: 5, group: 10, isotopes: [{ mass: 106, abundance: 27.33 }, { mass: 108, abundance: 26.46 }] },
  { z: 47, symbol: "Ag", name: "Silver", mass: 107.87, category: "transition-metal", config: "[Kr] 4d10 5s1", electronegativity: 1.93, atomicRadius: 165, meltingPoint: 1234.93, boilingPoint: 2435, density: 10.501, discoveredYear: "Ancient", period: 5, group: 11, isotopes: [{ mass: 107, abundance: 51.839 }, { mass: 109, abundance: 48.161 }] },
  { z: 48, symbol: "Cd", name: "Cadmium", mass: 112.41, category: "transition-metal", config: "[Kr] 4d10 5s2", electronegativity: 1.69, atomicRadius: 161, meltingPoint: 594.22, boilingPoint: 1040, density: 8.69, discoveredYear: 1817, period: 5, group: 12, isotopes: [{ mass: 110, abundance: 12.47 }, { mass: 111, abundance: 12.80 }, { mass: 112, abundance: 24.11 }] },
  { z: 49, symbol: "In", name: "Indium", mass: 114.82, category: "post-transition-metal", config: "[Kr] 4d10 5s2 5p1", electronegativity: 1.78, atomicRadius: 156, meltingPoint: 429.7485, boilingPoint: 2345, density: 7.31, discoveredYear: 1863, period: 5, group: 13, isotopes: [{ mass: 113, abundance: 4.29 }, { mass: 115, abundance: 95.71 }] },
  { z: 50, symbol: "Sn", name: "Tin", mass: 118.71, category: "post-transition-metal", config: "[Kr] 4d10 5s2 5p2", electronegativity: 1.96, atomicRadius: 145, meltingPoint: 505.08, boilingPoint: 2875, density: 7.287, discoveredYear: "Ancient", period: 5, group: 14, isotopes: [{ mass: 112, abundance: 0.97 }, { mass: 114, abundance: 0.66 }, { mass: 115, abundance: 0.34 }] },
  { z: 51, symbol: "Sb", name: "Antimony", mass: 121.76, category: "metalloid", config: "[Kr] 4d10 5s2 5p3", electronegativity: 2.05, atomicRadius: 133, meltingPoint: 903.78, boilingPoint: 1860, density: 6.685, discoveredYear: "Ancient", period: 5, group: 15, isotopes: [{ mass: 121, abundance: 57.21 }, { mass: 123, abundance: 42.79 }] },
  { z: 52, symbol: "Te", name: "Tellurium", mass: 127.60, category: "metalloid", config: "[Kr] 4d10 5s2 5p4", electronegativity: 2.1, atomicRadius: 123, meltingPoint: 722.66, boilingPoint: 1261, density: 6.232, discoveredYear: 1782, period: 5, group: 16, isotopes: [{ mass: 120, abundance: 0.09 }, { mass: 122, abundance: 2.55 }, { mass: 124, abundance: 4.74 }] },
  { z: 53, symbol: "I", name: "Iodine", mass: 126.90, category: "halogen", config: "[Kr] 4d10 5s2 5p5", electronegativity: 2.66, atomicRadius: 115, meltingPoint: 386.85, boilingPoint: 457.4, density: 4.93, discoveredYear: 1811, period: 5, group: 17, isotopes: [{ mass: 127, abundance: 100 }] },
  { z: 54, symbol: "Xe", name: "Xenon", mass: 131.29, category: "noble-gas", config: "[Kr] 4d10 5s2 5p6", electronegativity: 2.6, atomicRadius: 108, meltingPoint: 161.4, boilingPoint: 165.031, density: 0.005887, discoveredYear: 1898, period: 5, group: 18, isotopes: [{ mass: 124, abundance: 0.095 }, { mass: 126, abundance: 0.089 }, { mass: 128, abundance: 1.910 }] },
  { z: 55, symbol: "Cs", name: "Cesium", mass: 132.91, category: "alkali-metal", config: "[Xe] 6s1", electronegativity: 0.79, atomicRadius: 298, meltingPoint: 301.7, boilingPoint: 944, density: 1.873, discoveredYear: 1860, period: 6, group: 1, isotopes: [{ mass: 133, abundance: 100 }] },
  { z: 56, symbol: "Ba", name: "Barium", mass: 137.33, category: "alkaline-earth-metal", config: "[Xe] 6s2", electronegativity: 0.89, atomicRadius: 253, meltingPoint: 1000, boilingPoint: 2170, density: 3.594, discoveredYear: 1808, period: 6, group: 2, isotopes: [{ mass: 130, abundance: 0.106 }, { mass: 132, abundance: 0.101 }, { mass: 134, abundance: 2.417 }] },
  { z: 57, symbol: "La", name: "Lanthanum", mass: 138.91, category: "lanthanide", config: "[Xe] 5d1 6s2", electronegativity: 1.10, atomicRadius: 226, meltingPoint: 1193, boilingPoint: 3737, density: 6.145, discoveredYear: 1839, period: 6, group: 3, isotopes: [{ mass: 139, abundance: 99.910 }] },
  { z: 58, symbol: "Ce", name: "Cerium", mass: 140.12, category: "lanthanide", config: "[Xe] 4f1 5d1 6s2", electronegativity: 1.12, atomicRadius: 210, meltingPoint: 1068, boilingPoint: 3716, density: 6.770, discoveredYear: 1803, period: 6, group: 0, isotopes: [{ mass: 136, abundance: 0.185 }, { mass: 138, abundance: 0.251 }, { mass: 140, abundance: 88.450 }] },
  { z: 59, symbol: "Pr", name: "Praseodymium", mass: 140.91, category: "lanthanide", config: "[Xe] 4f3 6s2", electronegativity: 1.13, atomicRadius: 247, meltingPoint: 1208, boilingPoint: 3793, density: 6.773, discoveredYear: 1885, period: 6, group: 0, isotopes: [{ mass: 141, abundance: 100 }] },
  { z: 60, symbol: "Nd", name: "Neodymium", mass: 144.24, category: "lanthanide", config: "[Xe] 4f4 6s2", electronegativity: 1.14, atomicRadius: 206, meltingPoint: 1297, boilingPoint: 3347, density: 7.007, discoveredYear: 1885, period: 6, group: 0, isotopes: [{ mass: 142, abundance: 27.152 }, { mass: 144, abundance: 23.798 }] },
  { z: 61, symbol: "Pm", name: "Promethium", mass: 145, category: "lanthanide", config: "[Xe] 4f5 6s2", electronegativity: 1.13, atomicRadius: 205, meltingPoint: 1315, boilingPoint: 3273, density: 7.26, discoveredYear: 1945, period: 6, group: 0, isotopes: [{ mass: 145, abundance: 0 }, { mass: 147, abundance: 0 }] },
  { z: 62, symbol: "Sm", name: "Samarium", mass: 150.36, category: "lanthanide", config: "[Xe] 4f6 6s2", electronegativity: 1.17, atomicRadius: 238, meltingPoint: 1345, boilingPoint: 2067, density: 7.52, discoveredYear: 1879, period: 6, group: 0, isotopes: [{ mass: 144, abundance: 3.07 }, { mass: 149, abundance: 13.82 }, { mass: 152, abundance: 26.75 }] },
  { z: 63, symbol: "Eu", name: "Europium", mass: 151.96, category: "lanthanide", config: "[Xe] 4f7 6s2", electronegativity: 1.2, atomicRadius: 231, meltingPoint: 1099, boilingPoint: 1802, density: 5.243, discoveredYear: 1901, period: 6, group: 0, isotopes: [{ mass: 151, abundance: 47.81 }, { mass: 153, abundance: 52.19 }] },
  { z: 64, symbol: "Gd", name: "Gadolinium", mass: 157.25, category: "lanthanide", config: "[Xe] 4f7 5d1 6s2", electronegativity: 1.20, atomicRadius: 233, meltingPoint: 1585, boilingPoint: 3546, density: 7.895, discoveredYear: 1880, period: 6, group: 0, isotopes: [{ mass: 152, abundance: 0.20 }, { mass: 158, abundance: 24.84 }] },
  { z: 65, symbol: "Tb", name: "Terbium", mass: 158.93, category: "lanthanide", config: "[Xe] 4f9 6s2", electronegativity: 1.2, atomicRadius: 225, meltingPoint: 1629, boilingPoint: 3503, density: 8.229, discoveredYear: 1843, period: 6, group: 0, isotopes: [{ mass: 159, abundance: 100 }] },
  { z: 66, symbol: "Dy", name: "Dysprosium", mass: 162.50, category: "lanthanide", config: "[Xe] 4f10 6s2", electronegativity: 1.22, atomicRadius: 228, meltingPoint: 1680, boilingPoint: 2840, density: 8.55, discoveredYear: 1886, period: 6, group: 0, isotopes: [{ mass: 156, abundance: 0.056 }, { mass: 164, abundance: 28.26 }] },
  { z: 67, symbol: "Ho", name: "Holmium", mass: 164.93, category: "lanthanide", config: "[Xe] 4f11 6s2", electronegativity: 1.23, atomicRadius: 226, meltingPoint: 1734, boilingPoint: 2993, density: 8.795, discoveredYear: 1878, period: 6, group: 0, isotopes: [{ mass: 165, abundance: 100 }] },
  { z: 68, symbol: "Er", name: "Erbium", mass: 167.26, category: "lanthanide", config: "[Xe] 4f12 6s2", electronegativity: 1.24, atomicRadius: 226, meltingPoint: 1802, boilingPoint: 3141, density: 9.066, discoveredYear: 1843, period: 6, group: 0, isotopes: [{ mass: 162, abundance: 0.139 }, { mass: 166, abundance: 33.503 }] },
  { z: 69, symbol: "Tm", name: "Thulium", mass: 168.93, category: "lanthanide", config: "[Xe] 4f13 6s2", electronegativity: 1.25, atomicRadius: 222, meltingPoint: 1818, boilingPoint: 2223, density: 9.321, discoveredYear: 1879, period: 6, group: 0, isotopes: [{ mass: 169, abundance: 100 }] },
  { z: 70, symbol: "Yb", name: "Ytterbium", mass: 173.05, category: "lanthanide", config: "[Xe] 4f14 6s2", electronegativity: 1.1, atomicRadius: 222, meltingPoint: 1097, boilingPoint: 1469, density: 6.965, discoveredYear: 1878, period: 6, group: 0, isotopes: [{ mass: 168, abundance: 0.123 }, { mass: 174, abundance: 31.826 }] },
  { z: 71, symbol: "Lu", name: "Lutetium", mass: 174.97, category: "lanthanide", config: "[Xe] 4f14 5d1 6s2", electronegativity: 1.27, atomicRadius: 217, meltingPoint: 1925, boilingPoint: 3675, density: 9.84, discoveredYear: 1907, period: 6, group: 3, isotopes: [{ mass: 175, abundance: 97.401 }, { mass: 176, abundance: 2.599 }] },
  { z: 72, symbol: "Hf", name: "Hafnium", mass: 178.49, category: "transition-metal", config: "[Xe] 4f14 5d2 6s2", electronegativity: 1.3, atomicRadius: 208, meltingPoint: 2506, boilingPoint: 4876, density: 13.31, discoveredYear: 1923, period: 6, group: 4, isotopes: [{ mass: 174, abundance: 0.16 }, { mass: 180, abundance: 35.08 }] },
  { z: 73, symbol: "Ta", name: "Tantalum", mass: 180.95, category: "transition-metal", config: "[Xe] 4f14 5d3 6s2", electronegativity: 1.5, atomicRadius: 200, meltingPoint: 3290, boilingPoint: 5731, density: 16.654, discoveredYear: 1802, period: 6, group: 5, isotopes: [{ mass: 180, abundance: 0.012 }, { mass: 181, abundance: 99.988 }] },
  { z: 74, symbol: "W", name: "Tungsten", mass: 183.84, category: "transition-metal", config: "[Xe] 4f14 5d4 6s2", electronegativity: 2.36, atomicRadius: 193, meltingPoint: 3695, boilingPoint: 6203, density: 19.25, discoveredYear: 1783, period: 6, group: 6, isotopes: [{ mass: 180, abundance: 0.12 }, { mass: 184, abundance: 30.64 }, { mass: 186, abundance: 28.43 }] },
  { z: 75, symbol: "Re", name: "Rhenium", mass: 186.21, category: "transition-metal", config: "[Xe] 4f14 5d5 6s2", electronegativity: 1.9, atomicRadius: 188, meltingPoint: 3459, boilingPoint: 5869, density: 20.8, discoveredYear: 1925, period: 6, group: 7, isotopes: [{ mass: 185, abundance: 37.40 }, { mass: 187, abundance: 62.60 }] },
  { z: 76, symbol: "Os", name: "Osmium", mass: 190.23, category: "transition-metal", config: "[Xe] 4f14 5d6 6s2", electronegativity: 2.2, atomicRadius: 185, meltingPoint: 3306, boilingPoint: 5285, density: 22.59, discoveredYear: 1803, period: 6, group: 8, isotopes: [{ mass: 184, abundance: 0.02 }, { mass: 192, abundance: 40.78 }] },
  { z: 77, symbol: "Ir", name: "Iridium", mass: 192.22, category: "transition-metal", config: "[Xe] 4f14 5d7 6s2", electronegativity: 2.20, atomicRadius: 180, meltingPoint: 2719, boilingPoint: 4701, density: 22.56, discoveredYear: 1803, period: 6, group: 9, isotopes: [{ mass: 191, abundance: 37.3 }, { mass: 193, abundance: 62.7 }] },
  { z: 78, symbol: "Pt", name: "Platinum", mass: 195.08, category: "transition-metal", config: "[Xe] 4f14 5d9 6s1", electronegativity: 2.28, atomicRadius: 177, meltingPoint: 2041.4, boilingPoint: 4098, density: 21.46, discoveredYear: 1735, period: 6, group: 10, isotopes: [{ mass: 190, abundance: 0.014 }, { mass: 195, abundance: 33.832 }] },
  { z: 79, symbol: "Au", name: "Gold", mass: 196.97, category: "transition-metal", config: "[Xe] 4f14 5d10 6s1", electronegativity: 2.54, atomicRadius: 174, meltingPoint: 1337.33, boilingPoint: 3129, density: 19.282, discoveredYear: "Ancient", period: 6, group: 11, isotopes: [{ mass: 197, abundance: 100 }] },
  { z: 80, symbol: "Hg", name: "Mercury", mass: 200.59, category: "transition-metal", config: "[Xe] 4f14 5d10 6s2", electronegativity: 2.00, atomicRadius: 171, meltingPoint: 234.43, boilingPoint: 629.88, density: 13.5336, discoveredYear: "Ancient", period: 6, group: 12, isotopes: [{ mass: 196, abundance: 0.15 }, { mass: 202, abundance: 29.74 }] },
  { z: 81, symbol: "Tl", name: "Thallium", mass: 204.38, category: "post-transition-metal", config: "[Xe] 4f14 5d10 6s2 6p1", electronegativity: 1.62, atomicRadius: 156, meltingPoint: 577, boilingPoint: 1746, density: 11.85, discoveredYear: 1861, period: 6, group: 13, isotopes: [{ mass: 203, abundance: 29.524 }, { mass: 205, abundance: 70.476 }] },
  { z: 82, symbol: "Pb", name: "Lead", mass: 207.2, category: "post-transition-metal", config: "[Xe] 4f14 5d10 6s2 6p2", electronegativity: 1.87, atomicRadius: 154, meltingPoint: 600.61, boilingPoint: 2022, density: 11.342, discoveredYear: "Ancient", period: 6, group: 14, isotopes: [{ mass: 204, abundance: 1.4 }, { mass: 206, abundance: 24.1 }, { mass: 207, abundance: 22.1 }] },
  { z: 83, symbol: "Bi", name: "Bismuth", mass: 208.98, category: "post-transition-metal", config: "[Xe] 4f14 5d10 6s2 6p3", electronegativity: 2.02, atomicRadius: 143, meltingPoint: 544.7, boilingPoint: 1837, density: 9.807, discoveredYear: 1753, period: 6, group: 15, isotopes: [{ mass: 209, abundance: 100 }] },
  { z: 84, symbol: "Po", name: "Polonium", mass: 209, category: "post-transition-metal", config: "[Xe] 4f14 5d10 6s2 6p4", electronegativity: 2.0, atomicRadius: 135, meltingPoint: 527, boilingPoint: 1235, density: 9.32, discoveredYear: 1898, period: 6, group: 16, isotopes: [{ mass: 209, abundance: 0 }] },
  { z: 85, symbol: "At", name: "Astatine", mass: 210, category: "halogen", config: "[Xe] 4f14 5d10 6s2 6p5", electronegativity: 2.2, atomicRadius: 127, meltingPoint: 575, boilingPoint: 610, density: 7, discoveredYear: 1940, period: 6, group: 17, isotopes: [{ mass: 210, abundance: 0 }] },
  { z: 86, symbol: "Rn", name: "Radon", mass: 222, category: "noble-gas", config: "[Xe] 4f14 5d10 6s2 6p6", electronegativity: 2.2, atomicRadius: 120, meltingPoint: 202, boilingPoint: 211.5, density: 0.00973, discoveredYear: 1900, period: 6, group: 18, isotopes: [{ mass: 222, abundance: 0 }] },
  { z: 87, symbol: "Fr", name: "Francium", mass: 223, category: "alkali-metal", config: "[Rn] 7s1", electronegativity: 0.7, atomicRadius: 348, meltingPoint: 300, boilingPoint: 950, density: 1.87, discoveredYear: 1939, period: 7, group: 1, isotopes: [{ mass: 223, abundance: 0 }] },
  { z: 88, symbol: "Ra", name: "Radium", mass: 226, category: "alkaline-earth-metal", config: "[Rn] 7s2", electronegativity: 0.9, atomicRadius: 283, meltingPoint: 973, boilingPoint: 2010, density: 5.5, discoveredYear: 1898, period: 7, group: 2, isotopes: [{ mass: 226, abundance: 0 }] },
  { z: 89, symbol: "Ac", name: "Actinium", mass: 227, category: "actinide", config: "[Rn] 6d1 7s2", electronegativity: 1.1, atomicRadius: 260, meltingPoint: 1323, boilingPoint: 3471, density: 10.07, discoveredYear: 1899, period: 7, group: 3, isotopes: [{ mass: 227, abundance: 0 }] },
  { z: 90, symbol: "Th", name: "Thorium", mass: 232.04, category: "actinide", config: "[Rn] 6d2 7s2", electronegativity: 1.3, atomicRadius: 237, meltingPoint: 2115, boilingPoint: 5061, density: 11.72, discoveredYear: 1829, period: 7, group: 0, isotopes: [{ mass: 232, abundance: 100 }] },
  { z: 91, symbol: "Pa", name: "Protactinium", mass: 231.04, category: "actinide", config: "[Rn] 5f2 6d1 7s2", electronegativity: 1.5, atomicRadius: 243, meltingPoint: 1841, boilingPoint: 4300, density: 15.37, discoveredYear: 1913, period: 7, group: 0, isotopes: [{ mass: 231, abundance: 0 }] },
  { z: 92, symbol: "U", name: "Uranium", mass: 238.03, category: "actinide", config: "[Rn] 5f3 6d1 7s2", electronegativity: 1.38, atomicRadius: 240, meltingPoint: 1405.3, boilingPoint: 4404, density: 18.95, discoveredYear: 1789, period: 7, group: 0, isotopes: [{ mass: 234, abundance: 0.0055 }, { mass: 235, abundance: 0.7200 }, { mass: 238, abundance: 99.2745 }] },
  { z: 93, symbol: "Np", name: "Neptunium", mass: 237, category: "actinide", config: "[Rn] 5f4 6d1 7s2", electronegativity: 1.36, atomicRadius: 221, meltingPoint: 917, boilingPoint: 4273, density: 20.45, discoveredYear: 1940, period: 7, group: 0, isotopes: [{ mass: 237, abundance: 0 }] },
  { z: 94, symbol: "Pu", name: "Plutonium", mass: 244, category: "actinide", config: "[Rn] 5f6 7s2", electronegativity: 1.28, atomicRadius: 243, meltingPoint: 912.5, boilingPoint: 3505, density: 19.84, discoveredYear: 1940, period: 7, group: 0, isotopes: [{ mass: 239, abundance: 0 }, { mass: 244, abundance: 0 }] },
  { z: 95, symbol: "Am", name: "Americium", mass: 243, category: "actinide", config: "[Rn] 5f7 7s2", electronegativity: 1.3, atomicRadius: 244, meltingPoint: 1449, boilingPoint: 2880, density: 13.69, discoveredYear: 1944, period: 7, group: 0, isotopes: [{ mass: 241, abundance: 0 }, { mass: 243, abundance: 0 }] },
  { z: 96, symbol: "Cm", name: "Curium", mass: 247, category: "actinide", config: "[Rn] 5f7 6d1 7s2", electronegativity: 1.3, atomicRadius: 245, meltingPoint: 1613, boilingPoint: 3383, density: 13.51, discoveredYear: 1944, period: 7, group: 0, isotopes: [{ mass: 247, abundance: 0 }] },
  { z: 97, symbol: "Bk", name: "Berkelium", mass: 247, category: "actinide", config: "[Rn] 5f9 7s2", electronegativity: 1.3, atomicRadius: 244, meltingPoint: 1259, boilingPoint: 2900, density: 14.79, discoveredYear: 1949, period: 7, group: 0, isotopes: [{ mass: 247, abundance: 0 }] },
  { z: 98, symbol: "Cf", name: "Californium", mass: 251, category: "actinide", config: "[Rn] 5f10 7s2", electronegativity: 1.3, atomicRadius: 245, meltingPoint: 1173, boilingPoint: 1743, density: 15.1, discoveredYear: 1950, period: 7, group: 0, isotopes: [{ mass: 249, abundance: 0 }, { mass: 251, abundance: 0 }] },
  { z: 99, symbol: "Es", name: "Einsteinium", mass: 252, category: "actinide", config: "[Rn] 5f11 7s2", electronegativity: 1.3, atomicRadius: 245, meltingPoint: 1133, boilingPoint: 1269, density: 8.84, discoveredYear: 1952, period: 7, group: 0, isotopes: [{ mass: 252, abundance: 0 }] },
  { z: 100, symbol: "Fm", name: "Fermium", mass: 257, category: "actinide", config: "[Rn] 5f12 7s2", electronegativity: 1.3, atomicRadius: 245, meltingPoint: 1800, boilingPoint: null, density: null, discoveredYear: 1952, period: 7, group: 0, isotopes: [{ mass: 257, abundance: 0 }] },
  { z: 101, symbol: "Md", name: "Mendelevium", mass: 258, category: "actinide", config: "[Rn] 5f13 7s2", electronegativity: 1.3, atomicRadius: 246, meltingPoint: 1100, boilingPoint: null, density: null, discoveredYear: 1955, period: 7, group: 0, isotopes: [{ mass: 258, abundance: 0 }] },
  { z: 102, symbol: "No", name: "Nobelium", mass: 259, category: "actinide", config: "[Rn] 5f14 7s2", electronegativity: 1.3, atomicRadius: 246, meltingPoint: 1100, boilingPoint: null, density: null, discoveredYear: 1966, period: 7, group: 0, isotopes: [{ mass: 259, abundance: 0 }] },
  { z: 103, symbol: "Lr", name: "Lawrencium", mass: 266, category: "actinide", config: "[Rn] 5f14 7s2 7p1", electronegativity: 1.3, atomicRadius: 246, meltingPoint: 1900, boilingPoint: null, density: null, discoveredYear: 1961, period: 7, group: 3, isotopes: [{ mass: 266, abundance: 0 }] },
  { z: 104, symbol: "Rf", name: "Rutherfordium", mass: 267, category: "transition-metal", config: "[Rn] 5f14 6d2 7s2", electronegativity: null, atomicRadius: 233, meltingPoint: 2400, boilingPoint: 5800, density: 23.2, discoveredYear: 1964, period: 7, group: 4, isotopes: [{ mass: 267, abundance: 0 }] },
  { z: 105, symbol: "Db", name: "Dubnium", mass: 268, category: "transition-metal", config: "[Rn] 5f14 6d3 7s2", electronegativity: null, atomicRadius: 229, meltingPoint: null, boilingPoint: null, density: 29.3, discoveredYear: 1967, period: 7, group: 5, isotopes: [{ mass: 268, abundance: 0 }] },
  { z: 106, symbol: "Sg", name: "Seaborgium", mass: 269, category: "transition-metal", config: "[Rn] 5f14 6d4 7s2", electronegativity: null, atomicRadius: 228, meltingPoint: null, boilingPoint: null, density: 35.0, discoveredYear: 1974, period: 7, group: 6, isotopes: [{ mass: 269, abundance: 0 }] },
  { z: 107, symbol: "Bh", name: "Bohrium", mass: 270, category: "transition-metal", config: "[Rn] 5f14 6d5 7s2", electronegativity: null, atomicRadius: 225, meltingPoint: null, boilingPoint: null, density: 37.1, discoveredYear: 1981, period: 7, group: 7, isotopes: [{ mass: 270, abundance: 0 }] },
  { z: 108, symbol: "Hs", name: "Hassium", mass: 269, category: "transition-metal", config: "[Rn] 5f14 6d6 7s2", electronegativity: null, atomicRadius: 222, meltingPoint: null, boilingPoint: null, density: 40.7, discoveredYear: 1984, period: 7, group: 8, isotopes: [{ mass: 269, abundance: 0 }] },
  { z: 109, symbol: "Mt", name: "Meitnerium", mass: 278, category: "unknown", config: "[Rn] 5f14 6d7 7s2", electronegativity: null, atomicRadius: null, meltingPoint: null, boilingPoint: null, density: 37.4, discoveredYear: 1982, period: 7, group: 9, isotopes: [{ mass: 278, abundance: 0 }] },
  { z: 110, symbol: "Ds", name: "Darmstadtium", mass: 281, category: "unknown", config: "[Rn] 5f14 6d9 7s1", electronegativity: null, atomicRadius: null, meltingPoint: null, boilingPoint: null, density: 34.8, discoveredYear: 1994, period: 7, group: 10, isotopes: [{ mass: 281, abundance: 0 }] },
  { z: 111, symbol: "Rg", name: "Roentgenium", mass: 282, category: "unknown", config: "[Rn] 5f14 6d10 7s1", electronegativity: null, atomicRadius: null, meltingPoint: null, boilingPoint: null, density: 28.7, discoveredYear: 1994, period: 7, group: 11, isotopes: [{ mass: 282, abundance: 0 }] },
  { z: 112, symbol: "Cn", name: "Copernicium", mass: 285, category: "transition-metal", config: "[Rn] 5f14 6d10 7s2", electronegativity: null, atomicRadius: null, meltingPoint: null, boilingPoint: 357, density: 23.7, discoveredYear: 1996, period: 7, group: 12, isotopes: [{ mass: 285, abundance: 0 }] },
  { z: 113, symbol: "Nh", name: "Nihonium", mass: 286, category: "unknown", config: "[Rn] 5f14 6d10 7s2 7p1", electronegativity: null, atomicRadius: null, meltingPoint: 700, boilingPoint: 1430, density: 16, discoveredYear: 2003, period: 7, group: 13, isotopes: [{ mass: 286, abundance: 0 }] },
  { z: 114, symbol: "Fl", name: "Flerovium", mass: 289, category: "post-transition-metal", config: "[Rn] 5f14 6d10 7s2 7p2", electronegativity: null, atomicRadius: null, meltingPoint: 340, boilingPoint: 420, density: 14, discoveredYear: 1998, period: 7, group: 14, isotopes: [{ mass: 289, abundance: 0 }] },
  { z: 115, symbol: "Mc", name: "Moscovium", mass: 290, category: "unknown", config: "[Rn] 5f14 6d10 7s2 7p3", electronegativity: null, atomicRadius: null, meltingPoint: 700, boilingPoint: 1400, density: 13.5, discoveredYear: 2003, period: 7, group: 15, isotopes: [{ mass: 290, abundance: 0 }] },
  { z: 116, symbol: "Lv", name: "Livermorium", mass: 293, category: "unknown", config: "[Rn] 5f14 6d10 7s2 7p4", electronegativity: null, atomicRadius: null, meltingPoint: 709, boilingPoint: 1085, density: 12.9, discoveredYear: 2000, period: 7, group: 16, isotopes: [{ mass: 293, abundance: 0 }] },
  { z: 117, symbol: "Ts", name: "Tennessine", mass: 294, category: "unknown", config: "[Rn] 5f14 6d10 7s2 7p5", electronegativity: null, atomicRadius: null, meltingPoint: 723, boilingPoint: 883, density: 7.17, discoveredYear: 2010, period: 7, group: 17, isotopes: [{ mass: 294, abundance: 0 }] },
  { z: 118, symbol: "Og", name: "Oganesson", mass: 294, category: "noble-gas", config: "[Rn] 5f14 6d10 7s2 7p6", electronegativity: null, atomicRadius: null, meltingPoint: null, boilingPoint: 350, density: 5.0, discoveredYear: 2002, period: 7, group: 18, isotopes: [{ mass: 294, abundance: 0 }] },
];

// ---- Search ----

/** Normalize a search query. */
export function normalizeQuery(s: string): string {
  return (s || "").toLowerCase().trim();
}

/** Search elements by name, symbol, or atomic number. */
export function searchElements(query: string, elements: Element[] = ELEMENTS): Element[] {
  const q = normalizeQuery(query);
  if (!q) return elements;
  // Numeric: atomic number match (exact first, then substring)
  if (/^\d+$/.test(q)) {
    const n = parseInt(q, 10);
    const exact = elements.filter((e) => e.z === n);
    if (exact.length > 0) return exact;
    return elements.filter((e) => e.z.toString().includes(q));
  }
  return elements.filter((e) =>
    e.name.toLowerCase().includes(q) ||
    e.symbol.toLowerCase() === q ||
    e.symbol.toLowerCase().startsWith(q) ||
    e.name.toLowerCase().startsWith(q) ||
    e.category.toLowerCase().includes(q),
  );
}

// ---- Filter ----

/** Filter elements by category. */
export function filterByCategory(category: ElementCategory | "", elements: Element[] = ELEMENTS): Element[] {
  if (!category) return elements;
  return elements.filter((e) => e.category === category);
}

/** Combined search + filter. */
export function searchAndFilter(
  query: string,
  category: ElementCategory | "",
  elements: Element[] = ELEMENTS,
): Element[] {
  return filterByCategory(category, searchElements(query, elements));
}

// ---- Format ----

export interface FormattedElement {
  header: string;
  details: string[];
}

/** Format an element for display. */
export function formatElement(el: Element): FormattedElement {
  const lines: string[] = [];
  lines.push(`Atomic Number: ${el.z}`);
  lines.push(`Symbol: ${el.symbol}`);
  lines.push(`Name: ${el.name}`);
  lines.push(`Atomic Mass: ${el.mass} u`);
  lines.push(`Category: ${CATEGORY_LABELS[el.category]}`);
  lines.push(`Period: ${el.period}, Group: ${el.group || "f-block"}`);
  lines.push(`Electron Configuration: ${el.config}`);
  lines.push(`Electronegativity: ${el.electronegativity ?? "n/a"} (Pauling)`);
  lines.push(`Atomic Radius: ${el.atomicRadius ?? "n/a"} pm`);
  lines.push(`Melting Point: ${el.meltingPoint ?? "n/a"} K`);
  lines.push(`Boiling Point: ${el.boilingPoint ?? "n/a"} K`);
  lines.push(`Density: ${el.density ?? "n/a"} g/cm^3`);
  lines.push(`Discovered: ${el.discoveredYear}`);
  if (el.isotopes.length > 0) {
    const isoStr = el.isotopes
      .map((i) => `${i.mass} (${i.abundance}%)`)
      .join(", ");
    lines.push(`Isotopes: ${isoStr}`);
  }
  return {
    header: `${el.z}. ${el.symbol} — ${el.name}`,
    details: lines,
  };
}

// ---- Compare ----

export type SortKey = "z" | "mass" | "name" | "electronegativity";

/** Sort elements by key. */
export function sortElements(elements: Element[], key: SortKey, asc = true): Element[] {
  const sorted = [...elements].sort((a, b) => {
    let cmp = 0;
    if (key === "z") cmp = a.z - b.z;
    else if (key === "mass") cmp = a.mass - b.mass;
    else if (key === "name") cmp = a.name.localeCompare(b.name);
    else if (key === "electronegativity") {
      const av = a.electronegativity ?? -1;
      const bv = b.electronegativity ?? -1;
      cmp = av - bv;
    }
    return asc ? cmp : -cmp;
  });
  return sorted;
}

// ---- Category lookup ----

/** Get color for a category. */
export function getCategoryColor(category: ElementCategory): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.unknown;
}

/** Get all categories with counts. */
export function listCategoriesWithCounts(elements: Element[] = ELEMENTS): { category: ElementCategory; label: string; color: string; count: number }[] {
  const counts = new Map<ElementCategory, number>();
  for (const e of elements) {
    counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  }
  return (Object.keys(CATEGORY_LABELS) as ElementCategory[])
    .filter((c) => counts.has(c))
    .map((c) => ({
      category: c,
      label: CATEGORY_LABELS[c],
      color: CATEGORY_COLORS[c],
      count: counts.get(c) ?? 0,
    }));
}

// ---- Period/Group calculator ----

/** Compute period (row) and group (column) for an element. */
export function computePosition(el: Element): { period: number; group: number; isFBlock: boolean } {
  const isFBlock = el.category === "lanthanide" || el.category === "actinide";
  return {
    period: el.period,
    group: el.group,
    isFBlock,
  };
}

// ---- Neighbor finder ----

export interface ElementNeighbors {
  left: Element | null;
  right: Element | null;
  up: Element | null;
  down: Element | null;
}

/** Find the four neighbors of an element in the periodic table grid.
 *  Lanthanides/actinides (f-block) are not in the main grid. */
export function findNeighbors(el: Element, elements: Element[] = ELEMENTS): ElementNeighbors {
  const mainGrid = elements.filter(
    (e) => e.category !== "lanthanide" && e.category !== "actinide",
  );
  const result: ElementNeighbors = { left: null, right: null, up: null, down: null };
  if (el.category === "lanthanide" || el.category === "actinide") {
    return result;
  }
  for (const other of mainGrid) {
    if (other.category === "lanthanide" || other.category === "actinide") continue;
    if (other.period === el.period && other.group === el.group - 1) result.left = other;
    if (other.period === el.period && other.group === el.group + 1) result.right = other;
    if (other.period === el.period - 1 && other.group === el.group) result.up = other;
    if (other.period === el.period + 1 && other.group === el.group) result.down = other;
  }
  return result;
}

// ---- Isotope finder ----

/** Get isotopes for an element. */
export function getIsotopes(el: Element): { mass: number; abundance: number }[] {
  return el.isotopes;
}

/** Find the most abundant isotope. */
export function getMostAbundantIsotope(el: Element): { mass: number; abundance: number } | null {
  if (el.isotopes.length === 0) return null;
  return el.isotopes.reduce((best, cur) => (cur.abundance > best.abundance ? cur : best));
}

// ---- Compound formula validator ----

/** Element symbols sorted by length desc for greedy matching. */
const ELEMENT_SYMBOLS: string[] = ELEMENTS.map((e) => e.symbol).sort((a, b) => b.length - a.length);

export interface ValidationResult {
  valid: boolean;
  error?: string;
  tokens: { symbol: string; count: number }[];
}

/** Validate a chemical formula like H2O, NaCl, Ca(OH)2, H2SO4. */
export function validateCompoundFormula(formula: string): ValidationResult {
  const f = (formula || "").trim();
  if (!f) return { valid: false, error: "Empty formula", tokens: [] };
  if (!/^[A-Za-z0-9()]+$/.test(f)) {
    return { valid: false, error: "Invalid characters", tokens: [] };
  }
  const validSymbols = new Set(ELEMENT_SYMBOLS);
  const tokens: { symbol: string; count: number }[] = [];
  let i = 0;
  const stack: { symbol: string; count: number }[][] = [[]];
  while (i < f.length) {
    const ch = f[i];
    if (ch === "(") {
      stack.push([]);
      i++;
      continue;
    }
    if (ch === ")") {
      if (stack.length < 2) {
        return { valid: false, error: "Unmatched ')'", tokens: [] };
      }
      // optional multiplier
      let countStr = "";
      i++;
      while (i < f.length && /[0-9]/.test(f[i])) { countStr += f[i]; i++; }
      const mult = countStr ? parseInt(countStr, 10) : 1;
      const top = stack.pop()!;
      for (const t of top) {
        stack[stack.length - 1].push({ symbol: t.symbol, count: t.count * mult });
      }
      continue;
    }
    if (/[A-Z]/.test(ch)) {
      let sym = ch;
      i++;
      if (i < f.length && /[a-z]/.test(f[i])) { sym += f[i]; i++; }
      if (!validSymbols.has(sym)) {
        return { valid: false, error: `Unknown element: ${sym}`, tokens: [] };
      }
      let countStr = "";
      while (i < f.length && /[0-9]/.test(f[i])) { countStr += f[i]; i++; }
      const count = countStr ? parseInt(countStr, 10) : 1;
      stack[stack.length - 1].push({ symbol: sym, count });
      continue;
    }
    return { valid: false, error: `Unexpected character at position ${i}: '${ch}'`, tokens: [] };
  }
  if (stack.length !== 1) {
    return { valid: false, error: "Unmatched '('", tokens: [] };
  }
  // Merge same symbols
  const merged = new Map<string, number>();
  for (const t of stack[0]) {
    merged.set(t.symbol, (merged.get(t.symbol) ?? 0) + t.count);
  }
  for (const [symbol, count] of merged) {
    tokens.push({ symbol, count });
  }
  return { valid: true, tokens };
}

// ---- Renderers ----

/** Render an element as a one-line text. */
export function renderElementLine(el: Element): string {
  return `${el.z}\t${el.symbol}\t${el.name}\t${el.mass}\t${CATEGORY_LABELS[el.category]}`;
}

/** Render a list of elements as a text table. */
export function renderTextTable(elements: Element[] = ELEMENTS): string {
  const header = "#\tSym\tName\tMass\tCategory";
  return [header, ...elements.map(renderElementLine)].join("\n");
}

/** Render an ASCII periodic table. */
export function renderAsciiTable(elements: Element[] = ELEMENTS): string {
  const byPos = new Map<string, Element>();
  const fBlock: Element[] = [];
  for (const e of elements) {
    if (e.category === "lanthanide" || e.category === "actinide") {
      fBlock.push(e);
    } else {
      byPos.set(`${e.period}-${e.group}`, e);
    }
  }
  const lines: string[] = [];
  for (let p = 1; p <= 7; p++) {
    let line = "";
    for (let g = 1; g <= 18; g++) {
      const e = byPos.get(`${p}-${g}`);
      if (e) {
        line += (e.symbol + "   ").slice(0, 4);
      } else {
        line += "    ";
      }
    }
    lines.push(line);
  }
  if (fBlock.length > 0) {
    lines.push("");
    const lanth = fBlock.filter((e) => e.category === "lanthanide").map((e) => (e.symbol + "   ").slice(0, 4)).join("");
    const actin = fBlock.filter((e) => e.category === "actinide").map((e) => (e.symbol + "   ").slice(0, 4)).join("");
    lines.push("* " + lanth);
    lines.push("** " + actin);
  }
  return lines.join("\n");
}

/** Escape a CSV field. */
function escapeCsv(s: string | number): string {
  const str = String(s);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** Render a list of elements as CSV. */
export function renderCsv(elements: Element[] = ELEMENTS): string {
  const header = "atomic_number,symbol,name,atomic_mass,category,electron_configuration,electronegativity,atomic_radius_pm,melting_point_k,boiling_point_k,density_g_cm3,discovered_year,period,group";
  const lines = [header];
  for (const e of elements) {
    lines.push([
      e.z, e.symbol, e.name, e.mass, e.category, e.config,
      e.electronegativity ?? "", e.atomicRadius ?? "",
      e.meltingPoint ?? "", e.boilingPoint ?? "",
      e.density ?? "", e.discoveredYear, e.period, e.group,
    ].map(escapeCsv).join(","));
  }
  return lines.join("\n");
}

/** Render a list of elements as JSON. */
export function renderJson(elements: Element[] = ELEMENTS): string {
  return JSON.stringify(elements, null, 2);
}

/** Render a single element as JSON. */
export function renderElementJson(el: Element): string {
  return JSON.stringify(el, null, 2);
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:periodic-table-reference:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  z: number;
  symbol: string;
  name: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const current = loadHistory().filter((h) => h.z !== entry.z);
  const next = [entry, ...current].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(selectedZ: number): string {
  const params = new URLSearchParams();
  if (selectedZ > 0) params.set("z", String(selectedZ));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { z: number } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { z: 0 };
  const params = new URLSearchParams(clean);
  const zs = params.get("z") ?? "";
  if (!zs || !/^\d+$/.test(zs)) return { z: 0 };
  const z = parseInt(zs, 10);
  if (z < 1 || z > 118) return { z: 0 };
  return { z };
}

// ---- Summary stats ----

export interface SummaryStats {
  totalElements: number;
  byCategory: { category: ElementCategory; label: string; color: string; count: number }[];
  byPeriod: Record<number, number>;
  avgMass: number;
  avgElectronegativity: number | null;
  heaviest: Element | null;
  lightest: Element | null;
  mostElectronegative: Element | null;
  oldestDiscovery: Element | null;
}

/** Compute summary statistics. */
export function computeSummaryStats(elements: Element[] = ELEMENTS): SummaryStats {
  const byCategory = listCategoriesWithCounts(elements);
  const byPeriod: Record<number, number> = {};
  for (const e of elements) {
    byPeriod[e.period] = (byPeriod[e.period] ?? 0) + 1;
  }
  const avgMass = elements.length > 0
    ? elements.reduce((s, e) => s + e.mass, 0) / elements.length
    : 0;
  const withEn = elements.filter((e) => e.electronegativity !== null);
  const avgElectronegativity = withEn.length > 0
    ? withEn.reduce((s, e) => s + (e.electronegativity as number), 0) / withEn.length
    : null;
  let heaviest: Element | null = null;
  let lightest: Element | null = null;
  let mostEn: Element | null = null;
  let oldestYear = Infinity;
  let oldestEl: Element | null = null;
  for (const e of elements) {
    if (!heaviest || e.mass >= heaviest.mass) heaviest = e;
    if (!lightest || e.mass < lightest.mass) lightest = e;
    if (e.electronegativity !== null && (!mostEn || (e.electronegativity as number) > (mostEn.electronegativity as number))) {
      mostEn = e;
    }
    const year = typeof e.discoveredYear === "number" ? e.discoveredYear : -1;
    if (year >= 0 && year < oldestYear) {
      oldestYear = year;
      oldestEl = e;
    }
  }
  return {
    totalElements: elements.length,
    byCategory,
    byPeriod,
    avgMass,
    avgElectronegativity,
    heaviest,
    lightest,
    mostElectronegative: mostEn,
    oldestDiscovery: oldestEl,
  };
}

/** Get element by atomic number. */
export function getByAtomicNumber(z: number, elements: Element[] = ELEMENTS): Element | null {
  return elements.find((e) => e.z === z) ?? null;
}

/** Get element by symbol (case-insensitive). */
export function getBySymbol(symbol: string, elements: Element[] = ELEMENTS): Element | null {
  const s = symbol.trim().toUpperCase();
  return elements.find((e) => e.symbol.toUpperCase() === s) ?? null;
}
