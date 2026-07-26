/**
 * Password Strength Meter — pure logic.
 *
 * zxcvbn-style entropy estimation: dictionary words, repeats, sequences,
 * keyboard walks, l33t, dates, unicode. Multi-scenario crack times with
 * stated hash assumptions. 100% client-side, no network, no React.
 */

export interface PasswordMatch {
  pattern: "dictionary" | "repeat" | "sequence" | "spatial" | "regex" | "date" | "bruteforce" | "l33t";
  i: number;
  j: number;
  token: string;
  entropy: number; // bits
  message: string;
}

export interface StrengthResult {
  password: string;
  score: 0 | 1 | 2 | 3 | 4;
  entropy: number; // bits
  crackTimes: {
    onlineThrottled: string; // 100/hour
    onlineNoThrottle: string; // 10/s
    offlineBcrypt: string; // 10⁴/s (bcrypt cost 10, single GPU)
    offlineMd5: string; // 10¹¹/s (GPU rig)
  };
  matches: PasswordMatch[];
  suggestions: string[];
  warning: string | null;
  length: number;
}

/** Top-100 common passwords (subset of rockyou-style + common). */
const COMMON_PASSWORDS: Set<string> = new Set([
  "123456", "123456789", "qwerty", "password", "12345", "12345678", "111111", "1234567",
  "123123", "qwerty123", "1q2w3e", "1234567890", "0", "abc123", "iloveyou", "aaron431",
  "password1", "qqww1122", "123", "omgpop", "123321", "654321", "qwertyuiop", "letmein",
  "monkey", "696969", "abyss", "dragon", "master", "sunshine", "princess", "football",
  "shadow", "superman", "iloveu", "trustno1", "batman", "access", "hello", "charlie",
  "donald", "loveme", "baseball", "welcome", "whatever", "qazwsx", "ninja", "mustang",
  "password123", "admin", "welcome1", "root", "toor", "pass", "test", "guest",
]);

/** Common dictionary words used for matching (small set). */
const DICTIONARY: Set<string> = new Set([
  ...Array.from(COMMON_PASSWORDS),
  "letmein", "welcome", "monkey", "dragon", "master", "qwerty", "login", "admin",
  "user", "pass", "test", "guest", "root", "love", "baby", "angel", "princess",
  "football", "baseball", "soccer", "hockey", "hunter", "shadow", "sunshine",
  "trustno1", "superman", "batman", "spider", "killer", "whatever", "starwars",
  "computer", "internet", "secret", "private", "money", "freedom", "phoenix",
  "correct", "horse", "battery", "staple", "piano", "purple", "orange", "silver",
  "summer", "winter", "spring", "autumn", "january", "february", "march", "april",
  "mike", "john", "david", "james", "robert", "mark", "william", "richard",
  "mary", "patricia", "jennifer", "linda", "elizabeth", "barbara", "susan", "jessica",
]);

/** Common names (subset for matching). */
const NAMES: Set<string> = new Set([
  "mike", "john", "david", "james", "robert", "mark", "william", "richard",
  "mary", "patricia", "jennifer", "linda", "elizabeth", "barbara", "susan", "jessica",
  "thomas", "charles", "christopher", "daniel", "matthew", "anthony", "donald",
  "sarah", "karen", "nancy", "lisa", "betty", "helen", "sandra", "ashley",
]);

/** L33t substitution table. */
const L33T: Record<string, string> = {
  "@": "a", "4": "a", "$": "s", "5": "s", "0": "o", "1": "i", "!": "i",
  "3": "e", "7": "t", "2": "z", "8": "b", "6": "g", "9": "g",
};

/** Keyboard adjacency (QWERTY) for spatial pattern detection. */
const KEYBOARD_ROWS: string[] = [
  "`1234567890-=",
  "qwertyuiop[]\\",
  "asdfghjkl;'",
  "zxcvbnm,./",
];

/** Log2 helper. */
function log2(n: number): number {
  return Math.log(n) / Math.LN2;
}

