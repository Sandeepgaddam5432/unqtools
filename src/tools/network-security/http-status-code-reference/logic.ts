/**
 * HTTP Status Code Reference — pure data + lookup logic.
 *
 * Status codes from RFC 9110 (HTTP Semantics), RFC 6585, RFC 7725, RFC 2295,
 * RFC 2324 (HTCPCP), plus unofficial but widely-used Cloudflare/nginx codes.
 */

export type StatusCodeCategory = "1xx" | "2xx" | "3xx" | "4xx" | "5xx";

export interface StatusCodeInfo {
  code: number;
  name: string;
  category: StatusCodeCategory;
  categoryLabel: string;
  description: string;
  useCase: string;
  isOfficial: boolean;
}

export const CATEGORY_LABELS: Record<StatusCodeCategory, string> = {
  "1xx": "Informational",
  "2xx": "Success",
  "3xx": "Redirection",
  "4xx": "Client Error",
  "5xx": "Server Error",
};

export const STATUS_CODES: StatusCodeInfo[] = [
  // 1xx — Informational
  { code: 100, name: "Continue", category: "1xx", categoryLabel: "Informational", description: "The server has received the request headers and the client should proceed to send the request body.", useCase: "Used when the client wants to send a large body and checks if the server will accept it first via the Expect: 100-continue header.", isOfficial: true },
  { code: 101, name: "Switching Protocols", category: "1xx", categoryLabel: "Informational", description: "The requester has asked the server to switch protocols and the server has agreed.", useCase: "Used during WebSocket connection upgrade from HTTP to WS.", isOfficial: true },
  { code: 102, name: "Processing", category: "1xx", categoryLabel: "Informational", description: "The server has received and is processing the request, but no response is available yet.", useCase: "WebDAV — prevents client timeout for long-running operations.", isOfficial: false },
  { code: 103, name: "Early Hints", category: "1xx", categoryLabel: "Informational", description: "Used to return some response headers before the final HTTP message.", useCase: "Preload hints — server tells client to start fetching CSS/JS while the HTML is still being generated.", isOfficial: false },

  // 2xx — Success
  { code: 200, name: "OK", category: "2xx", categoryLabel: "Success", description: "Standard response for successful HTTP requests.", useCase: "GET returns the resource, POST returns the result of the action.", isOfficial: true },
  { code: 201, name: "Created", category: "2xx", categoryLabel: "Success", description: "The request has been fulfilled and a new resource has been created.", useCase: "POST to /users returns 201 with the new user's URL in the Location header.", isOfficial: true },
  { code: 202, name: "Accepted", category: "2xx", categoryLabel: "Success", description: "The request has been accepted for processing, but the processing is not complete.", useCase: "Async jobs — POST returns 202 with a job URL the client can poll.", isOfficial: true },
  { code: 203, name: "Non-Authoritative Information", category: "2xx", categoryLabel: "Success", description: "The server successfully processed the request but is returning information from another source.", useCase: "HTTP proxies that modify the response in some way.", isOfficial: true },
  { code: 204, name: "No Content", category: "2xx", categoryLabel: "Success", description: "The server successfully processed the request and is not returning any content.", useCase: "PUT/PATCH updates — saves the resource but doesn't return a body.", isOfficial: true },
  { code: 205, name: "Reset Content", category: "2xx", categoryLabel: "Success", description: "The server successfully processed the request, but is not returning any content. The client should reset the document view.", useCase: "Form submission — server tells client to clear the form.", isOfficial: true },
  { code: 206, name: "Partial Content", category: "2xx", categoryLabel: "Success", description: "The server is delivering only part of the resource due to a range header.", useCase: "Video streaming, resumable downloads — client requests bytes 0-1023 and gets 206 back.", isOfficial: true },
  { code: 207, name: "Multi-Status", category: "2xx", categoryLabel: "Success", description: "The message body is an XML message containing multiple separate response codes.", useCase: "WebDAV — multiple operations in one request.", isOfficial: false },
  { code: 208, name: "Already Reported", category: "2xx", categoryLabel: "Success", description: "Members of a DAV binding have already been enumerated in a previous reply.", useCase: "WebDAV — avoids enumerating the same resource twice.", isOfficial: false },
  { code: 226, name: "IM Used", category: "2xx", categoryLabel: "Success", description: "The server has fulfilled a GET request for the resource with instance manipulation applied.", useCase: "Delta encoding — server returns only the diff from a previous version.", isOfficial: false },

  // 3xx — Redirection
  { code: 300, name: "Multiple Choices", category: "3xx", categoryLabel: "Redirection", description: "Indicates multiple options for the resource from which the client may choose.", useCase: "Content negotiation — server offers HTML, JSON, or PDF versions.", isOfficial: true },
  { code: 301, name: "Moved Permanently", category: "3xx", categoryLabel: "Redirection", description: "This and all future requests should be directed to the given URI.", useCase: "Site migration — old URL permanently redirects to new URL. Search engines update their index.", isOfficial: true },
  { code: 302, name: "Found", category: "3xx", categoryLabel: "Redirection", description: "Tells the client to look at another URL for the resource (temporary).", useCase: "Post-redirect-GET pattern — form POST returns 302 to a success page. Note: 302 may change POST to GET — use 307 to preserve method.", isOfficial: true },
  { code: 303, name: "See Other", category: "3xx", categoryLabel: "Redirection", description: "The response to the request can be found under another URI using the GET method.", useCase: "POST → redirect to a GET URL (Post/Redirect/Get pattern).", isOfficial: true },
  { code: 304, name: "Not Modified", category: "3xx", categoryLabel: "Redirection", description: "The resource has not been modified since the version specified by the request headers.", useCase: "Conditional requests with If-Modified-Since / If-None-Match — saves bandwidth.", isOfficial: true },
  { code: 305, name: "Use Proxy", category: "3xx", categoryLabel: "Redirection", description: "The requested resource is available only through a proxy.", useCase: "Deprecated for security reasons. Don't use.", isOfficial: true },
  { code: 307, name: "Temporary Redirect", category: "3xx", categoryLabel: "Redirection", description: "Same as 302 but preserves the HTTP method (POST stays POST).", useCase: "Temporary redirect that keeps the original method. Safer than 302.", isOfficial: true },
  { code: 308, name: "Permanent Redirect", category: "3xx", categoryLabel: "Redirection", description: "Same as 301 but preserves the HTTP method (POST stays POST).", useCase: "Permanent redirect that keeps the original method. Safer than 301.", isOfficial: false },

  // 4xx — Client Error
  { code: 400, name: "Bad Request", category: "4xx", categoryLabel: "Client Error", description: "The server cannot process the request due to a client error (malformed syntax).", useCase: "Invalid JSON body, missing required parameters, bad query string.", isOfficial: true },
  { code: 401, name: "Unauthorized", category: "4xx", categoryLabel: "Client Error", description: "Authentication is required and has failed or has not been provided.", useCase: "Missing/invalid auth token. Response should include WWW-Authenticate header.", isOfficial: true },
  { code: 402, name: "Payment Required", category: "4xx", categoryLabel: "Client Error", description: "Reserved for future use. Sometimes used for payment-required access.", useCase: "Rarely used. Some APIs return this when quota is exceeded and payment is needed.", isOfficial: true },
  { code: 403, name: "Forbidden", category: "4xx", categoryLabel: "Client Error", description: "The request was valid but the server is refusing action.", useCase: "User is authenticated but doesn't have permission for this resource.", isOfficial: true },
  { code: 404, name: "Not Found", category: "4xx", categoryLabel: "Client Error", description: "The requested resource could not be found.", useCase: "URL doesn't match any route, or resource ID doesn't exist.", isOfficial: true },
  { code: 405, name: "Method Not Allowed", category: "4xx", categoryLabel: "Client Error", description: "The request method is not supported for the requested resource.", useCase: "POST to a GET-only endpoint. Response should include Allow header listing valid methods.", isOfficial: true },
  { code: 406, name: "Not Acceptable", category: "4xx", categoryLabel: "Client Error", description: "The requested resource is capable of generating only content not acceptable according to the Accept headers.", useCase: "Client requests only XML, server only produces JSON.", isOfficial: true },
  { code: 407, name: "Proxy Authentication Required", category: "4xx", categoryLabel: "Client Error", description: "The client must first authenticate itself with the proxy.", useCase: "Corporate proxies — response includes Proxy-Authenticate header.", isOfficial: true },
  { code: 408, name: "Request Timeout", category: "4xx", categoryLabel: "Client Error", description: "The server timed out waiting for the request.", useCase: "Client took too long to send the full request body.", isOfficial: true },
  { code: 409, name: "Conflict", category: "4xx", categoryLabel: "Client Error", description: "The request could not be processed because of conflict in the current state of the resource.", useCase: "Editing the same resource from two clients simultaneously (version mismatch).", isOfficial: true },
  { code: 410, name: "Gone", category: "4xx", categoryLabel: "Client Error", description: "The resource is no longer available and will not be available again.", useCase: "Deleted resource. Different from 404 — 410 tells clients to stop requesting it.", isOfficial: true },
  { code: 411, name: "Length Required", category: "4xx", categoryLabel: "Client Error", description: "The request did not specify the length of its content, which is required by the requested resource.", useCase: "Server requires Content-Length header for POST/PUT.", isOfficial: true },
  { code: 412, name: "Precondition Failed", category: "4xx", categoryLabel: "Client Error", description: "The server does not meet one of the preconditions specified in the request headers.", useCase: "If-Match / If-Unmodified-Since check failed during conditional update.", isOfficial: true },
  { code: 413, name: "Payload Too Large", category: "4xx", categoryLabel: "Client Error", description: "The request is larger than the server is willing or able to process.", useCase: "File upload exceeds size limit.", isOfficial: true },
  { code: 414, name: "URI Too Long", category: "4xx", categoryLabel: "Client Error", description: "The URI provided was too long for the server to process.", useCase: "Extremely long query string — should use POST body instead.", isOfficial: true },
  { code: 415, name: "Unsupported Media Type", category: "4xx", categoryLabel: "Client Error", description: "The request entity has a media type which the server or resource does not support.", useCase: "POSTing XML when server expects JSON. Check Content-Type header.", isOfficial: true },
  { code: 416, name: "Range Not Satisfiable", category: "4xx", categoryLabel: "Client Error", description: "The client has asked for a portion of the file, but the server cannot supply that portion.", useCase: "Range header requests bytes beyond the file size.", isOfficial: true },
  { code: 417, name: "Expectation Failed", category: "4xx", categoryLabel: "Client Error", description: "The server cannot meet the requirements of the Expect request-header field.", useCase: "Client sends Expect: 100-continue but server can't honor it.", isOfficial: true },
  { code: 418, name: "I'm a teapot", category: "4xx", categoryLabel: "Client Error", description: "The server refuses to brew coffee because it is, permanently, a teapot.", useCase: "April Fools' joke from RFC 2324 (HTCPCP). Sometimes used as an Easter egg.", isOfficial: false },
  { code: 421, name: "Misdirected Request", category: "4xx", categoryLabel: "Client Error", description: "The request was directed at a server that is not able to produce a response.", useCase: "HTTP/2 connection coalescing — server doesn't have a cert for the requested host.", isOfficial: false },
  { code: 422, name: "Unprocessable Entity", category: "4xx", categoryLabel: "Client Error", description: "The request was well-formed but was unable to be followed due to semantic errors.", useCase: "Validation failure — JSON is valid but missing required fields. Better than 400 for API errors.", isOfficial: false },
  { code: 423, name: "Locked", category: "4xx", categoryLabel: "Client Error", description: "The resource that is being accessed is locked.", useCase: "WebDAV — resource is locked by another client.", isOfficial: false },
  { code: 424, name: "Failed Dependency", category: "4xx", categoryLabel: "Client Error", description: "The request failed due to failure of a previous request.", useCase: "WebDAV — dependent request in a batch failed.", isOfficial: false },
  { code: 425, name: "Too Early", category: "4xx", categoryLabel: "Client Error", description: "The server is unwilling to risk processing a request that might be replayed.", useCase: "TLS 1.3 0-RTT data — protects against replay attacks.", isOfficial: false },
  { code: 426, name: "Upgrade Required", category: "4xx", categoryLabel: "Client Error", description: "The client should switch to a different protocol.", useCase: "Server requires TLS 1.2+ — response includes Upgrade header.", isOfficial: false },
  { code: 428, name: "Precondition Required", category: "4xx", categoryLabel: "Client Error", description: "The server requires the request to be conditional.", useCase: "Server requires If-Match header on PUT to prevent lost updates (optimistic locking).", isOfficial: false },
  { code: 429, name: "Too Many Requests", category: "4xx", categoryLabel: "Client Error", description: "The user has sent too many requests in a given amount of time.", useCase: "Rate limiting. Response should include Retry-After header.", isOfficial: false },
  { code: 431, name: "Request Header Fields Too Large", category: "4xx", categoryLabel: "Client Error", description: "The server is unwilling to process the request because either an individual header field, or all the header fields collectively, are too large.", useCase: "Too many cookies — server rejects the request.", isOfficial: false },
  { code: 451, name: "Unavailable For Legal Reasons", category: "4xx", categoryLabel: "Client Error", description: "A server operator has received a legal demand to deny access to a resource.", useCase: "Government censorship, DMCA takedowns. Response should include a Link to the legal demand.", isOfficial: false },

  // 5xx — Server Error
  { code: 500, name: "Internal Server Error", category: "5xx", categoryLabel: "Server Error", description: "A generic error message, given when an unexpected condition was encountered.", useCase: "Unhandled exception, database connection failure, bug in code.", isOfficial: true },
  { code: 501, name: "Not Implemented", category: "5xx", categoryLabel: "Server Error", description: "The server does not recognise the request method, or lacks the ability to fulfil it.", useCase: "Server doesn't support a custom HTTP method.", isOfficial: true },
  { code: 502, name: "Bad Gateway", category: "5xx", categoryLabel: "Server Error", description: "The server was acting as a gateway or proxy and received an invalid response from the upstream server.", useCase: "Reverse proxy (nginx, Cloudflare) can't reach the backend app.", isOfficial: true },
  { code: 503, name: "Service Unavailable", category: "5xx", categoryLabel: "Server Error", description: "The server is currently unavailable. Often because it is overloaded or down for maintenance.", useCase: "Server is restarting, deploying, or temporarily overloaded. Response should include Retry-After.", isOfficial: true },
  { code: 504, name: "Gateway Timeout", category: "5xx", categoryLabel: "Server Error", description: "The server was acting as a gateway or proxy and did not receive a timely response from the upstream server.", useCase: "Backend took too long to respond — proxy timeout.", isOfficial: true },
  { code: 505, name: "HTTP Version Not Supported", category: "5xx", categoryLabel: "Server Error", description: "The server does not support the HTTP protocol version used in the request.", useCase: "Client sends HTTP/2.0 to a server that only supports 1.1.", isOfficial: true },
  { code: 506, name: "Variant Also Negotiates", category: "5xx", categoryLabel: "Server Error", description: "Transparent content negotiation for the request results in a circular reference.", useCase: "Misconfigured content negotiation — rarely seen.", isOfficial: true },
  { code: 507, name: "Insufficient Storage", category: "5xx", categoryLabel: "Server Error", description: "The server is unable to store the representation needed to complete the request.", useCase: "WebDAV — disk full.", isOfficial: false },
  { code: 508, name: "Loop Detected", category: "5xx", categoryLabel: "Server Error", description: "The server detected an infinite loop while processing the request.", useCase: "WebDAV — binding loops.", isOfficial: false },
  { code: 510, name: "Not Extended", category: "5xx", categoryLabel: "Server Error", description: "Further extensions to the request are required for the server to fulfil it.", useCase: "Server requires HTTP extension framework — rarely seen.", isOfficial: false },
  { code: 511, name: "Network Authentication Required", category: "5xx", categoryLabel: "Server Error", description: "The client needs to authenticate to gain network access.", useCase: "Captive portals — hotel/airport WiFi login page.", isOfficial: false },

  // Unofficial — Cloudflare / nginx
  { code: 520, name: "Web Server Returned an Unknown Error", category: "5xx", categoryLabel: "Server Error", description: "Cloudflare — origin returned an empty, unknown, or unexpected response.", useCase: "Cloudflare-specific. Origin server is misconfigured or crashed.", isOfficial: false },
  { code: 521, name: "Web Server Is Down", category: "5xx", categoryLabel: "Server Error", description: "Cloudflare — origin server refused the connection.", useCase: "Cloudflare-specific. Origin server is offline.", isOfficial: false },
  { code: 522, name: "Connection Timed Out", category: "5xx", categoryLabel: "Server Error", description: "Cloudflare — TCP connection to the origin timed out.", useCase: "Cloudflare-specific. Origin server is too slow or firewall blocking Cloudflare IPs.", isOfficial: false },
  { code: 523, name: "Origin Is Unreachable", category: "5xx", categoryLabel: "Server Error", description: "Cloudflare — cannot reach the origin server.", useCase: "Cloudflare-specific. DNS issue or origin IP changed.", isOfficial: false },
  { code: 524, name: "A Timeout Occurred", category: "5xx", categoryLabel: "Server Error", description: "Cloudflare — TCP connection was established but origin didn't respond with HTTP headers within 100 seconds.", useCase: "Cloudflare-specific. Long-running request — increase proxy_read_timeout or use async processing.", isOfficial: false },
  { code: 525, name: "SSL Handshake Failed", category: "5xx", categoryLabel: "Server Error", description: "Cloudflare — SSL handshake with the origin failed.", useCase: "Cloudflare-specific. Origin cert expired, missing, or wrong cipher.", isOfficial: false },
  { code: 526, name: "Invalid SSL Certificate", category: "5xx", categoryLabel: "Server Error", description: "Cloudflare — origin's SSL certificate is invalid.", useCase: "Cloudflare-specific. Origin cert is self-signed, expired, or hostname mismatch.", isOfficial: false },
  { code: 527, name: "Railgun Error", category: "5xx", categoryLabel: "Server Error", description: "Cloudflare Railgun — error establishing connection between Railgun Listener and origin.", useCase: "Cloudflare-specific. Railgun misconfiguration.", isOfficial: false },
  { code: 530, name: "Origin DNS Error", category: "5xx", categoryLabel: "Server Error", description: "Cloudflare — cannot resolve origin DNS.", useCase: "Cloudflare-specific. Origin DNS record is missing or wrong.", isOfficial: false },
  { code: 598, name: "Network Read Timeout Error", category: "5xx", categoryLabel: "Server Error", description: "Unofficial — proxy read timeout between proxy and origin.", useCase: "Used by some proxies for upstream timeouts.", isOfficial: false },
  { code: 599, name: "Network Connect Timeout Error", category: "5xx", categoryLabel: "Server Error", description: "Unofficial — proxy connect timeout to origin.", useCase: "Used by some proxies for upstream connect timeouts.", isOfficial: false },
];

