/**
 * useToolOptions — persists tool options to localStorage per tool.
 * Options are restored on page load and saved on change.
 *
 * Usage:
 *   const [opts, setOpts] = useToolOptions("my-tool", { foo: 1, bar: "x" });
 *   setOpts({ ...opts, foo: 2 });
 */
import { useState, useEffect, useCallback } from "preact/hooks";

export function useToolOptions<T extends Record<string, unknown>>(
  toolId: string,
  defaults: T,
): [T, (patch: Partial<T>) => void] {
  const key = `unq-tx-opts-${toolId}`;
  const [opts, setOpts] = useState<T>(defaults);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        setOpts({ ...defaults, ...saved });
      }
    } catch {
      // ignore parse errors
    }
  }, [key]);

  const update = useCallback(
    (patch: Partial<T>) => {
      setOpts((prev) => {
        const next = { ...prev, ...patch };
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // ignore quota errors
        }
        return next;
      });
    },
    [key],
  );

  return [opts, update];
}
