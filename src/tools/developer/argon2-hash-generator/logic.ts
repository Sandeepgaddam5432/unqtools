/**
 * Argon2 Hash Generator — reference & parameter calculator.
 * Since Argon2 isn't natively available in WebCrypto, this provides
 * a parameter strength calculator and simulated output for educational purposes.
 */

export interface Argon2Params {
  type: "argon2d" | "argon2i" | "argon2id";
  memoryCost: number; // KB
  iterations: number;
  parallelism: number;
  hashLength: number;
  salt: string;
}

export function calculateStrength(params: Argon2Params): { score: number; label: string; timeEstimate: string } {
  const { memoryCost, iterations, parallelism } = params;
  // Rough estimate: strength ∝ memory * iterations * parallelism
  const raw = (memoryCost / 1024) * iterations * parallelism;
  let score = 0;
  if (raw > 1) score = 1;
  if (raw > 10) score = 2;
  if (raw > 100) score = 3;
  if (raw > 1000) score = 4;
  if (raw > 10000) score = 5;

  // Time estimate (very rough: ~memory_cost * iterations ms / 1000)
  const estMs = Math.round((memoryCost * iterations) / 100);
  let timeEstimate: string;
  if (estMs < 1) timeEstimate = "<1ms";
  else if (estMs < 1000) timeEstimate = `${estMs}ms`;
  else timeEstimate = `${(estMs / 1000).toFixed(1)}s`;

  const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  return { score, label: labels[score], timeEstimate };
}

export function generateSalt(length: number = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function generateSimulatedHash(password: string, params: Argon2Params): string {
  // Not a real Argon2 hash — just a deterministic simulation for UI demo
  const enc = new TextEncoder();
  const data = enc.encode(password + params.salt + params.type + params.iterations);
  // Use SHA-256 as stand-in
  return `argon2${params.type.slice(-1)}$v=19$m=${params.memoryCost},t=${params.iterations},p=${params.parallelism}$${params.salt}$<pending-webcrypto>`;
}

export const PRESETS: Record<string, Argon2Params> = {
  "Low (interactive)": { type: "argon2id", memoryCost: 4096, iterations: 2, parallelism: 1, hashLength: 32, salt: "" },
  "Medium (recommended)": { type: "argon2id", memoryCost: 65536, iterations: 3, parallelism: 4, hashLength: 32, salt: "" },
  "High (sensitive)": { type: "argon2id", memoryCost: 262144, iterations: 5, parallelism: 8, hashLength: 32, salt: "" },
};
