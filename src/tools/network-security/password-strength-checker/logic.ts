/**
 * Password Strength Checker — pure logic.
 * Uses Shannon entropy + pattern detection + common-password list.
 * No external libs (no zxcvbn) to keep bundle small.
 */

export interface PasswordAnalysis {
  password: string;
  length: number;
  entropy: number; // bits
  poolSize: number;
  poolDescription: string;
  classes: {
    lowercase: boolean;
    uppercase: boolean;
    digits: boolean;
    symbols: boolean;
    unicode: boolean;
  };
  patterns: { type: string; description: string; severity: "info" | "warning" | "danger" }[];
  isCommon: boolean;
  hasDictionaryWord: boolean;
  crackTime: { offlineFastHashing: string; offlineSlowHashing: string; onlineThrottled: string };
  score: 0 | 1 | 2 | 3 | 4;
  scoreLabel: string;
  suggestions: string[];
  perCharIssues: { index: number; char: string; issue: string }[];
}

// Top 100 most common passwords (simplified list — full 10k would be too large)
const COMMON_PASSWORDS = new Set([
  "123456", "password", "12345678", "qwerty", "123456789", "12345", "1234", "111111",
  "1234567", "dragon", "123123", "baseball", "abc123", "football", "monkey", "letmein",
  "shadow", "master", "666666", "qwertyuiop", "123321", "mustang", "1234567890",
  "michael", "654321", "superman", "1qaz2wsx", "7777777", "121212", "000000", "qazwsx",
  "123qwe", "killer", "trustno1", "jordan", "jennifer", "zxcvbnm", "asdfgh", "hunter",
  "buster", "soccer", "harley", "batman", "andrew", "tigger", "sunshine", "iloveyou",
  "2000", "charlie", "robert", "thomas", "hockey", "ranger", "daniel", "starwars",
  "klaster", "112233", "george", "computer", "michelle", "jessica", "pepper", "1111",
  "zxcvbn", "555555", "11111111", "131313", "freedom", "777777", "pass", "maggie",
  "159753", "aaaaaa", "ginger", "princess", "joshua", "cheese", "amanda", "summer",
  "love", "ashley", "nicole", "chelsea", "biteme", "matthew", "access", "yankees",
  "987654321", "dallas", "austin", "thunder", "taylor", "matrix", "mobilemail", "mom",
  "monitor", "monitoring", "montana", "moon", "moscow", "admin", "administrator",
  "root", "toor", "guest", "test", "demo", "secret", "letmein123", "welcome",
]);

// Common dictionary words (very short list for detection)
const DICTIONARY_WORDS = ["password", "qwerty", "letmein", "welcome", "admin", "login", "user", "hello", "love", "secret"];

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

function computePoolSize(classes: PasswordAnalysis["classes"]): { size: number; description: string } {
  let size = 0;
  const parts: string[] = [];
  if (classes.lowercase) { size += 26; parts.push("a-z (26)"); }
  if (classes.uppercase) { size += 26; parts.push("A-Z (26)"); }
  if (classes.digits) { size += 10; parts.push("0-9 (10)"); }
  if (classes.symbols) { size += 33; parts.push("symbols (33)"); }
  if (classes.unicode) { size += 100; parts.push("unicode (~100)"); }
  return { size: Math.max(size, 1), description: parts.join(" + ") || "empty" };
}

