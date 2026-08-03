import { describe, it, expect } from "vitest";
import { generateAuthHeader, getAuthSchemes } from "./logic";

describe("API Authentication Header Builder", () => {
  describe("Bearer Token", () => {
    it("generates Bearer header", async () => {
      const result = await generateAuthHeader({ scheme: "bearer", token: "test-token-123" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.headerName).toBe("Authorization");
      expect(result.result.headerValue).toBe("Bearer test-token-123");
      expect(result.result.curlExample).toContain("Authorization");
    });

    it("fails without token", async () => {
      const result = await generateAuthHeader({ scheme: "bearer" });
      expect(result.ok).toBe(false);
    });
  });

  describe("Basic Auth", () => {
    it("generates Basic header", async () => {
      const result = await generateAuthHeader({
        scheme: "basic",
        username: "user",
        password: "pass",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.headerName).toBe("Authorization");
      expect(result.result.headerValue).toContain("Basic");
      // Verify base64 encoding
      const decoded = atob(result.result.headerValue.replace("Basic ", ""));
      expect(decoded).toBe("user:pass");
    });

    it("fails without username", async () => {
      const result = await generateAuthHeader({ scheme: "basic", password: "pass" });
      expect(result.ok).toBe(false);
    });
  });

  describe("API Key", () => {
    it("generates custom header", async () => {
      const result = await generateAuthHeader({
        scheme: "apikey",
        apiKey: "my-api-key",
        apiKeyHeader: "X-API-Key",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.headerName).toBe("X-API-Key");
      expect(result.result.headerValue).toBe("my-api-key");
    });

    it("uses default header name", async () => {
      const result = await generateAuthHeader({ scheme: "apikey", apiKey: "key" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.headerName).toBe("X-API-Key");
    });
  });

  describe("OAuth2", () => {
    it("generates OAuth2 header with default Bearer type", async () => {
      const result = await generateAuthHeader({
        scheme: "oauth2",
        accessToken: "oauth-token",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.headerValue).toBe("Bearer oauth-token");
    });

    it("supports custom token type", async () => {
      const result = await generateAuthHeader({
        scheme: "oauth2",
        accessToken: "token",
        tokenType: "MAC",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.headerValue).toBe("MAC token");
    });
  });

  describe("HMAC", () => {
    it("generates HMAC signature", async () => {
      const result = await generateAuthHeader({
        scheme: "hmac",
        hmacSecret: "secret",
        hmacPayload: "payload",
        hmacAlgorithm: "SHA-256",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.headerName).toBe("X-Signature");
      expect(result.result.headerValue).toContain("HMAC-Signature");
    });

    it("fails without secret", async () => {
      const result = await generateAuthHeader({
        scheme: "hmac",
        hmacPayload: "payload",
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("AWS4", () => {
    it("generates AWS credential header", async () => {
      const result = await generateAuthHeader({
        scheme: "aws4",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        region: "us-east-1",
        service: "execute-api",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.headerValue).toContain("AWS4-HMAC-SHA256");
      expect(result.result.headerValue).toContain("AKIAIOSFODNN7EXAMPLE");
    });
  });

  describe("NTLM", () => {
    it("generates NTLM negotiate header", async () => {
      const result = await generateAuthHeader({ scheme: "ntlm" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.result.headerValue).toContain("NTLM");
    });
  });

  describe("getAuthSchemes", () => {
    it("returns all supported schemes", () => {
      const schemes = getAuthSchemes();
      expect(schemes.length).toBeGreaterThan(0);
      expect(schemes.find(s => s.id === "bearer")).toBeDefined();
      expect(schemes.find(s => s.id === "basic")).toBeDefined();
      expect(schemes.find(s => s.id === "apikey")).toBeDefined();
    });
  });
});
