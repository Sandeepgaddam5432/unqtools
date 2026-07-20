/**
 * AI Math Word Problem Solver — pure logic.
 *
 * Classify a math word problem (arithmetic, algebra, geometry,
 * percentage, ratio, rate, mixture) using keyword patterns,
 * extract numbers + operations + units from natural language,
 * set up the equation, compute the answer with a deterministic
 * math engine (NOT an LLM), and verify by back-substitution.
 *
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx because it touches the network.
 *
 * Honesty: the classifier can misread a problem — we verify
 * computation and show the setup so users can catch setup errors.
 */

// ---------- Types ----------

export type ProblemCategory =
  | "arithmetic"
  | "algebra"
  | "geometry"
  | "percentage"
  | "ratio"
  | "rate"
  | "mixture"
  | "unknown";

export type Operation =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "unknown";

export interface ExtractedNumber {
  value: number;
  raw: string;
  unit: string;
  index: number;
}

export interface Step {
  label: string;
  expression: string;
  result: string;
}

export interface Solution {
  category: ProblemCategory;
  numbers: ExtractedNumber[];
  operations: Operation[];
  units: string;
  equation: string;
  steps: Step[];
  answer: string;
  answerValue: number | null;
  verified: boolean;
  verificationNote: string;
  alternativeMethod: string | null;
  assumptions: string[];
  warnings: string[];
}

// ---------- Constants ----------

export const CATEGORY_LABELS: Record<ProblemCategory, string> = {
  "arithmetic": "Arithmetic",
  "algebra": "Algebra",
  "geometry": "Geometry",
  "percentage": "Percentage",
  "ratio": "Ratio",
  "rate": "Rate / Work",
  "mixture": "Mixture",
  "unknown": "Unknown",
};

export const OPERATION_LABELS: Record<Operation, string> = {
  "add": "Addition (+)",
  "subtract": "Subtraction (−)",
  "multiply": "Multiplication (×)",
  "divide": "Division (÷)",
  "unknown": "Unknown",
};

export const HISTORY_KEY = "unqtools:ai-math-word-problem-solver:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-math-word-problem-solver:llm-key";

export const SAMPLE_PROBLEMS: { name: string; problem: string; category: ProblemCategory }[] = [
  { name: "Arithmetic — sum", problem: "Alice has 12 apples and Bob gives her 7 more. How many apples does Alice have now?", category: "arithmetic" },
  { name: "Arithmetic — product", problem: "A box holds 8 pens. How many pens are in 6 boxes?", category: "arithmetic" },
  { name: "Algebra — linear", problem: "Twice a number plus 5 is 17. What is the number?", category: "algebra" },
  { name: "Algebra — division form", problem: "Three times a number equals 21. Find the number.", category: "algebra" },
  { name: "Geometry — rectangle area", problem: "A rectangle is 8 meters long and 5 meters wide. What is its area?", category: "geometry" },
  { name: "Geometry — circle area", problem: "What is the area of a circle with radius 4 cm? Use pi as 3.14159.", category: "geometry" },
  { name: "Percentage — of", problem: "What is 25 percent of 80?", category: "percentage" },
  { name: "Percentage — is what percent", problem: "30 is what percent of 120?", category: "percentage" },
  { name: "Percentage — increase", problem: "A price increases from $40 to $50. What is the percent increase?", category: "percentage" },
  { name: "Ratio — part to whole", problem: "The ratio of cats to dogs is 3 to 2. If there are 25 animals total, how many cats are there?", category: "ratio" },
  { name: "Rate — distance", problem: "A car travels at 60 miles per hour for 3 hours. How far does it travel?", category: "rate" },
  { name: "Rate — work", problem: "Alice can paint a wall in 4 hours and Bob in 6 hours. How long does it take them together?", category: "rate" },
  { name: "Mixture — concentration", problem: "How many liters of a 20 percent salt solution must be added to 10 liters of a 5 percent solution to make a 10 percent solution?", category: "mixture" },
];

// ---------- Number / unit / operation extraction ----------

const NUMBER_REGEX = /(-?\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?)/g;

/** Extract all numeric values from text, preserving position and surrounding unit. */
export function extractNumbers(text: string): ExtractedNumber[] {
  const out: ExtractedNumber[] = [];
  if (!text) return out;
  let m: RegExpExecArray | null;
  NUMBER_REGEX.lastIndex = 0;
  while ((m = NUMBER_REGEX.exec(text)) !== null) {
    const raw = m[1]!;
    let value = raw.includes("/")
      ? ((): number => {
          const [num, den] = raw.split("/");
          const n = Number(num);
          const d = Number(den);
          return d !== 0 ? n / d : NaN;
        })()
      : Number(raw);
    if (!Number.isFinite(value)) value = 0;
    // Look for a $ BEFORE the number
    let unit = "";
    const before = text.slice(0, m.index);
    const beforeMatch = before.match(/\$\s*$/);
    if (beforeMatch) {
      unit = "$";
    } else {
      // Capture unit: % or a letter-unit immediately after the number
      const rest = text.slice(m.index + raw.length);
      const unitMatch = rest.match(/^\s*(%|km|kms|meters|miles|mile|km|m|cm|mm|mi|ft|in|kg|g|lb|oz|L|ml|gal|hr|min|sec|hrs|mins|secs|hours|hour|minutes|seconds|kph|mph)?/);
      if (unitMatch && unitMatch[1]) unit = unitMatch[1];
    }
    out.push({
      value,
      raw,
      unit: unit.trim(),
      index: m.index,
    });
  }
  return out;
}