function detectPatterns(password: string): PasswordAnalysis["patterns"] {
  const patterns: PasswordAnalysis["patterns"] = [];
  const lower = password.toLowerCase();

  // Sequential digits (1234, 9876)
  for (let i = 0; i < lower.length - 2; i++) {
    const a = lower.charCodeAt(i);
    const b = lower.charCodeAt(i + 1);
    const c = lower.charCodeAt(i + 2);
    if (b === a + 1 && c === b + 1) {
      patterns.push({ type: "sequential", description: `Sequential characters at position ${i}: "${lower.slice(i, i + 3)}"`, severity: "warning" });
      break;
    }
    if (b === a - 1 && c === b - 1) {
      patterns.push({ type: "sequential", description: `Reverse sequential at position ${i}: "${lower.slice(i, i + 3)}"`, severity: "warning" });
      break;
    }
  }

  // Repeated characters (aaa, 111)
  for (let i = 0; i < lower.length - 2; i++) {
    if (lower[i] === lower[i + 1] && lower[i + 1] === lower[i + 2]) {
      patterns.push({ type: "repeated", description: `Repeated character "${lower[i]}" at position ${i}`, severity: "warning" });
      break;
    }
  }

  // Keyboard walk (qwerty, asdf, zxcv)
  for (const row of KEYBOARD_ROWS) {
    for (let i = 0; i < row.length - 2; i++) {
      const slice = row.slice(i, i + 3);
      if (lower.includes(slice)) {
        patterns.push({ type: "keyboard-walk", description: `Keyboard walk "${slice}" detected`, severity: "warning" });
      }
      const reversed = slice.split("").reverse().join("");
      if (lower.includes(reversed)) {
        patterns.push({ type: "keyboard-walk", description: `Reversed keyboard walk "${reversed}" detected`, severity: "warning" });
      }
    }
  }

  // All same character
  if (lower.length > 1 && lower.split("").every((c) => c === lower[0])) {
    patterns.push({ type: "all-same", description: "All characters are identical", severity: "danger" });
  }

  // Year pattern (1900-2099)
  if (/\b(19|20)\d{2}\b/.test(password)) {
    patterns.push({ type: "year", description: "Contains a year (1900-2099)", severity: "info" });
  }

  return patterns;
}

function leetNormalize(s: string): string {
  return s
    .replace(/@/g, "a")
    .replace(/3/g, "e")
    .replace(/1/g, "i")
    .replace(/0/g, "o")
    .replace(/\$/g, "s")
    .replace(/!/g, "i");
}

function hasDictionary(password: string): boolean {
  const lower = password.toLowerCase();
  const leet = leetNormalize(lower);
  return DICTIONARY_WORDS.some((word) => lower.includes(word) || leet.includes(word));
}

function formatCrackTime(entropyBits: number, guessesPerSecond: number): string {
  if (entropyBits <= 0) return "instant";
  const seconds = Math.pow(2, entropyBits) / 2 / guessesPerSecond; // average = half the keyspace
  if (seconds < 1) return "instant";
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 2592000) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 31536000) return `${Math.round(seconds / 2592000)} months`;
  const years = seconds / 31536000;
  if (years < 1000) return `${Math.round(years)} years`;
  if (years < 1_000_000) return `${Math.round(years / 1000)}K years`;
  if (years < 1_000_000_000) return `${Math.round(years / 1_000_000)}M years`;
  return `${(years / 1_000_000_000).toExponential(2)}B years`;
}

