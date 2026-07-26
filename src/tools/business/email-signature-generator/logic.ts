/**
 * Email Signature Generator — pure logic.
 *
 * Generates a portable HTML email signature from structured inputs.
 * Output is a single `<table>` block (the only layout reliably
 * supported across email clients) plus an inline-CSS variant.
 */

export interface SocialLink {
  type: "linkedin" | "twitter" | "github" | "website" | "instagram" | "facebook" | "youtube";
  url: string;
}

export interface SignatureInput {
  name: string;
  title?: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  social?: SocialLink[];
  /** Optional photo / logo URL. */
  photoUrl?: string;
  /** Accent colour (hex). */
  accentColor?: string;
  /** Tagline shown under the name. */
  tagline?: string;
}

export interface SignatureResult {
  html: string;
  htmlInline: string;
  text: string;
  config: SignatureInput;
  warnings: string[];
}

const SOCIAL_LABELS: Record<SocialLink["type"], string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
  github: "GitHub",
  website: "Website",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
};

function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidUrl(url: string): boolean {
  try { new URL(url); return true; } catch { return false; }
}

export function generateSignature(input: SignatureInput): SignatureResult | { error: string } {
  if (!input.name || input.name.trim().length === 0) return { error: "Name is required." };
  const warnings: string[] = [];
  if (input.email && !isValidEmail(input.email)) warnings.push(`Email "${input.email}" does not look valid.`);
  if (input.website && !isValidUrl(input.website)) warnings.push(`Website "${input.website}" is not a valid URL.`);
  if (input.photoUrl && !isValidUrl(input.photoUrl)) warnings.push(`Photo URL "${input.photoUrl}" is not a valid URL.`);
  for (const s of input.social ?? []) {
    if (!isValidUrl(s.url)) warnings.push(`Social link for ${SOCIAL_LABELS[s.type]} is not a valid URL.`);
  }

  const accent = input.accentColor ?? "#2563eb";
  const safeName = esc(input.name);
  const safeTitle = input.title ? esc(input.title) : "";
  const safeCompany = input.company ? esc(input.company) : "";
  const safeEmail = input.email ? esc(input.email) : "";
  const safePhone = input.phone ? esc(input.phone) : "";
  const safeWebsite = input.website ? esc(input.website) : "";
  const safeAddress = input.address ? esc(input.address) : "";
  const safeTagline = input.tagline ? esc(input.tagline) : "";
  const safePhoto = input.photoUrl ? esc(input.photoUrl) : "";

  // HTML table-based signature (most email-client-friendly)
  const rows: string[] = [];
  if (safeTitle || safeCompany) {
    rows.push(`<tr><td style="color:#475569;font-size:12px;">${safeTitle}${safeTitle && safeCompany ? " · " : ""}${safeCompany}</td></tr>`);
  }
  if (safeTagline) rows.push(`<tr><td style="color:#64748b;font-size:11px;font-style:italic;padding-top:4px;">${safeTagline}</td></tr>`);
  if (safeEmail) rows.push(`<tr><td style="font-size:12px;padding-top:8px;"><a href="mailto:${safeEmail}" style="color:${accent};text-decoration:none;">${safeEmail}</a></td></tr>`);
  if (safePhone) rows.push(`<tr><td style="font-size:12px;"><a href="tel:${safePhone.replace(/\s/g, "")}" style="color:${accent};text-decoration:none;">${safePhone}</a></td></tr>`);
  if (safeWebsite) rows.push(`<tr><td style="font-size:12px;"><a href="${safeWebsite}" style="color:${accent};text-decoration:none;">${safeWebsite.replace(/^https?:\/\//, "")}</a></td></tr>`);
  if (safeAddress) rows.push(`<tr><td style="color:#64748b;font-size:11px;padding-top:4px;">${safeAddress}</td></tr>`);
  if (input.social && input.social.length > 0) {
    const links = input.social.map((s) => `<a href="${esc(s.url)}" style="color:${accent};text-decoration:none;margin-right:8px;font-size:11px;">${SOCIAL_LABELS[s.type]}</a>`).join("");
    rows.push(`<tr><td style="padding-top:8px;">${links}</td></tr>`);
  }

  const photoCell = safePhoto
    ? `<td style="vertical-align:top;padding-right:12px;"><img src="${safePhoto}" alt="${safeName}" width="80" height="80" style="border-radius:8px;width:80px;height:80px;object-fit:cover;"/></td>`
    : "";

  const html = `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;max-width:480px;">
  <tr>
    ${photoCell}
    <td style="vertical-align:top;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr><td style="font-size:16px;font-weight:bold;color:#0f172a;">${safeName}</td></tr>
        ${rows.join("\n        ")}
      </table>
    </td>
  </tr>
</table>`;

  // Plain text variant
  const textLines: string[] = [input.name];
  if (input.title || input.company) textLines.push(`${input.title ?? ""}${input.title && input.company ? " · " : ""}${input.company ?? ""}`);
  if (input.tagline) textLines.push(input.tagline);
  if (input.email) textLines.push(`Email: ${input.email}`);
  if (input.phone) textLines.push(`Phone: ${input.phone}`);
  if (input.website) textLines.push(`Web: ${input.website}`);
  if (input.address) textLines.push(input.address);
  if (input.social && input.social.length > 0) {
    textLines.push(input.social.map((s) => `${SOCIAL_LABELS[s.type]}: ${s.url}`).join("\n"));
  }
  const text = textLines.join("\n");

  // Inline-styled variant (no nested tables — for clients that strip them)
  const htmlInline = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;padding:12px;border-left:3px solid ${accent};">
  <div style="font-size:16px;font-weight:bold;color:#0f172a;">${safeName}</div>
  ${safeTitle || safeCompany ? `<div style="color:#475569;font-size:12px;">${safeTitle}${safeTitle && safeCompany ? " · " : ""}${safeCompany}</div>` : ""}
  ${safeTagline ? `<div style="color:#64748b;font-size:11px;font-style:italic;">${safeTagline}</div>` : ""}
  ${safeEmail ? `<div style="margin-top:8px;font-size:12px;"><a href="mailto:${safeEmail}" style="color:${accent};text-decoration:none;">${safeEmail}</a></div>` : ""}
  ${safePhone ? `<div style="font-size:12px;"><a href="tel:${safePhone.replace(/\s/g, "")}" style="color:${accent};text-decoration:none;">${safePhone}</a></div>` : ""}
  ${safeWebsite ? `<div style="font-size:12px;"><a href="${safeWebsite}" style="color:${accent};text-decoration:none;">${safeWebsite.replace(/^https?:\/\//, "")}</a></div>` : ""}
  ${safeAddress ? `<div style="color:#64748b;font-size:11px;">${safeAddress}</div>` : ""}
  ${input.social && input.social.length > 0 ? `<div style="margin-top:8px;">${input.social.map((s) => `<a href="${esc(s.url)}" style="color:${accent};text-decoration:none;margin-right:8px;font-size:11px;">${SOCIAL_LABELS[s.type]}</a>`).join("")}</div>` : ""}
</div>`;

  return { html, htmlInline, text, config: input, warnings };
}

/** Return the friendly label for a social type. */
export function socialLabel(type: SocialLink["type"]): string {
  return SOCIAL_LABELS[type];
}

/** Return all supported social types. */
export function supportedSocialTypes(): SocialLink["type"][] {
  return Object.keys(SOCIAL_LABELS) as SocialLink["type"][];
}
