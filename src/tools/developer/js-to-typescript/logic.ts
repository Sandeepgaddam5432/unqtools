/**
 * JavaScript to TypeScript Converter — pure logic.
 */
export interface ConversionResult { output: string; warnings: string[]; conversions: number; }
export function convertJsToTs(code: string): ConversionResult {
  const warnings: string[] = [];
  let conversions = 0;
  let result = code;
  // var -> let/const
  result = result.replace(/\bvar\s+(\w+)/g, (_, name) => { conversions++; return `let ${name}`; });
  // function params: add any
  result = result.replace(/function\s+(\w+)\s*\(([^)]+)\)/g, (_, name, params) => {
    const typedParams = params.split(",").map((p: string) => p.trim()).filter(Boolean).map((p: string) => `${p}: any`).join(", ");
    conversions++;
    return `function ${name}(${typedParams})`;
  });
  // Arrow function params
  result = result.replace(/\(([^)]+)\)\s*=>/g, (_, params) => {
    const typedParams = params.split(",").map((p: string) => p.trim()).filter(Boolean).map((p: string) => `${p}: any`).join(", ");
    conversions++;
    return `(${typedParams}) =>`;
  });
  // Add :any return type to functions
  result = result.replace(/function\s+(\w+)\s*\(([^)]*)\)\s*{/g, (_, name, params) => { conversions++; return `function ${name}(${params}): any {`; });
  return { output: result, warnings, conversions };
}
export function inferType(value: any): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return value.length > 0 ? `${inferType(value[0])}[]` : "any[]";
  if (typeof value === "object") return "object";
  return typeof value;
}
export function generateInterface(obj: Record<string, any>, name: string = "MyInterface"): string {
  let out = `interface ${name} {\n`;
  for (const [key, value] of Object.entries(obj)) { out += `  ${key}: ${inferType(value)};\n`; }
  out += `}\n`;
  return out;
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
    const result = convertJsToTs(input);
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