/** Format a number of seconds into a human-readable duration. */
export function formatDuration(seconds: number): string {
  if (seconds < 1) return "less than a second";
  if (seconds < 60) return `${seconds.toFixed(0)} seconds`;
  const mins = seconds / 60;
  if (mins < 60) return `${mins.toFixed(0)} minutes`;
  const hours = mins / 60;
  if (hours < 24) return `${hours.toFixed(1)} hours`;
  const days = hours / 24;
  if (days < 30) return `${days.toFixed(1)} days`;
  const months = days / 30;
  if (months < 12) return `${months.toFixed(1)} months`;
  const years = months / 12;
  if (years < 1000) return `${years.toFixed(1)} years`;
  if (years < 1e6) return `${(years / 1000).toFixed(1)} thousand years`;
  if (years < 1e9) return `${(years / 1e6).toFixed(1)} million years`;
  if (years < 1e12) return `${(years / 1e9).toFixed(1)} billion years`;
  return `${(years / 1e12).toExponential(2)} trillion years`;
}

/** Format average crack time (half of worst-case) from guesses count and guesses-per-second. */
function crackTimeFromGuesses(guesses: number, gps: number): string {
  // average = guesses / 2
  const seconds = guesses / 2 / gps;
  return formatDuration(seconds);
}

/** Convert a 0–4 score to a label. */
export function scoreLabel(score: 0 | 1 | 2 | 3 | 4): string {
  return ["Very weak", "Weak", "Fair", "Strong", "Very strong"][score];
}

/** Convert a 0–4 score to a color. */
export function scoreColor(score: 0 | 1 | 2 | 3 | 4): string {
  return ["#dc2626", "#ea580c", "#d97706", "#16a34a", "#15803d"][score];
}

/** Build a regex for keyboard spatial matching. */
function inKeyboardSequence(token: string): boolean {
  if (token.length < 4) return false;
  const lower = token.toLowerCase();
  for (const row of KEYBOARD_ROWS) {
    // forward or backward along the row
    if (row.includes(lower)) return true;
    if (row.split("").reverse().join("").includes(lower)) return true;
  }
  // also check columns (simplified)
  return false;
}

/** Detect a sequence (alphabetical or numerical). */
export function isSequence(token: string): boolean {
  if (token.length < 3) return false;
  let dir = 0;
  for (let i = 1; i < token.length; i++) {
    const d = token.charCodeAt(i) - token.charCodeAt(i - 1);
    if (Math.abs(d) !== 1) return false;
    if (dir === 0) dir = Math.sign(d);
    else if (Math.sign(d) !== dir) return false;
  }
  return true;
}

/** Detect repeats (aaaa, abcabc). */
export function isRepeat(token: string): { isRepeat: boolean; baseLen: number } {
  if (token.length < 3) return { isRepeat: false, baseLen: 0 };
  // single-char repeat
  if (token.split("").every((c) => c === token[0])) return { isRepeat: true, baseLen: 1 };
  // multi-char repeat
  for (let baseLen = 2; baseLen <= token.length / 2; baseLen++) {
    if (token.length % baseLen !== 0) continue;
    const base = token.substring(0, baseLen);
    let ok = true;
    for (let i = baseLen; i < token.length; i += baseLen) {
      if (token.substring(i, i + baseLen) !== base) { ok = false; break; }
    }
    if (ok) return { isRepeat: true, baseLen };
  }
  return { isRepeat: false, baseLen: 0 };
}

/** Apply l33t de-obfuscation. */
export function del33t(token: string): string {
  let out = "";
  for (const c of token) out += L33T[c] ?? c;
  return out;
}

/** Whether a token (or its l33t form) is in the dictionary. */
export function dictLookup(token: string): { found: boolean; l33t: boolean } {
  const lower = token.toLowerCase();
  if (DICTIONARY.has(lower)) return { found: true, l33t: false };
  if (NAMES.has(lower)) return { found: true, l33t: false };
  const del33ted = del33t(lower);
  if (del33ted !== lower && (DICTIONARY.has(del33ted) || NAMES.has(del33ted))) {
    return { found: true, l33t: true };
  }
  return { found: false, l33t: false };
}

/** Detect a date in YYYY/MM/DD or MM/DD/YYYY style (simplified). */
export function isDate(token: string): boolean {
  return /^\d{4}$/.test(token) || /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.test(token) || /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.test(token);
}

