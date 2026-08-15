/**
 * Add Line Numbers — pure logic.
 */

export interface LineNumberResult {
  output: string;
  error?: string;
}

export function addLineNumbers(
  input: string,
  start = 1,
  step = 1,
  padding = 0,
  format = "%n: %t"
): LineNumberResult {
  if (!input && input !== "") return { output: "" };
  try {
    const lines = input.split(/\r?\n/);
    const out = lines
      .map((line, i) => {
        const num = start + i * step;
        const numStr = String(num).padStart(padding, "0");
        const text = format.replace("%n", numStr).replace("%t", line);
        return text;
      })
      .join("\n");
    return { output: out };
  } catch (e) {
    return { output: "", error: e instanceof Error ? e.message : String(e) };
  }
}

export function getStats(input: string, output: string) {
  return {
    inputSize: new TextEncoder().encode(input).length,
    outputSize: new TextEncoder().encode(output).length,
    ratio: input.length > 0 ? output.length / input.length : 0,
    lineCount: input.split(/\r?\n/).length,
  };
}
