import { describe, it, expect } from "vitest";
import { generateMockServer, generateExpressMock, getDefaultEndpoints, getStatusCodes } from "./logic";

describe("Mock REST API Generator", () => {
  it("generates mock server", () => {
    const code = generateMockServer(getDefaultEndpoints(), 3000);
    expect(code).toContain("http.createServer");
    expect(code).toContain("listen(3000)");
  });
  it("generates Express mock", () => {
    const code = generateExpressMock(getDefaultEndpoints(), 3000);
    expect(code).toContain("express()");
    expect(code).toContain("/api/users");
  });
  it("lists default endpoints", () => {
    expect(getDefaultEndpoints().length).toBeGreaterThan(3);
  });
  it("lists status codes", () => {
    expect(getStatusCodes().length).toBeGreaterThan(5);
    expect(getStatusCodes().some(s => s.code === 200)).toBe(true);
  });
});
