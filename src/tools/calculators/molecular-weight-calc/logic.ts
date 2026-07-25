/**
 * Molecular Weight Calculator — parse chemical formula and sum atomic weights.
 * Pure logic. No DOM access.
 */
export interface AtomicWeight { symbol: string; weight: number; }

/** Table of 20 common elements with atomic weights (IUPAC 2021). */
export const ATOMIC_WEIGHTS: Record<string, number> = {
  H: 1.008, He: 4.0026, Li: 6.94, Be: 9.0122, B: 10.81, C: 12.011, N: 14.007, O: 15.999,
  F: 18.998, Ne: 20.180, Na: 22.990, Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06,
  Cl: 35.45, K: 39.098, Ar: 39.948, Ca: 40.078,
};

export interface FormulaToken { element: string; count: number; }

export interface ParseResult {
  tokens: FormulaToken[];
  unknown: string[];
}

/** Parse a chemical formula into element-count tokens. */
export function parseFormula(formula: string): ParseResult {
  const tokens: FormulaToken[] = [];
  const unknown: string[] = [];
  // Stack-based parser for nested groups.
  type Frame = { multiplier: number; tokens: FormulaToken[] };
  const stack: Frame[] = [{ multiplier: 1, tokens: [] }];
  let i = 0;
  const peekCount = (): number => {
    let j = i;
    let s = "";
    while (j < formula.length && /[0-9]/.test(formula[j]!)) { s += formula[j]; j++; }
    return s ? parseInt(s, 10) : 1;
  };
  while (i < formula.length) {
    const ch = formula[i]!;
    if (ch === "(") {
      stack.push({ multiplier: 1, tokens: [] });
      i++;
    } else if (ch === ")") {
      i++;
      const mult = peekCount();
      i += mult.toString().length - 1 > 0 ? mult.toString().length - 1 : 0;
      // consume the digits
      while (i < formula.length && /[0-9]/.test(formula[i]!)) i++;
      const frame = stack.pop()!;
      const top = stack[stack.length - 1]!;
      for (const t of frame.tokens) {
        const idx = top.tokens.findIndex((x) => x.element === t.element);
        if (idx >= 0) top.tokens[idx]!.count += t.count * mult;
        else top.tokens.push({ element: t.element, count: t.count * mult });
      }
    } else if (/[A-Z]/.test(ch)) {
      let sym = ch;
      i++;
      while (i < formula.length && /[a-z]/.test(formula[i]!)) { sym += formula[i]; i++; }
      const count = peekCount();
      while (i < formula.length && /[0-9]/.test(formula[i]!)) i++;
      const top = stack[stack.length - 1]!;
      const idx = top.tokens.findIndex((x) => x.element === sym);
      if (idx >= 0) top.tokens[idx]!.count += count;
      else top.tokens.push({ element: sym, count });
      if (!(sym in ATOMIC_WEIGHTS)) unknown.push(sym);
    } else {
      i++; // skip whitespace, hydrates dot, etc.
    }
  }
  const top = stack[0]!;
  return { tokens: top.tokens, unknown };
}

/** Compute molecular weight from parsed tokens. */
export function computeMolecularWeight(tokens: FormulaToken[]): { weight: number; missing: string[] } {
  let weight = 0;
  const missing: string[] = [];
  for (const t of tokens) {
    if (t.element in ATOMIC_WEIGHTS) weight += ATOMIC_WEIGHTS[t.element]! * t.count;
    else missing.push(t.element);
  }
  return { weight, missing };
}

/** Parse + compute in one shot. */
export function molecularWeight(formula: string): { weight: number; tokens: FormulaToken[]; missing: string[] } | { error: string } {
  if (!formula || !formula.trim()) return { error: "Formula must not be empty." };
  const parsed = parseFormula(formula.trim());
  if (parsed.tokens.length === 0) return { error: "No valid elements found in formula." };
  if (parsed.unknown.length > 0) return { error: `Unknown elements: ${parsed.unknown.join(", ")}` };
  const r = computeMolecularWeight(parsed.tokens);
  return { weight: r.weight, tokens: parsed.tokens, missing: r.missing };
}

export function validateFormula(formula: string): { ok: true } | { error: string } {
  if (!formula.trim()) return { error: "Formula is empty." };
  return { ok: true };
}
