/**
 * Chemical Equation Balancer — pure logic.
 * Parse equation, balance using linear algebra, stoichiometry, step-by-step solution.
 */

export interface ParsedSide {
  /** Map of compound → coefficient (default 1 if not specified). */
  compounds: { formula: string; coefficient: number }[];
}

export interface ParsedEquation {
  reactants: ParsedSide;
  products: ParsedSide;
  /** All unique elements in the equation. */
  elements: string[];
}

/** Parse a formula like "H2O" or "Ca(OH)2" into a map of element → count. */
export function parseFormula(formula: string): Record<string, number> {
  const result: Record<string, number> = {};
  const tokens: { type: "element" | "number" | "open" | "close"; value: string }[] = [];
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (ch === "(") {
      tokens.push({ type: "open", value: ch });
      i++;
    } else if (ch === ")") {
      tokens.push({ type: "close", value: ch });
      i++;
    } else if (/[A-Z]/.test(ch)) {
      let elem = ch;
      i++;
      if (i < formula.length && /[a-z]/.test(formula[i])) {
        elem += formula[i];
        i++;
      }
      tokens.push({ type: "element", value: elem });
    } else if (/[0-9]/.test(ch)) {
      let num = ch;
      i++;
      while (i < formula.length && /[0-9]/.test(formula[i])) {
        num += formula[i];
        i++;
      }
      tokens.push({ type: "number", value: num });
    } else {
      i++; // skip whitespace
    }
  }

  // Recursive parser with stack for parentheses
  function parseTokens(start: number): { counts: Record<string, number>; next: number } {
    const counts: Record<string, number> = {};
    let i = start;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.type === "close") return { counts, next: i + 1 };
      if (t.type === "element") {
        let count = 1;
        if (i + 1 < tokens.length && tokens[i + 1].type === "number") {
          count = parseInt(tokens[i + 1].value, 10);
          i++;
        }
        counts[t.value] = (counts[t.value] ?? 0) + count;
        i++;
      } else if (t.type === "open") {
        const inner = parseTokens(i + 1);
        let multiplier = 1;
        if (inner.next < tokens.length && tokens[inner.next].type === "number") {
          multiplier = parseInt(tokens[inner.next].value, 10);
          inner.next++;
        }
        for (const [elem, n] of Object.entries(inner.counts)) {
          counts[elem] = (counts[elem] ?? 0) + n * multiplier;
        }
        i = inner.next;
      } else {
        i++;
      }
    }
    return { counts, next: i };
  }

  const parsed = parseTokens(0);
  return parsed.counts;
}

/** Parse a side string like "2 H2O + O2" into compounds. */
export function parseSide(side: string): ParsedSide {
  const parts = side.split("+").map((s) => s.trim()).filter((s) => s.length > 0);
  const compounds = parts.map((p) => {
    const m = p.match(/^(\d*)\s*(.+)$/);
    const coeff = m && m[1] ? parseInt(m[1], 10) : 1;
    const formula = m ? m[2].trim() : p;
    return { formula, coefficient: coeff };
  });
  return { compounds };
}

/** Parse a full equation like "H2 + O2 -> H2O" or "H2 + O2 = H2O". */
export function parseEquation(eq: string): ParsedEquation {
  const sides = eq.split(/->|=>|=|→/).map((s) => s.trim());
  if (sides.length !== 2) throw new Error("Equation must contain exactly one -> or = separator.");
  const reactants = parseSide(sides[0]);
  const products = parseSide(sides[1]);
  const elementSet = new Set<string>();
  for (const side of [reactants, products]) {
    for (const c of side.compounds) {
      for (const elem of Object.keys(parseFormula(c.formula))) {
        elementSet.add(elem);
      }
    }
  }
  return { reactants, products, elements: Array.from(elementSet).sort() };
}

/** Build a matrix of element counts per compound. */
export function buildMatrix(eq: ParsedEquation): number[][] {
  const allCompounds = [...eq.reactants.compounds, ...eq.products.compounds];
  return eq.elements.map((elem) => {
    return allCompounds.map((c, idx) => {
      const counts = parseFormula(c.formula);
      const count = counts[elem] ?? 0;
      // Reactants positive, products negative
      return idx < eq.reactants.compounds.length ? count : -count;
    });
  });
}

