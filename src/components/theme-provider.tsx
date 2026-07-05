"use client";

import React, { useState, useEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * ThemeProvider wrapper that mounts only on the client to avoid React 19
 * hydration mismatch (#418) with next-themes 0.4.6.
 *
 * The issue: next-themes' useState initializer reads localStorage on the client
 * but returns undefined on the server. This causes the <script> element's content
 * to differ between SSG and client render -> React #418.
 *
 * Fix: render children without ThemeProvider on SSG + first client render,
 * then mount ThemeProvider after useEffect. The next-themes inline script still
 * runs before hydration (setting the dark class on <html>), so there's no FOUC.
 */
export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
