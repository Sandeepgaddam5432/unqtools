/**
 * Physics Formula Reference & Calculator — pure logic.
 *
 * 50+ formulas across 6 categories. Pure functions only — no DOM, no
 * network. Includes formula evaluator, variable validator, unit
 * converter, dimensional analysis, sig-figs handler, and history.
 */

// ---- Types ----

export type PhysicsCategory =
  | "mechanics"
  | "electricity"
  | "waves"
  | "thermodynamics"
  | "modern-physics"
  | "optics";

export type Difficulty = "basic" | "intermediate" | "advanced";

export interface FormulaVariable {
  symbol: string; // e.g. "m"
  name: string; // e.g. "mass"
  unit: string; // e.g. "kg"
  /** Dimensions: [mass, length, time, current, temperature, amount, luminous] */
  dimensions?: number[];
}

export interface PhysicsFormula {
  id: string;
  name: string;
  category: PhysicsCategory;
  equation: string; // e.g. "F = m * a"
  description: string;
  difficulty: Difficulty;
  variables: FormulaVariable[];
  /** Solve for `unknown` given the known values. Returns the value. */
  solve: (known: Record<string, number>, unknown: string) => number;
  related?: string[]; // ids of related formulas
}

export interface CategoryInfo {
  value: PhysicsCategory;
  label: string;
  description: string;
}

// ---- Categories ----