/** Look up a status code by number. Returns undefined if not found. */
export function lookup(code: number): StatusCodeInfo | undefined {
  return STATUS_CODES.find((s) => s.code === code);
}

/** Filter status codes by category. */
export function byCategory(category: StatusCodeCategory): StatusCodeInfo[] {
  return STATUS_CODES.filter((s) => s.category === category);
}

/** Search status codes by code, name, description, or use case. */
export function search(query: string): StatusCodeInfo[] {
  if (!query || typeof query !== "string") return STATUS_CODES;
  const q = query.trim().toLowerCase();
  if (!q) return STATUS_CODES;
  return STATUS_CODES.filter(
    (s) =>
      String(s.code).includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.categoryLabel.toLowerCase().includes(q) ||
      s.useCase.toLowerCase().includes(q),
  );
}

/** Total count of status codes in the reference. */
export function count(): number {
  return STATUS_CODES.length;
}

/** Color for each category. */
export const CATEGORY_COLORS: Record<StatusCodeCategory, string> = {
  "1xx": "text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10",
  "2xx": "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  "3xx": "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10",
  "4xx": "text-orange-600 dark:text-orange-400 border-orange-500/30 bg-orange-500/10",
  "5xx": "text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10",
};

// ===== v8.1 upgrade — blueprint features + 10 extras =====

