/**
 * JSON to Java POJO — pure logic.
 */

export function jsonToJava(json: string, className: string = "MyClass"): string {
  let parsed: any;
  try { parsed = JSON.parse(json); } catch { return "// Invalid JSON"; }
  return generateClass(parsed, className);
}

function generateClass(obj: any, className: string, indent: number = 0): string {
  const pad = "  ".repeat(indent);
  let out = `${pad}public class ${className} {\n`;
  const entries = Object.entries(obj);
  for (const [key, value] of entries) {
    const type = getJavaType(value, key);
    const capitalKey = key.charAt(0).toUpperCase() + key.slice(1);
    out += `${pad}  private ${type} ${key};\n`;
    out += `${pad}  public ${type} get${capitalKey}() { return this.${key}; }\n`;
    out += `${pad}  public void set${capitalKey}(${type} ${key}) { this.${key} = ${key}; }\n`;
  }
  out += `${pad}}\n`;
  return out;
}

function getJavaType(value: any, key: string): string {
  if (value === null) return "Object";
  if (typeof value === "string") return "String";
  if (typeof value === "number") return Number.isInteger(value) ? "Long" : "Double";
  if (typeof value === "boolean") return "Boolean";
  if (Array.isArray(value)) {
    if (value.length === 0) return "List<Object>";
    return `List<${getJavaType(value[0], key)}>`;
  }
  if (typeof value === "object") return key.charAt(0).toUpperCase() + key.slice(1);
  return "Object";
}

export function generateWithLombok(json: string, className: string = "MyClass"): string {
  let parsed: any;
  try { parsed = JSON.parse(json); } catch { return "// Invalid JSON"; }
  let out = `@Data\n@Builder\n@NoArgsConstructor\n@AllArgsConstructor\npublic class ${className} {\n`;
  for (const [key, value] of Object.entries(parsed)) {
    out += `  private ${getJavaType(value, key)} ${key};\n`;
  }
  out += `}\n`;
  return out;
}

export function generateImports(useLombok: boolean = false): string {
  const imports = [
    "import java.util.List;",
    "import java.util.ArrayList;",
  ];
  if (useLombok) {
    imports.unshift("import lombok.*;");
  }
  return imports.join("\n") + "\n\n";
}
