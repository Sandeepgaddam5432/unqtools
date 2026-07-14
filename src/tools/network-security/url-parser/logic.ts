/**
 * URL Parser — pure logic.
 *
 * Uses the browser's native URL() constructor (WHATWG URL Living Standard).
 * All functions are pure and side-effect-free.
 */

export interface ParsedUrl {
  href: string;
  protocol: string;
  username: string;
  password: string;
  host: string;
  hostname: string;
  port: string;
  origin: string;
  pathname: string;
  search: string;
  hash: string;
  searchParams: { key: string; value: string }[];
  isValid: boolean;
  error?: string;
}

/** Parse a URL string. Returns ParsedUrl with isValid flag. Never throws. */
export function parseUrl(input: string): ParsedUrl {
  if (!input || typeof input !== "string") {
    return {
      href: "",
      protocol: "",
      username: "",
      password: "",
      host: "",
      hostname: "",
      port: "",
      origin: "",
      pathname: "",
      search: "",
      hash: "",
      searchParams: [],
      isValid: false,
      error: "URL is empty.",
    };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return {
      href: "",
      protocol: "",
      username: "",
      password: "",
      host: "",
      hostname: "",
      port: "",
      origin: "",
      pathname: "",
      search: "",
      hash: "",
      searchParams: [],
      isValid: false,
      error: "URL is empty.",
    };
  }

  // WHATWG URL requires a base for relative URLs. We prepend protocol if missing.
  let urlObj: URL;
  try {
    // Try as-is first
    urlObj = new URL(trimmed);
  } catch {
    // Try with implicit https://
    try {
      urlObj = new URL(trimmed.startsWith("//") ? `https:${trimmed}` : `https://${trimmed}`);
    } catch (e) {
      return {
        href: trimmed,
        protocol: "",
        username: "",
        password: "",
        host: "",
        hostname: "",
        port: "",
        origin: "",
        pathname: "",
        search: "",
        hash: "",
        searchParams: [],
        isValid: false,
        error: (e as Error).message ?? "Invalid URL.",
      };
    }
  }

  // Extract search params
  const searchParams: { key: string; value: string }[] = [];
  urlObj.searchParams.forEach((value, key) => {
    searchParams.push({ key, value });
  });

  return {
    href: urlObj.href,
    protocol: urlObj.protocol,
    username: urlObj.username,
    password: urlObj.password,
    host: urlObj.host,
    hostname: urlObj.hostname,
    port: urlObj.port,
    origin: urlObj.origin,
    pathname: urlObj.pathname,
    search: urlObj.search,
    hash: urlObj.hash,
    searchParams,
    isValid: true,
  };
}

/** Default port for each protocol. */
export const DEFAULT_PORTS: Record<string, number> = {
  "http:": 80,
  "https:": 443,
  "ftp:": 21,
  "ws:": 80,
  "wss:": 443,
  "file:": 0,
};

/** Get the effective port (explicit port, or default for the protocol). */
export function getEffectivePort(parsed: ParsedUrl): number | null {
  if (parsed.port) return parseInt(parsed.port, 10);
  if (parsed.protocol && DEFAULT_PORTS[parsed.protocol]) {
    return DEFAULT_PORTS[parsed.protocol];
  }
  return null;
}

/** Check if URL uses HTTPS (secure). */
export function isHttps(parsed: ParsedUrl): boolean {
  return parsed.protocol === "https:" || parsed.protocol === "wss:";
}

/** Pretty-print a URL in a single line for display. */
export function formatUrl(parsed: ParsedUrl): string {
  if (!parsed.isValid) return parsed.href;
  return parsed.href;
}

/** Decode a percent-encoded string. */
export function decodeUrlComponent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Encode a string for use in a URL component. */
export function encodeUrlComponent(s: string): string {
  return encodeURIComponent(s);
}

/** Build a query string from key-value pairs. */
export function buildQueryString(
  params: { key: string; value: string }[],
): string {
  if (params.length === 0) return "";
  const sp = new URLSearchParams();
  for (const { key, value } of params) {
    sp.append(key, value);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