/** Compute GCD of two numbers. */
export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

/** Compute LCM of two numbers. */
export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

/** Solve a system of linear equations using Gaussian elimination. Returns null if no unique solution. */
export function gaussianEliminate(matrix: number[][]): number[] | null {
  const m = matrix.map((row) => [...row]);
  const rows = m.length;
  const cols = m[0]?.length ?? 0;
  if (cols === 0) return null;
  let r = 0;
  for (let c = 0; c < cols - 1 && r < rows; c++) {
    // Find pivot
    let pivot = -1;
    for (let i = r; i < rows; i++) {
      if (Math.abs(m[i][c]) > 1e-9) { pivot = i; break; }
    }
    if (pivot === -1) continue;
    [m[r], m[pivot]] = [m[pivot], m[r]];
    // Eliminate other rows
    for (let i = 0; i < rows; i++) {
      if (i !== r && Math.abs(m[i][c]) > 1e-9) {
        const factor = m[i][c] / m[r][c];
        for (let j = c; j < cols; j++) m[i][j] -= factor * m[r][j];
      }
    }
    r++;
  }
  // Check consistency
  for (let i = 0; i < rows; i++) {
    const allZero = m[i].slice(0, cols - 1).every((v) => Math.abs(v) < 1e-9);
    if (allZero && Math.abs(m[i][cols - 1]) > 1e-9) return null;
  }
  // Back-substitute (find solution with last variable = 1)
  const solution = new Array(cols - 1).fill(0);
  // Build reduced row-echelon form
  for (let i = rows - 1; i >= 0; i--) {
    let pivotCol = -1;
    for (let j = 0; j < cols - 1; j++) {
      if (Math.abs(m[i][j]) > 1e-9) { pivotCol = j; break; }
    }
    if (pivotCol === -1) continue;
    solution[pivotCol] = m[i][cols - 1] / m[i][pivotCol];
  }
  return solution;
}

/** Balance an equation. Returns coefficients in order: reactants then products. */
export function balanceEquation(eq: ParsedEquation): number[] | null {
  const matrix = buildMatrix(eq);
  // Add a row for "sum of all coefficients = 1" to pin down the scale
  // Actually we want to solve M * x = 0 with x = [c1, c2, ...] all positive integers.
  // Approach: set last variable to 1 and solve.
  const n = matrix[0]?.length ?? 0;
  if (n === 0) return null;
  // Move last column to RHS: M[:, :-1] * x[:-1] = -M[:, -1] * x[-1], with x[-1] = 1
  const reduced = matrix.map((row) => {
    const last = row[row.length - 1];
    return [...row.slice(0, -1).map((v) => v), -last];
  });
  const solution = gaussianEliminate(reduced);
  if (!solution) return null;
  // Append 1 for the last variable
  const fullSolution = [...solution, 1];
  // Convert to integers by finding LCM of denominators
  const denominators = fullSolution.map((v) => {
    const denom = parseFloat((1 / (Math.round(v * 1e6) / 1e6)).toPrecision(12));
    // Find smallest integer k such that k * v is integer
    for (let k = 1; k <= 1000; k++) {
      if (Math.abs(k * v - Math.round(k * v)) < 1e-6) return k;
    }
    return 1;
  });
  const multiplier = denominators.reduce((a, b) => lcm(a, b), 1);
  const intSolution = fullSolution.map((v) => Math.round(v * multiplier));
  // Verify all positive
  if (intSolution.some((v) => v <= 0)) return null;
  // Reduce by GCD
  const commonGcd = intSolution.reduce((a, b) => gcd(a, b));
  return intSolution.map((v) => v / commonGcd);
}

export interface BalanceResult {
  equation: string;
  parsed: ParsedEquation;
  coefficients: number[] | null;
  balancedEquation: string;
  steps: string[];
  warnings: string[];
  notes: string[];
}

