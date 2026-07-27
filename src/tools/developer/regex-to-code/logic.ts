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
