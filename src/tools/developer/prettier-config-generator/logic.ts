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
