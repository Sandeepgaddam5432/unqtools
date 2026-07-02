/**
 * useUrlState — encodes tool state (input + options) in the URL query string.
 * On load, restores state from URL. On change, updates URL (debounced).
 * Falls back gracefully for large inputs (>2000 chars): skips URL update
 * and returns a "too large" flag instead of breaking the URL.
 *
 * Usage:
 *   const { input, opts, setInput, setOpts, urlTooLarge } = useUrlState(
 *     "my-tool", "", defaultOpts
 *   );
 */
import { useState, useEffect, useCallback, useRef } from "preact/hooks";

const MAX_URL_LENGTH = 2000;

export function useUrlState<T extends Record<string, unknown>>(
  toolId: string,
  defaultInput: string,
  defaultOpts: T,
): {
  input: string;
  opts: T;
  setInput: (v: string) => void;
  setOpts: (patch: Partial<T>) => void;
  urlTooLarge: boolean;
} {
  const [input, setInputState] = useState(defaultInput);
  const [opts, setOptsState] = useState<T>(defaultOpts);
  const [urlTooLarge, setUrlTooLarge] = useState(false);
  const initialized = useRef(false);

  // Restore from URL on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlInput = params.get("i");
      const urlOpts = params.get("o");
      if (urlInput !== null) setInputState(decodeURIComponent(urlInput));
      if (urlOpts !== null) {
        const parsed = JSON.parse(decodeURIComponent(urlOpts));
        setOptsState({ ...defaultOpts, ...parsed });
      }
    } catch {
      // ignore parse errors
    }
    initialized.current = true;
  }, []);

  // Update URL when state changes (debounced)
  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(() => {
      try {
        const params = new URLSearchParams();
        if (input) params.set("i", encodeURIComponent(input));
        const optsJson = JSON.stringify(opts);
        // Only encode opts if they differ from defaults
        if (optsJson !== JSON.stringify(defaultOpts)) {
          params.set("o", encodeURIComponent(optsJson));
        }
        const qs = params.toString();
        const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
        if (newUrl.length <= MAX_URL_LENGTH) {
          window.history.replaceState({}, "", newUrl);
          setUrlTooLarge(false);
        } else {
          setUrlTooLarge(true);
        }
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [input, opts]);

  const setInput = useCallback((v: string) => setInputState(v), []);
  const setOpts = useCallback(
    (patch: Partial<T>) => setOptsState((prev) => ({ ...prev, ...patch })),
    [],
  );

  return { input, opts, setInput, setOpts, urlTooLarge };
}
