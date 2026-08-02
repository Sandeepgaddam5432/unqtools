/**
 * Regex to Code (JS/Python/PHP) — pure logic.
 */
export function generateJS(pattern: string, flags: string, testString: string): string {
  return `const regex = /${pattern}/${flags};\nconst result = ${testString}.match(regex);\nconsole.log(result);`;
}
export function generatePython(pattern: string, flags: string, testString: string): string {
  const pyFlags = flags.includes("i") ? "re.IGNORECASE" : "0";
  return `import re\n\nregex = re.compile(r"${pattern}"${flags.includes("i") ? ", re.IGNORECASE" : ""})\nresult = regex.findall("${testString}")\nprint(result)`;
}
export function generatePHP(pattern: string, flags: string, testString: string): string {
  const phpFlags = flags.replace("g", "");
  return `<?php\n$pattern = '/${pattern}/${phpFlags}';\n$result = preg_match_all($pattern, "${testString}", $matches);\nprint_r($matches);\n?>`;
}
export function generateGo(pattern: string, flags: string, testString: string): string {
  return `package main\n\nimport (\n  "fmt"\n  "regexp"\n)\n\nfunc main() {\n  re := regexp.MustCompile(\`${pattern}\`)\n  matches := re.FindAllString("${testString}", -1)\n  fmt.Println(matches)\n}`;
}
export function generateRust(pattern: string, flags: string, testString: string): string {
  return `use regex::Regex;\n\nfn main() {\n  let re = Regex::new(r"${pattern}").unwrap();\n  let matches: Vec<&str> = re.find_iter("${testString}").map(|m| m.as_str()).collect();\n  println!("{:?}", matches);\n}`;
}
export function getAllLanguages(): { value: string; label: string; generator: (p: string, f: string, t: string) => string }[] {
  return [
    { value: "javascript", label: "JavaScript", generator: generateJS },
    { value: "python", label: "Python", generator: generatePython },
    { value: "php", label: "PHP", generator: generatePHP },
    { value: "go", label: "Go", generator: generateGo },
    { value: "rust", label: "Rust", generator: generateRust },
  ];
}
export function validatePattern(pattern: string): { valid: boolean; error?: string } {
  try { new RegExp(pattern); return { valid: true }; } catch (e) { return { valid: false, error: e instanceof Error ? e.message : "Invalid" }; }
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
    const result = generateJS(input);
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