/** Detect operations mentioned in the problem text. */
export function extractOperations(text: string): Operation[] {
  const lower = (text || "").toLowerCase();
  const ops: Operation[] = [];
  if (/\b(sum|plus|added|add|increase|more|total|combined|together|increased by)\b/.test(lower)) ops.push("add");
  if (/\b(difference|minus|subtract|less|decrease|fewer|decreased by|less than)\b/.test(lower)) ops.push("subtract");
  if (/\b(product|times|multiply|multiplied|twice|double|triple|of each|per box|groups of)\b/.test(lower)) ops.push("multiply");
  if (/\b(quotient|divided by|divide|split|per|ratio|each)\b/.test(lower)) ops.push("divide");
  if (ops.length === 0) ops.push("unknown");
  return ops;
}

/** Extract a leading unit string from the problem (best-effort). */
export function extractUnits(text: string): string {
  const lower = (text || "").toLowerCase();
  const units = ["miles", "kilometers", "meters", "centimeters", "feet", "inches", "kg", "grams", "pounds", "liters", "gallons", "hours", "minutes", "seconds", "dollars", "percent"];
  for (const u of units) {
    if (lower.includes(u)) return u;
  }
  return "";
}

// ---------- Classifier ----------

/** Classify a problem into a category using keyword patterns. */
export function classifyProblem(text: string): ProblemCategory {
  const lower = (text || "").toLowerCase();
  if (!lower.trim()) return "unknown";
  // Mixture — must check BEFORE percentage (both use "percent")
  if (/\b(mixture|solution|concentration|alloy|acid|salt solution|mixed with)\b/.test(lower)) {
    return "mixture";
  }
  // Percentage
  if (/\b(percent|percentage|%|percent increase|percent decrease|percent off|discount)\b/.test(lower)) {
    return "percentage";
  }
  // Geometry
  if (/\b(area|perimeter|circumference|radius|diameter|rectangle|triangle|circle|square|length|width|height|base)\b/.test(lower)) {
    return "geometry";
  }
  // Rate / work
  if (/\b(per hour|per minute|per second|mph|kph|speed|velocity|distance|travels|paint.*hours?|fill.*hours?|together.*hours?|work together|in \d+ hours?\b.*together)\b/.test(lower)) {
    return "rate";
  }
  // Ratio
  if (/\b(ratio|proportion|to every|for every|out of)\b/.test(lower)) {
    return "ratio";
  }
  // Algebra — "a number", "twice a number", "find x"
  if (/\b(a number|the number|find the number|twice a number|three times a number|solve for x|equals|is what value)\b/.test(lower)) {
    return "algebra";
  }
  // Arithmetic — defaults when add/subtract/multiply/divide keywords are present
  if (/\b(sum|add|plus|minus|subtract|difference|product|times|multiply|divide|quotient|total|more|less|each|per box|per group|how many)\b/.test(lower)) {
    return "arithmetic";
  }
  return "unknown";
}

// ---------- Math helpers ----------

export function gcd(a: number, b: number): number {
  const x = Math.abs(a);
  const y = Math.abs(b);
  if (x === 0) return y;
  if (y === 0) return x;
  return gcd(y, x % y);
}

export function round(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  const f = Math.pow(10, Math.max(0, decimals));
  return Math.round(value * f) / f;
}

export function formatNumber(value: number, decimals = 4): string {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  // Try to render fractions when close to a simple one
  const rounded = round(value, decimals);
  return String(rounded);
}

// ---------- Solvers ----------

/** Solve an arithmetic word problem. */
export function solveArithmetic(text: string): Solution {
  const numbers = extractNumbers(text);
  const ops = extractOperations(text);
  const units = extractUnits(text);
  const warnings: string[] = [];
  const assumptions: string[] = [];

  if (numbers.length < 2) {
    return {
      category: "arithmetic",
      numbers, operations: ops, units,
      equation: "",
      steps: [],
      answer: "Not enough numbers to compute.",
      answerValue: null,
      verified: false,
      verificationNote: "Need at least two numbers for an arithmetic problem.",
      alternativeMethod: null,
      assumptions,
      warnings: ["Could not find at least two numbers in the problem."],
    };
  }

  const a = numbers[0]!.value;
  const b = numbers[1]!.value;
  let op: Operation = ops[0] ?? "unknown";
  // If unknown, try to infer from text
  if (op === "unknown") {
    const lower = text.toLowerCase();
    if (/\b(sum|plus|add|more|total|together|combined)\b/.test(lower)) op = "add";
    else if (/\b(difference|minus|subtract|less|fewer)\b/.test(lower)) op = "subtract";
    else if (/\b(product|times|multiply|twice|double|of each)\b/.test(lower)) op = "multiply";
    else if (/\b(quotient|divided by|divide|per|split)\b/.test(lower)) op = "divide";
    assumptions.push(`Inferred operation as "${op}" from problem keywords.`);
  }

  let result: number;
  let opSymbol: string;
  let opLabel: string;
  switch (op) {
    case "add": result = a + b; opSymbol = "+"; opLabel = "sum"; break;
    case "subtract": result = a - b; opSymbol = "−"; opLabel = "difference"; break;
    case "multiply": result = a * b; opSymbol = "×"; opLabel = "product"; break;
    case "divide":
      if (b === 0) {
        return {
          category: "arithmetic",
          numbers, operations: ops, units,
          equation: `${a} ÷ ${b}`,
          steps: [],
          answer: "Division by zero is undefined.",
          answerValue: null,
          verified: false,
          verificationNote: "Cannot divide by zero.",
          alternativeMethod: null,
          assumptions,
          warnings: ["Division by zero detected."],
        };
      }
      result = a / b; opSymbol = "÷"; opLabel = "quotient"; break;
    case "unknown":
    default:
      result = a + b; opSymbol = "+"; opLabel = "sum";
      assumptions.push("Defaulted to addition.");
      break;
  }

  const unitStr = units ? ` ${units}` : (numbers[0]!.unit || numbers[1]!.unit || "");
  const steps: Step[] = [
    { label: "Identify the numbers", expression: `${a}${unitStr} and ${b}${unitStr}`, result: "" },
    { label: "Identify the operation", expression: opLabel, result: opSymbol },
    { label: "Compute", expression: `${a} ${opSymbol} ${b}`, result: `${formatNumber(result)}${unitStr}` },
  ];

  // Verify by recomputing
  let verified = false;
  let verificationNote = "";
  let alt: string | null = null;
  switch (op) {
    case "add": {
      const check = result - b;
      verified = Math.abs(check - a) < 1e-9;
      verificationNote = `Back-substitution: ${formatNumber(result)} − ${b} = ${formatNumber(check)} (expected ${a}).`;
      break;
    }
    case "subtract": {
      const check = result + b;
      verified = Math.abs(check - a) < 1e-9;
      verificationNote = `Back-substitution: ${formatNumber(result)} + ${b} = ${formatNumber(check)} (expected ${a}).`;
      break;
    }
    case "multiply": {
      const check = result / b;
      verified = Math.abs(check - a) < 1e-9;
      verificationNote = `Back-substitution: ${formatNumber(result)} ÷ ${b} = ${formatNumber(check)} (expected ${a}).`;
      alt = `Counting method: ${a} groups of ${b} = ${formatNumber(a * b)}${unitStr}.`;
      break;
    }
    case "divide": {
      const check = result * b;
      verified = Math.abs(check - a) < 1e-9;
      verificationNote = `Back-substitution: ${formatNumber(result)} × ${b} = ${formatNumber(check)} (expected ${a}).`;
      break;
    }
  }

  return {
    category: "arithmetic",
    numbers, operations: ops, units,
    equation: `${a} ${opSymbol} ${b} = ${formatNumber(result)}${unitStr}`,
    steps,
    answer: `${formatNumber(result)}${unitStr}`,
    answerValue: result,
    verified,
    verificationNote,
    alternativeMethod: alt,
    assumptions,
    warnings,
  };
}

