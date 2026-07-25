/**
 * Password Policy Checker — pure logic.
 * Check password against configurable policy rules (length, complexity, history).
 */

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireLower: boolean;
  requireUpper: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
  minUnique: number;
  rejectCommon: boolean;
  rejectSequential: boolean;
  rejectRepeating: boolean;
  maxRepeating: number;
  history: string[]; // previous passwords to reject
}

export const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: 128,
  requireLower: true,
  requireUpper: true,
  requireDigit: true,
  requireSymbol: true,
  minUnique: 6,
  rejectCommon: true,
  rejectSequential: true,
  rejectRepeating: true,
  maxRepeating: 3,
  history: [],
};

export interface PolicyCheckResult {
  password: string;
  passed: boolean;
  checks: { id: string; label: string; passed: boolean; detail?: string }[];
  score: number; // 0-100
  suggestions: string[];
}

const COMMON_PASSWORDS = new Set([
  "123456", "password", "12345678", "qwerty", "abc123", "111111", "1234567",
  "123456789", "12345", "1234567890", "admin", "letmein", "welcome", "monkey",
  "dragon", "sunshine", "iloveyou", "princess", "football", "baseball",
]);

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export function checkPolicy(password: string, policy: PasswordPolicy = DEFAULT_POLICY): PolicyCheckResult {
  const checks: PolicyCheckResult["checks"] = [];
  const suggestions: string[] = [];

  checks.push({
    id: "length",
    label: `Length between ${policy.minLength} and ${policy.maxLength}`,
    passed: password.length >= policy.minLength && password.length <= policy.maxLength,
    detail: `current: ${password.length}`,
  });

  checks.push({
    id: "lower",
    label: "Contains lowercase letter",
    passed: !policy.requireLower || /[a-z]/.test(password),
  });

  checks.push({
    id: "upper",
    label: "Contains uppercase letter",
    passed: !policy.requireUpper || /[A-Z]/.test(password),
  });

  checks.push({
    id: "digit",
    label: "Contains digit",
    passed: !policy.requireDigit || /\d/.test(password),
  });

  checks.push({
    id: "symbol",
    label: "Contains symbol",
    passed: !policy.requireSymbol || /[^a-zA-Z0-9]/.test(password),
  });

  const unique = new Set(password).size;
  checks.push({
    id: "unique",
    label: `At least ${policy.minUnique} unique characters`,
    passed: unique >= policy.minUnique,
    detail: `current: ${unique}`,
  });

  const isCommon = COMMON_PASSWORDS.has(password.toLowerCase());
  checks.push({
    id: "common",
    label: "Not a common password",
    passed: !policy.rejectCommon || !isCommon,
  });

  let hasSequential = false;
  const lower = password.toLowerCase();
  for (let i = 0; i < lower.length - 2; i++) {
    const a = lower.charCodeAt(i);
    const b = lower.charCodeAt(i + 1);
    const c = lower.charCodeAt(i + 2);
    if (b === a + 1 && c === b + 1) { hasSequential = true; break; }
    if (b === a - 1 && c === b - 1) { hasSequential = true; break; }
  }
  checks.push({
    id: "sequential",
    label: "No sequential characters (abc, 123)",
    passed: !policy.rejectSequential || !hasSequential,
  });

  let maxRun = 1, run = 1;
  for (let i = 1; i < password.length; i++) {
    if (password[i] === password[i - 1]) { run++; maxRun = Math.max(maxRun, run); }
    else run = 1;
  }
  checks.push({
    id: "repeating",
    label: `No more than ${policy.maxRepeating} repeating characters`,
    passed: !policy.rejectRepeating || maxRun <= policy.maxRepeating,
    detail: `longest run: ${maxRun}`,
  });

  const inHistory = policy.history.some((h) => h === password);
  checks.push({
    id: "history",
    label: "Not in password history",
    passed: !inHistory,
  });

  // Keyboard walk check
  let hasKeyboardWalk = false;
  for (const row of KEYBOARD_ROWS) {
    for (let i = 0; i < row.length - 2; i++) {
      const slice = row.slice(i, i + 3);
      if (lower.includes(slice) || lower.includes(slice.split("").reverse().join(""))) {
        hasKeyboardWalk = true;
      }
    }
  }
  if (hasKeyboardWalk) {
    suggestions.push("Avoid keyboard walks (qwerty, asdf).");
  }

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const passed = checks.every((c) => c.passed);

  if (!checks[0].passed) suggestions.push(`Use ${policy.minLength}-${policy.maxLength} characters.`);
  if (!checks[1].passed) suggestions.push("Add lowercase letters.");
  if (!checks[2].passed) suggestions.push("Add uppercase letters.");
  if (!checks[3].passed) suggestions.push("Add digits.");
  if (!checks[4].passed) suggestions.push("Add symbols.");
  if (!checks[5].passed) suggestions.push("Add more unique characters.");
  if (isCommon) suggestions.push("This password is on a known common list — replace it.");

  return { password, passed, checks, score, suggestions };
}