export function analyzePassword(password: string): PasswordAnalysis {
  const classes: PasswordAnalysis["classes"] = {
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digits: /\d/.test(password),
    symbols: /[^a-zA-Z0-9]/.test(password),
    unicode: /[^\x00-\x7F]/.test(password),
  };
  const pool = computePoolSize(classes);
  const entropy = password.length * Math.log2(pool.size);
  const patterns = detectPatterns(password);
  const isCommon = COMMON_PASSWORDS.has(password.toLowerCase()) || COMMON_PASSWORDS.has(leetNormalize(password.toLowerCase()));
  const hasDict = hasDictionary(password);

  // Crack time estimates
  const offlineFast = 10_000_000_000; // 10B guesses/sec (offline bcrypt with GPU)
  const offlineSlow = 10_000; // 10k guesses/sec (Argon2)
  const online = 10; // 10 guesses/sec (online throttled)

  // Score
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (entropy >= 28) score = 1;
  if (entropy >= 36) score = 2;
  if (entropy >= 60) score = 3;
  if (entropy >= 128) score = 4;
  if (isCommon) score = 0;
  if (patterns.some((p) => p.severity === "danger")) score = Math.min(score, 0) as 0;
  if (patterns.some((p) => p.severity === "warning")) score = Math.min(score, 2) as 0 | 1 | 2;
  if (hasDict) score = Math.min(score, 2) as 0 | 1 | 2;
  if (password.length < 8) score = Math.min(score, 1) as 0 | 1;

  const scoreLabel = ["Very weak", "Weak", "Fair", "Strong", "Very strong"][score]!;

  // Suggestions
  const suggestions: string[] = [];
  if (password.length < 12) suggestions.push("Use at least 12 characters.");
  if (!classes.uppercase) suggestions.push("Add uppercase letters.");
  if (!classes.lowercase) suggestions.push("Add lowercase letters.");
  if (!classes.digits) suggestions.push("Add digits.");
  if (!classes.symbols) suggestions.push("Add symbols (!@#$%^&*).");
  if (isCommon) suggestions.push("This is a known common password — change it immediately.");
  if (hasDict) suggestions.push("Contains a dictionary word — consider a passphrase instead.");
  if (patterns.some((p) => p.type === "sequential")) suggestions.push("Avoid sequential characters (123, abc).");
  if (patterns.some((p) => p.type === "repeated")) suggestions.push("Avoid repeated characters (aaa, 111).");
  if (patterns.some((p) => p.type === "keyboard-walk")) suggestions.push("Avoid keyboard walks (qwerty, asdf).");
  if (patterns.some((p) => p.type === "year")) suggestions.push("Avoid years — they're easy to guess.");

  // Per-char issues
  const perCharIssues: { index: number; char: string; issue: string }[] = [];
  for (let i = 0; i < password.length; i++) {
    const ch = password[i]!;
    if (i > 0 && ch === password[i - 1]) perCharIssues.push({ index: i, char: ch, issue: "Repeats previous char" });
  }

  return {
    password,
    length: password.length,
    entropy: Math.round(entropy * 10) / 10,
    poolSize: pool.size,
    poolDescription: pool.description,
    classes,
    patterns,
    isCommon,
    hasDictionaryWord: hasDict,
    crackTime: {
      offlineFastHashing: formatCrackTime(entropy, offlineFast),
      offlineSlowHashing: formatCrackTime(entropy, offlineSlow),
      onlineThrottled: formatCrackTime(entropy, online),
    },
    score,
    scoreLabel,
    suggestions,
    perCharIssues,
  };
}

/** Batch analysis. */
export function analyzeBatch(passwords: string[]): PasswordAnalysis[] {
  return passwords.map(analyzePassword);
}

