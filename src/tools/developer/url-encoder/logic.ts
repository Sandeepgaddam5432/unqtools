/**
 * URL Encoder / Decoder — pure logic.
 */

export type UrlMode = "component" | "uri";

/** Encode a URL or component. */
export function encodeUrl(input: string, mode: UrlMode = "component"): string {
  if (!input) return "";
  return mode === "component" ? encodeURIComponent(input) : encodeURI(input);
}

/** Decode a percent-encoded URL or component. */
export function decodeUrl(
  input: string,
): { ok: true; output: string } | { ok: false; error: string } {
  if (!input.trim()) return { ok: false, error: "Input is empty." };
  try {
    const output = decodeURIComponent(input);
    return { ok: true, output };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Invalid percent-encoding" };
  }
}

/** Parse a URL into its components using the URL API. */
export interface ParsedUrl {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  username: string;
  password: string;
  searchParams: { key: string; value: string }[];
  isValid: boolean;
  error?: string;
}

export function parseUrl(input: string): ParsedUrl {
  if (!input.trim()) {
    return {
      protocol: "",
      hostname: "",
      port: "",
      pathname: "",
      search: "",
      hash: "",
      username: "",
      password: "",
      searchParams: [],
      isValid: false,
      error: "Empty input",
    };
  }
  try {
    let urlStr = input.trim();
    // Add protocol if missing — URL API requires one
    if (!/^[a-z][a-z0-9+.-]*:/i.test(urlStr)) {
      urlStr = "https://" + urlStr;
    }
    const url = new URL(urlStr);
    const searchParams: { key: string; value: string }[] = [];
    url.searchParams.forEach((value, key) => searchParams.push({ key, value }));
    return {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      username: url.username,
      password: url.password,
      searchParams,
      isValid: true,
    };
  } catch (e) {
    return {
      protocol: "",
      hostname: "",
      port: "",
      pathname: "",
      search: "",
      hash: "",
      username: "",
      password: "",
      searchParams: [],
      isValid: false,
      error: (e as Error).message ?? "Invalid URL",
    };
  }
}

/** Build a query string from key/value pairs. */
export function buildQueryString(pairs: { key: string; value: string }[]): string {
  const params = new URLSearchParams();
  for (const { key, value } of pairs) {
    if (key) params.append(key, value);
  }
  const s = params.toString();
  return s ? "?" + s : "";
}