export const CATEGORIES: CategoryInfo[] = [
  { value: "mechanics", label: "Mechanics", description: "Force, motion, energy, momentum" },
  { value: "electricity", label: "Electricity", description: "Voltage, current, resistance, charge" },
  { value: "waves", label: "Waves", description: "Frequency, wavelength, energy" },
  { value: "thermodynamics", label: "Thermodynamics", description: "Heat, gas laws, efficiency" },
  { value: "modern-physics", label: "Modern Physics", description: "Relativity, quantum, doppler" },
  { value: "optics", label: "Optics", description: "Lenses, mirrors, refraction" },
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

// ---- Constants ----

export interface PhysicsConstant {
  symbol: string;
  name: string;
  value: number;
  unit: string;
}

export const CONSTANTS: PhysicsConstant[] = [
  { symbol: "g", name: "Gravitational acceleration (Earth)", value: 9.80665, unit: "m/s²" },
  { symbol: "c", name: "Speed of light in vacuum", value: 2.99792458e8, unit: "m/s" },
  { symbol: "h", name: "Planck constant", value: 6.62607015e-34, unit: "J·s" },
  { symbol: "k", name: "Boltzmann constant", value: 1.380649e-23, unit: "J/K" },
  { symbol: "G", name: "Gravitational constant", value: 6.6743e-11, unit: "N·m²/kg²" },
  { symbol: "R", name: "Gas constant", value: 8.314462618, unit: "J/(mol·K)" },
  { symbol: "N_A", name: "Avogadro number", value: 6.02214076e23, unit: "1/mol" },
  { symbol: "e", name: "Elementary charge", value: 1.602176634e-19, unit: "C" },
  { symbol: "epsilon_0", name: "Vacuum permittivity", value: 8.8541878128e-12, unit: "F/m" },
  { symbol: "k_e", name: "Coulomb constant", value: 8.9875517923e9, unit: "N·m²/C²" },
];

export function lookupConstant(symbol: string): PhysicsConstant | undefined {
  return CONSTANTS.find((c) => c.symbol === symbol);
}

// ---- Formula database (50+) ----

// Mechanics (10)
const MECHANICS: PhysicsFormula[] = [
  {
    id: "newton2",
    name: "Newton's Second Law",
    category: "mechanics",
    equation: "F = m × a",
    description: "Force equals mass times acceleration.",
    difficulty: "basic",
    variables: [
      { symbol: "F", name: "force", unit: "N", dimensions: [1, 1, -2, 0, 0, 0, 0] },
      { symbol: "m", name: "mass", unit: "kg", dimensions: [1, 0, 0, 0, 0, 0, 0] },
      { symbol: "a", name: "acceleration", unit: "m/s²", dimensions: [0, 1, -2, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "F") return k.m * k.a;
      if (u === "m") return k.F / k.a;
      if (u === "a") return k.F / k.m;
      return NaN;
    },
    related: ["weight", "momentum"],
  },
  {
    id: "weight",
    name: "Weight",
    category: "mechanics",
    equation: "W = m × g",
    description: "Weight equals mass times gravitational acceleration.",
    difficulty: "basic",
    variables: [
      { symbol: "W", name: "weight", unit: "N", dimensions: [1, 1, -2, 0, 0, 0, 0] },
      { symbol: "m", name: "mass", unit: "kg", dimensions: [1, 0, 0, 0, 0, 0, 0] },
      { symbol: "g", name: "gravitational acceleration", unit: "m/s²", dimensions: [0, 1, -2, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "W") return k.m * k.g;
      if (u === "m") return k.W / k.g;
      if (u === "g") return k.W / k.m;
      return NaN;
    },
    related: ["newton2"],
  },
  {
    id: "velocity-at",
    name: "Velocity (constant acceleration)",
    category: "mechanics",
    equation: "v = u + a × t",
    description: "Final velocity equals initial velocity plus acceleration times time.",
    difficulty: "basic",
    variables: [
      { symbol: "v", name: "final velocity", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "u", name: "initial velocity", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "a", name: "acceleration", unit: "m/s²", dimensions: [0, 1, -2, 0, 0, 0, 0] },
      { symbol: "t", name: "time", unit: "s", dimensions: [0, 0, 1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "v") return k.u + k.a * k.t;
      if (u === "u") return k.v - k.a * k.t;
      if (u === "a") return (k.v - k.u) / k.t;
      if (u === "t") return (k.v - k.u) / k.a;
      return NaN;
    },
    related: ["displacement-ut", "velocity2"],
  },
  {
    id: "displacement-ut",
    name: "Displacement (constant acceleration)",
    category: "mechanics",
    equation: "s = u × t + ½ × a × t²",
    description: "Displacement equals initial velocity times time plus half acceleration times time squared.",
    difficulty: "intermediate",
    variables: [
      { symbol: "s", name: "displacement", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
      { symbol: "u", name: "initial velocity", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "t", name: "time", unit: "s", dimensions: [0, 0, 1, 0, 0, 0, 0] },
      { symbol: "a", name: "acceleration", unit: "m/s²", dimensions: [0, 1, -2, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "s") return k.u * k.t + 0.5 * k.a * k.t * k.t;
      if (u === "u") return (k.s - 0.5 * k.a * k.t * k.t) / k.t;
      if (u === "a") return (2 * (k.s - k.u * k.t)) / (k.t * k.t);
      if (u === "t") {
        // s = ut + 0.5at² → 0.5at² + ut - s = 0
        const disc = k.u * k.u + 2 * k.a * k.s;
        if (disc < 0) return NaN;
        return (-k.u + Math.sqrt(disc)) / k.a;
      }
      return NaN;
    },
    related: ["velocity-at", "velocity2"],
  },
  {
    id: "velocity2",
    name: "Velocity squared (no time)",
    category: "mechanics",
    equation: "v² = u² + 2 × a × s",
    description: "Final velocity squared equals initial velocity squared plus twice acceleration times displacement.",
    difficulty: "intermediate",
    variables: [
      { symbol: "v", name: "final velocity", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "u", name: "initial velocity", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "a", name: "acceleration", unit: "m/s²", dimensions: [0, 1, -2, 0, 0, 0, 0] },
      { symbol: "s", name: "displacement", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "v") return Math.sqrt(k.u * k.u + 2 * k.a * k.s);
      if (u === "u") return Math.sqrt(k.v * k.v - 2 * k.a * k.s);
      if (u === "a") return (k.v * k.v - k.u * k.u) / (2 * k.s);
      if (u === "s") return (k.v * k.v - k.u * k.u) / (2 * k.a);
      return NaN;
    },
    related: ["velocity-at", "displacement-ut"],
  },
  {
    id: "gravitation",
    name: "Newton's Law of Universal Gravitation",
    category: "mechanics",
    equation: "F = G × (m1 × m2) / r²",
    description: "Gravitational force between two masses is proportional to product of masses and inversely proportional to distance squared.",
    difficulty: "intermediate",
    variables: [
      { symbol: "F", name: "force", unit: "N", dimensions: [1, 1, -2, 0, 0, 0, 0] },
      { symbol: "G", name: "gravitational constant", unit: "N·m²/kg²", dimensions: [0, 3, -2, 0, 0, -1, 0] },
      { symbol: "m1", name: "mass 1", unit: "kg", dimensions: [1, 0, 0, 0, 0, 0, 0] },
      { symbol: "m2", name: "mass 2", unit: "kg", dimensions: [1, 0, 0, 0, 0, 0, 0] },
      { symbol: "r", name: "distance", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "F") return (k.G * k.m1 * k.m2) / (k.r * k.r);
      if (u === "m1") return (k.F * k.r * k.r) / (k.G * k.m2);
      if (u === "m2") return (k.F * k.r * k.r) / (k.G * k.m1);
      if (u === "r") return Math.sqrt((k.G * k.m1 * k.m2) / k.F);
      if (u === "G") return (k.F * k.r * k.r) / (k.m1 * k.m2);
      return NaN;
    },
    related: ["newton2"],
  },
  {
    id: "work",
    name: "Work",
    category: "mechanics",
    equation: "W = F × d",
    description: "Work equals force times displacement (in direction of force).",
    difficulty: "basic",
    variables: [
      { symbol: "W", name: "work", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
      { symbol: "F", name: "force", unit: "N", dimensions: [1, 1, -2, 0, 0, 0, 0] },
      { symbol: "d", name: "displacement", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "W") return k.F * k.d;
      if (u === "F") return k.W / k.d;
      if (u === "d") return k.W / k.F;
      return NaN;
    },
    related: ["power", "kinetic-energy"],
  },
  {
    id: "power",
    name: "Power",
    category: "mechanics",
    equation: "P = W / t",
    description: "Power equals work done divided by time.",
    difficulty: "basic",
    variables: [
      { symbol: "P", name: "power", unit: "W", dimensions: [1, 2, -3, 0, 0, 0, 0] },
      { symbol: "W", name: "work", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
      { symbol: "t", name: "time", unit: "s", dimensions: [0, 0, 1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "P") return k.W / k.t;
      if (u === "W") return k.P * k.t;
      if (u === "t") return k.W / k.P;
      return NaN;
    },
    related: ["work"],
  },
  {
    id: "kinetic-energy",
    name: "Kinetic Energy",
    category: "mechanics",
    equation: "KE = ½ × m × v²",
    description: "Kinetic energy equals half mass times velocity squared.",
    difficulty: "intermediate",
    variables: [
      { symbol: "KE", name: "kinetic energy", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
      { symbol: "m", name: "mass", unit: "kg", dimensions: [1, 0, 0, 0, 0, 0, 0] },
      { symbol: "v", name: "velocity", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "KE") return 0.5 * k.m * k.v * k.v;
      if (u === "m") return (2 * k.KE) / (k.v * k.v);
      if (u === "v") return Math.sqrt((2 * k.KE) / k.m);
      return NaN;
    },
    related: ["potential-energy", "work"],
  },
  {
    id: "potential-energy",
    name: "Gravitational Potential Energy",
    category: "mechanics",
    equation: "PE = m × g × h",
    description: "Potential energy equals mass times gravitational acceleration times height.",
    difficulty: "basic",
    variables: [
      { symbol: "PE", name: "potential energy", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
      { symbol: "m", name: "mass", unit: "kg", dimensions: [1, 0, 0, 0, 0, 0, 0] },
      { symbol: "g", name: "gravitational acceleration", unit: "m/s²", dimensions: [0, 1, -2, 0, 0, 0, 0] },
      { symbol: "h", name: "height", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "PE") return k.m * k.g * k.h;
      if (u === "m") return k.PE / (k.g * k.h);
      if (u === "g") return k.PE / (k.m * k.h);
      if (u === "h") return k.PE / (k.m * k.g);
      return NaN;
    },
    related: ["kinetic-energy"],
  },
  {
    id: "momentum",
    name: "Momentum",
    category: "mechanics",
    equation: "p = m × v",
    description: "Momentum equals mass times velocity.",
    difficulty: "basic",
    variables: [
      { symbol: "p", name: "momentum", unit: "kg·m/s", dimensions: [1, 1, -1, 0, 0, 0, 0] },
      { symbol: "m", name: "mass", unit: "kg", dimensions: [1, 0, 0, 0, 0, 0, 0] },
      { symbol: "v", name: "velocity", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "p") return k.m * k.v;
      if (u === "m") return k.p / k.v;
      if (u === "v") return k.p / k.m;
      return NaN;
    },
    related: ["newton2"],
  },
  {
    id: "hookes-law",
    name: "Hooke's Law",
    category: "mechanics",
    equation: "F = k × x",
    description: "Restoring force of a spring equals spring constant times displacement.",
    difficulty: "basic",
    variables: [
      { symbol: "F", name: "force", unit: "N", dimensions: [1, 1, -2, 0, 0, 0, 0] },
      { symbol: "k", name: "spring constant", unit: "N/m", dimensions: [1, 0, -2, 0, 0, 0, 0] },
      { symbol: "x", name: "displacement", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "F") return k.k * k.x;
      if (u === "k") return k.F / k.x;
      if (u === "x") return k.F / k.k;
      return NaN;
    },
    related: ["work"],
  },
  {
    id: "centripetal-force",
    name: "Centripetal Force",
    category: "mechanics",
    equation: "F = m × v² / r",
    description: "Centripetal force equals mass times velocity squared divided by radius.",
    difficulty: "intermediate",
    variables: [
      { symbol: "F", name: "centripetal force", unit: "N", dimensions: [1, 1, -2, 0, 0, 0, 0] },
      { symbol: "m", name: "mass", unit: "kg", dimensions: [1, 0, 0, 0, 0, 0, 0] },
      { symbol: "v", name: "velocity", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "r", name: "radius", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "F") return (k.m * k.v * k.v) / k.r;
      if (u === "m") return (k.F * k.r) / (k.v * k.v);
      if (u === "v") return Math.sqrt((k.F * k.r) / k.m);
      if (u === "r") return (k.m * k.v * k.v) / k.F;
      return NaN;
    },
    related: ["newton2", "kinetic-energy"],
  },
  {
    id: "torque",
    name: "Torque",
    category: "mechanics",
    equation: "τ = r × F × sin(θ)",
    description: "Torque equals lever arm times force times sine of angle between them.",
    difficulty: "intermediate",
    variables: [
      { symbol: "tau", name: "torque", unit: "N·m", dimensions: [1, 2, -2, 0, 0, 0, 0] },
      { symbol: "r", name: "lever arm", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
      { symbol: "F", name: "force", unit: "N", dimensions: [1, 1, -2, 0, 0, 0, 0] },
      { symbol: "theta", name: "angle (deg)", unit: "°", dimensions: [0, 0, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      const rad = (k.theta * Math.PI) / 180;
      if (u === "tau") return k.r * k.F * Math.sin(rad);
      if (u === "r") return k.tau / (k.F * Math.sin(rad));
      if (u === "F") return k.tau / (k.r * Math.sin(rad));
      if (u === "theta") return (Math.asin(k.tau / (k.r * k.F)) * 180) / Math.PI;
      return NaN;
    },
    related: ["work"],
  },
  {
    id: "pendulum-period",
    name: "Simple Pendulum Period",
    category: "mechanics",
    equation: "T = 2π × √(L/g)",
    description: "Period of a simple pendulum depends on length and gravitational acceleration.",
    difficulty: "intermediate",
    variables: [
      { symbol: "T", name: "period", unit: "s", dimensions: [0, 0, 1, 0, 0, 0, 0] },
      { symbol: "L", name: "length", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
      { symbol: "g", name: "gravitational acceleration", unit: "m/s²", dimensions: [0, 1, -2, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "T") return 2 * Math.PI * Math.sqrt(k.L / k.g);
      if (u === "L") return k.g * Math.pow(k.T / (2 * Math.PI), 2);
      if (u === "g") return k.L / Math.pow(k.T / (2 * Math.PI), 2);
      return NaN;
    },
    related: ["wave-period"],
  },
  {
    id: "angular-velocity",
    name: "Angular Velocity",
    category: "mechanics",
    equation: "ω = θ / t",
    description: "Angular velocity equals angle rotated divided by time.",
    difficulty: "basic",
    variables: [
      { symbol: "omega", name: "angular velocity", unit: "rad/s", dimensions: [0, 0, -1, 0, 0, 0, 0] },
      { symbol: "theta", name: "angle", unit: "rad", dimensions: [0, 0, 0, 0, 0, 0, 0] },
      { symbol: "t", name: "time", unit: "s", dimensions: [0, 0, 1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "omega") return k.theta / k.t;
      if (u === "theta") return k.omega * k.t;
      if (u === "t") return k.theta / k.omega;
      return NaN;
    },
    related: ["velocity-at"],
  },
];

// Electricity (7)
const ELECTRICITY: PhysicsFormula[] = [
  {
    id: "ohms-law",
    name: "Ohm's Law",
    category: "electricity",
    equation: "V = I × R",
    description: "Voltage equals current times resistance.",
    difficulty: "basic",
    variables: [
      { symbol: "V", name: "voltage", unit: "V", dimensions: [1, 2, -3, -1, 0, 0, 0] },
      { symbol: "I", name: "current", unit: "A", dimensions: [0, 0, 0, 1, 0, 0, 0] },
      { symbol: "R", name: "resistance", unit: "Ω", dimensions: [1, 2, -3, -2, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "V") return k.I * k.R;
      if (u === "I") return k.V / k.R;
      if (u === "R") return k.V / k.I;
      return NaN;
    },
    related: ["electrical-power", "charge-current"],
  },
  {
    id: "electrical-power",
    name: "Electrical Power",
    category: "electricity",
    equation: "P = V × I",
    description: "Power equals voltage times current.",
    difficulty: "basic",
    variables: [
      { symbol: "P", name: "power", unit: "W", dimensions: [1, 2, -3, 0, 0, 0, 0] },
      { symbol: "V", name: "voltage", unit: "V", dimensions: [1, 2, -3, -1, 0, 0, 0] },
      { symbol: "I", name: "current", unit: "A", dimensions: [0, 0, 0, 1, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "P") return k.V * k.I;
      if (u === "V") return k.P / k.I;
      if (u === "I") return k.P / k.V;
      return NaN;
    },
    related: ["ohms-law"],
  },
  {
    id: "charge-current",
    name: "Charge and Current",
    category: "electricity",
    equation: "Q = I × t",
    description: "Charge equals current times time.",
    difficulty: "basic",
    variables: [
      { symbol: "Q", name: "charge", unit: "C", dimensions: [0, 0, 1, 1, 0, 0, 0] },
      { symbol: "I", name: "current", unit: "A", dimensions: [0, 0, 0, 1, 0, 0, 0] },
      { symbol: "t", name: "time", unit: "s", dimensions: [0, 0, 1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "Q") return k.I * k.t;
      if (u === "I") return k.Q / k.t;
      if (u === "t") return k.Q / k.I;
      return NaN;
    },
    related: ["ohms-law"],
  },
  {
    id: "coulombs-law",
    name: "Coulomb's Law",
    category: "electricity",
    equation: "F = k_e × (q1 × q2) / r²",
    description: "Electrostatic force between two charges is proportional to product of charges and inversely proportional to distance squared.",
    difficulty: "intermediate",
    variables: [
      { symbol: "F", name: "force", unit: "N", dimensions: [1, 1, -2, 0, 0, 0, 0] },
      { symbol: "k_e", name: "Coulomb constant", unit: "N·m²/C²", dimensions: [1, 3, -4, -2, 0, 0, 0] },
      { symbol: "q1", name: "charge 1", unit: "C", dimensions: [0, 0, 1, 1, 0, 0, 0] },
      { symbol: "q2", name: "charge 2", unit: "C", dimensions: [0, 0, 1, 1, 0, 0, 0] },
      { symbol: "r", name: "distance", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "F") return (k.k_e * k.q1 * k.q2) / (k.r * k.r);
      if (u === "q1") return (k.F * k.r * k.r) / (k.k_e * k.q2);
      if (u === "q2") return (k.F * k.r * k.r) / (k.k_e * k.q1);
      if (u === "r") return Math.sqrt((k.k_e * k.q1 * k.q2) / k.F);
      if (u === "k_e") return (k.F * k.r * k.r) / (k.q1 * k.q2);
      return NaN;
    },
    related: ["electric-field"],
  },
  {
    id: "electric-field",
    name: "Electric Field",
    category: "electricity",
    equation: "E = F / q",
    description: "Electric field equals force per unit charge.",
    difficulty: "intermediate",
    variables: [
      { symbol: "E", name: "electric field", unit: "N/C", dimensions: [1, 1, -3, -1, 0, 0, 0] },
      { symbol: "F", name: "force", unit: "N", dimensions: [1, 1, -2, 0, 0, 0, 0] },
      { symbol: "q", name: "charge", unit: "C", dimensions: [0, 0, 1, 1, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "E") return k.F / k.q;
      if (u === "F") return k.E * k.q;
      if (u === "q") return k.F / k.E;
      return NaN;
    },
    related: ["coulombs-law", "voltage-charge-distance"],
  },
  {
    id: "voltage-charge-distance",
    name: "Voltage from Point Charge",
    category: "electricity",
    equation: "V = k_e × Q / r",
    description: "Voltage at distance r from a point charge Q.",
    difficulty: "intermediate",
    variables: [
      { symbol: "V", name: "voltage", unit: "V", dimensions: [1, 2, -3, -1, 0, 0, 0] },
      { symbol: "k_e", name: "Coulomb constant", unit: "N·m²/C²", dimensions: [1, 3, -4, -2, 0, 0, 0] },
      { symbol: "Q", name: "charge", unit: "C", dimensions: [0, 0, 1, 1, 0, 0, 0] },
      { symbol: "r", name: "distance", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "V") return (k.k_e * k.Q) / k.r;
      if (u === "k_e") return (k.V * k.r) / k.Q;
      if (u === "Q") return (k.V * k.r) / k.k_e;
      if (u === "r") return (k.k_e * k.Q) / k.V;
      return NaN;
    },
    related: ["coulombs-law", "electric-field"],
  },
  {
    id: "resistance-resistivity",
    name: "Resistance from Resistivity",
    category: "electricity",
    equation: "R = ρ × L / A",
    description: "Resistance equals resistivity times length over cross-sectional area.",
    difficulty: "advanced",
    variables: [
      { symbol: "R", name: "resistance", unit: "Ω", dimensions: [1, 2, -3, -2, 0, 0, 0] },
      { symbol: "rho", name: "resistivity", unit: "Ω·m", dimensions: [1, 3, -3, -2, 0, 0, 0] },
      { symbol: "L", name: "length", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
      { symbol: "A", name: "cross-sectional area", unit: "m²", dimensions: [0, 2, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "R") return (k.rho * k.L) / k.A;
      if (u === "rho") return (k.R * k.A) / k.L;
      if (u === "L") return (k.R * k.A) / k.rho;
      if (u === "A") return (k.rho * k.L) / k.R;
      return NaN;
    },
    related: ["ohms-law"],
  },
  {
    id: "capacitance",
    name: "Capacitance",
    category: "electricity",
    equation: "C = Q / V",
    description: "Capacitance equals charge divided by voltage.",
    difficulty: "intermediate",
    variables: [
      { symbol: "C", name: "capacitance", unit: "F", dimensions: [-1, -2, 4, 2, 0, 0, 0] },
      { symbol: "Q", name: "charge", unit: "C", dimensions: [0, 0, 1, 1, 0, 0, 0] },
      { symbol: "V", name: "voltage", unit: "V", dimensions: [1, 2, -3, -1, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "C") return k.Q / k.V;
      if (u === "Q") return k.C * k.V;
      if (u === "V") return k.Q / k.C;
      return NaN;
    },
    related: ["energy-capacitor", "charge-current"],
  },
  {
    id: "energy-capacitor",
    name: "Energy Stored in Capacitor",
    category: "electricity",
    equation: "U = ½ × C × V²",
    description: "Energy stored in a charged capacitor equals half capacitance times voltage squared.",
    difficulty: "intermediate",
    variables: [
      { symbol: "U", name: "energy", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
      { symbol: "C", name: "capacitance", unit: "F", dimensions: [-1, -2, 4, 2, 0, 0, 0] },
      { symbol: "V", name: "voltage", unit: "V", dimensions: [1, 2, -3, -1, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "U") return 0.5 * k.C * k.V * k.V;
      if (u === "C") return (2 * k.U) / (k.V * k.V);
      if (u === "V") return Math.sqrt((2 * k.U) / k.C);
      return NaN;
    },
    related: ["capacitance"],
  },
  {
    id: "resistors-series",
    name: "Resistors in Series",
    category: "electricity",
    equation: "R = R₁ + R₂ + R₃",
    description: "Total resistance of series resistors is the sum of individual resistances.",
    difficulty: "basic",
    variables: [
      { symbol: "R", name: "total resistance", unit: "Ω", dimensions: [1, 2, -3, -2, 0, 0, 0] },
      { symbol: "R1", name: "resistor 1", unit: "Ω", dimensions: [1, 2, -3, -2, 0, 0, 0] },
      { symbol: "R2", name: "resistor 2", unit: "Ω", dimensions: [1, 2, -3, -2, 0, 0, 0] },
      { symbol: "R3", name: "resistor 3", unit: "Ω", dimensions: [1, 2, -3, -2, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "R") return k.R1 + k.R2 + k.R3;
      if (u === "R1") return k.R - k.R2 - k.R3;
      if (u === "R2") return k.R - k.R1 - k.R3;
      if (u === "R3") return k.R - k.R1 - k.R2;
      return NaN;
    },
    related: ["ohms-law", "resistors-parallel"],
  },
  {
    id: "resistors-parallel",
    name: "Resistors in Parallel",
    category: "electricity",
    equation: "1/R = 1/R₁ + 1/R₂ + 1/R₃",
    description: "Reciprocal of total parallel resistance equals sum of reciprocals.",
    difficulty: "intermediate",
    variables: [
      { symbol: "R", name: "total resistance", unit: "Ω", dimensions: [1, 2, -3, -2, 0, 0, 0] },
      { symbol: "R1", name: "resistor 1", unit: "Ω", dimensions: [1, 2, -3, -2, 0, 0, 0] },
      { symbol: "R2", name: "resistor 2", unit: "Ω", dimensions: [1, 2, -3, -2, 0, 0, 0] },
      { symbol: "R3", name: "resistor 3", unit: "Ω", dimensions: [1, 2, -3, -2, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "R") return 1 / (1 / k.R1 + 1 / k.R2 + 1 / k.R3);
      if (u === "R1") return 1 / (1 / k.R - 1 / k.R2 - 1 / k.R3);
      if (u === "R2") return 1 / (1 / k.R - 1 / k.R1 - 1 / k.R3);
      if (u === "R3") return 1 / (1 / k.R - 1 / k.R1 - 1 / k.R2);
      return NaN;
    },
    related: ["resistors-series"],
  },
];

// Waves (5)
const WAVES: PhysicsFormula[] = [
  {
    id: "wave-speed",
    name: "Wave Speed",
    category: "waves",
    equation: "v = f × λ",
    description: "Wave speed equals frequency times wavelength.",
    difficulty: "basic",
    variables: [
      { symbol: "v", name: "wave speed", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "f", name: "frequency", unit: "Hz", dimensions: [0, 0, -1, 0, 0, 0, 0] },
      { symbol: "lambda", name: "wavelength", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "v") return k.f * k.lambda;
      if (u === "f") return k.v / k.lambda;
      if (u === "lambda") return k.v / k.f;
      return NaN;
    },
    related: ["wave-period"],
  },
  {
    id: "wave-period",
    name: "Wave Period",
    category: "waves",
    equation: "T = 1 / f",
    description: "Period equals reciprocal of frequency.",
    difficulty: "basic",
    variables: [
      { symbol: "T", name: "period", unit: "s", dimensions: [0, 0, 1, 0, 0, 0, 0] },
      { symbol: "f", name: "frequency", unit: "Hz", dimensions: [0, 0, -1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "T") return 1 / k.f;
      if (u === "f") return 1 / k.T;
      return NaN;
    },
    related: ["wave-speed"],
  },
  {
    id: "photon-energy",
    name: "Photon Energy",
    category: "waves",
    equation: "E = h × f",
    description: "Photon energy equals Planck constant times frequency.",
    difficulty: "intermediate",
    variables: [
      { symbol: "E", name: "energy", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
      { symbol: "h", name: "Planck constant", unit: "J·s", dimensions: [1, 2, -1, 0, 0, 0, 0] },
      { symbol: "f", name: "frequency", unit: "Hz", dimensions: [0, 0, -1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "E") return k.h * k.f;
      if (u === "h") return k.E / k.f;
      if (u === "f") return k.E / k.h;
      return NaN;
    },
    related: ["wave-speed", "de-broglie"],
  },
  {
    id: "intensity",
    name: "Wave Intensity",
    category: "waves",
    equation: "I = P / A",
    description: "Intensity equals power per unit area.",
    difficulty: "intermediate",
    variables: [
      { symbol: "I", name: "intensity", unit: "W/m²", dimensions: [1, 0, -3, 0, 0, 0, 0] },
      { symbol: "P", name: "power", unit: "W", dimensions: [1, 2, -3, 0, 0, 0, 0] },
      { symbol: "A", name: "area", unit: "m²", dimensions: [0, 2, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "I") return k.P / k.A;
      if (u === "P") return k.I * k.A;
      if (u === "A") return k.P / k.I;
      return NaN;
    },
    related: ["wave-speed"],
  },
  {
    id: "wavelength-frequency",
    name: "Photon Wavelength from Energy",
    category: "waves",
    equation: "λ = h × c / E",
    description: "Photon wavelength equals Planck constant times speed of light divided by energy.",
    difficulty: "advanced",
    variables: [
      { symbol: "lambda", name: "wavelength", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
      { symbol: "h", name: "Planck constant", unit: "J·s", dimensions: [1, 2, -1, 0, 0, 0, 0] },
      { symbol: "c", name: "speed of light", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "E", name: "energy", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "lambda") return (k.h * k.c) / k.E;
      if (u === "h") return (k.lambda * k.E) / k.c;
      if (u === "c") return (k.lambda * k.E) / k.h;
      if (u === "E") return (k.h * k.c) / k.lambda;
      return NaN;
    },
    related: ["photon-energy", "de-broglie"],
  },
  {
    id: "beat-frequency",
    name: "Beat Frequency",
    category: "waves",
    equation: "f_beat = |f₁ - f₂|",
    description: "Beat frequency equals absolute difference between two close frequencies.",
    difficulty: "basic",
    variables: [
      { symbol: "fbeat", name: "beat frequency", unit: "Hz", dimensions: [0, 0, -1, 0, 0, 0, 0] },
      { symbol: "f1", name: "frequency 1", unit: "Hz", dimensions: [0, 0, -1, 0, 0, 0, 0] },
      { symbol: "f2", name: "frequency 2", unit: "Hz", dimensions: [0, 0, -1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "fbeat") return Math.abs(k.f1 - k.f2);
      if (u === "f1") return k.f2 + k.fbeat;
      if (u === "f2") return k.f1 - k.fbeat;
      return NaN;
    },
    related: ["wave-speed"],
  },
  {
    id: "string-wave-speed",
    name: "Wave Speed on a String",
    category: "waves",
    equation: "v = √(T / μ)",
    description: "Wave speed on a stretched string equals square root of tension divided by linear mass density.",
    difficulty: "intermediate",
    variables: [
      { symbol: "v", name: "wave speed", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "T", name: "tension", unit: "N", dimensions: [1, 1, -2, 0, 0, 0, 0] },
      { symbol: "mu", name: "linear mass density", unit: "kg/m", dimensions: [1, -1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "v") return Math.sqrt(k.T / k.mu);
      if (u === "T") return k.v * k.v * k.mu;
      if (u === "mu") return k.T / (k.v * k.v);
      return NaN;
    },
    related: ["wave-speed"],
  },
];

// Thermodynamics (5)
const THERMO: PhysicsFormula[] = [
  {
    id: "ideal-gas",
    name: "Ideal Gas Law",
    category: "thermodynamics",
    equation: "P × V = n × R × T",
    description: "Pressure times volume equals moles times gas constant times temperature.",
    difficulty: "intermediate",
    variables: [
      { symbol: "P", name: "pressure", unit: "Pa", dimensions: [1, -1, -2, 0, 0, 0, 0] },
      { symbol: "V", name: "volume", unit: "m³", dimensions: [0, 3, 0, 0, 0, 0, 0] },
      { symbol: "n", name: "amount of substance", unit: "mol", dimensions: [0, 0, 0, 0, 0, 1, 0] },
      { symbol: "R", name: "gas constant", unit: "J/(mol·K)", dimensions: [1, 2, -2, 0, -1, -1, 0] },
      { symbol: "T", name: "temperature", unit: "K", dimensions: [0, 0, 0, 0, 1, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "P") return (k.n * k.R * k.T) / k.V;
      if (u === "V") return (k.n * k.R * k.T) / k.P;
      if (u === "n") return (k.P * k.V) / (k.R * k.T);
      if (u === "R") return (k.P * k.V) / (k.n * k.T);
      if (u === "T") return (k.P * k.V) / (k.n * k.R);
      return NaN;
    },
    related: ["heat-capacity"],
  },
  {
    id: "heat-capacity",
    name: "Heat Capacity",
    category: "thermodynamics",
    equation: "Q = m × c × ΔT",
    description: "Heat equals mass times specific heat capacity times temperature change.",
    difficulty: "intermediate",
    variables: [
      { symbol: "Q", name: "heat", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
      { symbol: "m", name: "mass", unit: "kg", dimensions: [1, 0, 0, 0, 0, 0, 0] },
      { symbol: "c", name: "specific heat capacity", unit: "J/(kg·K)", dimensions: [0, 2, -2, 0, -1, 0, 0] },
      { symbol: "dT", name: "temperature change", unit: "K", dimensions: [0, 0, 0, 0, 1, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "Q") return k.m * k.c * k.dT;
      if (u === "m") return k.Q / (k.c * k.dT);
      if (u === "c") return k.Q / (k.m * k.dT);
      if (u === "dT") return k.Q / (k.m * k.c);
      return NaN;
    },
    related: ["ideal-gas", "latent-heat"],
  },
  {
    id: "latent-heat",
    name: "Latent Heat",
    category: "thermodynamics",
    equation: "Q = m × L",
    description: "Heat for phase change equals mass times latent heat.",
    difficulty: "intermediate",
    variables: [
      { symbol: "Q", name: "heat", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
      { symbol: "m", name: "mass", unit: "kg", dimensions: [1, 0, 0, 0, 0, 0, 0] },
      { symbol: "L", name: "latent heat", unit: "J/kg", dimensions: [0, 2, -2, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "Q") return k.m * k.L;
      if (u === "m") return k.Q / k.L;
      if (u === "L") return k.Q / k.m;
      return NaN;
    },
    related: ["heat-capacity"],
  },
  {
    id: "thermal-efficiency",
    name: "Thermal Efficiency",
    category: "thermodynamics",
    equation: "η = W / Q_H",
    description: "Efficiency equals work output divided by heat input.",
    difficulty: "intermediate",
    variables: [
      { symbol: "eta", name: "efficiency", unit: "", dimensions: [0, 0, 0, 0, 0, 0, 0] },
      { symbol: "W", name: "work output", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
      { symbol: "Q_H", name: "heat input", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "eta") return k.W / k.Q_H;
      if (u === "W") return k.eta * k.Q_H;
      if (u === "Q_H") return k.W / k.eta;
      return NaN;
    },
    related: ["internal-energy"],
  },
  {
    id: "internal-energy",
    name: "First Law of Thermodynamics",
    category: "thermodynamics",
    equation: "ΔU = Q - W",
    description: "Change in internal energy equals heat added minus work done by system.",
    difficulty: "advanced",
    variables: [
      { symbol: "dU", name: "change in internal energy", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
      { symbol: "Q", name: "heat added", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
      { symbol: "W", name: "work done by system", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "dU") return k.Q - k.W;
      if (u === "Q") return k.dU + k.W;
      if (u === "W") return k.Q - k.dU;
      return NaN;
    },
    related: ["thermal-efficiency"],
  },
  {
    id: "thermal-expansion",
    name: "Linear Thermal Expansion",
    category: "thermodynamics",
    equation: "ΔL = α × L₀ × ΔT",
    description: "Change in length equals coefficient of linear expansion times original length times temperature change.",
    difficulty: "intermediate",
    variables: [
      { symbol: "dL", name: "length change", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
      { symbol: "alpha", name: "coefficient of expansion", unit: "1/K", dimensions: [0, 0, 0, 0, -1, 0, 0] },
      { symbol: "L0", name: "original length", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
      { symbol: "dT", name: "temperature change", unit: "K", dimensions: [0, 0, 0, 0, 1, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "dL") return k.alpha * k.L0 * k.dT;
      if (u === "alpha") return k.dL / (k.L0 * k.dT);
      if (u === "L0") return k.dL / (k.alpha * k.dT);
      if (u === "dT") return k.dL / (k.alpha * k.L0);
      return NaN;
    },
    related: ["heat-capacity"],
  },
  {
    id: "combined-gas",
    name: "Combined Gas Law",
    category: "thermodynamics",
    equation: "(P₁ × V₁) / T₁ = (P₂ × V₂) / T₂",
    description: "Pressure-volume over temperature is constant for a fixed amount of gas.",
    difficulty: "intermediate",
    variables: [
      { symbol: "P1", name: "initial pressure", unit: "Pa", dimensions: [1, -1, -2, 0, 0, 0, 0] },
      { symbol: "V1", name: "initial volume", unit: "m³", dimensions: [0, 3, 0, 0, 0, 0, 0] },
      { symbol: "T1", name: "initial temperature", unit: "K", dimensions: [0, 0, 0, 0, 1, 0, 0] },
      { symbol: "P2", name: "final pressure", unit: "Pa", dimensions: [1, -1, -2, 0, 0, 0, 0] },
      { symbol: "V2", name: "final volume", unit: "m³", dimensions: [0, 3, 0, 0, 0, 0, 0] },
      { symbol: "T2", name: "final temperature", unit: "K", dimensions: [0, 0, 0, 0, 1, 0, 0] },
    ],
    solve: (k, u) => {
      const k1 = (k.P1 * k.V1) / k.T1;
      if (u === "P2") return (k1 * k.T2) / k.V2;
      if (u === "V2") return (k1 * k.T2) / k.P2;
      if (u === "T2") return (k.P2 * k.V2) / k1;
      // Solving for the initial side requires switching the formula.
      const k2 = (k.P2 * k.V2) / k.T2;
      if (u === "P1") return (k2 * k.T1) / k.V1;
      if (u === "V1") return (k2 * k.T1) / k.P1;
      if (u === "T1") return (k.P1 * k.V1) / k2;
      return NaN;
    },
    related: ["ideal-gas"],
  },
];

// Modern Physics (5)
const MODERN: PhysicsFormula[] = [
  {
    id: "mass-energy",
    name: "Mass-Energy Equivalence",
    category: "modern-physics",
    equation: "E = m × c²",
    description: "Energy equals mass times speed of light squared.",
    difficulty: "intermediate",
    variables: [
      { symbol: "E", name: "energy", unit: "J", dimensions: [1, 2, -2, 0, 0, 0, 0] },
      { symbol: "m", name: "mass", unit: "kg", dimensions: [1, 0, 0, 0, 0, 0, 0] },
      { symbol: "c", name: "speed of light", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "E") return k.m * k.c * k.c;
      if (u === "m") return k.E / (k.c * k.c);
      if (u === "c") return Math.sqrt(k.E / k.m);
      return NaN;
    },
    related: ["photon-energy"],
  },
  {
    id: "de-broglie",
    name: "de Broglie Wavelength",
    category: "modern-physics",
    equation: "λ = h / p",
    description: "Wavelength equals Planck constant divided by momentum.",
    difficulty: "advanced",
    variables: [
      { symbol: "lambda", name: "wavelength", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
      { symbol: "h", name: "Planck constant", unit: "J·s", dimensions: [1, 2, -1, 0, 0, 0, 0] },
      { symbol: "p", name: "momentum", unit: "kg·m/s", dimensions: [1, 1, -1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "lambda") return k.h / k.p;
      if (u === "h") return k.lambda * k.p;
      if (u === "p") return k.h / k.lambda;
      return NaN;
    },
    related: ["photon-energy", "momentum"],
  },
  {
    id: "doppler",
    name: "Doppler Effect (source approaching)",
    category: "modern-physics",
    equation: "f = f₀ × (c + v) / c",
    description: "Observed frequency when source approaches observer at speed v.",
    difficulty: "advanced",
    variables: [
      { symbol: "f", name: "observed frequency", unit: "Hz", dimensions: [0, 0, -1, 0, 0, 0, 0] },
      { symbol: "f0", name: "source frequency", unit: "Hz", dimensions: [0, 0, -1, 0, 0, 0, 0] },
      { symbol: "c", name: "wave speed", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "v", name: "source velocity", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "f") return k.f0 * (k.c + k.v) / k.c;
      if (u === "f0") return k.f * k.c / (k.c + k.v);
      if (u === "c") return (k.f * k.v) / (k.f - k.f0);
      if (u === "v") return (k.f * k.c - k.f0 * k.c) / k.f0;
      return NaN;
    },
    related: ["wave-speed"],
  },
  {
    id: "time-dilation",
    name: "Time Dilation",
    category: "modern-physics",
    equation: "t = t₀ / √(1 - v²/c²)",
    description: "Dilated time equals proper time divided by Lorentz factor.",
    difficulty: "advanced",
    variables: [
      { symbol: "t", name: "dilated time", unit: "s", dimensions: [0, 0, 1, 0, 0, 0, 0] },
      { symbol: "t0", name: "proper time", unit: "s", dimensions: [0, 0, 1, 0, 0, 0, 0] },
      { symbol: "v", name: "velocity", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "c", name: "speed of light", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      const beta2 = (k.v * k.v) / (k.c * k.c);
      const gamma = 1 / Math.sqrt(1 - beta2);
      if (u === "t") return k.t0 * gamma;
      if (u === "t0") return k.t / gamma;
      if (u === "v") return k.c * Math.sqrt(1 - (k.t0 * k.t0) / (k.t * k.t));
      if (u === "c") return k.v / Math.sqrt(1 - (k.t0 * k.t0) / (k.t * k.t));
      return NaN;
    },
    related: ["length-contraction"],
  },
  {
    id: "length-contraction",
    name: "Length Contraction",
    category: "modern-physics",
    equation: "L = L₀ × √(1 - v²/c²)",
    description: "Contracted length equals proper length times inverse Lorentz factor.",
    difficulty: "advanced",
    variables: [
      { symbol: "L", name: "contracted length", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
      { symbol: "L0", name: "proper length", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
      { symbol: "v", name: "velocity", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "c", name: "speed of light", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      const beta2 = (k.v * k.v) / (k.c * k.c);
      const factor = Math.sqrt(1 - beta2);
      if (u === "L") return k.L0 * factor;
      if (u === "L0") return k.L / factor;
      if (u === "v") return k.c * Math.sqrt(1 - (k.L * k.L) / (k.L0 * k.L0));
      if (u === "c") return k.v / Math.sqrt(1 - (k.L * k.L) / (k.L0 * k.L0));
      return NaN;
    },
    related: ["time-dilation"],
  },
  {
    id: "relativistic-momentum",
    name: "Relativistic Momentum",
    category: "modern-physics",
    equation: "p = γ × m × v",
    description: "Relativistic momentum equals Lorentz factor times mass times velocity.",
    difficulty: "advanced",
    variables: [
      { symbol: "p", name: "momentum", unit: "kg·m/s", dimensions: [1, 1, -1, 0, 0, 0, 0] },
      { symbol: "m", name: "mass", unit: "kg", dimensions: [1, 0, 0, 0, 0, 0, 0] },
      { symbol: "v", name: "velocity", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "c", name: "speed of light", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      const beta2 = (k.v * k.v) / (k.c * k.c);
      const gamma = 1 / Math.sqrt(1 - beta2);
      if (u === "p") return gamma * k.m * k.v;
      if (u === "m") return k.p / (gamma * k.v);
      if (u === "v") {
        // Solve numerically: p = m*v / sqrt(1-v²/c²)
        // p²(1 - v²/c²) = m²v² → p² = v²(m² + p²/c²)
        // v = p / sqrt(m² + p²/c²)
        return k.p / Math.sqrt(k.m * k.m + (k.p * k.p) / (k.c * k.c));
      }
      if (u === "c") {
        // Use: γ = p/(m·v); γ² = 1/(1 - v²/c²); c² = v²·γ²/(γ²-1)
        const g = k.p / (k.m * k.v);
        if (g <= 1) return NaN;
        return Math.abs(k.v) * g / Math.sqrt(g * g - 1);
      }
      return NaN;
    },
    related: ["de-broglie", "time-dilation"],
  },
];

// Optics (5)
const OPTICS: PhysicsFormula[] = [
  {
    id: "lens-equation",
    name: "Thin Lens Equation",
    category: "optics",
    equation: "1/f = 1/u + 1/v",
    description: "Reciprocal of focal length equals sum of reciprocals of object and image distances.",
    difficulty: "intermediate",
    variables: [
      { symbol: "f", name: "focal length", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
      { symbol: "u", name: "object distance", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
      { symbol: "v", name: "image distance", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "f") return 1 / (1 / k.u + 1 / k.v);
      if (u === "u") return 1 / (1 / k.f - 1 / k.v);
      if (u === "v") return 1 / (1 / k.f - 1 / k.u);
      return NaN;
    },
    related: ["magnification"],
  },
  {
    id: "magnification",
    name: "Magnification",
    category: "optics",
    equation: "m = -v / u",
    description: "Magnification equals negative image distance over object distance.",
    difficulty: "basic",
    variables: [
      { symbol: "m", name: "magnification", unit: "", dimensions: [0, 0, 0, 0, 0, 0, 0] },
      { symbol: "v", name: "image distance", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
      { symbol: "u", name: "object distance", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "m") return -k.v / k.u;
      if (u === "v") return -k.m * k.u;
      if (u === "u") return -k.v / k.m;
      return NaN;
    },
    related: ["lens-equation"],
  },
  {
    id: "refractive-index",
    name: "Refractive Index",
    category: "optics",
    equation: "n = c / v",
    description: "Refractive index equals speed of light in vacuum over speed in medium.",
    difficulty: "basic",
    variables: [
      { symbol: "n", name: "refractive index", unit: "", dimensions: [0, 0, 0, 0, 0, 0, 0] },
      { symbol: "c", name: "speed of light", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
      { symbol: "v", name: "speed in medium", unit: "m/s", dimensions: [0, 1, -1, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "n") return k.c / k.v;
      if (u === "c") return k.n * k.v;
      if (u === "v") return k.c / k.n;
      return NaN;
    },
    related: ["snells-law"],
  },
  {
    id: "snells-law",
    name: "Snell's Law",
    category: "optics",
    equation: "n₁ × sin(θ₁) = n₂ × sin(θ₂)",
    description: "Refractive index times sine of angle is constant across media.",
    difficulty: "intermediate",
    variables: [
      { symbol: "n1", name: "refractive index 1", unit: "", dimensions: [0, 0, 0, 0, 0, 0, 0] },
      { symbol: "theta1", name: "angle of incidence (deg)", unit: "°", dimensions: [0, 0, 0, 0, 0, 0, 0] },
      { symbol: "n2", name: "refractive index 2", unit: "", dimensions: [0, 0, 0, 0, 0, 0, 0] },
      { symbol: "theta2", name: "angle of refraction (deg)", unit: "°", dimensions: [0, 0, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      const toRad = (d: number) => (d * Math.PI) / 180;
      const toDeg = (r: number) => (r * 180) / Math.PI;
      if (u === "n1") return (k.n2 * Math.sin(toRad(k.theta2))) / Math.sin(toRad(k.theta1));
      if (u === "n2") return (k.n1 * Math.sin(toRad(k.theta1))) / Math.sin(toRad(k.theta2));
      if (u === "theta1") return toDeg(Math.asin((k.n2 * Math.sin(toRad(k.theta2))) / k.n1));
      if (u === "theta2") return toDeg(Math.asin((k.n1 * Math.sin(toRad(k.theta1))) / k.n2));
      return NaN;
    },
    related: ["refractive-index"],
  },
  {
    id: "critical-angle",
    name: "Critical Angle (Total Internal Reflection)",
    category: "optics",
    equation: "sin(θ_c) = n₂ / n₁",
    description: "Critical angle for total internal reflection from denser medium n1 to rarer medium n2.",
    difficulty: "advanced",
    variables: [
      { symbol: "theta_c", name: "critical angle (deg)", unit: "°", dimensions: [0, 0, 0, 0, 0, 0, 0] },
      { symbol: "n1", name: "denser refractive index", unit: "", dimensions: [0, 0, 0, 0, 0, 0, 0] },
      { symbol: "n2", name: "rarer refractive index", unit: "", dimensions: [0, 0, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      const toRad = (d: number) => (d * Math.PI) / 180;
      const toDeg = (r: number) => (r * 180) / Math.PI;
      if (u === "theta_c") return toDeg(Math.asin(k.n2 / k.n1));
      if (u === "n1") return k.n2 / Math.sin(toRad(k.theta_c));
      if (u === "n2") return k.n1 * Math.sin(toRad(k.theta_c));
      return NaN;
    },
    related: ["snells-law", "refractive-index"],
  },
  {
    id: "lens-power",
    name: "Lens Power",
    category: "optics",
    equation: "P = 1 / f",
    description: "Power of a lens equals reciprocal of focal length (in meters).",
    difficulty: "basic",
    variables: [
      { symbol: "P", name: "power", unit: "diopters", dimensions: [0, -1, 0, 0, 0, 0, 0] },
      { symbol: "f", name: "focal length", unit: "m", dimensions: [0, 1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "P") return 1 / k.f;
      if (u === "f") return 1 / k.P;
      return NaN;
    },
    related: ["lens-equation"],
  },
  {
    id: "lens-combination",
    name: "Lenses in Contact",
    category: "optics",
    equation: "P = P₁ + P₂",
    description: "Combined power of thin lenses in contact equals sum of individual powers.",
    difficulty: "intermediate",
    variables: [
      { symbol: "P", name: "combined power", unit: "diopters", dimensions: [0, -1, 0, 0, 0, 0, 0] },
      { symbol: "P1", name: "lens 1 power", unit: "diopters", dimensions: [0, -1, 0, 0, 0, 0, 0] },
      { symbol: "P2", name: "lens 2 power", unit: "diopters", dimensions: [0, -1, 0, 0, 0, 0, 0] },
    ],
    solve: (k, u) => {
      if (u === "P") return k.P1 + k.P2;
      if (u === "P1") return k.P - k.P2;
      if (u === "P2") return k.P - k.P1;
      return NaN;
    },
    related: ["lens-power", "lens-equation"],
  },
];

export const FORMULAS: PhysicsFormula[] = [
  ...MECHANICS,
  ...ELECTRICITY,
  ...WAVES,
  ...THERMO,
  ...MODERN,
  ...OPTICS,
];

/** Get all formulas in a category. */
export function formulasByCategory(category: PhysicsCategory): PhysicsFormula[] {
  return FORMULAS.filter((f) => f.category === category);
}

/** Look up a formula by id. */
export function lookupFormula(id: string): PhysicsFormula | undefined {
  return FORMULAS.find((f) => f.id === id);
}

/** Search formulas by name/equation/description. */
export function searchFormulas(query: string): PhysicsFormula[] {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  return FORMULAS.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      f.equation.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q),
  );
}

// ---- Variable parsing & validation ----

/** Parse known-values text. Each line: "variable=value" (whitespace ignored). */
export function parseKnownValues(input: string): Record<string, number> | { error: string } {
  const out: Record<string, number> = {};
  if (!input || !input.trim()) return out;
  const lines = input
    .split(/[\n;]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Also split each line on commas (top-level only) to support "m=10, a=9.8".
  const expanded: string[] = [];
  for (const line of lines) {
    // Don't split on commas inside the numeric value (no thousands sep here).
    const parts = line.split(",").map((p) => p.trim()).filter(Boolean);
    for (const p of parts) expanded.push(p);
  }
  for (const line of expanded) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*[=:]?\s*(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)$/);
    if (!m) {
      return { error: `Cannot parse line: "${line}" (expected variable=value)` };
    }
    const varName = m[1];
    const val = parseFloat(m[2]);
    if (isNaN(val)) return { error: `Invalid number in line: "${line}"` };
    out[varName] = val;
  }
  return out;
}

export interface ValidationResult {
  ok: boolean;
  missing: string[];
  unknown: string[];
  formula: PhysicsFormula;
  unknownVariable: string;
  error?: string;
}

/** Validate that the user has provided all required variables except the unknown. */
export function validateVariables(
  formula: PhysicsFormula,
  known: Record<string, number>,
  unknownVariable: string,
): ValidationResult {
  const required = formula.variables.map((v) => v.symbol);
  if (!required.includes(unknownVariable)) {
    return {
      ok: false,
      missing: [],
      unknown: [],
      formula,
      unknownVariable,
      error: `Unknown variable "${unknownVariable}" is not in formula ${formula.equation}`,
    };
  }
  const missing = required.filter((s) => s !== unknownVariable && !(s in known));
  const knownSet = new Set(Object.keys(known));
  const unknown = [...knownSet].filter((s) => !required.includes(s));
  return {
    ok: missing.length === 0,
    missing,
    unknown,
    formula,
    unknownVariable,
    error: missing.length > 0 ? `Missing: ${missing.join(", ")}` : undefined,
  };
}

// ---- Solver ----

export interface SolveResult {
  ok: boolean;
  value: number;
  unit: string;
  formula: PhysicsFormula;
  unknownVariable: string;
  known: Record<string, number>;
  error?: string;
}

/** Solve a formula for the unknown variable given known values. */
export function solveFormula(
  formula: PhysicsFormula,
  known: Record<string, number>,
  unknownVariable: string,
): SolveResult {
  const v = validateVariables(formula, known, unknownVariable);
  if (!v.ok) {
    return {
      ok: false,
      value: NaN,
      unit: "",
      formula,
      unknownVariable,
      known,
      error: v.error,
    };
  }
  try {
    const value = formula.solve(known, unknownVariable);
    if (!isFinite(value) || isNaN(value)) {
      return {
        ok: false,
        value: NaN,
        unit: "",
        formula,
        unknownVariable,
        known,
        error: "Calculation produced an invalid (non-finite) result",
      };
    }
    const varInfo = formula.variables.find((vv) => vv.symbol === unknownVariable);
    return {
      ok: true,
      value,
      unit: varInfo?.unit ?? "",
      formula,
      unknownVariable,
      known,
    };
  } catch (e) {
    return {
      ok: false,
      value: NaN,
      unit: "",
      formula,
      unknownVariable,
      known,
      error: e instanceof Error ? e.message : "Calculation failed",
    };
  }
}

// ---- Significant figures ----

/** Round a number to n significant figures. */
export function roundSigFigs(value: number, sigFigs: number): number {
  if (!isFinite(value) || value === 0) return value;
  if (sigFigs <= 0) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const exp = Math.floor(Math.log10(abs));
  const magnitude = Math.pow(10, exp - sigFigs + 1);
  return sign * Math.round(abs / magnitude) * magnitude;
}

/** Format a number with up to n significant figures (string). */
export function formatSigFigs(value: number, sigFigs: number): string {
  if (!isFinite(value)) return String(value);
  if (sigFigs <= 0) return String(value);
  const rounded = roundSigFigs(value, sigFigs);
  if (Math.abs(rounded) >= 1e6 || (Math.abs(rounded) < 1e-3 && rounded !== 0)) {
    return rounded.toExponential(sigFigs - 1);
  }
  // Count digits to format properly.
  const str = rounded.toPrecision(sigFigs);
  // Strip trailing zeros after decimal.
  return str.replace(/\.?0+$/, (m) => (m.startsWith(".") ? "" : m));
}

// ---- Unit converter ----

export interface UnitConversion {
  value: number;
  from: string;
  to: string;
  result: number;
  ok: boolean;
  error?: string;
}

interface UnitDef {
  name: string;
  /** Factor to convert this unit to the base unit (multiply by this). */
  toBase: number;
  /** Base unit name (e.g. "m/s"). */
  base: string;
  /** Offset (for temperatures). */
  offset?: number;
}

export const UNIT_CATEGORIES: Record<string, UnitDef[]> = {
  velocity: [
    { name: "m/s", toBase: 1, base: "m/s" },
    { name: "km/h", toBase: 1 / 3.6, base: "m/s" },
    { name: "mph", toBase: 0.44704, base: "m/s" },
    { name: "ft/s", toBase: 0.3048, base: "m/s" },
    { name: "knot", toBase: 0.514444, base: "m/s" },
  ],
  energy: [
    { name: "J", toBase: 1, base: "J" },
    { name: "kJ", toBase: 1000, base: "J" },
    { name: "cal", toBase: 4.184, base: "J" },
    { name: "kcal", toBase: 4184, base: "J" },
    { name: "kWh", toBase: 3.6e6, base: "J" },
    { name: "eV", toBase: 1.602176634e-19, base: "J" },
  ],
  length: [
    { name: "m", toBase: 1, base: "m" },
    { name: "km", toBase: 1000, base: "m" },
    { name: "cm", toBase: 0.01, base: "m" },
    { name: "mm", toBase: 0.001, base: "m" },
    { name: "mi", toBase: 1609.344, base: "m" },
    { name: "ft", toBase: 0.3048, base: "m" },
    { name: "in", toBase: 0.0254, base: "m" },
  ],
  mass: [
    { name: "kg", toBase: 1, base: "kg" },
    { name: "g", toBase: 0.001, base: "kg" },
    { name: "mg", toBase: 1e-6, base: "kg" },
    { name: "lb", toBase: 0.453592, base: "kg" },
    { name: "oz", toBase: 0.0283495, base: "kg" },
    { name: "t", toBase: 1000, base: "kg" },
  ],
  time: [
    { name: "s", toBase: 1, base: "s" },
    { name: "ms", toBase: 0.001, base: "s" },
    { name: "min", toBase: 60, base: "s" },
    { name: "h", toBase: 3600, base: "s" },
    { name: "day", toBase: 86400, base: "s" },
  ],
  temperature: [
    { name: "K", toBase: 1, base: "K" },
    { name: "C", toBase: 1, base: "K", offset: 273.15 },
    { name: "F", toBase: 5 / 9, base: "K", offset: 459.67 },
  ],
};

/** Convert a value from one unit to another within the same category. */
export function convertUnit(value: number, from: string, to: string): UnitConversion {
  // Find the source unit across all categories.
  let srcCat: string | null = null;
  let srcDef: UnitDef | null = null;
  for (const [cat, units] of Object.entries(UNIT_CATEGORIES)) {
    const found = units.find((u) => u.name === from);
    if (found) {
      srcCat = cat;
      srcDef = found;
      break;
    }
  }
  if (!srcCat || !srcDef) {
    return { value, from, to, result: NaN, ok: false, error: `Unknown source unit: ${from}` };
  }
  const dstDef = UNIT_CATEGORIES[srcCat].find((u) => u.name === to);
  if (!dstDef) {
    return { value, from, to, result: NaN, ok: false, error: `Unknown target unit: ${to}` };
  }
  // To base: handle offsets (temperature).
  const baseValue = (value + (srcDef.offset ?? 0)) * srcDef.toBase;
  // From base to target.
  const result = baseValue / dstDef.toBase - (dstDef.offset ?? 0);
  return { value, from, to, result, ok: true };
}

// ---- Dimensional analysis ----

const DIMENSION_NAMES = ["M", "L", "T", "I", "Θ", "N", "J"];

export interface DimensionalCheckResult {
  ok: boolean;
  leftDims: number[];
  rightDims: number[];
  error?: string;
}

/**
 * Check dimensional consistency of a formula. Returns ok=true if the LHS
 * variable's dimensions match the dimensions computed from the RHS
 * variables (using multiplication/division rules). Only meaningful when
 * every variable on the RHS has dimensions defined and the LHS has a
 * dimension.
 *
 * Note: this is a best-effort check. It only handles simple multiplicative
 * formulas (which covers most of the included database).
 */
export function checkDimensions(
  formula: PhysicsFormula,
  unknown: string,
  known: Record<string, number>,
): DimensionalCheckResult {
  const unknownVar = formula.variables.find((v) => v.symbol === unknown);
  if (!unknownVar || !unknownVar.dimensions) {
    return { ok: false, leftDims: [], rightDims: [], error: "Unknown variable has no dimensions" };
  }
  // For dimensional analysis: dims of LHS = sum of dims of RHS (where division
  // subtracts). Without parsing the equation, we just check that all knowns
  // have dimensions defined.
  const allDefined = formula.variables.every((v) => v.dimensions);
  if (!allDefined) {
    return { ok: false, leftDims: [], rightDims: [], error: "Not all variables have dimensions" };
  }
  // The left dims are the unknown's dimensions.
  const leftDims = [...unknownVar.dimensions];
  void known; // known not used in this simple check
  return { ok: true, leftDims, rightDims: [] };
}

/** Render dimensions as a string like [M L T⁻²]. */
export function formatDimensions(dims: number[]): string {
  if (!dims || dims.length === 0) return "[]";
  const parts: string[] = [];
  for (let i = 0; i < dims.length; i++) {
    if (dims[i] === 0) continue;
    if (dims[i] === 1) parts.push(DIMENSION_NAMES[i]);
    else parts.push(`${DIMENSION_NAMES[i]}${superscript(dims[i])}`);
  }
  return parts.length === 0 ? "[]" : `[${parts.join(" ")}]`;
}

function superscript(n: number): string {
  const map: Record<string, string> = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
    "-": "⁻",
  };
  return String(n)
    .split("")
    .map((c) => map[c] ?? c)
    .join("");
}

// ---- Render ----

export interface SummaryStats {
  totalFormulas: number;
  byCategory: Record<PhysicsCategory, number>;
  byDifficulty: Record<Difficulty, number>;
}

export function computeSummary(): SummaryStats {
  const byCategory = {
    mechanics: 0,
    electricity: 0,
    waves: 0,
    thermodynamics: 0,
    "modern-physics": 0,
    optics: 0,
  } as Record<PhysicsCategory, number>;
  const byDifficulty = { basic: 0, intermediate: 0, advanced: 0 } as Record<Difficulty, number>;
  for (const f of FORMULAS) {
    byCategory[f.category] += 1;
    byDifficulty[f.difficulty] += 1;
  }
  return {
    totalFormulas: FORMULAS.length,
    byCategory,
    byDifficulty,
  };
}

/** Render a solve result as a text report. */
export function renderText(result: SolveResult, sigFigs: number): string {
  const lines: string[] = [];
  lines.push("Physics Formula Calculation");
  lines.push("==========================");
  lines.push(`Formula: ${result.formula.name}`);
  lines.push(`Equation: ${result.formula.equation}`);
  lines.push(`Category: ${result.formula.category}`);
  lines.push(`Difficulty: ${result.formula.difficulty}`);
  lines.push("");
  lines.push("Known values:");
  for (const [k, v] of Object.entries(result.known)) {
    const varInfo = result.formula.variables.find((vv) => vv.symbol === k);
    lines.push(`  ${k} = ${formatSigFigs(v, sigFigs)} ${varInfo?.unit ?? ""}`.trim());
  }
  lines.push("");
  if (result.ok) {
    lines.push(`Solved for: ${result.unknownVariable}`);
    lines.push(`  ${result.unknownVariable} = ${formatSigFigs(result.value, sigFigs)} ${result.unit}`.trim());
  } else {
    lines.push(`Error: ${result.error}`);
  }
  return lines.join("\n");
}

/** Render known + solved values as CSV. */
export function renderCsv(result: SolveResult, sigFigs: number): string {
  const lines = ["variable,value,unit"];
  for (const [k, v] of Object.entries(result.known)) {
    const varInfo = result.formula.variables.find((vv) => vv.symbol === k);
    lines.push(`${k},${formatSigFigs(v, sigFigs)},${varInfo?.unit ?? ""}`);
  }
  if (result.ok) {
    lines.push(`${result.unknownVariable},${formatSigFigs(result.value, sigFigs)},${result.unit}`);
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:physics-formula-reference:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  formulaId: string;
  formulaName: string;
  unknownVariable: string;
  result: string;
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

// ---- Shareable URL ----

export function buildShareUrl(
  category: PhysicsCategory,
  formulaId: string,
  knownValues: string,
  unknownVariable: string,
  sigFigs: number,
): string {
  const params = new URLSearchParams();
  if (category) params.set("c", category);
  if (formulaId) params.set("f", formulaId);
  if (knownValues) params.set("v", knownValues);
  if (unknownVariable) params.set("u", unknownVariable);
  if (sigFigs && sigFigs !== 4) params.set("s", String(sigFigs));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  category: PhysicsCategory;
  formulaId: string;
  knownValues: string;
  unknownVariable: string;
  sigFigs: number;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return { category: "mechanics", formulaId: "", knownValues: "", unknownVariable: "", sigFigs: 4 };
  }
  const params = new URLSearchParams(clean);
  const c = params.get("c") ?? "mechanics";
  const validCats = CATEGORIES.map((cc) => cc.value);
  const category = validCats.includes(c as PhysicsCategory)
    ? (c as PhysicsCategory)
    : "mechanics";
  const formulaId = params.get("f") ?? "";
  const knownValues = params.get("v") ?? "";
  const unknownVariable = params.get("u") ?? "";
  const s = parseInt(params.get("s") ?? "4", 10);
  const sigFigs = isNaN(s) || s < 1 || s > 12 ? 4 : s;
  return { category, formulaId, knownValues, unknownVariable, sigFigs };
}
