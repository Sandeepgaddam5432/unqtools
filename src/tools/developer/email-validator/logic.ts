/**
 * Email Validator — pure logic, fully offline.
 * Standards-aware syntax + format validation (RFC 5322 subset), no network.
 */

export interface EmailResult {
  email: string;
  valid: boolean;
  errors: string[];
}

/** A curated subset of the real IANA top-level domains. */
export const COMMON_TLDS = new Set([
  "com", "org", "net", "edu", "gov", "mil", "int", "io", "dev", "app", "co",
  "uk", "us", "in", "ca", "au", "de", "fr", "es", "it", "nl", "se", "no",
  "jp", "cn", "kr", "sg", "hk", "tw", "br", "mx", "ar", "za", "ng", "eg",
  "ae", "sa", "ru", "pl", "ch", "at", "be", "dk", "fi", "ie", "nz", "id",
  "th", "vn", "ph", "my", "nz", "pt", "gr", "il", "tr", "ua", "ro", "bg",
  "cz", "sk", "hu", "hr", "si", "rs", "ee", "lv", "lt",
]);

const LOCAL_ALLOWED = new Set(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.!#$%&'*+/=?^_`{|}~-".split(""),
);
const DOMAIN_ALLOWED = new Set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.".split(""));

export function validateEmail(email: string): EmailResult {
  const errors: string[] = [];
  const trimmed = email.trim();

  if (!trimmed) {
    return { email: trimmed, valid: false, errors: ["Email is empty."] };
  }

  if (trimmed.length > 254) {
    errors.push(`Length ${trimmed.length} exceeds the 254 max.`);
  }

  const atParts = trimmed.split("@");
  if (atParts.length !== 2) {
    return { email: trimmed, valid: false, errors: ["Must contain exactly one '@'."] };
  }
  const [local, domain] = atParts;

  if (!local) errors.push("Missing local part (before '@').");
  else if (local.length > 64) errors.push(`Local part ${local.length} chars exceeds 64 max.`);
  else if (/^\.|\.$|\.\./.test(local)) errors.push("Local part has invalid '.' placement.");
  else {
    for (const ch of local) {
      if (!LOCAL_ALLOWED.has(ch)) {
        errors.push(`Invalid character '${ch}' in local part.`);
        break;
      }
    }
  }

  if (!domain) errors.push("Missing domain (after '@').");
  else {
    if (domain.length > 253) errors.push(`Domain ${domain.length} chars exceeds 253 max.`);
    if (!/^[a-zA-Z0-9.-]+$/.test(domain)) errors.push("Domain has invalid characters.");
    if (domain.startsWith("-") || domain.endsWith("-")) errors.push("Domain segment cannot start/end with '-'.");
    const labels = domain.split(".");
    if (labels.length < 2) errors.push("Domain needs at least two labels (e.g. example.com).");
    else {
      const tld = labels[labels.length - 1].toLowerCase();
      if (!/^[a-z]{2,}$/i.test(tld)) errors.push(`TLD '${tld}' must be 2+ letters.`);
      else if (!COMMON_TLDS.has(tld)) {
        errors.push(`TLD '.${tld}' not recognized (valid common TLD).`);
      }
    }
    for (const label of labels) {
      if (label.length > 63) errors.push(`Domain label '${label}' exceeds 63 chars.`);
    }
  }

  return { email: trimmed, valid: errors.length === 0, errors };
}

/** Validate a batch (one email per line). */
export function validateEmailList(input: string): EmailResult[] {
  return input
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(validateEmail);
}

/** Build a CSV of results. */
export function resultsToCsv(results: EmailResult[]): string {
  const header = "email,valid,errors";
  const rows = results.map((r) => {
    const email = r.email.replace(/"/g, '""');
    const errs = r.errors.join("; ").replace(/"/g, '""');
    return `"${email}",${r.valid},"${errs}"`;
  });
  return [header, ...rows].join("\n");
}

/** Summarize a batch. */
export function summarize(results: EmailResult[]): { total: number; valid: number; invalid: number } {
  const valid = results.filter((r) => r.valid).length;
  return { total: results.length, valid, invalid: results.length - valid };
}
