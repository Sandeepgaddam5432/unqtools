"use client";

import { Menu, X } from "lucide-react";

/**
 * MobileHeader — compact fixed top bar for mobile only (md:hidden).
 * Replaces the old floating hamburger button. Fills the dead strip
 * that padding-tweaks couldn't eliminate.
 *
 * Height: 48px (h-12). Content starts at pt-12 on mobile.
 */
export function MobileHeader({
  menuOpen,
  onMenuClick,
}: {
  menuOpen: boolean;
  onMenuClick: () => void;
}) {
  return (
    <header
      className="fixed inset-x-0 top-0 z-50 flex h-12 items-center gap-2 border-b border-border/50 bg-background/90 px-3 backdrop-blur-lg md:hidden"
      aria-label="Mobile navigation"
    >
      <button
        type="button"
        onClick={onMenuClick}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
      >
        {menuOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>
      <span className="text-sm font-semibold tracking-tight text-foreground">
        UnQ<span className="text-primary">Tools</span>
      </span>
    </header>
  );
}
