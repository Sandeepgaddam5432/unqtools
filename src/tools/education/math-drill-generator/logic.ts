/**
 * Math Drill Generator — pure logic.
 * Generate math problems by operation and difficulty.
 */

export type Operation = "add" | "sub" | "mul" | "div" | "mixed";
export type Difficulty = "easy" | "medium" | "hard";

export interface DrillConfig {
  operation: Operation;
  difficulty: Difficulty;
  count: number;
  seed?: number;
}

export interface MathProblem {
  id: number;
  a: number;
  b: number;
  op: Operation;
  text: string;
  answer: number;
}

export interface DrillResult {
  problems: MathProblem[];
  count: number;
  difficulty: Difficulty;
  operation: Operation;
}

/** Mulberry32 seeded PRNG so tests can be deterministic. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

const DIFFICULTY_RANGES: Record<Difficulty, { add: [number, number]; sub: [number, number]; mul: [number, number]; div: [number, number] }> = {
  easy: { add: [1, 10], sub: [1, 10], mul: [1, 5], div: [1, 5] },
  medium: { add: [10, 99], sub: [10, 99], mul: [2, 12], div: [2, 12] },
  hard: { add: [100, 999], sub: [100, 999], mul: [11, 25], div: [3, 20] },
};

const OP_SYMBOL: Record<Exclude<Operation, "mixed">, string> = {
  add: "+", sub: "−", mul: "×", div: "÷",
};

export function generateProblem(rng: () => number, op: Operation, difficulty: Difficulty, id: number): MathProblem {
  let realOp: Exclude<Operation, "mixed"> = op as Exclude<Operation, "mixed">;
  if (op === "mixed") {
    const ops: Exclude<Operation, "mixed">[] = ["add", "sub", "mul", "div"];
    realOp = ops[Math.floor(rng() * ops.length)]!;
  }
  const range = DIFFICULTY_RANGES[difficulty][realOp];
  let a = randInt(rng, range[0], range[1]);
  let b = randInt(rng, range[0], range[1]);
  let answer: number;
  // For subtraction, ensure non-negative result for easy/medium
  if (realOp === "sub" && b > a) [a, b] = [b, a];
  if (realOp === "div") {
    // Make b a divisor of a so the answer is an integer
    if (b === 0) b = 1;
    a = a * b;
    answer = a / b;
  } else if (realOp === "add") answer = a + b;
  else if (realOp === "sub") answer = a - b;
  else answer = a * b;

  return {
    id,
    a, b, op: realOp,
    text: `${a} ${OP_SYMBOL[realOp]} ${b} = ?`,
    answer,
  };
}

export function generate(config: DrillConfig): DrillResult {
  const count = Math.max(1, Math.min(100, config.count));
  const rng = makeRng(config.seed ?? 12345);
  const problems: MathProblem[] = [];
  for (let i = 0; i < count; i++) {
    problems.push(generateProblem(rng, config.operation, config.difficulty, i + 1));
  }
  return { problems, count, difficulty: config.difficulty, operation: config.operation };
}

export function checkAnswer(problem: MathProblem, given: number): boolean {
  return problem.answer === given;
}

export function toText(result: DrillResult): string {
  return result.problems.map((p) => `${p.id}. ${p.text}`).join("\n");
}

export function withAnswers(result: DrillResult): string {
  return result.problems.map((p) => `${p.id}. ${p.text}  →  ${p.answer}`).join("\n");
}