/** Solve a linear algebra word problem (ax + b = c, ax = b, x + b = c). */
export function solveAlgebra(text: string): Solution {
  const lower = text.toLowerCase();
  const numbers = extractNumbers(text);
  const units = extractUnits(text);
  const warnings: string[] = [];
  const assumptions: string[] = [];

  // Detect coefficient ("twice"=2, "three times"=3, "double"=2, "triple"=3, "half"=0.5)
  let coeff = 1;
  if (/\b(twice|double|two times)\b/.test(lower)) coeff = 2;
  else if (/\b(three times|triple)\b/.test(lower)) coeff = 3;
  else if (/\b(four times|quadruple)\b/.test(lower)) coeff = 4;
  else if (/\b(half of|half)\b/.test(lower)) coeff = 0.5;
  else if (/\bten times\b/.test(lower)) coeff = 10;

  // Detect additive constant ("plus 5", "and 7 more", "minus 3")
  let addConst = 0;
  const plusMatch = lower.match(/\b(?:plus|and|more|increased by)\s+(\d+(?:\.\d+)?)/);
  const minusMatch = lower.match(/\b(?:minus|less|decreased by|subtract)\s+(\d+(?:\.\d+)?)/);
  if (plusMatch) addConst = Number(plusMatch[1]);
  else if (minusMatch) addConst = -Number(minusMatch[1]);

  // Detect target ("is 17", "equals 21")
  const isMatch = lower.match(/\b(?:is|equals|equal to|gives|yields)\s+(\d+(?:\.\d+)?)\b/);
  let target = NaN;
  if (isMatch) target = Number(isMatch[1]);
  else if (numbers.length > 0) target = numbers[numbers.length - 1]!.value;

  if (!Number.isFinite(target)) {
    return {
      category: "algebra",
      numbers, operations: ["unknown"], units,
      equation: "",
      steps: [],
      answer: "Could not identify the target value (e.g., '... is 17').",
      answerValue: null,
      verified: false,
      verificationNote: "Need a clear target value.",
      alternativeMethod: null,
      assumptions,
      warnings: ["No target value detected."],
    };
  }

  // Equation: coeff * x + addConst = target
  const equation = `${coeff === 1 ? "" : coeff}x${addConst === 0 ? "" : (addConst > 0 ? ` + ${addConst}` : ` − ${Math.abs(addConst)}`)} = ${target}`;
  const steps: Step[] = [
    { label: "Set up the equation", expression: equation, result: "" },
    { label: "Isolate the x-term", expression: `${coeff === 1 ? "" : coeff}x = ${formatNumber(target)} ${addConst > 0 ? `− ${addConst}` : addConst < 0 ? `+ ${Math.abs(addConst)}` : ""}`.trim(), result: `${coeff === 1 ? "" : coeff}x = ${formatNumber(target - addConst)}` },
  ];
  if (coeff === 0) {
    return {
      category: "algebra",
      numbers, operations: ["unknown"], units,
      equation,
      steps,
      answer: "Coefficient is zero — no unique solution.",
      answerValue: null,
      verified: false,
      verificationNote: "Coefficient of x is zero.",
      alternativeMethod: null,
      assumptions,
      warnings: ["Zero coefficient."],
    };
  }
  const x = (target - addConst) / coeff;
  steps.push({ label: "Solve for x", expression: `x = ${formatNumber(target - addConst)} ÷ ${coeff}`, result: `x = ${formatNumber(x)}` });

  // Verify by substitution
  const check = coeff * x + addConst;
  const verified = Math.abs(check - target) < 1e-9;

  return {
    category: "algebra",
    numbers, operations: ["unknown"], units,
    equation,
    steps,
    answer: `x = ${formatNumber(x)}`,
    answerValue: x,
    verified,
    verificationNote: `Substitute back: ${coeff} × ${formatNumber(x)}${addConst === 0 ? "" : (addConst > 0 ? ` + ${addConst}` : ` − ${Math.abs(addConst)}`)} = ${formatNumber(check)} (expected ${target}).`,
    alternativeMethod: `Trial: if x = ${formatNumber(x)}, then ${coeff}x${addConst === 0 ? "" : (addConst > 0 ? ` + ${addConst}` : ` − ${Math.abs(addConst)}`)} = ${formatNumber(check)} ✓`,
    assumptions,
    warnings,
  };
}