export function planBalance(equation: string): BalanceResult {
  const warnings: string[] = [];
  const notes: string[] = [];
  const steps: string[] = [];

  let parsed: ParsedEquation;
  try {
    parsed = parseEquation(equation);
  } catch (e) {
    return {
      equation, parsed: { reactants: { compounds: [] }, products: { compounds: [] }, elements: [] },
      coefficients: null, balancedEquation: "", steps: [], warnings: [String(e)], notes: [],
    };
  }

  steps.push(`1. Parse equation: ${parsed.reactants.compounds.length} reactant(s), ${parsed.products.compounds.length} product(s).`);
  steps.push(`2. Identify elements: ${parsed.elements.join(", ")}.`);
  const matrix = buildMatrix(parsed);
  steps.push(`3. Build matrix (${matrix.length}×${matrix[0]?.length ?? 0}).`);

  const coeffs = balanceEquation(parsed);
  if (!coeffs) {
    warnings.push("Could not balance equation — check that it's chemically valid.");
    return { equation, parsed, coefficients: null, balancedEquation: "", steps, warnings, notes };
  }
  steps.push(`4. Solve linear system → coefficients: ${coeffs.join(", ")}.`);

  // Build balanced equation string
  const reactantStr = parsed.reactants.compounds.map((c, i) => `${coeffs[i] === 1 ? "" : coeffs[i]}${c.formula}`).join(" + ");
  const productStr = parsed.products.compounds.map((c, i) => `${coeffs[parsed.reactants.compounds.length + i] === 1 ? "" : coeffs[parsed.reactants.compounds.length + i]}${c.formula}`).join(" + ");
  const balancedEquation = `${reactantStr} → ${productStr}`;
  steps.push(`5. Balanced: ${balancedEquation}`);

  // Verify by counting atoms
  const reactantCounts: Record<string, number> = {};
  const productCounts: Record<string, number> = {};
  parsed.reactants.compounds.forEach((c, i) => {
    const f = parseFormula(c.formula);
    for (const [elem, n] of Object.entries(f)) {
      reactantCounts[elem] = (reactantCounts[elem] ?? 0) + n * coeffs[i];
    }
  });
  parsed.products.compounds.forEach((c, i) => {
    const f = parseFormula(c.formula);
    for (const [elem, n] of Object.entries(f)) {
      productCounts[elem] = (productCounts[elem] ?? 0) + n * coeffs[parsed.reactants.compounds.length + i];
    }
  });
  const balanced = parsed.elements.every((e) => reactantCounts[e] === productCounts[e]);
  if (!balanced) {
    warnings.push("Balance verification failed — equation may be invalid.");
  } else {
    notes.push("Verified: atom counts balance on both sides.");
  }

  return { equation, parsed, coefficients: coeffs, balancedEquation, steps, warnings, notes };
}

export function planBatch(equations: string[]): BalanceResult[] {
  return equations.map(planBalance);
}

export function renderBatchCsv(results: BalanceResult[]): string {
  const lines: string[] = ["index,input,balanced,status"];
  results.forEach((r, i) => {
    lines.push([String(i + 1), `"${r.equation.replace(/"/g, '""')}"`, `"${r.balancedEquation.replace(/"/g, '""')}"`, r.coefficients ? "balanced" : "failed"].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: BalanceResult): string {
  const lines: string[] = [];
  lines.push("Chemical Equation Balancer Report");
  lines.push("=================================");
  lines.push(`Input: ${r.equation}`);
  lines.push(`Balanced: ${r.balancedEquation || "(failed)"}`);
  if (r.coefficients) lines.push(`Coefficients: ${r.coefficients.join(", ")}`);
  lines.push("");
  lines.push("Step-by-step:");
  r.steps.forEach((s) => lines.push(`  ${s}`));
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

/** Compute molar mass given a formula and an atomic masses table. */
export function molarMass(formula: string, atomicMasses: Record<string, number>): number {
  const counts = parseFormula(formula);
  let total = 0;
  for (const [elem, n] of Object.entries(counts)) {
    total += (atomicMasses[elem] ?? 0) * n;
  }
  return total;
}
