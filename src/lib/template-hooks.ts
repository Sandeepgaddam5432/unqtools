"use client";

import { useCallback, useEffect, useState } from "react";

/** SSR-safe localStorage state. Hydrates after mount to avoid mismatches. */
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) {
        const parsed = JSON.parse(raw) as T;
        // Basic structural integrity check for arrays — discard anything that looks broken.
        if (Array.isArray(parsed) || parsed === null || typeof parsed === "object") {
          setValue(parsed as T);
        }
      }
    } catch {
      /* noop */
    }
    setHydrated(true);
  }, [key]);

  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* noop */
        }
        return next;
      });
    },
    [key]
  );

  return [value, set, hydrated] as const;
}

/** Online/offline status. */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (typeof navigator !== "undefined") setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/** Eased count-up that starts when `start` flips true. */
export function useCountUp(target: number, start: boolean, duration = 1600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start || !Number.isFinite(target) || target <= 0) {
      setV(start ? target : 0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, target, duration]);
  return v;
}
