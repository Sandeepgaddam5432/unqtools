/**
 * Business Card Maker — pure logic.
 * Layout calculations and vCard generation for a business card.
 */

export interface CardInput {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  accent: string; // hex color
  layout: "modern" | "classic" | "minimal";
}

export const DEFAULT_INPUT: CardInput = {
  name: "Jane Doe",
  title: "Product Manager",
  company: "Acme Inc.",
  email: "jane@acme.com",
  phone: "+1 555 0100",
  website: "acme.com",
  address: "100 Market St, San Francisco, CA",
  accent: "#2563eb",
  layout: "modern",
};

export interface CardLayout {
  widthMm: number;
  heightMm: number;
  safeMarginMm: number;
  fieldPositions: Record<keyof CardInput, { x: number; y: number }>;
}

/** Compute layout positions in mm for a 90×50 mm card. */
export function computeLayout(layout: CardInput["layout"]): CardLayout {
  const base: CardLayout = {
    widthMm: 90,
    heightMm: 50,
    safeMarginMm: 4,
    fieldPositions: {} as CardLayout["fieldPositions"],
  };
  if (layout === "classic") {
    base.fieldPositions = {
      name: { x: 8, y: 14 },
      title: { x: 8, y: 22 },
      company: { x: 8, y: 30 },
      email: { x: 8, y: 38 },
      phone: { x: 50, y: 38 },
      website: { x: 8, y: 44 },
      address: { x: 50, y: 44 },
      accent: { x: 0, y: 0 },
    };
  } else if (layout === "minimal") {
    base.fieldPositions = {
      name: { x: 12, y: 18 },
      title: { x: 12, y: 26 },
      company: { x: 12, y: 32 },
      email: { x: 12, y: 40 },
      phone: { x: 12, y: 45 },
      website: { x: 50, y: 40 },
      address: { x: 50, y: 45 },
      accent: { x: 0, y: 0 },
    };
  } else {
    // modern
    base.fieldPositions = {
      name: { x: 10, y: 16 },
      title: { x: 10, y: 24 },
      company: { x: 10, y: 32 },
      email: { x: 10, y: 40 },
      phone: { x: 50, y: 40 },
      website: { x: 10, y: 44 },
      address: { x: 50, y: 44 },
      accent: { x: 0, y: 0 },
    };
  }
  return base;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateInput(input: CardInput): ValidationResult {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push("Name is required");
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.push("Invalid email format");
  if (input.website && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(input.website)) errors.push("Website should be a domain like 'acme.com'");
  if (input.phone && !/^[\d+()\s-]+$/.test(input.phone)) errors.push("Phone contains invalid characters");
  if (!/^#[0-9a-fA-F]{6}$/.test(input.accent)) errors.push("Accent must be a hex color like #2563eb");
  if (input.name.length > 40) errors.push("Name too long (max 40)");
  if (input.title.length > 40) errors.push("Title too long (max 40)");
  return { ok: errors.length === 0, errors };
}

/** Build a vCard 3.0 string from the input. */
export function toVCard(input: CardInput): string {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`N:${input.name};;;;`);
  lines.push(`FN:${input.name}`);
  if (input.title) lines.push(`TITLE:${input.title}`);
  if (input.company) lines.push(`ORG:${input.company}`);
  if (input.email) lines.push(`EMAIL;TYPE=INTERNET:${input.email}`);
  if (input.phone) lines.push(`TEL;TYPE=CELL:${input.phone}`);
  if (input.website) lines.push(`URL:${input.website.startsWith("http") ? input.website : `https://${input.website}`}`);
  if (input.address) lines.push(`ADR:;;${input.address};;;;`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

/** Plain-text export of the card content. */
export function toPlainText(input: CardInput): string {
  const lines = [
    input.name,
    input.title,
    input.company,
    "",
    input.email,
    input.phone,
    input.website,
    input.address,
  ].filter(Boolean);
  return lines.join("\n");
}
