/**
 * Arrow Function Converter — converts between function declarations and arrow functions.
 */

export type Mode = "to-arrow" | "to-function";

export function convertToArrow(code: string): string {
  let result = code;
  // Convert: function name(params) { body } → const name = (params) => { body }
  result = result.replace(
    /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*\{/g,
    (_, name, params) => `const ${name} = (${params.trim()}) => {`
  );
  // Convert anonymous: function(params) { → (params) => {
  result = result.replace(
    /(?<![a-zA-Z0-9_$])function\s*\(([^)]*)\)\s*\{/g,
    (_, params) => `(${params.trim()}) => {`
  );
  // Convert: const x = function(params) { → const x = (params) => {
  result = result.replace(
    /=\s*function\s*\(([^)]*)\)\s*\{/g,
    (_, params) => `= (${params.trim()}) => {`
  );
  return result;
}

export function convertToFunction(code: string): string {
  let result = code;
  // const name = (params) => { → function name(params) {
  result = result.replace(
    /const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\(([^)]*)\)\s*=>\s*\{/g,
    (_, name, params) => `function ${name}(${params.trim()}) {`
  );
  // (params) => { used as callback → function(params) {
  result = result.replace(
    /\(([^)]*)\)\s*=>\s*\{/g,
    (_, params) => `function(${params.trim()}) {`
  );
  return result;
}

export function convert(code: string, mode: Mode): { ok: true; output: string; changes: number } | { ok: false; error: string } {
  if (!code.trim()) return { ok: false, error: "Code is empty" };
  const original = code;
  const output = mode === "to-arrow" ? convertToArrow(code) : convertToFunction(code);
  const changes = original.split("\n").filter((line, i) => line !== output.split("\n")[i]).length;
  return { ok: true, output, changes };
}

export function getStats(code: string) {
  const lines = code.split("\n");
  return {
    lines: lines.length,
    functionCount: (code.match(/function\s*[a-zA-Z(]/g) || []).length,
    arrowCount: (code.match(/=>/g) || []).length,
    chars: code.length,
  };
}
