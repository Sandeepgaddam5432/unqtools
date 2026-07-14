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
