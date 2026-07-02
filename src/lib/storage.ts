/**
 * Reactive localStorage hooks — favorites, recents, and arbitrary state.
 * All hooks are SSR-safe (they no-op on the server) and update across
 * tabs/windows via the `storage` event.
 */
import { useEffect, useState, useCallback } from "preact/hooks";

/** Generic reactive localStorage hook. */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof localStorage === "undefined") return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota exceeded — ignore */
    }
  }, [key, value]);

  // Sync across tabs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue === null) return;
      try {
        setValue(JSON.parse(e.newValue) as T);
      } catch {
        /* ignore malformed */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const update = useCallback((v: T | ((prev: T) => T)) => {
    setValue((prev) => (typeof v === "function" ? (v as (p: T) => T)(prev) : v));
  }, []);

  return [value, update];
}

const FAV_KEY = "unq-favorites";
const RECENT_KEY = "unq-recents";
const MAX_RECENTS = 8;

/** Favorites — list of tool IDs the user has starred. */
export function useFavorites(): {
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
} {
  const [favorites, setFavorites] = useLocalStorage<string[]>(FAV_KEY, []);
  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);
  const toggleFavorite = useCallback(
    (id: string) => {
      setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    },
    [setFavorites],
  );
  return { favorites, isFavorite, toggleFavorite };
}

/** Recents — most-recently-used tool IDs, capped at MAX_RECENTS. */
export function useRecents(): {
  recents: string[];
  pushRecent: (id: string) => void;
  clearRecents: () => void;
} {
  const [recents, setRecents] = useLocalStorage<string[]>(RECENT_KEY, []);
  const pushRecent = useCallback(
    (id: string) => {
      setRecents((prev) => {
        const filtered = prev.filter((x) => x !== id);
        return [id, ...filtered].slice(0, MAX_RECENTS);
      });
    },
    [setRecents],
  );
  const clearRecents = useCallback(() => setRecents([]), [setRecents]);
  return { recents, pushRecent, clearRecents };
}

/**
 * PWA install prompt — captures the `beforeinstallprompt` event and exposes
 * a `promptInstall()` function. Returns `null` if the platform doesn't
 * support install prompts (iOS Safari, desktop Firefox).
 */
export function useInstallPrompt(): {
  canInstall: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<boolean>;
} {
  const [deferred, setDeferred] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect if already running as installed PWA
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(standalone);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return choice.outcome === "accepted";
  }, [deferred]);

  return { canInstall: !!deferred, isInstalled, promptInstall };
}
