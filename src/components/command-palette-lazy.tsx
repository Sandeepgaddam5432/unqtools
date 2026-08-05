"use client";

import dynamic from "next/dynamic";

/**
 * Client wrapper that lazy-loads the command palette.
 *
 * Kept as its own tiny client component so the heavy `next/dynamic`
 * import (with `ssr: false`) lives in a Client Component, as Next.js
 * requires. The 1700-item catalog chunk only downloads when the user
 * opens the ⌘K palette, keeping it out of every page's initial bundle.
 */
const CommandPaletteMount = dynamic(
  () => import("@/components/command-palette").then((m) => m.CommandPaletteMount),
  { ssr: false }
);

export function CommandPaletteLazy() {
  return <CommandPaletteMount />;
}
