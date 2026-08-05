"use client";

import Link from "next/link";
import { Menu, X, Search } from "lucide-react";

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
      className="unq-glass fixed inset-x-0 top-0 z-50 flex h-12 items-center gap-2 border-b border-border/50 px-3 md:hidden"
      aria-label="Mobile navigation"
    >
      <button
        type="button"
        onClick={onMenuClick}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted touch-target"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
      >
        {menuOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>
      <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
        UnQ<span className="text-primary">Tools</span>
      </Link>
      <Link
        href="/tools"
        aria-label="Search all tools"
        className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground touch-target"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search tools</span>
      </Link>
    </header>
  );
}
