"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

/**
 * Intent-based lazy load for the command palette.
 *
 * The palette imports the full 1,679-tool catalog (~180KB chunk).
 * Previously `next/dynamic(..., { ssr:false })` loaded that chunk on
 * every page load right after hydration — even though most users never
 * open ⌘K. That was the single biggest JavaScript cost on the site
 * (Lighthouse: 2.5s script bootup on /tools).
 *
 * Now: mount a ~1KB key listener immediately; download the palette
 * chunk only on first user intent (⌘K / Ctrl+K / search-trigger event),
 * or once the browser goes idle (prefetch so the first ⌘K opens
 * without waiting for the network).
 */

const LoadablePalette = dynamic(
  () =>
    import("@/components/command-palette").then((m) => m.CommandPaletteMount),
  { ssr: false },
);

export function CommandPaletteLazy() {
  const [activated, setActivated] = useState(false);
  // True when the activation came from an explicit open request
  // (keypress / event) rather than idle prefetch — the palette should
  // mount already-open in that case so one keystroke is enough.
  const [openRequested, setOpenRequested] = useState(false);

  useEffect(() => {
    if (activated) return;

    const prefetch = () => setActivated(true);
    const openNow = () => {
      setOpenRequested(true);
      setActivated(true);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openNow();
      }
    };
    document.addEventListener("keydown", keyHandler);
    window.addEventListener("unq:open-command-bar", openNow);

    // Idle prefetch: warm the chunk when the page goes quiet so the
    // first real ⌘K opens instantly without costing initial load.
    let idleId: number | undefined;
    const ric = window.requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    if (ric) {
      idleId = ric(prefetch, { timeout: 8000 });
    }

    return () => {
      document.removeEventListener("keydown", keyHandler);
      window.removeEventListener("unq:open-command-bar", openNow);
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        (window as unknown as { cancelIdleCallback: (id: number) => void })
          .cancelIdleCallback(idleId);
      }
    };
  }, [activated]);

  if (!activated) return null;
  return <LoadablePalette initialOpen={openRequested} />;
}