// ===== Common causes + how to fix (blueprint feature) =====

export interface CodeDetails {
  code: number;
  commonCauses: string[];
  howToFix: string[];
  ianaUrl: string;
  serverSoftware?: string[];   // which servers/proxies emit this code
  http2Diff?: string;          // differences in HTTP/2
}

const CODE_DETAILS: Record<number, CodeDetails> = {
  200: {
    code: 200,
    commonCauses: ["Successful GET/POST/PUT request", "Resource fetched normally"],
    howToFix: ["Nothing to fix — this is the expected success response"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
    serverSoftware: ["all"],
  },
  201: {
    code: 201,
    commonCauses: ["POST created a new resource", "PUT created a new resource at a new URI"],
    howToFix: ["Include a Location header pointing to the new resource URL", "Return the created resource in the body (or just its URL)"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
  },
  204: {
    code: 204,
    commonCauses: ["PUT/PATCH updated a resource without returning content", "DELETE succeeded"],
    howToFix: ["Don't include a body in the response", "Content-Length must be 0"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
  },
  301: {
    code: 301,
    commonCauses: ["Site migrated to a new domain", "URL structure changed permanently", "HTTP → HTTPS redirect"],
    howToFix: ["Use 301 for permanent moves — search engines update their index", "Use 308 if you need to preserve the HTTP method (POST stays POST)", "Don't use 301 for temporary redirects"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
    serverSoftware: ["nginx", "Apache", "Cloudflare"],
    http2Diff: "Same in HTTP/2 — no behavioral difference.",
  },
  302: {
    code: 302,
    commonCauses: ["Post-redirect-GET pattern (form POST → success page)", "Temporary A/B test redirect"],
    howToFix: ["Use 303 for post-redirect-GET (more semantic)", "Use 307 to preserve the HTTP method", "302 may change POST to GET in some clients — don't rely on it"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
  },
  304: {
    code: 304,
    commonCauses: ["Client sent If-Modified-Since/If-None-Match and resource hasn't changed"],
    howToFix: ["Set proper Last-Modified or ETag headers on responses", "Compare the conditional header against the current resource", "Return 304 with no body to save bandwidth"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
    http2Diff: "HTTP/2 uses the same 304 but with HPACK-compressed headers.",
  },
  400: {
    code: 400,
    commonCauses: ["Malformed JSON in request body", "Missing required query params", "Invalid URL encoding", "Content-Type mismatch"],
    howToFix: ["Validate input before processing — return field-level errors", "Use 422 for semantic errors (valid JSON but missing fields)", "Include an error message in the response body explaining what's wrong"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
  },
  401: {
    code: 401,
    commonCauses: ["No Authorization header sent", "Expired or invalid JWT/token", "Missing API key"],
    howToFix: ["Include WWW-Authenticate header describing the auth scheme", "Return 401 for missing/invalid auth, 403 for authenticated-but-unauthorized", "Don't reveal whether the username exists (use same error for bad user vs bad password)"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
  },
  403: {
    code: 403,
    commonCauses: ["User authenticated but lacks permission", "IP blocked by firewall/WAF", "Directory listing disabled", "File permissions wrong (server-side)"],
    howToFix: ["Check user roles/permissions before the action", "Don't use 401 (that's for missing auth) — 403 means auth succeeded but access denied", "Log the denial for audit"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
  },
  404: {
    code: 404,
    commonCauses: ["URL doesn't match any route", "Resource ID doesn't exist", "Typo in URL", "Resource was deleted"],
    howToFix: ["Return a helpful 404 page with suggestions for similar URLs", "Log 404s to find broken links", "For APIs, return JSON error: {\"error\": \"Resource not found\"}", "Don't use 404 for 'unauthorized' — that's 403"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
  },
  405: {
    code: 405,
    commonCauses: ["POST to a GET-only endpoint", "DELETE on a read-only resource", "PUT on a collection (should be POST)"],
    howToFix: ["Include Allow header listing valid methods: Allow: GET, POST", "Make sure your router handles the method", "For CORS preflight, return 200 with Access-Control-Allow-Methods"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
  },
  408: {
    code: 408,
    commonCauses: ["Client took too long to send the full request", "Slow upload (large file, poor connection)", "Server's timeout setting is too low"],
    howToFix: ["Increase server timeout (e.g. nginx proxy_read_timeout)", "Use chunked transfer encoding for large uploads", "Show a retry option to the user"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
  },
  409: {
    code: 409,
    commonCauses: ["Concurrent edits to the same resource (version conflict)", "Duplicate unique key in database", "Trying to create a resource that already exists"],
    howToFix: ["Use If-Match/ETag for optimistic locking", "Return the current resource state so the client can merge", "For duplicates, return 409 (not 400) with a clear message"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
  },
  413: {
    code: 413,
    commonCauses: ["File upload exceeds server's max body size", "JSON payload too large", "nginx client_max_body_size too low"],
    howToFix: ["Increase nginx: client_max_body_size 50M;", "Increase Apache: LimitRequestBody 52428800", "Use chunked upload for large files", "Validate size client-side before upload"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
    serverSoftware: ["nginx", "Apache", "Cloudflare"],
  },
  429: {
    code: 429,
    commonCauses: ["Client hit the rate limit", "Too many requests in a short window", "API quota exceeded"],
    howToFix: ["Include Retry-After header (seconds to wait)", "Include X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers", "Use exponential backoff on the client side", "Return 429 (not 503) for rate limits"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
  },
  500: {
    code: 500,
    commonCauses: ["Unhandled exception in code", "Database connection failed", "Null pointer / undefined access", "Out of memory", "Syntax error in server config"],
    howToFix: ["Log the full stack trace server-side", "Return a generic error to the client (don't leak internals)", "Use a global error handler / middleware", "Set up monitoring/alerting for 500s", "Check server logs immediately"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
    serverSoftware: ["all"],
  },
  502: {
    code: 502,
    commonCauses: ["Backend server crashed", "Backend returned an invalid response", "Reverse proxy can't reach upstream", "Backend too slow (proxy timeout but connection established)"],
    howToFix: ["Check if the backend process is running (pm2, systemd)", "Check backend logs for crashes", "Verify the proxy's upstream config (nginx upstream block)", "Check firewall rules between proxy and backend"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
    serverSoftware: ["nginx", "Cloudflare", "Apache", "HAProxy"],
  },
  503: {
    code: 503,
    commonCauses: ["Server is restarting/deploying", "Server overloaded (too many requests)", "Maintenance mode", "Dependency (DB, cache) is down"],
    howToFix: ["Include Retry-After header", "Use a queue for incoming requests", "Scale horizontally (add more servers)", "Implement circuit breakers for dependencies", "Return a maintenance page"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
    serverSoftware: ["nginx", "Apache", "Cloudflare"],
  },
  504: {
    code: 504,
    commonCauses: ["Backend took too long to respond", "Database query timeout", "External API call timed out", "Proxy's timeout setting too low"],
    howToFix: ["Increase proxy timeout (nginx: proxy_read_timeout 60s;)", "Optimize the slow query/request", "Add caching for slow operations", "Use async processing for long-running tasks", "Set up alerts for 504s"],
    ianaUrl: "https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml",
    serverSoftware: ["nginx", "Cloudflare", "Apache", "HAProxy"],
  },
};

/** Get detailed info for a status code. */
export function getCodeDetails(code: number): CodeDetails | undefined {
  return CODE_DETAILS[code];
}

// ===== Copy-as-curl (blueprint feature) =====

/** Generate a curl command that would trigger this status code (for testing). */
export function toCurlCommand(code: number, url: string = "https://httpbin.org/status/{CODE}"): string {
  const realUrl = url.replace("{CODE}", String(code));
  return `curl -i -X GET "${realUrl}"`;
}

// ===== Deep-link support (blueprint feature) =====

/** Build a deep-link URL to a specific status code. */
export function buildDeepLink(code: number): string {
  if (typeof window === "undefined") return `#code=${code}`;
  return `${window.location.origin}${window.location.pathname}#code=${code}`;
}

/** Extract a code from the URL fragment (e.g. #code=418). */
export function extractCodeFromFragment(): number | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash) return null;
  const match = hash.match(/[#&]code=(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// ===== Extra #1: History =====

const HTTP_HISTORY_KEY = "unqtools-http-history";
const MAX_HTTP_HISTORY = 30;

export interface HttpHistoryEntry {
  code: number;
  viewedAt: string;
}

export function loadHttpHistory(): HttpHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HTTP_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HTTP_HISTORY);
  } catch {
    return [];
  }
}

export function saveHttpToHistory(code: number): HttpHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const entry: HttpHistoryEntry = { code, viewedAt: new Date().toISOString() };
  const current = loadHttpHistory().filter((e) => e.code !== code);
  const updated = [entry, ...current].slice(0, MAX_HTTP_HISTORY);
  try { localStorage.setItem(HTTP_HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHttpHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HTTP_HISTORY_KEY); } catch {}
}

// ===== Extra #2: Favorites =====

const FAVORITES_KEY = "unqtools-http-favorites";

export function loadFavorites(): number[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function toggleFavorite(code: number): number[] {
  const current = loadFavorites();
  const updated = current.includes(code) ? current.filter((c) => c !== code) : [...current, code];
  if (typeof localStorage === "undefined") return updated;
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

// ===== Extra #3: Filter by server software =====

/** Filter status codes by server software (e.g. show only Cloudflare codes). */
export function filterByServer(server: string): StatusCodeInfo[] {
  return STATUS_CODES.filter((s) => {
    const details = CODE_DETAILS[s.code];
    return details?.serverSoftware?.includes(server) || details?.serverSoftware?.includes("all");
  });
}

export const SUPPORTED_SERVERS = ["nginx", "Apache", "Cloudflare", "HAProxy"];

// ===== Extra #4: Export as reference sheet =====

/** Format all status codes as a CSV reference sheet. */
export function exportAsCsv(): string {
  const header = "code,name,category,description,is_official";
  const lines = STATUS_CODES.map((s) =>
    `${s.code},"${s.name.replace(/"/g, '""')}","${s.categoryLabel}","${s.description.replace(/"/g, '""')}",${s.isOfficial}`,
  );
  return [header, ...lines].join("\n");
}

/** Format all status codes as a Markdown reference table. */
export function exportAsMarkdown(): string {
  const header = "| Code | Name | Category | Official | Description |\n|------|------|----------|----------|-------------|\n";
  const rows = STATUS_CODES.map((s) =>
    `| ${s.code} | ${s.name} | ${s.categoryLabel} | ${s.isOfficial ? "✅" : "❌"} | ${s.description.replace(/\|/g, "\\|")} |`,
  ).join("\n");
  return header + rows;
}

// ===== Extra #5: HTTP/2 vs HTTP/1.1 differences =====

export interface HttpVersionDiff {
  code: number;
  http1Behavior: string;
  http2Behavior: string;
  http3Behavior: string;
}

const HTTP_VERSION_DIFFS: Record<number, HttpVersionDiff> = {
  304: {
    code: 304,
    http1Behavior: "Headers sent as plain text.",
    http2Behavior: "Headers HPACK-compressed. 304 still works the same way.",
    http3Behavior: "Headers QPACK-compressed. Same semantics.",
  },
  421: {
    code: 421,
    http1Behavior: "Not used in HTTP/1.1.",
    http2Behavior: "Returned when HTTP/2 connection coalescing fails (server doesn't have a cert for the requested host).",
    http3Behavior: "Same as HTTP/2.",
  },
  425: {
    code: 425,
    http1Behavior: "Not used in HTTP/1.1.",
    http2Behavior: "Returned for TLS 1.3 0-RTT data to prevent replay attacks.",
    http3Behavior: "Same — used for 0-RTT replay protection.",
  },
};

export function getHttpVersionDiff(code: number): HttpVersionDiff | undefined {
  return HTTP_VERSION_DIFFS[code];
}

// ===== Extra #6: Status code quiz mode =====

export interface QuizQuestion {
  code: number;
  choices: number[];
  correctIndex: number;
}

/** Generate a quiz question: given a description, pick the right code. */
export function generateQuizQuestion(): QuizQuestion {
  const correct = STATUS_CODES[Math.floor(Math.random() * STATUS_CODES.length)];
  const wrongChoices = STATUS_CODES
    .filter((s) => s.category === correct.category && s.code !== correct.code)
    .slice(0, 3)
    .map((s) => s.code);
  const choices = [...wrongChoices, correct.code];
  // Shuffle
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return {
    code: correct.code,
    choices,
    correctIndex: choices.indexOf(correct.code),
  };
}

// ===== Extra #7: Related codes =====

/** Get codes related to the given one (same category). */
export function getRelatedCodes(code: number): StatusCodeInfo[] {
  const target = lookup(code);
  if (!target) return [];
  return byCategory(target.category).filter((s) => s.code !== code);
}

// ===== Extra #8: Copy as JSON =====

/** Format a status code as JSON. */
export function codeToJson(code: number): string {
  const info = lookup(code);
  const details = getCodeDetails(code);
  return JSON.stringify({
    ...info,
    details: details ?? null,
  }, null, 2);
}

// ===== Extra #9: Cheat sheet (common codes only) =====

export const CHEAT_SHEET_CODES = [200, 201, 204, 301, 302, 304, 400, 401, 403, 404, 405, 429, 500, 502, 503, 504];

export function getCheatSheet(): StatusCodeInfo[] {
  return CHEAT_SHEET_CODES.map((c) => lookup(c)).filter(Boolean) as StatusCodeInfo[];
}

// ===== Extra #10: Shareable URL =====

export function buildHttpShareUrl(code: number): string {
  return buildDeepLink(code);
}