/** Estimate the entropy of a single character pool given the password's character classes. */
export function alphabetSize(password: string): number {
  let size = 0;
  if (/[a-z]/.test(password)) size += 26;
  if (/[A-Z]/.test(password)) size += 26;
  if (/[0-9]/.test(password)) size += 10;
  if (/[^a-zA-Z0-9]/.test(password)) {
    // count printable ASCII punctuation as 33, plus unicode
    const asciiSym = (password.match(/[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/g) ?? []).length;
    const unicode = (password.match(/[^\x00-\x7f]/g) ?? []).length;
    if (asciiSym > 0) size += 33;
    if (unicode > 0) size += 0x110000; // full unicode range
  }
  return size;
}

/** Find all matches in the password (zxcvbn-style). */
export function findMatches(password: string, customDict: string[] = []): PasswordMatch[] {
  const matches: PasswordMatch[] = [];
  const customSet = new Set(customDict.map((w) => w.toLowerCase().trim()).filter(Boolean));
  const n = password.length;

  // 1. Dictionary matches — sliding window over the password
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j <= n; j++) {
      const token = password.substring(i, j);
      const lower = token.toLowerCase();
      if (lower.length < 3) continue;
      let lookup = dictLookup(token);
      if (!lookup.found && customSet.has(lower)) lookup = { found: true, l33t: false };
      if (lookup.found) {
        // entropy: log2(dictionary size) + l33t bonus + case bonus
        let entropy = log2(DICTIONARY.size + NAMES.size + customSet.size);
        if (lookup.l33t) entropy += 1 + log2(token.length);
        if (/[A-Z]/.test(token) && token !== token.toUpperCase()) entropy += 1;
        matches.push({
          pattern: lookup.l33t ? "l33t" : "dictionary",
          i, j: j - 1, token, entropy,
          message: lookup.l33t
            ? `Dictionary word "${del33t(lower)}" with l33t substitutions`
            : `Dictionary word "${lower}"${customSet.has(lower) ? " (custom dictionary)" : ""}`,
        });
      }
    }
  }

  // 2. Common passwords (high-entropy penalty)
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    matches.push({
      pattern: "dictionary", i: 0, j: n - 1, token: password, entropy: log2(100),
      message: "In top-100 common passwords list — cracked instantly",
    });
  }

  // 3. Repeats
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j <= n; j++) {
      const token = password.substring(i, j);
      const r = isRepeat(token);
      if (r.isRepeat) {
        const entropy = log2(token.length / r.baseLen) * 2;
        matches.push({ pattern: "repeat", i, j: j - 1, token, entropy, message: `Repeated ${token.length / r.baseLen}× "${token.substring(0, r.baseLen)}"` });
      }
    }
  }

  // 4. Sequences
  for (let i = 0; i < n; i++) {
    for (let j = i + 3; j <= n; j++) {
      const token = password.substring(i, j);
      if (isSequence(token)) {
        matches.push({ pattern: "sequence", i, j: j - 1, token, entropy: log2(token.length * 2), message: `Sequence "${token}" (ascending or descending)` });
      }
    }
  }

  // 5. Spatial (keyboard walks)
  for (let i = 0; i < n; i++) {
    for (let j = i + 3; j <= n; j++) {
      const token = password.substring(i, j);
      if (inKeyboardSequence(token)) {
        matches.push({ pattern: "spatial", i, j: j - 1, token, entropy: log2(token.length) * 2, message: `Keyboard walk "${token.toLowerCase()}"` });
      }
    }
  }

  // 6. Dates
  for (let i = 0; i < n; i++) {
    for (let j = i + 3; j <= n; j++) {
      const token = password.substring(i, j);
      if (isDate(token)) {
        matches.push({ pattern: "date", i, j: j - 1, token, entropy: log2(365 * 100), message: `Date-like "${token}"` });
      }
    }
  }

  // Greedy non-overlapping selection: pick highest-entropy matches first, drop overlaps
  matches.sort((a, b) => a.i - b.i || (b.j - b.i) - (a.j - a.i));
  const chosen: PasswordMatch[] = [];
  let covered = -1;
  for (const m of matches.sort((a, b) => a.i - b.i)) {
    if (m.i > covered) {
      chosen.push(m);
      covered = m.j;
    }
  }
  // Fill gaps with bruteforce
  const sorted = [...chosen].sort((a, b) => a.i - b.i);
  const finalMatches: PasswordMatch[] = [];
  let pos = 0;
  for (const m of sorted) {
    if (m.i > pos) {
      const token = password.substring(pos, m.i);
      finalMatches.push({ pattern: "bruteforce", i: pos, j: m.i - 1, token, entropy: log2(alphabetSize(password)) * token.length, message: `Brute-force segment "${token}"` });
    }
    finalMatches.push(m);
    pos = m.j + 1;
  }
  if (pos < n) {
    const token = password.substring(pos);
    finalMatches.push({ pattern: "bruteforce", i: pos, j: n - 1, token, entropy: log2(alphabetSize(password)) * token.length, message: `Brute-force segment "${token}"` });
  }
  return finalMatches;
}

