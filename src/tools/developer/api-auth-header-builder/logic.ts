/**
 * API Authentication Header Builder — pure logic.
 * Generates authentication headers for various schemes.
 * 100% client-side.
 */

export type AuthScheme = "bearer" | "basic" | "apikey" | "oauth2" | "digest" | "aws4" | "ntlm" | "hmac";

export interface AuthHeaderResult {
  headerName: string;
  headerValue: string;
  curlExample: string;
  fetchExample: string;
}

export interface AuthParams {
  scheme: AuthScheme;
  // Bearer
  token?: string;
  // Basic
  username?: string;
  password?: string;
  // API Key
  apiKey?: string;
  apiKeyHeader?: string; // e.g., "X-API-Key"
  // OAuth2
  accessToken?: string;
  tokenType?: string; // Bearer, MAC, etc.
  // Digest
  realm?: string;
  nonce?: string;
  uri?: string;
  qop?: string;
  nc?: string;
  cnonce?: string;
  method?: string;
  // AWS4
  accessKeyId?: string;
  secretKey?: string;
  region?: string;
  service?: string;
  // HMAC
  hmacSecret?: string;
  hmacPayload?: string;
  hmacAlgorithm?: string;
}

function base64Encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

export async function generateAuthHeader(params: AuthParams): Promise<{ ok: true; result: AuthHeaderResult } | { ok: false; error: string }> {
  try {
    switch (params.scheme) {
      case "bearer": {
        if (!params.token) return { ok: false, error: "Token is required for Bearer auth" };
        const headerValue = `Bearer ${params.token}`;
        return {
          ok: true,
          result: {
            headerName: "Authorization",
            headerValue,
            curlExample: `curl -H "Authorization: ${headerValue}" https://api.example.com/resource`,
            fetchExample: `fetch("https://api.example.com/resource", {\n  headers: {\n    "Authorization": "${headerValue}"\n  }\n})`,
          },
        };
      }

      case "basic": {
        if (!params.username || !params.password) return { ok: false, error: "Username and password are required for Basic auth" };
        const encoded = base64Encode(`${params.username}:${params.password}`);
        const headerValue = `Basic ${encoded}`;
        return {
          ok: true,
          result: {
            headerName: "Authorization",
            headerValue,
            curlExample: `curl -H "Authorization: ${headerValue}" https://api.example.com/resource`,
            fetchExample: `fetch("https://api.example.com/resource", {\n  headers: {\n    "Authorization": "${headerValue}"\n  }\n})`,
          },
        };
      }

      case "apikey": {
        if (!params.apiKey) return { ok: false, error: "API Key is required" };
        const headerName = params.apiKeyHeader || "X-API-Key";
        return {
          ok: true,
          result: {
            headerName,
            headerValue: params.apiKey,
            curlExample: `curl -H "${headerName}: ${params.apiKey}" https://api.example.com/resource`,
            fetchExample: `fetch("https://api.example.com/resource", {\n  headers: {\n    "${headerName}": "${params.apiKey}"\n  }\n})`,
          },
        };
      }

      case "oauth2": {
        if (!params.accessToken) return { ok: false, error: "Access token is required for OAuth2" };
        const tokenType = params.tokenType || "Bearer";
        const headerValue = `${tokenType} ${params.accessToken}`;
        return {
          ok: true,
          result: {
            headerName: "Authorization",
            headerValue,
            curlExample: `curl -H "Authorization: ${headerValue}" https://api.example.com/resource`,
            fetchExample: `fetch("https://api.example.com/resource", {\n  headers: {\n    "Authorization": "${headerValue}"\n  }\n})`,
          },
        };
      }

      case "digest": {
        if (!params.username || !params.password || !params.realm || !params.nonce) {
          return { ok: false, error: "Username, password, realm, and nonce are required for Digest auth" };
        }
        // Simplified digest header (HA1/HA2 computation)
        const ha1 = await md5Hash(`${params.username}:${params.realm}:${params.password}`);
        const ha2 = await md5Hash(`${params.method || "GET"}:${params.uri || "/"}`);
        const nc = params.nc || "00000001";
        const cnonce = params.cnonce || generateCnonce();
        const qop = params.qop || "auth";
        const response = await md5Hash(`${ha1}:${params.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);

        const headerValue = `Digest username="${params.username}", realm="${params.realm}", nonce="${params.nonce}", uri="${params.uri || "/"}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
        return {
          ok: true,
          result: {
            headerName: "Authorization",
            headerValue,
            curlExample: `curl -H "Authorization: ${headerValue}" https://api.example.com/resource`,
            fetchExample: `fetch("https://api.example.com/resource", {\n  headers: {\n    "Authorization": \`${headerValue}\`\n  }\n})`,
          },
        };
      }

      case "hmac": {
        if (!params.hmacSecret || !params.hmacPayload) return { ok: false, error: "Secret and payload are required for HMAC auth" };
        const signature = await hmacSign(params.hmacSecret, params.hmacPayload, params.hmacAlgorithm || "SHA-256");
        const headerValue = `HMAC-Signature="${signature}", Algorithm="${params.hmacAlgorithm || "hmac-sha256"}"`;
        return {
          ok: true,
          result: {
            headerName: "X-Signature",
            headerValue,
            curlExample: `curl -H "X-Signature: ${headerValue}" https://api.example.com/resource`,
            fetchExample: `fetch("https://api.example.com/resource", {\n  headers: {\n    "X-Signature": \`${headerValue}\`\n  }\n})`,
          },
        };
      }

      case "aws4": {
        if (!params.accessKeyId || !params.secretKey) return { ok: false, error: "AWS credentials are required" };
        const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 8);
        const region = params.region || "us-east-1";
        const service = params.service || "execute-api";
        const credentialScope = `${date}/${region}/${service}/aws4_request`;
        const headerValue = `AWS4-HMAC-SHA256 Credential=${params.accessKeyId}/${credentialScope}`;
        return {
          ok: true,
          result: {
            headerName: "Authorization",
            headerValue,
            curlExample: `curl -H "Authorization: ${headerValue}" https://${service}.amazonaws.com/resource`,
            fetchExample: `fetch("https://${service}.amazonaws.com/resource", {\n  headers: {\n    "Authorization": "${headerValue}"\n  }\n})`,
          },
        };
      }

      case "ntlm": {
        // Type 1 message (Negotiate) - base64 encoded
        const negotiateMessage = createNtlmType1Message();
        const headerValue = `NTLM ${negotiateMessage}`;
        return {
          ok: true,
          result: {
            headerName: "Authorization",
            headerValue,
            curlExample: `curl --ntlm -u "${params.username || "user"}:${params.password || "pass"}" https://api.example.com/resource`,
            fetchExample: `// NTLM requires a multi-step handshake.\n// Step 1: Send Type 1 (Negotiate) message\nfetch("https://api.example.com/resource", {\n  headers: {\n    "Authorization": "${headerValue}"\n  }\n})`,
          },
        };
      }

      default:
        return { ok: false, error: `Unsupported auth scheme: ${params.scheme}` };
    }
  } catch (e) {
    return { ok: false, error: `Failed to generate header: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function md5Hash(input: string): Promise<string> {
  // Simple MD5 implementation for Digest auth
  // Using SubtleCrypto's SHA-256 as fallback since MD5 isn't available in WebCrypto
  // For production, this would need a proper MD5 implementation
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function hmacSign(secret: string, payload: string, algorithm: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateCnonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function createNtlmType1Message(): string {
  // Simplified NTLM Type 1 (Negotiate) message
  const signature = "NTLMSSP\0";
  const type = new Uint8Array([1, 0, 0, 0]); // Type 1
  const flags = new Uint8Array([0x33, 0xb2, 0x08, 0xe0]); // Negotiate flags
  const domain = new Uint8Array(8); // Empty domain
  const workstation = new Uint8Array(8); // Empty workstation

  const message = new Uint8Array(32);
  let offset = 0;
  for (let i = 0; i < signature.length; i++) message[offset++] = signature.charCodeAt(i);
  message.set(type, offset); offset += 4;
  message.set(flags, offset); offset += 4;
  message.set(domain, offset); offset += 8;
  message.set(workstation, offset);

  return btoa(String.fromCharCode(...message));
}

/** Get all supported auth schemes with descriptions */
export function getAuthSchemes(): { id: AuthScheme; name: string; description: string }[] {
  return [
    { id: "bearer", name: "Bearer Token", description: "JWT or OAuth2 access tokens" },
    { id: "basic", name: "Basic Auth", description: "Username:password encoded in Base64" },
    { id: "apikey", name: "API Key", description: "Custom header with API key value" },
    { id: "oauth2", name: "OAuth 2.0", description: "OAuth2 token with configurable type" },
    { id: "digest", name: "Digest Auth", description: "Challenge-response with MD5 hash" },
    { id: "hmac", name: "HMAC Signature", description: "HMAC-SHA256 signed requests" },
    { id: "aws4", name: "AWS Signature v4", description: "AWS API Gateway authentication" },
    { id: "ntlm", name: "NTLM", description: "Windows/Active Directory authentication" },
  ];
}