/** Batch to CSV. */
export function batchToCsv(results: PasswordAnalysis[]): string {
  const lines = ["Password,Length,Entropy,Score,ScoreLabel,IsCommon,HasDictWord,CrackTimeFast,CrackTimeSlow,CrackTimeOnline"];
  for (const r of results) {
    const escapedPw = `"${r.password.replace(/"/g, '""')}"`;
    lines.push(`${escapedPw},${r.length},${r.entropy},${r.score},${r.scoreLabel},${r.isCommon ? "yes" : "no"},${r.hasDictionaryWord ? "yes" : "no"},${r.crackTime.offlineFastHashing},${r.crackTime.offlineSlowHashing},${r.crackTime.onlineThrottled}`);
  }
  return lines.join("\n");
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// F075 SENSITIVE MODE: no history, no drafts, no URL state for passwords.
// ============================================================================

/**
 * Password strength score 0-100 based on multiple factors.
 */
export function scorePassword(password: string): {
  score: number;
  grade: "F" | "D" | "C" | "B" | "A";
  label: string;
} {
  if (!password) return { score: 0, grade: "F", label: "Empty" };
  let score = 0;
  // Length scoring (up to 40)
  score += Math.min(40, password.length * 2);
  // Character variety (up to 30)
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  score += [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length * 7.5;
  // Entropy bonus (up to 30)
  const pool = (hasLower ? 26 : 0) + (hasUpper ? 26 : 0) + (hasDigit ? 10 : 0) + (hasSymbol ? 32 : 0);
  const entropy = password.length * Math.log2(Math.max(2, pool));
  score += Math.min(30, entropy / 3);
  // Penalize common patterns
  if (/(.)\1{2,}/.test(password)) score -= 10; // repeated chars
  if (/^(123|abc|qwe|password|admin|letmein)/i.test(password)) score -= 20;
  score = Math.max(0, Math.min(100, Math.round(score)));
  let grade: "F" | "D" | "C" | "B" | "A";
  let label: string;
  if (score >= 90) { grade = "A"; label = "Very strong"; }
  else if (score >= 75) { grade = "B"; label = "Strong"; }
  else if (score >= 50) { grade = "C"; label = "Fair"; }
  else if (score >= 25) { grade = "D"; label = "Weak"; }
  else { grade = "F"; label = "Very weak"; }
  return { score, grade, label };
}

/**
 * Common password patterns to detect.
 * Note: the original `detectPatterns` is a private function above; this
 * is a new exported version that returns a richer structure.
 */
export function detectPasswordPatterns(password: string): Array<{ pattern: string; matched: boolean; severity: "info" | "warn" | "fail" }> {
  return [
    { pattern: "Sequential digits (1234)", matched: /(?:0123|1234|2345|3456|4567|5678|6789)/.test(password), severity: "warn" },
    { pattern: "Sequential letters (abcd)", matched: /(?:abcd|bcde|cdef|wxyz|zyxw)/i.test(password), severity: "warn" },
    { pattern: "Keyboard walk (qwerty)", matched: /(?:qwerty|asdf|zxcv|qazwsx)/i.test(password), severity: "warn" },
    { pattern: "Repeated characters (aaa)", matched: /(.)\1{2,}/.test(password), severity: "warn" },
    { pattern: "Common word: password", matched: /password/i.test(password), severity: "fail" },
    { pattern: "Common word: admin", matched: /admin/i.test(password), severity: "fail" },
    { pattern: "Common word: letmein", matched: /letmein/i.test(password), severity: "fail" },
    { pattern: "Year (1900-2099)", matched: /(?:19|20)\d{2}/.test(password), severity: "info" },
    { pattern: "All digits", matched: /^\d+$/.test(password), severity: "warn" },
    { pattern: "All letters", matched: /^[a-zA-Z]+$/.test(password), severity: "info" },
  ];
}

export interface ValidationReport {
  level: "pass" | "warn" | "fail";
  code: string;
  message: string;
}

export function validatePasswordInput(password: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!password) {
    reports.push({ level: "fail", code: "EMPTY", message: "Password is empty." });
    return reports;
  }
  const { score, grade, label } = scorePassword(password);
  if (grade === "F" || grade === "D") {
    reports.push({ level: "fail", code: "WEAK", message: `Password is ${label.toLowerCase()} (score ${score}/100).` });
  } else if (grade === "C") {
    reports.push({ level: "warn", code: "FAIR", message: `Password is fair (score ${score}/100) — consider strengthening.` });
  } else {
    reports.push({ level: "pass", code: "STRONG", message: `Password is ${label.toLowerCase()} (score ${score}/100).` });
  }
  const patterns = detectPasswordPatterns(password);
  for (const p of patterns) {
    if (p.matched) {
      reports.push({
        level: p.severity === "fail" ? "fail" : p.severity === "warn" ? "warn" : "pass",
        code: "PATTERN",
        message: `Detected: ${p.pattern}`,
      });
    }
  }
  return reports;
}

export interface Receipt {
  tool: string;
  version: string;
  timestamp: string;
  inputFingerprint: string;
}

export function buildReceipt(password: string): Receipt {
  const s = password.length + ":" + password.length * password.charCodeAt(0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return {
    tool: "password-strength-checker",
    version: "100x.1.0",
    timestamp: new Date().toISOString(),
    inputFingerprint: (h >>> 0).toString(16).padStart(8, "0"),
  };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "NIST-800-63B", citation: "NIST SP 800-63B (2017)", summary: "Digital Identity Guidelines — password strength metrics." },
  { id: "zxcvbn", citation: "Dropbox zxcvbn (2012)", summary: "Low-budget password strength estimation." },
  { id: "OWASP-Auth", citation: "OWASP Authentication Cheat Sheet", summary: "Password storage and strength guidelines." },
];
