/**
 * Theme controller — light / dark / system.
 * Persists choice to localStorage and reflects it on <html data-theme>.
 * The no-FOUC inline script (themeNoFoUcScript) runs in <head> BEFORE
 * first paint, so there is never a theme flash on static pages.
 */
export type ThemeChoice = "light" | "dark" | "system";
const STORAGE_KEY = "unq-theme";

export function getStoredTheme(): ThemeChoice {
  if (typeof localStorage === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

export function storeTheme(theme: ThemeChoice): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, theme);
}

function systemPrefersDark(): boolean {
  if (typeof matchMedia === "undefined") return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemeToDocument(theme: ThemeChoice): void {
  if (typeof document === "undefined") return;
  const resolved = theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
  document.documentElement.setAttribute("data-theme", resolved);
}

export function applyTheme(theme: ThemeChoice): void {
  applyThemeToDocument(theme);
  storeTheme(theme);
}

/**
 * Inline-safe init script — runs in <head> before paint to prevent FOUC.
 * Reads localStorage and sets <html data-theme> synchronously.
 */
export const themeNoFoUcScript = `
(function() {
  try {
    var t = localStorage.getItem('${STORAGE_KEY}');
    var resolved = (t === 'light' || t === 'dark') ? t
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', resolved);

    // If user chose 'system', also react to OS theme changes live.
    if (t === null || t === 'system') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        // Only auto-update if the user hasn't explicitly chosen light/dark.
        var current = localStorage.getItem('${STORAGE_KEY}');
        if (current === null || current === 'system') {
          document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      });
    }
  } catch (e) {
    // localStorage might be blocked (private mode) — fall back to system preference.
    var resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', resolved);
  }
})();
`;

/**
 * Reactively subscribe to system theme changes (used by the theme toggle
 * when the user has selected 'system').
 */
export function watchSystemTheme(callback: (isDark: boolean) => void): () => void {
  if (typeof matchMedia === "undefined") return () => {};
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => callback(e.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
