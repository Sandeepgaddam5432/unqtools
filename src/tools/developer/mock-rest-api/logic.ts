/**
 * Mock REST API Generator — pure logic.
 */
export interface MockEndpoint { method: string; path: string; status: number; response: string; delay: number; }
export function generateMockServer(endpoints: MockEndpoint[], port: number = 3000): string {
  let code = `const http = require("http");\n\n`;
  code += `const server = http.createServer((req, res) => {\n`;
  for (const ep of endpoints) {
    code += `  if (req.method === "${ep.method}" && req.url === "${ep.path}") {\n`;
    if (ep.delay > 0) code += `    setTimeout(() => {\n`;
    code += `    res.writeHead(${ep.status}, { "Content-Type": "application/json" });\n`;
    code += `    res.end(${JSON.stringify(ep.response)});\n`;
    if (ep.delay > 0) code += `    }, ${ep.delay});\n`;
    code += `    return;\n  }\n\n`;
  }
  code += `  res.writeHead(404);\n  res.end("Not found");\n});\n\n`;
  code += `server.listen(${port}, () => console.log("Mock API running on port ${port}"));\n`;
  return code;
}
export function generateExpressMock(endpoints: MockEndpoint[], port: number = 3000): string {
  let code = `const express = require("express");\nconst app = express();\napp.use(express.json());\n\n`;
  for (const ep of endpoints) {
    const method = ep.method.toLowerCase();
    code += `app.${method}("${ep.path}", (req, res) => {\n`;
    if (ep.delay > 0) code += `  setTimeout(() => {\n`;
    code += `  res.status(${ep.status}).json(${ep.response});\n`;
    if (ep.delay > 0) code += `  }, ${ep.delay});\n`;
    code += `});\n\n`;
  }
  code += `app.listen(${port}, () => console.log("Mock API on ${port}"));\n`;
  return code;
}
export function getDefaultEndpoints(): MockEndpoint[] {
  return [
    { method: "GET", path: "/api/users", status: 200, response: '[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]', delay: 0 },
    { method: "GET", path: "/api/users/:id", status: 200, response: '{"id":1,"name":"Alice"}', delay: 0 },
    { method: "POST", path: "/api/users", status: 201, response: '{"id":3,"name":"Charlie"}', delay: 0 },
    { method: "PUT", path: "/api/users/:id", status: 200, response: '{"id":1,"name":"Updated"}', delay: 0 },
    { method: "DELETE", path: "/api/users/:id", status: 204, response: "", delay: 0 },
  ];
}
export function getStatusCodes(): { code: number; label: string }[] {
  return [{ code: 200, label: "OK" }, { code: 201, label: "Created" }, { code: 204, label: "No Content" }, { code: 400, label: "Bad Request" }, { code: 401, label: "Unauthorized" }, { code: 403, label: "Forbidden" }, { code: 404, label: "Not Found" }, { code: 500, label: "Internal Server Error" }];
}

// ============================================================================
// Backward-compat stub exports (added to satisfy UI template imports).
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getStats(input: string, output: string): {
  inputSize: number;
  outputSize: number;
} {
  return {
    inputSize: new Blob([input]).size,
    outputSize: new Blob([output]).size,
  };
}

export function validate(input: string): string[] {
  const issues: string[] = [];
  if (!input || input.trim().length === 0) {
    issues.push("Input is empty.");
  }
  return issues;
}

export function process(input: string): { output: string; error: string | null } {
  try {
    const result = generateMockServer(input);
    if (typeof result === "string") {
      return { output: result, error: null };
    }
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      const output =
        (typeof r.output === "string" && r.output) ||
        (typeof r.html === "string" && r.html) ||
        (typeof r.result === "string" && r.result) ||
        (typeof r.text === "string" && r.text) ||
        (typeof r.code === "string" && r.code) ||
        (typeof r.value === "string" && r.value) ||
        JSON.stringify(result, null, 2);
      const error =
        (typeof r.error === "string" && r.error) ||
        (r.ok === false && typeof r.message === "string" && r.message) ||
        null;
      return { output, error };
    }
    return { output: String(result), error: null };
  } catch (e) {
    return { output: "", error: (e as Error).message };
  }
}