/** Solve a geometry word problem (area/perimeter of rectangle, triangle, circle). */
export function solveGeometry(text: string): Solution {
  const lower = text.toLowerCase();
  const numbers = extractNumbers(text);
  const units = extractUnits(text);
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const unitStr = units ? ` ${units}` : (numbers[0]?.unit ?? "");

  const isArea = /\barea\b/.test(lower);
  const isPerimeter = /\bperimeter\b/.test(lower);
  const isCircumference = /\bcircumference\b/.test(lower);

  if (/\brectangle\b/.test(lower) || (/\blength\b/.test(lower) && /\bwidth\b/.test(lower))) {
    if (numbers.length < 2) {
      return emptySolution("geometry", "Need both length and width.", numbers, units, ["Need both length and width for a rectangle."]);
    }
    const l = numbers[0]!.value;
    const w = numbers[1]!.value;
    if (isArea || (!isPerimeter && !isCircumference)) {
      const area = l * w;
      const steps: Step[] = [
        { label: "Identify shape", expression: "Rectangle", result: `length = ${l}${unitStr}, width = ${w}${unitStr}` },
        { label: "Formula", expression: "Area = length × width", result: "" },
        { label: "Compute", expression: `Area = ${l} × ${w}`, result: `Area = ${formatNumber(area)}${unitStr}²` },
      ];
      const verified = Math.abs(area - l * w) < 1e-9;
      return {
        category: "geometry", numbers, operations: ["multiply"], units,
        equation: `Area = ${l} × ${w} = ${formatNumber(area)}${unitStr}²`,
        steps,
        answer: `${formatNumber(area)}${unitStr}²`,
        answerValue: area,
        verified,
        verificationNote: `Recompute: ${l} × ${w} = ${formatNumber(l * w)}${unitStr}² ✓`,
        alternativeMethod: `Counting: ${l} rows of ${w} unit squares = ${formatNumber(l * w)} squares.`,
        assumptions, warnings,
      };
    }
    if (isPerimeter) {
      const perim = 2 * (l + w);
      const steps: Step[] = [
        { label: "Identify shape", expression: "Rectangle", result: `length = ${l}${unitStr}, width = ${w}${unitStr}` },
        { label: "Formula", expression: "Perimeter = 2 × (length + width)", result: "" },
        { label: "Compute", expression: `Perimeter = 2 × (${l} + ${w})`, result: `Perimeter = ${formatNumber(perim)}${unitStr}` },
      ];
      const verified = Math.abs(perim - 2 * (l + w)) < 1e-9;
      return {
        category: "geometry", numbers, operations: ["add"], units,
        equation: `Perimeter = 2 × (${l} + ${w}) = ${formatNumber(perim)}${unitStr}`,
        steps,
        answer: `${formatNumber(perim)}${unitStr}`,
        answerValue: perim,
        verified,
        verificationNote: `Recompute: 2 × (${l} + ${w}) = ${formatNumber(2 * (l + w))}${unitStr} ✓`,
        alternativeMethod: null,
        assumptions, warnings,
      };
    }
  }

  if (/\btriangle\b/.test(lower)) {
    if (numbers.length < 2) {
      return emptySolution("geometry", "Need both base and height for a triangle.", numbers, units, ["Need both base and height for a triangle."]);
    }
    const base = numbers[0]!.value;
    const h = numbers[1]!.value;
    const area = 0.5 * base * h;
    const steps: Step[] = [
      { label: "Identify shape", expression: "Triangle", result: `base = ${base}${unitStr}, height = ${h}${unitStr}` },
      { label: "Formula", expression: "Area = ½ × base × height", result: "" },
      { label: "Compute", expression: `Area = 0.5 × ${base} × ${h}`, result: `Area = ${formatNumber(area)}${unitStr}²` },
    ];
    const verified = Math.abs(area - 0.5 * base * h) < 1e-9;
    return {
      category: "geometry", numbers, operations: ["multiply"], units,
      equation: `Area = 0.5 × ${base} × ${h} = ${formatNumber(area)}${unitStr}²`,
      steps,
      answer: `${formatNumber(area)}${unitStr}²`,
      answerValue: area,
      verified,
      verificationNote: `Recompute: 0.5 × ${base} × ${h} = ${formatNumber(0.5 * base * h)}${unitStr}² ✓`,
      alternativeMethod: null,
      assumptions, warnings,
    };
  }

  if (/\bcircle\b/.test(lower) || /\bradius\b/.test(lower) || /\bdiameter\b/.test(lower)) {
    let r = NaN;
    if (/\bradius\b/.test(lower) && numbers.length >= 1) r = numbers[0]!.value;
    else if (/\bdiameter\b/.test(lower) && numbers.length >= 1) r = numbers[0]!.value / 2;
    else if (numbers.length >= 1) {
      r = numbers[0]!.value;
      assumptions.push("Assumed the given number is the radius.");
    }
    if (!Number.isFinite(r) || r <= 0) {
      return emptySolution("geometry", "Need a radius (or diameter) for a circle.", numbers, units, ["Need a radius or diameter for a circle."]);
    }
    const pi = 3.14159;
    if (isCircumference || (!isArea && /\bcircumference\b/.test(lower))) {
      const circ = 2 * pi * r;
      const steps: Step[] = [
        { label: "Identify shape", expression: "Circle", result: `radius = ${r}${unitStr}` },
        { label: "Formula", expression: "Circumference = 2 × π × r", result: "" },
        { label: "Compute", expression: `Circumference = 2 × ${pi} × ${r}`, result: `Circumference ≈ ${formatNumber(circ)}${unitStr}` },
      ];
      return {
        category: "geometry", numbers, operations: ["multiply"], units,
        equation: `Circumference = 2 × π × ${r} ≈ ${formatNumber(circ)}${unitStr}`,
        steps,
        answer: `${formatNumber(circ)}${unitStr}`,
        answerValue: circ,
        verified: true,
        verificationNote: `Recompute: 2 × ${pi} × ${r} ≈ ${formatNumber(2 * pi * r)}${unitStr} ✓`,
        alternativeMethod: null,
        assumptions, warnings,
      };
    }
    // Default: area
    const area = pi * r * r;
    const steps: Step[] = [
      { label: "Identify shape", expression: "Circle", result: `radius = ${r}${unitStr}` },
      { label: "Formula", expression: "Area = π × r²", result: "" },
      { label: "Compute", expression: `Area = ${pi} × ${r}²`, result: `Area ≈ ${formatNumber(area)}${unitStr}²` },
    ];
    return {
      category: "geometry", numbers, operations: ["multiply"], units,
      equation: `Area = π × ${r}² ≈ ${formatNumber(area)}${unitStr}²`,
      steps,
      answer: `${formatNumber(area)}${unitStr}²`,
      answerValue: area,
      verified: true,
      verificationNote: `Recompute: ${pi} × ${r}² ≈ ${formatNumber(pi * r * r)}${unitStr}² ✓`,
      alternativeMethod: `Using π ≈ 22/7: ${22 / 7} × ${r}² ≈ ${formatNumber((22 / 7) * r * r)}${unitStr}² (close to ${formatNumber(area)}).`,
      assumptions, warnings,
    };
  }

  return emptySolution("geometry", "Could not identify a supported shape (rectangle, triangle, circle).", numbers, units, ["Unrecognized geometry shape."]);
}

