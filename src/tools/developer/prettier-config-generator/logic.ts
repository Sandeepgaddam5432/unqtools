/**
 * Prettier Config Generator — pure logic.
 */

export interface PrettierConfig {
  printWidth: number;
  tabWidth: number;
  useTabs: boolean;
  semi: boolean;
  singleQuote: boolean;
  trailingComma: "none" | "es5" | "all";
  bracketSpacing: boolean;
  bracketSameLine: boolean;
  arrowParens: "always" | "avoid";
  endOfLine: "lf" | "crlf" | "auto";
  jsxSingleQuote: boolean;
  jsxBracketSameLine: boolean;
}

export function defaultConfig(): PrettierConfig {
  return { printWidth: 80, tabWidth: 2, useTabs: false, semi: true, singleQuote: false, trailingComma: "es5", bracketSpacing: true, bracketSameLine: false, arrowParens: "always", endOfLine: "lf", jsxSingleQuote: false, jsxBracketSameLine: false };
}

export function generateJSON(config: PrettierConfig): string {
  return JSON.stringify(config, null, 2);
}

export function generateYAML(config: PrettierConfig): string {
  let yaml = "# .prettierrc.yaml\n";
  for (const [key, value] of Object.entries(config)) {
    const yamlValue = typeof value === "string" ? `"${value}"` : typeof value === "boolean" ? value : value;
    yaml += `${key}: ${yamlValue}\n`;
  }
  return yaml;
}

export function generateJS(config: PrettierConfig): string {
  return `module.exports = ${JSON.stringify(config, null, 2)};\n`;
}

export function generateToml(config: PrettierConfig): string {
  let toml = "# .prettierrc.toml\n";
  for (const [key, value] of Object.entries(config)) {
    const tomlValue = typeof value === "string" ? `"${value}"` : typeof value === "boolean" ? value : value;
    toml += `${key} = ${tomlValue}\n`;
  }
  return toml;
}

export function getPresets(): { name: string; config: Partial<PrettierConfig> }[] {
  return [
    { name: "Default", config: {} },
    { name: "Airbnb", config: { singleQuote: true, trailingComma: "all", arrowParens: "always" } },
    { name: "Standard", config: { singleQuote: true, semi: false, trailingComma: "es5" } },
    { name: "Prettier 3", config: { trailingComma: "all" } },
    { name: "Minimal", config: { printWidth: 120, semi: false, singleQuote: true } },
  ];
}

export function validate(config: PrettierConfig): string[] {
  const errors: string[] = [];
  if (config.printWidth < 40 || config.printWidth > 200) errors.push("printWidth should be 40-200");
  if (config.tabWidth < 1 || config.tabWidth > 8) errors.push("tabWidth should be 1-8");
  if (!["none", "es5", "all"].includes(config.trailingComma)) errors.push("Invalid trailingComma");
  if (!["always", "avoid"].includes(config.arrowParens)) errors.push("Invalid arrowParens");
  if (!["lf", "crlf", "auto"].includes(config.endOfLine)) errors.push("Invalid endOfLine");
  return errors;
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

export function process(input: string): { output: string; error: string | null } {
  try {
    const result = generateJSON(input);
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
