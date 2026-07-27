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