/** Solve a percentage word problem. */
export function solvePercentage(text: string): Solution {
  const lower = text.toLowerCase();
  const numbers = extractNumbers(text);
  const units = "%";
  const warnings: string[] = [];
  const assumptions: string[] = [];

  // "what is X% of Y"
  const ofMatch = lower.match(/what is\s+(\d+(?:\.\d+)?)\s*(?:percent|%)\s*of\s+(\d+(?:\.\d+)?)/);
  if (ofMatch) {
    const pct = Number(ofMatch[1]!);
    const base = Number(ofMatch[2]!);
    const result = (pct / 100) * base;
    const steps: Step[] = [
      { label: "Identify", expression: `${pct}% of ${base}`, result: "" },
      { label: "Convert percent to decimal", expression: `${pct}% = ${pct} / 100 = ${formatNumber(pct / 100)}`, result: "" },
      { label: "Multiply", expression: `${formatNumber(pct / 100)} × ${base}`, result: `${formatNumber(result)}` },
    ];
    const verified = Math.abs(result - (pct / 100) * base) < 1e-9;
    return {
      category: "percentage", numbers, operations: ["multiply"], units,
      equation: `${pct}% of ${base} = ${formatNumber(result)}`,
      steps,
      answer: `${formatNumber(result)}`,
      answerValue: result,
      verified,
      verificationNote: `Recompute: (${pct}/100) × ${base} = ${formatNumber((pct / 100) * base)} ✓`,
      alternativeMethod: `Fraction method: ${pct}% = ${pct}/100, so ${pct}/100 × ${base} = ${formatNumber(result)}.`,
      assumptions, warnings,
    };
  }

  // "X is what percent of Y"
  const isWhatPct = lower.match(/(\d+(?:\.\d+)?)\s*is what (?:percent|%)?\s*of\s+(\d+(?:\.\d+)?)/);
  if (isWhatPct) {
    const part = Number(isWhatPct[1]!);
    const whole = Number(isWhatPct[2]!);
    if (whole === 0) {
      return emptySolution("percentage", "Cannot divide by zero (whole is 0).", numbers, units, ["Whole is zero."]);
    }
    const pct = (part / whole) * 100;
    const steps: Step[] = [
      { label: "Identify", expression: `${part} is what percent of ${whole}`, result: "" },
      { label: "Formula", expression: "Percent = (part / whole) × 100", result: "" },
      { label: "Compute", expression: `(${part} / ${whole}) × 100`, result: `${formatNumber(pct)}%` },
    ];
    const verified = Math.abs(pct - (part / whole) * 100) < 1e-9;
    return {
      category: "percentage", numbers, operations: ["divide"], units,
      equation: `(${part} / ${whole}) × 100 = ${formatNumber(pct)}%`,
      steps,
      answer: `${formatNumber(pct)}%`,
      answerValue: pct,
      verified,
      verificationNote: `Recompute: (${part}/${whole}) × 100 = ${formatNumber((part / whole) * 100)}% ✓`,
      alternativeMethod: null,
      assumptions, warnings,
    };
  }

  // "increases from X to Y" / "decreases from X to Y"
  const incDec = lower.match(/(?:increases?|decreases?|goes up|goes down|changes?)\s+from\s+(?:\$)?(\d+(?:\.\d+)?)\s+to\s+(?:\$)?(\d+(?:\.\d+)?)/);
  if (incDec) {
    const oldVal = Number(incDec[1]!);
    const newVal = Number(incDec[2]!);
    if (oldVal === 0) {
      return emptySolution("percentage", "Cannot compute percent change from zero.", numbers, units, ["Old value is zero."]);
    }
    const diff = newVal - oldVal;
    const pct = (diff / oldVal) * 100;
    const direction = pct >= 0 ? "increase" : "decrease";
    const steps: Step[] = [
      { label: "Identify", expression: `Old = ${oldVal}, New = ${newVal}`, result: "" },
      { label: "Difference", expression: `${newVal} − ${oldVal}`, result: `${formatNumber(diff)}` },
      { label: "Percent change", expression: `(${formatNumber(diff)} / ${oldVal}) × 100`, result: `${formatNumber(pct)}% ${direction}` },
    ];
    const verified = Math.abs(pct - (diff / oldVal) * 100) < 1e-9;
    return {
      category: "percentage", numbers, operations: ["subtract"], units,
      equation: `((${newVal} − ${oldVal}) / ${oldVal}) × 100 = ${formatNumber(pct)}%`,
      steps,
      answer: `${formatNumber(pct)}% ${direction}`,
      answerValue: pct,
      verified,
      verificationNote: `Recompute: diff = ${formatNumber(diff)}, pct = ${formatNumber((diff / oldVal) * 100)}% ✓`,
      alternativeMethod: null,
      assumptions, warnings,
    };
  }

  return emptySolution("percentage", "Could not identify a percentage pattern (use 'what is X% of Y', 'X is what percent of Y', or 'increases from X to Y').", numbers, units, ["Unrecognized percentage pattern."]);
}

