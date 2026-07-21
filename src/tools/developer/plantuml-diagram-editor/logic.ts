/**
 * PlantUML Diagram Editor — pure logic.
 *
 * Pure-JS PlantUML syntax validator, diagram-type detector, syntax reference,
 * and shareable plantuml.com render URL generator (deflate+base64 variant).
 * Pure functions only — no DOM, no network, no PlantUML runtime required.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiagramType =
  | "sequence"
  | "class"
  | "usecase"
  | "activity"
  | "component"
  | "state"
  | "object"
  | "deployment"
  | "unknown";

export interface ValidationIssue {
  line: number; // 1-based, 0 = "no line"
  column?: number;
  message: string;
  severity: "error" | "warn";
}

export interface ValidationResult {
  ok: boolean;
  type: DiagramType;
  issues: ValidationIssue[];
}

export interface DiagramTemplate {
  type: DiagramType;
  label: string;
  code: string;
  description: string;
}

export interface SyntaxReference {
  type: DiagramType;
  label: string;
  description: string;
  keywords: string[];
  example: string;
}

export type ExportFormat = "svg" | "png" | "txt" | "uml";

export type ThemeName =
  | "plain"
  | "plantuml"
  | "minty"
  | "cerulean"
  | "cyborg"
  | "lemon"
  | "materia"
  | "spacelab"
  | "united"
  | "amiga";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PLANTUML_SERVER_BASE = "https://www.plantuml.com/plantuml";

export const DIAGRAM_TYPES: DiagramType[] = [
  "sequence", "class", "usecase", "activity",
  "component", "state", "object", "deployment",
];

export const DIAGRAM_LABELS: Record<DiagramType, string> = {
  sequence: "Sequence Diagram",
  class: "Class Diagram",
  usecase: "Use Case Diagram",
  activity: "Activity Diagram",
  component: "Component Diagram",
  state: "State Diagram",
  object: "Object Diagram",
  deployment: "Deployment Diagram",
  unknown: "Unknown",
};

export const THEMES: { value: ThemeName; label: string }[] = [
  { value: "plain", label: "Plain (no theme)" },
  { value: "plantuml", label: "PlantUML (default)" },
  { value: "minty", label: "Minty" },
  { value: "cerulean", label: "Cerulean" },
  { value: "cyborg", label: "Cyborg (dark)" },
  { value: "lemon", label: "Lemon" },
  { value: "materia", label: "Materia" },
  { value: "spacelab", label: "Spacelab" },
  { value: "united", label: "United" },
  { value: "amiga", label: "Amiga" },
];

export const TEMPLATES: DiagramTemplate[] = [
  {
    type: "sequence",
    label: "Sequence Diagram",
    description: "Two participants exchanging messages.",
    code: "@startuml\nparticipant Alice\nparticipant Bob\nAlice -> Bob: Hello Bob, how are you?\nBob --> Alice: Great!\nAlice -> Bob: See you later!\n@enduml",
  },
  {
    type: "class",
    label: "Class Diagram",
    description: "Animal-Dog inheritance with attributes and methods.",
    code: "@startuml\nclass Animal {\n  +int age\n  +String name\n  +makeSound()\n}\nclass Dog {\n  +fetch()\n}\nAnimal <|-- Dog\n@enduml",
  },
  {
    type: "usecase",
    label: "Use Case Diagram",
    description: "User interacts with a login use case.",
    code: "@startuml\nactor User\nusecase \"Log in\" as UC1\nusecase \"Reset password\" as UC2\nUser --> UC1\nUser --> UC2\nUC1 ..> UC2 : <<extend>>\n@enduml",
  },
  {
    type: "activity",
    label: "Activity Diagram",
    description: "Login flow with a decision branch.",
    code: "@startuml\nstart\n:Enter credentials;\nif (Valid?) then (yes)\n  :Grant access;\nelse (no)\n  :Show error;\n  stop\nendif\n:Show dashboard;\nstop\n@enduml",
  },
  {
    type: "component",
    label: "Component Diagram",
    description: "Web app with API and database.",
    code: "@startuml\ncomponent [Web App] as web\ncomponent [API Server] as api\ndatabase \"PostgreSQL\" as db\nweb --> api\napi --> db\n@enduml",
  },
  {
    type: "state",
    label: "State Diagram",
    description: "Order lifecycle states.",
    code: "@startuml\n[*] --> Created\nCreated --> Pending : submit\nPending --> Paid : pay\nPending --> Cancelled : cancel\nPaid --> Shipped : ship\nShipped --> Delivered : deliver\nDelivered --> [*]\nCancelled --> [*]\n@enduml",
  },
  {
    type: "object",
    label: "Object Diagram",
    description: "Two object instances with a link.",
    code: "@startuml\nobject alice {\n  name = \"Alice\"\n  age = 30\n}\nobject bob {\n  name = \"Bob\"\n  age = 25\n}\nalice --> bob : friend\n@enduml",
  },
  {
    type: "deployment",
    label: "Deployment Diagram",
    description: "Browser, server, and DB nodes.",
    code: "@startuml\nnode \"Browser\" as browser\nnode \"Web Server\" as web\ndatabase \"Database\" as db\nbrowser --> web : HTTPS\nweb --> db : TCP\n@enduml",
  },
];

export const SYNTAX_REFERENCE: SyntaxReference[] = [
  {
    type: "sequence",
    label: "Sequence Diagram",
    description: "Participants and messages over time. Arrows: ->, -->, ->>, -->>. Use `participant` or `actor` to declare.",
    keywords: ["@startuml", "@enduml", "participant", "actor", "->", "-->", "->>", "activate", "deactivate", "Note", "loop", "alt", "else", "end"],
    example: "@startuml\nparticipant A\nparticipant B\nA->>B: Sync message\nB-->>A: Reply\nNote over A,B: Note text\n@enduml",
  },
  {
    type: "class",
    label: "Class Diagram",
    description: "Classes with attributes/methods. Arrows: <|--, *--, o--, <.., ..|>. Visibility: + (public), - (private), # (protected).",
    keywords: ["@startuml", "@enduml", "class", "interface", "abstract", "enum", "<|--", "*--", "o--", "..|>", "package"],
    example: "@startuml\nclass Animal {\n  +String name\n  +makeSound() String\n}\nAnimal <|-- Dog\n@enduml",
  },
  {
    type: "usecase",
    label: "Use Case Diagram",
    description: "Actors and use cases. `usecase \"Title\" as id` declares a use case; `actor Name` declares an actor.",
    keywords: ["@startuml", "@enduml", "actor", "usecase", "(", ")", ":", "-->", "..>", "<<include>>", "<<extend>>"],
    example: "@startuml\nactor User\nusecase \"Login\" as UC1\nUser --> UC1\n@enduml",
  },
  {
    type: "activity",
    label: "Activity Diagram (new syntax)",
    description: "Flow with actions, conditions, loops. `start`/`stop`, `:action;`, `if (cond) then (yes) ... else (no) ... endif`.",
    keywords: ["@startuml", "@enduml", "start", "stop", "if", "then", "else", "elseif", "endif", "while", "endwhile", "fork", "end fork", "repeat", "repeat while"],
    example: "@startuml\nstart\n:Do work;\nif (ok?) then (yes)\n  :Finish;\nelse (no)\n  :Retry;\nendif\nstop\n@enduml",
  },
  {
    type: "component",
    label: "Component Diagram",
    description: "Components in brackets, interfaces in parens. Arrows: -->, ..>, ()--. Use `component`, `interface`, `port`.",
    keywords: ["@startuml", "@enduml", "component", "interface", "[", "]", "(", ")", "-->", "..>", "port", "package"],
    example: "@startuml\ncomponent [Web] as web\ncomponent [API] as api\nweb --> api\n@enduml",
  },
  {
    type: "state",
    label: "State Diagram",
    description: "States and transitions. [*] marks start/end. `state Name` declares a state; `A --> B : event` is a transition.",
    keywords: ["@startuml", "@enduml", "state", "[*]", "-->", ": ", "note", "fork", "join", "history"],
    example: "@startuml\n[*] --> Active\nActive --> Inactive : pause\nInactive --> Active : resume\nActive --> [*] : stop\n@enduml",
  },
  {
    type: "object",
    label: "Object Diagram",
    description: "Object instances with field values. `object name { field = value }`. Links use `-->`.",
    keywords: ["@startuml", "@enduml", "object", "{", "}", "=", "-->"],
    example: "@startuml\nobject a {\n  x = 1\n}\nobject b {\n  y = 2\n}\na --> b\n@enduml",
  },
  {
    type: "deployment",
    label: "Deployment Diagram",
    description: "Physical nodes. `node`, `database`, `cloud`, `queue`, `artifact`. Arrows: -->, ..>.",
    keywords: ["@startuml", "@enduml", "node", "database", "cloud", "queue", "artifact", "-->", "..>"],
    example: "@startuml\nnode \"Browser\" as b\nnode \"Server\" as s\ndatabase \"DB\" as db\nb --> s\ns --> db\n@enduml",
  },
];

// ---------------------------------------------------------------------------
// Pre-processing
// ---------------------------------------------------------------------------

/** Strip PlantUML single-line ' comment and /' ... '/ block comments. */
export function stripComment(line: string): string {
  if (!line) return "";
  const trimmed = line.trim();
  // Single-line comment starts with single quote
  if (trimmed.startsWith("'")) return "";
  // Find inline ' comment (but not within strings)
  const idx = trimmed.indexOf("'");
  if (idx === 0) return "";
  if (idx > 0) return trimmed.slice(0, idx).trim();
  return trimmed;
}