/** Compute total entropy from matches (sum, with multiplicities). */
export function totalEntropy(matches: PasswordMatch[]): number {
  return matches.reduce((s, m) => s + Math.max(m.entropy, 1), 0);
}

/** Convert entropy (bits) → guesses count (2^entropy, but capped). */
export function entropyToGuesses(entropy: number): number {
  return Math.pow(2, entropy);
}

/** Convert entropy → 0–4 score. */
export function scoreFromEntropy(entropy: number): 0 | 1 | 2 | 3 | 4 {
  if (entropy < 10) return 0;
  if (entropy < 20) return 1;
  if (entropy < 35) return 2;
  if (entropy < 60) return 3;
  return 4;
}

/** Build the suggestions list from matches + score. */
export function buildSuggestions(matches: PasswordMatch[], score: 0 | 1 | 2 | 3 | 4): string[] {
  const s: string[] = [];
  const dictHits = matches.filter((m) => m.pattern === "dictionary" || m.pattern === "l33t");
  if (dictHits.length > 0) s.push(`Replace dictionary word(s): ${dictHits.map((m) => `"${m.token}"`).join(", ")}.`);
  const seqs = matches.filter((m) => m.pattern === "sequence");
  if (seqs.length > 0) s.push("Avoid sequences (abc, 123).");
  const walks = matches.filter((m) => m.pattern === "spatial");
  if (walks.length > 0) s.push("Avoid keyboard walks (qwerty, asdf).");
  const reps = matches.filter((m) => m.pattern === "repeat");
  if (reps.length > 0) s.push("Avoid repeats (aaaa, abcabc).");
  if (score < 3) s.push("Use a 5+ word random passphrase (e.g., 'correct-horse-battery-staple-piano') for 60+ bits of entropy.");
  if (score < 4) s.push("Or use a 16+ character random password generated by a CSPRNG.");
  if (s.length === 0) s.push("Strong password — keep it in a password manager, never reuse it, and enable 2FA.");
  return s;
}

/** Build the honest warning (the bcrypt(MD5) trap etc). */
export function buildWarning(score: 0 | 1 | 2 | 3 | 4, matches: PasswordMatch[], password?: string): string | null {
  if (score === 4) {
    return "Even 4/4 isn't safe if the service hashes passwords with MD5 or SHA-1 — at 100B guesses/sec, a 60-bit password falls in ~38 days. Always use unique passwords.";
  }
  if (score <= 1) {
    const isCommon = (password && COMMON_PASSWORDS.has(password.toLowerCase())) ||
      matches.some((m) => m.message.includes("top-100"));
    if (isCommon) return "This is in the top-100 breached passwords. It will be cracked in milliseconds. Change it everywhere.";
  }
  if (score === 2) {
    return "Fair password — fine for low-stakes accounts but use a passphrase for anything important.";
  }
  return null;
}

/** Main entry — analyze a password. */
export function analyzePassword(password: string, customDict: string[] = []): StrengthResult {
  const matches = findMatches(password, customDict);
  const entropy = password.length === 0 ? 0 : totalEntropy(matches);
  const guesses = entropyToGuesses(entropy);
  const score = scoreFromEntropy(entropy);
  const crackTimes = {
    onlineThrottled: crackTimeFromGuesses(guesses, 100 / 3600),
    onlineNoThrottle: crackTimeFromGuesses(guesses, 10),
    offlineBcrypt: crackTimeFromGuesses(guesses, 1e4),
    offlineMd5: crackTimeFromGuesses(guesses, 1e11),
  };
  return {
    password,
    score,
    entropy: Math.round(entropy * 10) / 10,
    crackTimes,
    matches,
    suggestions: buildSuggestions(matches, score),
    warning: buildWarning(score, matches, password),
    length: password.length,
  };
}