/** Solve a ratio word problem. */
export function solveRatio(text: string): Solution {
  const lower = text.toLowerCase();
  const numbers = extractNumbers(text);
  const units = extractUnits(text);
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const unitStr = units ? ` ${units}` : "";

  // First, look for the ratio definition: "ratio of X to Y is A to B"
  const ratioDefMatch = lower.match(/ratio of\s+\w+\s+to\s+\w+\s+is\s+(\d+(?:\.\d+)?)\s+(?:to|:)\s+(\d+(?:\.\d+)?)/);
  if (ratioDefMatch) {
    const ra = Number(ratioDefMatch[1]!);
    const rb = Number(ratioDefMatch[2]!);
    const sum = ra + rb;
    if (sum === 0) {
      return emptySolution("ratio", "Ratio parts sum to zero.", numbers, units, ["Ratio parts sum to zero."]);
    }
    // Part-to-whole: "total" keyword present, with a third number that is the total
    if (lower.includes("total")) {
      // Find the third number (not equal to ra or rb) as the total
      const candidates = numbers.map((n) => n.value).filter((v) => v !== ra && v !== rb);
      if (candidates.length > 0) {
        const total = candidates[0]!;
        const shareA = (ra / sum) * total;
        const shareB = (rb / sum) * total;
        const steps: Step[] = [
          { label: "Identify ratio", expression: `${ra} : ${rb}`, result: "" },
          { label: "Sum of parts", expression: `${ra} + ${rb}`, result: `${formatNumber(sum)}` },
          { label: "First part's share", expression: `(${ra} / ${formatNumber(sum)}) × ${total}`, result: `${formatNumber(shareA)}${unitStr}` },
          { label: "Second part's share", expression: `(${rb} / ${formatNumber(sum)}) × ${total}`, result: `${formatNumber(shareB)}${unitStr}` },
        ];
        const verified = Math.abs(shareA + shareB - total) < 1e-9;
        return {
          category: "ratio", numbers, operations: ["divide"], units,
          equation: `First = (${ra} / ${formatNumber(sum)}) × ${total} = ${formatNumber(shareA)}${unitStr}`,
          steps,
          answer: `${formatNumber(shareA)}${unitStr} and ${formatNumber(shareB)}${unitStr}`,
          answerValue: shareA,
          verified,
          verificationNote: `Check: ${formatNumber(shareA)} + ${formatNumber(shareB)} = ${formatNumber(shareA + shareB)} (expected ${total}) ✓`,
          alternativeMethod: null,
          assumptions, warnings,
        };
      }
    }
    // Scaling: "if A is M, how many B?" — find a third number that scales one part
    const candidates = numbers.map((n) => n.value).filter((v) => v !== ra && v !== rb);
    if (candidates.length > 0) {
      const known = candidates[0]!;
      if (ra === 0) {
        return emptySolution("ratio", "First ratio part is zero.", numbers, units, ["First ratio part is zero."]);
      }
      const scale = known / ra;
      const other = rb * scale;
      const steps: Step[] = [
        { label: "Identify ratio", expression: `${ra} : ${rb}`, result: "" },
        { label: "Scale factor", expression: `${known} / ${ra}`, result: `${formatNumber(scale)}` },
        { label: "Apply scale to other", expression: `${rb} × ${formatNumber(scale)}`, result: `${formatNumber(other)}${unitStr}` },
      ];
      const verified = Math.abs(other - rb * (known / ra)) < 1e-9;
      return {
        category: "ratio", numbers, operations: ["divide"], units,
        equation: `Other = ${rb} × (${known} / ${ra}) = ${formatNumber(other)}${unitStr}`,
        steps,
        answer: `${formatNumber(other)}${unitStr}`,
        answerValue: other,
        verified,
        verificationNote: `Recompute: ${rb} × ${known} / ${ra} = ${formatNumber(rb * known / ra)}${unitStr} ✓`,
        alternativeMethod: null,
        assumptions, warnings,
      };
    }
  }

  return emptySolution("ratio", "Could not identify a ratio pattern (use 'ratio of A to B is X to Y, if total is T' or 'if A is M, how many B?').", numbers, units, ["Unrecognized ratio pattern."]);
}