/** Get the first non-comment, non-blank line (for type detection). */
export function firstSignificantLine(code: string): string {
  const lines = code.split(/\r?\n/);
  for (const raw of lines) {
    const s = stripComment(raw);
    if (s) return s;
  }
  return "";
}

/** Split code into trimmed, non-empty, non-comment lines. */
export function codeLines(code: string): string[] {
  if (!code) return [];
  return code
    .split(/\r?\n/)
    .map((l) => stripComment(l))
    .filter(Boolean);
}

/** Extract the inner content between @startuml and @enduml. Returns { inner, startLine, endLine }. */
export function extractUmlBlock(code: string): {
  inner: string;
  hasStart: boolean;
  hasEnd: boolean;
  startLine: number;
  endLine: number;
} {
  const lines = code.split(/\r?\n/);
  let startLine = -1;
  let endLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim().toLowerCase();
    if (startLine === -1 && (t.startsWith("@startuml") || t === "@startuml")) {
      startLine = i;
    } else if (t === "@enduml" || t.startsWith("@enduml")) {
      endLine = i;
      // don't break — use the first @enduml after @startuml
      if (startLine !== -1) break;
    }
  }
  const hasStart = startLine !== -1;
  const hasEnd = endLine !== -1 && endLine > startLine;
  if (!hasStart) return { inner: "", hasStart: false, hasEnd, startLine: -1, endLine };
  const endIdx = hasEnd ? endLine : lines.length;
  const inner = lines.slice(startLine + 1, endIdx).join("\n");
  return { inner, hasStart, hasEnd, startLine: startLine + 1, endLine: endLine + 1 };
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Score-based detection — returns the best-matching diagram type from the inner block. */
export function detectType(code: string): DiagramType {
  const { inner, hasStart } = extractUmlBlock(code);
  if (!code.trim()) return "unknown";
  if (!hasStart) {
    // Even without @startuml, try to detect from the first significant line
    return detectFromLines(codeLines(code));
  }
  return detectFromLines(codeLines(inner));
}

