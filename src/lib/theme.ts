/**
 * Theme controller — light / dark / system.
 * Persists choice to localStorage and reflects it on <html data-theme>.
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
 * Inline-safe init script — call as a string in <head> to avoid FOUC.
 */
export const themeNoFoUcScript = `
(function() {
  try {
    var t = localStorage.getItem('${STORAGE_KEY}');
    var resolved = (t === 'light' || t === 'dark') ? t
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', resolved);
  } catch (e) {}
})();
`;