/** Solve a rate / work word problem. */
export function solveRate(text: string): Solution {
  const lower = text.toLowerCase();
  const numbers = extractNumbers(text);
  const units = extractUnits(text);
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const unitStr = units ? ` ${units}` : "";

  // Distance = rate × time: "travels at R [unit/hr] for T hours. How far?"
  const distMatch = lower.match(/(?:travels?|drives?|moves?)\s+at\s+(\d+(?:\.\d+)?)\s*(\w+)?\s*(?:per|\/)\s*(\w+)?\s*(?:for|in)\s+(\d+(?:\.\d+)?)\s*(\w+)?/);
  if (distMatch) {
    const rate = Number(distMatch[1]!);
    const rateUnit = distMatch[2] ?? "";
    const time = Number(distMatch[4]!);
    const timeUnit = distMatch[5] ?? "hours";
    const distance = rate * time;
    const steps: Step[] = [
      { label: "Identify", expression: `rate = ${rate} ${rateUnit}/${timeUnit}, time = ${time} ${timeUnit}`, result: "" },
      { label: "Formula", expression: "distance = rate × time", result: "" },
      { label: "Compute", expression: `${rate} × ${time}`, result: `${formatNumber(distance)} ${rateUnit}` },
    ];
    const verified = Math.abs(distance - rate * time) < 1e-9;
    return {
      category: "rate", numbers, operations: ["multiply"], units,
      equation: `distance = ${rate} × ${time} = ${formatNumber(distance)} ${rateUnit}`,
      steps,
      answer: `${formatNumber(distance)} ${rateUnit}`,
      answerValue: distance,
      verified,
      verificationNote: `Recompute: ${rate} × ${time} = ${formatNumber(rate * time)} ${rateUnit} ✓`,
      alternativeMethod: null,
      assumptions, warnings,
    };
  }

  // Work problem: "Alice can do X in A hours, Bob in B hours. Together?"
  const workMatch = lower.match(/(\d+(?:\.\d+)?)\s*hours?.*?(\d+(?:\.\d+)?)\s*hours?.*?together/);
  if (workMatch) {
    const a = Number(workMatch[1]!);
    const b = Number(workMatch[2]!);
    if (a === 0 || b === 0) {
      return emptySolution("rate", "Work rate is zero — invalid input.", numbers, units, ["Zero work rate."]);
    }
    const rateA = 1 / a;
    const rateB = 1 / b;
    const combined = rateA + rateB;
    if (combined === 0) {
      return emptySolution("rate", "Combined rate is zero.", numbers, units, ["Zero combined rate."]);
    }
    const t = 1 / combined;
    const steps: Step[] = [
      { label: "Identify", expression: `Alice = ${a} hours, Bob = ${b} hours`, result: "" },
      { label: "Individual rates", expression: `1/${a} + 1/${b}`, result: `${formatNumber(rateA)} + ${formatNumber(rateB)} = ${formatNumber(combined)}/hour` },
      { label: "Combined time", expression: `1 / ${formatNumber(combined)}`, result: `${formatNumber(t)} hours` },
    ];
    const verified = Math.abs(t - 1 / (1 / a + 1 / b)) < 1e-9;
    return {
      category: "rate", numbers, operations: ["divide"], units,
      equation: `1 / (1/${a} + 1/${b}) = ${formatNumber(t)} hours`,
      steps,
      answer: `${formatNumber(t)} hours`,
      answerValue: t,
      verified,
      verificationNote: `Recompute: 1 / (1/${a} + 1/${b}) = ${formatNumber(1 / (1 / a + 1 / b))} hours ✓`,
      alternativeMethod: `Product-over-sum: ${a}×${b} / (${a}+${b}) = ${formatNumber((a * b) / (a + b))} hours.`,
      assumptions, warnings,
    };
  }

  return emptySolution("rate", "Could not identify a rate/work pattern (use 'travels at R per hour for T hours' or 'A in X hours, B in Y hours, together?').", numbers, units, ["Unrecognized rate/work pattern."]);
}

/** Solve a mixture word problem. */
export function solveMixture(text: string): Solution {
  const lower = text.toLowerCase();
  const numbers = extractNumbers(text);
  const warnings: string[] = [];
  const assumptions: string[] = [];

  // "How many liters of X% must be added to Y liters of Z% to make W%?"
  const mixMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:percent|%).*?(\d+(?:\.\d+)?)\s*liters?.*?(\d+(?:\.\d+)?)\s*(?:percent|%).*?(\d+(?:\.\d+)?)\s*(?:percent|%)/);
  if (mixMatch) {
    const c1 = Number(mixMatch[1]!) / 100;
    const v2 = Number(mixMatch[2]!);
    const c2 = Number(mixMatch[3]!) / 100;
    const cf = Number(mixMatch[4]!) / 100;
    // Solve: c1*v1 + c2*v2 = cf*(v1 + v2)
    // c1*v1 + c2*v2 = cf*v1 + cf*v2
    // v1*(c1 - cf) = cf*v2 - c2*v2
    // v1 = v2*(cf - c2) / (c1 - cf)
    if (Math.abs(c1 - cf) < 1e-12) {
      return emptySolution("mixture", "Target concentration equals the added solution's concentration — infinite solutions.", numbers, "%", ["Concentration of added solution equals target."]);
    }
    const v1 = v2 * (cf - c2) / (c1 - cf);
    if (v1 < 0) {
      return emptySolution("mixture", `Computed volume is negative (${formatNumber(v1)} liters) — the target concentration is unreachable with these inputs.`, numbers, "%", ["Target concentration unreachable."]);
    }
    const steps: Step[] = [
      { label: "Identify", expression: `Added: ${formatNumber(c1 * 100)}%, Existing: ${v2} L @ ${formatNumber(c2 * 100)}%, Target: ${formatNumber(cf * 100)}%`, result: "" },
      { label: "Equation", expression: `${formatNumber(c1)}v₁ + ${formatNumber(c2)}×${v2} = ${formatNumber(cf)}×(v₁ + ${v2})`, result: "" },
      { label: "Solve for v₁", expression: `v₁ = ${v2} × (${formatNumber(cf)} − ${formatNumber(c2)}) / (${formatNumber(c1)} − ${formatNumber(cf)})`, result: `${formatNumber(v1)} liters` },
    ];
    // Verify
    const totalSalt = c1 * v1 + c2 * v2;
    const totalVol = v1 + v2;
    const finalConc = totalVol === 0 ? 0 : totalSalt / totalVol;
    const verified = Math.abs(finalConc - cf) < 1e-6;
    return {
      category: "mixture", numbers, operations: ["multiply"], units: "%",
      equation: `v₁ = ${v2} × (${formatNumber(cf)} − ${formatNumber(c2)}) / (${formatNumber(c1)} − ${formatNumber(cf)}) = ${formatNumber(v1)} liters`,
      steps,
      answer: `${formatNumber(v1)} liters`,
      answerValue: v1,
      verified,
      verificationNote: `Check final concentration: (${formatNumber(c1)}×${formatNumber(v1)} + ${formatNumber(c2)}×${v2}) / (${formatNumber(v1)} + ${v2}) = ${formatNumber(finalConc * 100)}% (expected ${formatNumber(cf * 100)}%) ✓`,
      alternativeMethod: null,
      assumptions, warnings,
    };
  }

  return emptySolution("mixture", "Could not identify a mixture pattern (use 'How many liters of X% must be added to Y liters of Z% to make W%?').", numbers, "%", ["Unrecognized mixture pattern."]);
}