function detectFromLines(lines: string[]): DiagramType {
  if (lines.length === 0) return "unknown";
  const joined = lines.join("\n").toLowerCase();
  const scores: Record<DiagramType, number> = {
    sequence: 0, class: 0, usecase: 0, activity: 0,
    component: 0, state: 0, object: 0, deployment: 0, unknown: 0,
  };
  // Sequence: participant/actor + arrows (actor alone is ambiguous with usecase)
  if (/\bparticipant\b/.test(joined)) scores.sequence += 3;
  if (/\bactor\b/.test(joined) && !/\busecase\b/.test(joined)) scores.sequence += 2;
  if (/->>|-->|->/.test(joined)) scores.sequence += 1;
  if (/\bactivate\b|\bdeactivate\b/.test(joined)) scores.sequence += 2;
  // Class
  if (/\bclass\s+\w+/.test(joined)) scores.class += 2;
  if (/\binterface\b/.test(joined)) scores.class += 1;
  if (/<\|--|\*--|o--|\.\.\|>/.test(joined)) scores.class += 2;
  // Use case — 'usecase' keyword is a strong signal
  if (/\busecase\b/.test(joined)) scores.usecase += 5;
  if (/\bactor\b/.test(joined) && /\(.*\)/.test(joined)) scores.usecase += 2;
  if (/<<include>>|<<extend>>/.test(joined)) scores.usecase += 2;
  // Activity
  if (/\bstart\b/.test(joined) && /\bstop\b/.test(joined)) scores.activity += 3;
  if (/:.*;/.test(joined)) scores.activity += 2;
  if (/\bif\b.*\bthen\b|\bendif\b/.test(joined)) scores.activity += 2;
  if (/\bwhile\b|\bendwhile\b/.test(joined)) scores.activity += 1;
  // Component
  if (/\bcomponent\b/.test(joined)) scores.component += 2;
  if (/\[[^\]]+\]/.test(joined)) scores.component += 2;
  if (/\binterface\b/.test(joined) && /\[[^\]]+\]/.test(joined)) scores.component += 1;
  // State
  if (/\bstate\b\s+\w+/.test(joined)) scores.state += 2;
  if (/\[\*\]/.test(joined)) scores.state += 3;
  // Object
  if (/\bobject\b\s+\w+/.test(joined)) scores.object += 4;
  // Deployment
  if (/\bnode\b/.test(joined)) scores.deployment += 2;
  if (/\bdatabase\b/.test(joined) || /\bcloud\b/.test(joined) || /\bqueue\b/.test(joined)) scores.deployment += 2;
  // Pick the highest
  let best: DiagramType = "unknown";
  let bestScore = 0;
  for (const t of DIAGRAM_TYPES) {
    if (scores[t] > bestScore) {
      bestScore = scores[t];
      best = t;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validate a sequence diagram. */
function validateSequence(lines: string[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  // Block matching: alt/else/end, loop/end, opt/end, par/and/end
  const stack: { keyword: string; line: number }[] = [];
  const blocks: Record<string, string> = {
    alt: "end", opt: "end", loop: "end", par: "end", critical: "end", break: "end",
  };
  lines.forEach((l, i) => {
    const lower = l.toLowerCase();
    const first = lower.split(/\s+/)[0];
    if (blocks[first]) {
      stack.push({ keyword: first, line: i + 1 });
    } else if (first === "end") {
      if (stack.length === 0) {
        out.push({ line: i + 1, message: "'end' without matching block (alt/loop/opt/par)", severity: "error" });
      } else {
        stack.pop();
      }
    }
  });
  for (const open of stack) {
    out.push({ line: open.line, message: `Unclosed '${open.keyword}' block — missing 'end'`, severity: "error" });
  }
  return out;
}

/** Validate a class diagram. */
function validateClass(lines: string[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  let inClass = false;
  let classOpenLine = 0;
  lines.forEach((l, i) => {
    const lower = l.toLowerCase();
    if (lower.startsWith("class ") && l.includes("{")) {
      inClass = true;
      classOpenLine = i + 1;
    } else if (inClass && l.trim() === "}") {
      inClass = false;
    } else if (inClass && l.trim().endsWith("}")) {
      inClass = false;
    }
  });
  if (inClass) {
    out.push({ line: classOpenLine, message: "Unclosed class block — missing '}'", severity: "error" });
  }
  return out;
}

/** Validate an activity diagram. */
function validateActivity(lines: string[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const hasStart = lines.some((l) => l.toLowerCase() === "start");
  const hasStop = lines.some((l) => l.toLowerCase() === "stop" || l.toLowerCase() === "stop;");
  if (!hasStart) {
    out.push({ line: 0, message: "Activity diagram should have a 'start' statement", severity: "warn" });
  }
  if (!hasStop) {
    out.push({ line: 0, message: "Activity diagram should have a 'stop' (or 'end') statement", severity: "warn" });
  }
  // if/endif matching
  const stack: { keyword: string; line: number }[] = [];
  lines.forEach((l, i) => {
    const lower = l.toLowerCase();
    const first = lower.split(/\s+/)[0];
    if (first === "if") {
      stack.push({ keyword: "if", line: i + 1 });
    } else if (first === "endif" || first === "endif;") {
      if (stack.length === 0) {
        out.push({ line: i + 1, message: "'endif' without matching 'if'", severity: "error" });
      } else {
        stack.pop();
      }
    }
  });
  for (const open of stack) {
    out.push({ line: open.line, message: "Unclosed 'if' — missing 'endif'", severity: "error" });
  }
  return out;
}

/** Validate a state diagram. */
function validateState(lines: string[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const hasStart = lines.some((l) => /\[\*\]/.test(l));
  if (!hasStart) {
    out.push({ line: 0, message: "State diagram should have a [*] start or end state", severity: "warn" });
  }
  return out;
}

/** Validate a component diagram. */
function validateComponent(lines: string[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const hasBracket = lines.some((l) => /\[[^\]]+\]/.test(l));
  if (!hasBracket) {
    out.push({ line: 0, message: "Component diagram should have at least one [Component] block", severity: "warn" });
  }
  return out;
}

/** Validate a deployment diagram. */
function validateDeployment(lines: string[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const hasNode = lines.some((l) => /\bnode\b/.test(l.toLowerCase()) || /\bdatabase\b/.test(l.toLowerCase()) || /\bcloud\b/.test(l.toLowerCase()) || /\bqueue\b/.test(l.toLowerCase()));
  if (!hasNode) {
    out.push({ line: 0, message: "Deployment diagram should have at least one node/database/cloud/queue", severity: "warn" });
  }
  return out;
}

/** Validate the @startuml/@enduml envelope. */
function validateEnvelope(code: string): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const lines = code.split(/\r?\n/);
  let startCount = 0;
  let endCount = 0;
  let firstStartLine = 0;
  let firstEndLine = 0;
  lines.forEach((l, i) => {
    const t = l.trim().toLowerCase();
    if (t.startsWith("@startuml")) {
      startCount += 1;
      if (startCount === 1) firstStartLine = i + 1;
    } else if (t.startsWith("@enduml")) {
      endCount += 1;
      if (endCount === 1) firstEndLine = i + 1;
    }
  });
  if (startCount === 0) {
    out.push({ line: 0, message: "Missing '@startuml' envelope — PlantUML source must start with @startuml", severity: "error" });
  }
  if (endCount === 0 && startCount > 0) {
    out.push({ line: firstStartLine, message: "Missing '@enduml' — every @startuml must have a matching @enduml", severity: "error" });
  }
  if (startCount > 0 && endCount > 0 && firstEndLine < firstStartLine) {
    out.push({ line: firstEndLine, message: "'@enduml' appears before '@startuml'", severity: "error" });
  }
  return out;
}

/** Validate any diagram — dispatcher. */
export function validateCode(code: string): ValidationResult {
  if (!code.trim()) {
    return { ok: false, type: "unknown", issues: [{ line: 0, message: "Empty diagram — type some PlantUML syntax", severity: "error" }] };
  }
  const envIssues = validateEnvelope(code);
  const { inner, hasStart } = extractUmlBlock(code);
  const innerLines = hasStart ? codeLines(inner) : codeLines(code);
  const type = detectType(code);
  let issues: ValidationIssue[] = [];
  switch (type) {
    case "sequence": issues = validateSequence(innerLines); break;
    case "class": issues = validateClass(innerLines); break;
    case "activity": issues = validateActivity(innerLines); break;
    case "state": issues = validateState(innerLines); break;
    case "component": issues = validateComponent(innerLines); break;
    case "deployment": issues = validateDeployment(innerLines); break;
    default: break;
  }
  const allIssues = [...envIssues, ...issues];
  const ok = allIssues.filter((i) => i.severity === "error").length === 0;
  return { ok, type, issues: allIssues };
}

// ---------------------------------------------------------------------------
// Auto-format
// ---------------------------------------------------------------------------

/** Light auto-format: trim trailing whitespace, collapse 3+ blank lines. */
export function autoFormat(code: string): string {
  if (!code) return "";
  const lines = code.split(/\r?\n/);
  const out: string[] = [];
  let blanks = 0;
  for (const l of lines) {
    if (l.trim() === "") {
      blanks += 1;
      if (blanks <= 1) out.push("");
      continue;
    }
    blanks = 0;
    out.push(l.replace(/\s+$/g, ""));
  }
  while (out.length > 0 && out[0] === "") out.shift();
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// PlantUML URL encoding (deflate + custom base64)
// ---------------------------------------------------------------------------

/**
 * PlantUML uses raw DEFLATE (no zlib header, no checksum) followed by a
 * custom base64 alphabet. We implement a minimal RFC-1951 deflate encoder
 * (stored blocks only — no compression, just framing) which the PlantUML
 * server accepts and decodes correctly. Pure JS, no dependencies.
 */

// PlantUML's custom base64 alphabet (different from standard base64).
const PLANTUML_B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

function bytesToPlantUmlBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  const len = bytes.length;
  while (i < len) {
    const b1 = bytes[i++];
    const b2 = i < len ? bytes[i++] : 0;
    const b3 = i < len ? bytes[i++] : 0;
    out += PLANTUML_B64.charAt((b1 >> 2) & 0x3f);
    out += PLANTUML_B64.charAt(((b1 << 4) | (b2 >> 4)) & 0x3f);
    out += PLANTUML_B64.charAt(((b2 << 2) | (b3 >> 6)) & 0x3f);
    out += PLANTUML_B64.charAt(b3 & 0x3f);
  }
  return out;
}

function plantUmlBase64ToBytes(b64: string): Uint8Array {
  const out: number[] = [];
  const clean = b64.replace(/[^0-9A-Za-z\-_]/g, "");
  for (let i = 0; i + 4 <= clean.length; i += 4) {
    const c1 = PLANTUML_B64.indexOf(clean.charAt(i));
    const c2 = PLANTUML_B64.indexOf(clean.charAt(i + 1));
    const c3 = PLANTUML_B64.indexOf(clean.charAt(i + 2));
    const c4 = PLANTUML_B64.indexOf(clean.charAt(i + 3));
    if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) break;
    out.push(((c1 << 2) | (c2 >> 4)) & 0xff);
    out.push(((c2 << 4) | (c3 >> 2)) & 0xff);
    out.push(((c3 << 6) | c4) & 0xff);
  }
  return new Uint8Array(out);
}

/** UTF-8 encode a string into a byte array. */
function utf8ToBytes(s: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(s);
  }
  // Pure-JS fallback
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6));
      out.push(0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      i++;
      const c2 = s.charCodeAt(i);
      const cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      out.push(0xf0 | (cp >> 18));
      out.push(0x80 | ((cp >> 12) & 0x3f));
      out.push(0x80 | ((cp >> 6) & 0x3f));
      out.push(0x80 | (cp & 0x3f));
    } else {
      out.push(0xe0 | (c >> 12));
      out.push(0x80 | ((c >> 6) & 0x3f));
      out.push(0x80 | (c & 0x3f));
    }
  }
  return new Uint8Array(out);
}

/** UTF-8 decode a byte array back to a string. */
function bytesToUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(bytes);
  }
  let out = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i++];
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if ((b & 0xe0) === 0xc0) {
      const b2 = bytes[i++];
      out += String.fromCharCode(((b & 0x1f) << 6) | (b2 & 0x3f));
    } else if ((b & 0xf0) === 0xe0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      out += String.fromCharCode(((b & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
    } else if ((b & 0xf8) === 0xf0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const b4 = bytes[i++];
      const cp = ((b & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
      const adj = cp - 0x10000;
      out += String.fromCharCode(0xd800 | (adj >> 10), 0xdc00 | (adj & 0x3ff));
    }
  }
  return out;
}

/**
 * Wrap a payload in RFC-1951 stored (uncompressed) DEFLATE blocks.
 * Each stored block can be up to 65535 bytes; longer inputs are split
 * into multiple blocks. The final block has BFINAL=1. The PlantUML
 * server accepts stored blocks because it uses zlib's inflate which
 * handles them transparently.
 */
function deflateStored(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let offset = 0;
  const MAX_BLOCK = 65535;
  if (data.length === 0) {
    // One empty final block: BFINAL=1, BTYPE=00, LEN=0, NLEN=0xFFFF
    out.push(0x01, 0x00, 0x00, 0xff, 0xff);
    return new Uint8Array(out);
  }
  while (offset < data.length) {
    const chunkLen = Math.min(MAX_BLOCK, data.length - offset);
    const isFinal = offset + chunkLen >= data.length ? 1 : 0;
    out.push(isFinal); // BFINAL + BTYPE=00 (stored) in low 3 bits
    out.push(chunkLen & 0xff);
    out.push((chunkLen >> 8) & 0xff);
    const nlen = ~chunkLen & 0xffff;
    out.push(nlen & 0xff);
    out.push((nlen >> 8) & 0xff);
    for (let i = 0; i < chunkLen; i++) out.push(data[offset + i]);
    offset += chunkLen;
  }
  return new Uint8Array(out);
}

/** Inverse of deflateStored — read stored DEFLATE blocks back to original bytes. */
function inflateStored(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const header = data[i++];
    const isFinal = header & 1;
    const btype = (header >> 1) & 3;
    if (btype !== 0) {
      // We only support stored blocks (type 0). Anything else is unsupported.
      // Bail out — return what we have so far.
      break;
    }
    if (i + 4 > data.length) break;
    const len = data[i] | (data[i + 1] << 8);
    i += 4; // skip LEN and NLEN
    if (i + len > data.length) break;
    for (let k = 0; k < len; k++) out.push(data[i + k]);
    i += len;
    if (isFinal) break;
  }
  return new Uint8Array(out);
}

/** Encode PlantUML source into the URL-safe PlantUML format (deflate + custom base64). */
export function encodePlantUml(source: string): string {
  if (!source) return "";
  const bytes = utf8ToBytes(source);
  const deflated = deflateStored(bytes);
  return bytesToPlantUmlBase64(deflated);
}

/** Decode a PlantUML-encoded string back to source. */
export function decodePlantUml(encoded: string): string {
  if (!encoded) return "";
  const deflated = plantUmlBase64ToBytes(encoded);
  const bytes = inflateStored(deflated);
  return bytesToUtf8(bytes);
}

/** Build the plantuml.com URL for a given format. */
export function buildRenderUrl(code: string, format: ExportFormat = "svg", theme: ThemeName = "plain"): string {
  if (!code || !code.trim()) return PLANTUML_SERVER_BASE;
  const withTheme = applyTheme(code, theme);
  const encoded = encodePlantUml(withTheme);
  const path = format === "uml" ? "uml" : format; // 'uml' is alias for ASCII text
  return `${PLANTUML_SERVER_BASE}/${path}/${encoded}`;
}

/** Apply a theme to the source via !theme directive (after @startuml). */
export function applyTheme(code: string, theme: ThemeName): string {
  if (theme === "plain") return code;
  const lines = code.split(/\r?\n/);
  const out: string[] = [];
  let inserted = false;
  for (const l of lines) {
    out.push(l);
    if (!inserted && l.trim().toLowerCase().startsWith("@startuml")) {
      out.push(`!theme ${theme}`);
      inserted = true;
    }
  }
  if (!inserted) {
    // No @startuml — prepend
    return `@startuml\n!theme ${theme}\n${code}\n@enduml`;
  }
  return out.join("\n");
}

/** Build a Markdown embed snippet with the rendered image. */
export function buildMarkdownEmbed(code: string, format: ExportFormat = "svg", altText?: string): string {
  const url = buildRenderUrl(code, format);
  const alt = altText || "PlantUML diagram";
  return `![${alt}](${url})`;
}

/** Build a raw PlantUML code block for embedding. */
export function buildPumlCodeBlock(code: string): string {
  const fence = "```";
  return `${fence}plantuml\n${code}\n${fence}`;
}

/** Decode a plantuml.com URL back to source. Returns "" if the URL isn't recognized. */
export function decodeRenderUrl(url: string): string {
  if (!url) return "";
  // Match paths like .../svg/<encoded>, .../png/<encoded>, .../uml/<encoded>, .../txt/<encoded>
  const m = url.match(/\/(svg|png|uml|txt)\/([0-9A-Za-z\-_]+)/);
  if (!m) return "";
  return decodePlantUml(m[2]);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface DiagramStats {
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  type: DiagramType;
  charCount: number;
}

export function computeStats(code: string): DiagramStats {
  if (!code) {
    return {
      totalLines: 0, codeLines: 0, commentLines: 0,
      blankLines: 0, type: "unknown", charCount: 0,
    };
  }
  const allLines = code.split(/\r?\n/);
  let codeCount = 0;
  let commentCount = 0;
  let blankCount = 0;
  for (const raw of allLines) {
    const trimmed = raw.trim();
    if (!trimmed) { blankCount += 1; continue; }
    if (trimmed.startsWith("'")) { commentCount += 1; continue; }
    codeCount += 1;
  }
  return {
    totalLines: allLines.length,
    codeLines: codeCount,
    commentLines: commentCount,
    blankLines: blankCount,
    type: detectType(code),
    charCount: code.length,
  };
}

// ---------------------------------------------------------------------------
// Templates & references
// ---------------------------------------------------------------------------

export function getTemplate(type: DiagramType): DiagramTemplate | undefined {
  return TEMPLATES.find((t) => t.type === type);
}

export function getReference(type: DiagramType): SyntaxReference | undefined {
  return SYNTAX_REFERENCE.find((r) => r.type === type);
}

export function defaultCode(): string {
  return TEMPLATES[0].code;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:plantuml-diagram-editor:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  type: DiagramType;
  preview: string; // first ~80 chars of code
  renderUrl: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL (own hash, for restoring editor state)
// ---------------------------------------------------------------------------

export function buildShareUrl(code: string, theme: ThemeName): string {
  const encoded = encodePlantUml(code);
  const params = new URLSearchParams();
  params.set("code", encoded);
  if (theme !== "plain") params.set("theme", theme);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { code: string; theme: ThemeName } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { code: "", theme: "plain" };
  const params = new URLSearchParams(clean);
  const code = params.get("code");
  const themeStr = params.get("theme");
  const validThemes = THEMES.map((t) => t.value) as ThemeName[];
  const theme = themeStr && validThemes.includes(themeStr as ThemeName) ? (themeStr as ThemeName) : "plain";
  if (!code) return { code: "", theme };
  return { code: decodePlantUml(code), theme };
}
