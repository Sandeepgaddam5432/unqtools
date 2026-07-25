/**
 * Periodic Table Lookup — pure data + lookup logic.
 * Database of 20 common elements with search.
 */

export interface Element {
  number: number;
  symbol: string;
  name: string;
  atomicMass: number;
  category: string;
  group: number | null;
  period: number;
  electronConfig: string;
  summary: string;
}

export const ELEMENTS: Element[] = [
  { number: 1, symbol: "H", name: "Hydrogen", atomicMass: 1.008, category: "nonmetal", group: 1, period: 1, electronConfig: "1s1", summary: "Lightest and most abundant element in the universe." },
  { number: 2, symbol: "He", name: "Helium", atomicMass: 4.003, category: "noble gas", group: 18, period: 1, electronConfig: "1s2", summary: "Inert noble gas; second most abundant in the cosmos." },
  { number: 6, symbol: "C", name: "Carbon", atomicMass: 12.011, category: "nonmetal", group: 14, period: 2, electronConfig: "[He] 2s2 2p2", summary: "Backbone of organic chemistry and life." },
  { number: 7, symbol: "N", name: "Nitrogen", atomicMass: 14.007, category: "nonmetal", group: 15, period: 2, electronConfig: "[He] 2s2 2p3", summary: "78% of Earth's atmosphere; essential for proteins." },
  { number: 8, symbol: "O", name: "Oxygen", atomicMass: 15.999, category: "nonmetal", group: 16, period: 2, electronConfig: "[He] 2s2 2p4", summary: "Essential for respiration; 21% of atmosphere." },
  { number: 9, symbol: "F", name: "Fluorine", atomicMass: 18.998, category: "halogen", group: 17, period: 2, electronConfig: "[He] 2s2 2p5", summary: "Most electronegative element; very reactive." },
  { number: 10, symbol: "Ne", name: "Neon", atomicMass: 20.180, category: "noble gas", group: 18, period: 2, electronConfig: "[He] 2s2 2p6", summary: "Inert gas used in lighting signs." },
  { number: 11, symbol: "Na", name: "Sodium", atomicMass: 22.990, category: "alkali metal", group: 1, period: 3, electronConfig: "[Ne] 3s1", summary: "Soft reactive metal; key in table salt (NaCl)." },
  { number: 12, symbol: "Mg", name: "Magnesium", atomicMass: 24.305, category: "alkaline earth metal", group: 2, period: 3, electronConfig: "[Ne] 3s2", summary: "Light structural metal; central atom of chlorophyll." },
  { number: 13, symbol: "Al", name: "Aluminum", atomicMass: 26.982, category: "post-transition metal", group: 13, period: 3, electronConfig: "[Ne] 3s2 3p1", summary: "Light, corrosion-resistant metal used in cans and aircraft." },
  { number: 14, symbol: "Si", name: "Silicon", atomicMass: 28.085, category: "metalloid", group: 14, period: 3, electronConfig: "[Ne] 3s2 3p2", summary: "Foundation of semiconductors and computer chips." },
  { number: 15, symbol: "P", name: "Phosphorus", atomicMass: 30.974, category: "nonmetal", group: 15, period: 3, electronConfig: "[Ne] 3s2 3p3", summary: "Essential for DNA, ATP, and bones." },
  { number: 16, symbol: "S", name: "Sulfur", atomicMass: 32.06, category: "nonmetal", group: 16, period: 3, electronConfig: "[Ne] 3s2 3p4", summary: "Yellow nonmetal; used in vulcanization and matches." },
  { number: 17, symbol: "Cl", name: "Chlorine", atomicMass: 35.45, category: "halogen", group: 17, period: 3, electronConfig: "[Ne] 3s2 3p5", summary: "Disinfectant; key component of table salt." },
  { number: 18, symbol: "Ar", name: "Argon", atomicMass: 39.948, category: "noble gas", group: 18, period: 3, electronConfig: "[Ne] 3s2 3p6", summary: "Inert gas used as shielding gas in welding." },
  { number: 19, symbol: "K", name: "Potassium", atomicMass: 39.098, category: "alkali metal", group: 1, period: 4, electronConfig: "[Ar] 4s1", summary: "Essential electrolyte for nerve function." },
  { number: 20, symbol: "Ca", name: "Calcium", atomicMass: 40.078, category: "alkaline earth metal", group: 2, period: 4, electronConfig: "[Ar] 4s2", summary: "Main component of bones and teeth." },
  { number: 26, symbol: "Fe", name: "Iron", atomicMass: 55.845, category: "transition metal", group: 8, period: 4, electronConfig: "[Ar] 3d6 4s2", summary: "Core of Earth's planet; key in hemoglobin." },
  { number: 29, symbol: "Cu", name: "Copper", atomicMass: 63.546, category: "transition metal", group: 11, period: 4, electronConfig: "[Ar] 3d10 4s1", summary: "Excellent electrical conductor; used in wiring." },
  { number: 79, symbol: "Au", name: "Gold", atomicMass: 196.967, category: "transition metal", group: 11, period: 6, electronConfig: "[Xe] 4f14 5d10 6s1", summary: "Dense, malleable precious metal; symbol of wealth." },
];

export function search(query: string): Element[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...ELEMENTS];
  return ELEMENTS.filter((e) =>
    e.name.toLowerCase().includes(q) ||
    e.symbol.toLowerCase() === q ||
    String(e.number) === q ||
    e.category.toLowerCase().includes(q),
  );
}

export function getBySymbol(symbol: string): Element | undefined {
  return ELEMENTS.find((e) => e.symbol.toLowerCase() === symbol.trim().toLowerCase());
}

export function getByNumber(n: number): Element | undefined {
  return ELEMENTS.find((e) => e.number === n);
}

export function categories(): string[] {
  return Array.from(new Set(ELEMENTS.map((e) => e.category))).sort();
}

export function toMarkdown(e: Element): string {
  return [
    `# ${e.name} (${e.symbol})`,
    "",
    `- Atomic number: ${e.number}`,
    `- Atomic mass: ${e.atomicMass} u`,
    `- Category: ${e.category}`,
    `- Group: ${e.group ?? "n/a"}`,
    `- Period: ${e.period}`,
    `- Electron configuration: ${e.electronConfig}`,
    "",
    e.summary,
  ].join("\n");
}