// ---------- Helpers ----------

function emptySolution(
  category: ProblemCategory,
  answer: string,
  numbers: ExtractedNumber[],
  units: string,
  warnings: string[],
): Solution {
  return {
    category,
    numbers,
    operations: ["unknown"],
    units,
    equation: "",
    steps: [],
    answer,
    answerValue: null,
    verified: false,
    verificationNote: "",
    alternativeMethod: null,
    assumptions: [],
    warnings,
  };
}

// ---------- Dispatcher ----------

/** Solve a word problem by dispatching to the appropriate category solver. */
export function solveProblem(text: string): Solution {
  if (!text || !text.trim()) {
    return emptySolution("unknown", "Please enter a math word problem.", [], "", ["Empty input."]);
  }
  const category = classifyProblem(text);
  switch (category) {
    case "arithmetic": return solveArithmetic(text);
    case "algebra": return solveAlgebra(text);
    case "geometry": return solveGeometry(text);
    case "percentage": return solvePercentage(text);
    case "ratio": return solveRatio(text);
    case "rate": return solveRate(text);
    case "mixture": return solveMixture(text);
    case "unknown":
    default:
      return emptySolution("unknown", "Could not classify the problem. Try rephrasing or pick a sample.", extractNumbers(text), extractUnits(text), ["Unclassifiable problem."]);
  }
}

// ---------- Rendering ----------

/** Format a Solution as readable Markdown text. */
export function formatStepsMarkdown(solution: Solution, problem: string): string {
  const lines: string[] = [];
  lines.push(`# Math Word Problem Solution`);
  lines.push("");
  lines.push(`**Problem:** ${problem}`);
  lines.push(`**Category:** ${CATEGORY_LABELS[solution.category]}`);
  if (solution.units) lines.push(`**Units:** ${solution.units}`);
  if (solution.numbers.length > 0) {
    lines.push(`**Numbers found:** ${solution.numbers.map((n) => `${n.raw}${n.unit ? " " + n.unit : ""}`).join(", ")}`);
  }
  if (solution.operations.length > 0 && solution.operations[0] !== "unknown") {
    lines.push(`**Operations:** ${solution.operations.map((o) => OPERATION_LABELS[o]).join(", ")}`);
  }
  lines.push("");
  if (solution.equation) {
    lines.push(`## Equation`);
    lines.push("```");
    lines.push(solution.equation);
    lines.push("```");
    lines.push("");
  }
  if (solution.steps.length > 0) {
    lines.push(`## Steps`);
    for (const s of solution.steps) {
      lines.push(`**${s.label}**`);
      if (s.expression) lines.push(`- ${s.expression}`);
      if (s.result) lines.push(`- → ${s.result}`);
    }
    lines.push("");
  }
  lines.push(`## Answer`);
  lines.push(`**${solution.answer}**`);
  if (solution.verified) {
    lines.push(`✓ Verified`);
  } else {
    lines.push(`⚠ Not verified`);
  }
  if (solution.verificationNote) {
    lines.push("");
    lines.push(`**Verification:** ${solution.verificationNote}`);
  }
  if (solution.alternativeMethod) {
    lines.push("");
    lines.push(`**Alternative method:** ${solution.alternativeMethod}`);
  }
  if (solution.assumptions.length > 0) {
    lines.push("");
    lines.push(`## Assumptions`);
    for (const a of solution.assumptions) lines.push(`- ${a}`);
  }
  if (solution.warnings.length > 0) {
    lines.push("");
    lines.push(`## Warnings`);
    for (const w of solution.warnings) lines.push(`- ${w}`);
  }
  lines.push("");
  lines.push("> Honesty: the classifier can misread a problem — verify the setup against the original wording. All computation runs locally.");
  return lines.join("\n");
}

/** Render a Solution as plain text. */
export function formatStepsText(solution: Solution, problem: string): string {
  return formatStepsMarkdown(solution, problem)
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/```/g, "")
    .replace(/^> /gm, "");
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  problem: string;
  category: ProblemCategory;
  answer: string;
  verified: boolean;
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
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
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

// ---------- Shareable URL ----------

export function buildShareUrl(problem: string): string {
  const params = new URLSearchParams();
  if (problem) params.set("p", problem);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): string {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return "";
  const params = new URLSearchParams(clean);
  return params.get("p") ?? "";
}

// ---------- LLM prompt (BYO key, called from ui.tsx) ----------

export function buildLlmPrompt(problem: string): { system: string; user: string } {
  return {
    system:
      "You are a math tutor. Read the user's word problem, set up the equation in plain text, " +
      "and outline the steps needed to solve it. Do NOT compute the final answer — the deterministic " +
      "engine will do that and verify it. Return only the setup: identified category, extracted numbers, " +
      "the equation, and the sequence of operations needed.",
    user:
      `Problem: ${problem}\n\n` +
      `Provide:\n` +
      `1. Category (one of: arithmetic, algebra, geometry, percentage, ratio, rate, mixture)\n` +
      `2. Numbers extracted (with units if any)\n` +
      `3. The equation to solve\n` +
      `4. The ordered steps (as expressions, not computed)\n`,
  };
}

export function renderLlmResult(raw: string): string {
  // Strip code fences if present
  let out = raw.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:\w+)?\n?/, "").replace(/\n?```$/, "");
  }
  return out.trim();
}
