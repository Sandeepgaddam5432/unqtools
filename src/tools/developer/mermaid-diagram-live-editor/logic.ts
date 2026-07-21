/**
 * Mermaid Diagram Live Editor — pure logic.
 *
 * Pure-JS Mermaid syntax validator, diagram type detector, syntax reference,
 * and shareable mermaid.live URL generator. Pure functions only — no DOM,
 * no network, no mermaid runtime required.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiagramType =
  | "flowchart"
  | "sequence"
  | "class"
  | "er"
  | "gantt"
  | "pie"
  | "state"
  | "mindmap"
  | "gitGraph"
  | "journey"
  | "c4"
  | "timeline"
  | "quadrant"
  | "requirement"
  | "xychart"
  | "unknown";

export interface ValidationIssue {
  line: number; // 1-based
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MERMAID_LIVE_BASE = "https://mermaid.live/edit";

export const DIAGRAM_TYPES: DiagramType[] = [
  "flowchart", "sequence", "class", "er", "gantt", "pie", "state",
  "mindmap", "gitGraph", "journey", "c4", "timeline", "quadrant",
  "requirement", "xychart",
];

export const DIAGRAM_LABELS: Record<DiagramType, string> = {
  flowchart: "Flowchart",
  sequence: "Sequence Diagram",
  class: "Class Diagram",
  er: "ER Diagram",
  gantt: "Gantt Chart",
  pie: "Pie Chart",
  state: "State Diagram",
  mindmap: "Mindmap",
  gitGraph: "Git Graph",
  journey: "User Journey",
  c4: "C4 Diagram",
  timeline: "Timeline",
  quadrant: "Quadrant Chart",
  requirement: "Requirement Diagram",
  xychart: "XY Chart",
  unknown: "Unknown",
};

/** Map of Mermaid source-line keywords → diagram type. */
export const TYPE_KEYWORDS: Record<string, DiagramType> = {
  "flowchart": "flowchart",
  "graph": "flowchart",
  "flowchart-v2": "flowchart",
  "sequencediagram": "sequence",
  "classdiagram": "class",
  "classdiagram-v2": "class",
  "erdiagram": "er",
  "gantt": "gantt",
  "pie": "pie",
  "statediagram": "state",
  "statediagram-v2": "state",
  "mindmap": "mindmap",
  "gitgraph": "gitGraph",
  "journey": "journey",
  "c4context": "c4",
  "c4container": "c4",
  "c4component": "c4",
  "c4dynamic": "c4",
  "c4deployment": "c4",
  "timeline": "timeline",
  "quadrantchart": "quadrant",
  "requirementdiagram": "requirement",
  "xychart-beta": "xychart",
};

export const TEMPLATES: DiagramTemplate[] = [
  {
    type: "flowchart",
    label: "Flowchart (TD)",
    description: "Top-down flowchart with two nodes connected by an arrow.",
    code: "flowchart TD\n    A[Start] --> B{Decision?}\n    B -- Yes --> C[Do it]\n    B -- No --> D[Skip]\n    C --> E[End]\n    D --> E",
  },
  {
    type: "sequence",
    label: "Sequence Diagram",
    description: "Two actors exchanging messages.",
    code: "sequenceDiagram\n    participant Alice\n    participant Bob\n    Alice->>Bob: Hello Bob, how are you?\n    Bob-->>Alice: Great!\n    Alice-)Bob: See you later!",
  },
  {
    type: "class",
    label: "Class Diagram",
    description: "Two classes with inheritance.",
    code: "classDiagram\n    Animal <|-- Dog\n    Animal: +int age\n    Animal: +String name\n    Animal: +makeSound()\n    class Dog {\n      +fetch()\n    }",
  },
  {
    type: "er",
    label: "ER Diagram",
    description: "Customer-Order-Product entity relationship.",
    code: "erDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n    CUSTOMER {\n      string name\n      string email\n    }\n    ORDER {\n      int orderNumber\n      string deliveryAddress\n    }",
  },
  {
    type: "gantt",
    label: "Gantt Chart",
    description: "Project timeline with sections.",
    code: "gantt\n    title A Gantt Diagram\n    dateFormat YYYY-MM-DD\n    section Section\n    A task           :a1, 2024-01-01, 30d\n    Another task     :after a1, 20d\n    section Another\n    Task in sec      :2024-01-12, 12d\n    next task        :24d",
  },
  {
    type: "pie",
    label: "Pie Chart",
    description: "Distribution of pets.",
    code: "pie title Pets adopted by volunteers\n    \"Dogs\" : 386\n    \"Cats\" : 85\n    \"Rats\" : 15",
  },
  {
    type: "state",
    label: "State Diagram (v2)",
    description: "State machine with transitions.",
    code: "stateDiagram-v2\n    [*] --> Still\n    Still --> [*]\n    Still --> Moving\n    Moving --> Still\n    Moving --> Crash\n    Crash --> [*]",
  },
  {
    type: "mindmap",
    label: "Mindmap",
    description: "Root with three branches.",
    code: "mindmap\n  root((Mindmap))\n    Origins\n      Long history\n      ::icon(fa fa-book)\n    Research\n      On effectives\n      Of visual learning\n    Tools\n      Pen & paper\n      Mermaid",
  },
  {
    type: "gitGraph",
    label: "Git Graph",
    description: "Commit graph with branches.",
    code: "gitGraph\n    commit\n    commit\n    branch develop\n    checkout develop\n    commit\n    checkout main\n    merge develop\n    commit",
  },
  {
    type: "journey",
    label: "User Journey",
    description: "User's shopping experience.",
    code: "journey\n    title My working day\n    section Go to work\n      Make tea: 5: Me\n      Go upstairs: 3: Me\n      Do work: 1: Me, Cat\n    section Come home\n      Go downstairs: 5: Me\n      Sit down: 5: Me",
  },
  {
    type: "c4",
    label: "C4 Context Diagram",
    description: "System context view.",
    code: "C4Context\n    title System Context diagram for Internet Banking System\n    Person(customer, \"Banking Customer\", \"A customer of the bank\")\n    System(banking, \"Internet Banking System\")\n    Rel(customer, banking, \"Uses\")",
  },
  {
    type: "timeline",
    label: "Timeline",
    description: "History of a project.",
    code: "timeline\n    title History of Social Media Platform\n    2002 : LinkedIn\n    2004 : Facebook\n    2005 : Youtube\n    2006 : Twitter",
  },
  {
    type: "quadrant",
    label: "Quadrant Chart",
    description: "Reach vs engagement.",
    code: "quadrantChart\n    title Reach and engagement of campaigns\n    x-axis Low Reach --> High Reach\n    y-axis Low Engagement --> High Engagement\n    quadrant-1 We should expand\n    quadrant-2 Need to promote\n    quadrant-3 Re-evaluate\n    quadrant-4 May be improved\n    Campaign A: [0.3, 0.6]\n    Campaign B: [0.45, 0.23]",
  },
  {
    type: "requirement",
    label: "Requirement Diagram",
    description: "Requirement with sub-requirements.",
    code: "requirementDiagram\n    requirement Test_req {\n      id: 1\n      text: the test text.\n      risk: high\n      verifymethod: test\n    }\n    element Test_entity {\n      type: simulation\n    }\n    Test_entity - satisfies -> Test_req",
  },
  {
    type: "xychart",
    label: "XY Chart (beta)",
    description: "Line chart with x and y axes.",
    code: "xychart-beta\n    title \"Sales Revenue\"\n    x-axis [jan, feb, mar, apr, may, jun, jul]\n    y-axis \"Revenue (in $)\" 0 --> 400\n    bar [100, 200, 150, 300, 250, 350, 380]\n    line [100, 200, 150, 300, 250, 350, 380]",
  },
];

export const SYNTAX_REFERENCE: SyntaxReference[] = [
  {
    type: "flowchart",
    label: "Flowchart",
    description: "Nodes connected by arrows. Supports shapes ([], (), {}, >], [/]) and arrow types (-->, ---, -.->, ==>, --x, --o).",
    keywords: ["flowchart", "graph", "TD", "LR", "RL", "BT", "subgraph"],
    example: "flowchart LR\n  A[Square] --> B(Round)\n  B --> C{Diamond}\n  C -- Yes --> D[(Database)]\n  C -- No --> E[/Input/]",
  },
  {
    type: "sequence",
    label: "Sequence Diagram",
    description: "Participants and messages over time. Arrows: ->, -->, ->>, -->>, -), --), -x, --x.",
    keywords: ["sequencediagram", "participant", "actor", "autonumber", "Note", "loop", "alt", "opt"],
    example: "sequenceDiagram\n  participant A\n  participant B\n  A->>B: Sync message\n  B-->>A: Reply\n  Note over A,B: Note text",
  },
  {
    type: "class",
    label: "Class Diagram",
    description: "Classes, attributes, methods, and relationships. Arrows: <|--, *--, o--, <--, ..|>, --.",
    keywords: ["classdiagram", "class", "interface", "namespace", "direction"],
    example: "classDiagram\n  class Animal {\n    +String name\n    +int age\n    +makeSound() String\n  }\n  Animal <|-- Dog",
  },
  {
    type: "er",
    label: "ER Diagram",
    description: "Entities and relationships. Cardinality: ||--o{, ||--|{, }o--o{, }o--|{. Each entity lists fields with type.",
    keywords: ["erdiagram", "entity"],
    example: "erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  CUSTOMER { string name }\n  ORDER { int number }",
  },
  {
    type: "gantt",
    label: "Gantt Chart",
    description: "Project timeline. Requires dateFormat and tasks. Sections group tasks.",
    keywords: ["gantt", "dateFormat", "section", "title", "excludes", "axisFormat"],
    example: "gantt\n  dateFormat YYYY-MM-DD\n  section Setup\n  Task A :2024-01-01, 10d\n  Task B :after Task A, 5d",
  },
  {
    type: "pie",
    label: "Pie Chart",
    description: "Slices with values. Optional title.",
    keywords: ["pie", "title"],
    example: "pie title Pets\n  \"Dogs\" : 386\n  \"Cats\" : 85",
  },
  {
    type: "state",
    label: "State Diagram",
    description: "States and transitions. [*] marks start/end. Use stateDiagram-v2 for advanced features (fork, join, notes).",
    keywords: ["statediagram", "statediagram-v2", "state", "note"],
    example: "stateDiagram-v2\n  [*] --> Active\n  Active --> Inactive : pause\n  Inactive --> Active : resume\n  Active --> [*] : stop",
  },
  {
    type: "mindmap",
    label: "Mindmap",
    description: "Hierarchical tree from root. Indentation defines hierarchy. ::icon(fa fa-book) adds icons.",
    keywords: ["mindmap", "root", "::icon"],
    example: "mindmap\n  root((Topic))\n    Branch A\n      Leaf 1\n      Leaf 2\n    Branch B",
  },
  {
    type: "gitGraph",
    label: "Git Graph",
    description: "Commits and branches. commit, branch, checkout, merge, cherry-pick, tag.",
    keywords: ["gitgraph", "commit", "branch", "checkout", "merge", "tag"],
    example: "gitGraph\n  commit\n  branch develop\n  checkout develop\n  commit\n  checkout main\n  merge develop",
  },
  {
    type: "journey",
    label: "User Journey",
    description: "Steps with satisfaction scores (0-5). Sections group steps.",
    keywords: ["journey", "title", "section"],
    example: "journey\n  title User flow\n  section Sign in\n    Visit page: 5: User\n    Sign in: 3: User",
  },
  {
    type: "c4",
    label: "C4 Diagram",
    description: "C4 model diagrams: C4Context, C4Container, C4Component, C4Dynamic, C4Deployment.",
    keywords: ["c4context", "c4container", "c4component", "c4dynamic", "c4deployment", "Person", "System", "Rel"],
    example: "C4Context\n  title System Context\n  Person(user, User)\n  System(sys, System)\n  Rel(user, sys, Uses)",
  },
  {
    type: "timeline",
    label: "Timeline",
    description: "Time-ordered events. Each line is a year/event, optionally with description.",
    keywords: ["timeline", "title"],
    example: "timeline\n  title History\n  2002 : Event A\n  2004 : Event B",
  },
  {
    type: "quadrant",
    label: "Quadrant Chart",
    description: "Four-quadrant scatter. x-axis and y-axis define ranges; quadrant-1..4 set labels; points plotted as Name: [x, y].",
    keywords: ["quadrantchart", "x-axis", "y-axis", "quadrant-1", "quadrant-2", "quadrant-3", "quadrant-4"],
    example: "quadrantChart\n  title Quadrant\n  x-axis Low --> High\n  y-axis Low --> High\n  quadrant-1 Expand\n  quadrant-2 Promote\n  Point A: [0.7, 0.6]",
  },
  {
    type: "requirement",
    label: "Requirement Diagram",
    description: "Requirements with type, risk, verifymethod. Elements satisfy/verifies/traces relationships.",
    keywords: ["requirementdiagram", "requirement", "element", "satisfies", "verifies", "traces"],
    example: "requirementDiagram\n  requirement R1 {\n    id: 1\n    text: text\n    risk: high\n    verifymethod: test\n  }",
  },
  {
    type: "xychart",
    label: "XY Chart",
    description: "Beta line/bar chart. x-axis labels, y-axis range, bar/line data.",
    keywords: ["xychart-beta", "x-axis", "y-axis", "bar", "line", "title"],
    example: "xychart-beta\n  title \"Chart\"\n  x-axis [a, b, c]\n  y-axis 0 --> 100\n  bar [10, 20, 30]\n  line [10, 20, 30]",
  },
];

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Strip Mermaid %% ... %% comments and leading whitespace from a line. */
export function stripComment(line: string): string {
  if (!line) return "";
  const trimmed = line.trim();
  // Inline comment after content (%% ...): remove the comment portion
  const idx = trimmed.indexOf("%%");
  if (idx === 0) return ""; // entire line is a comment
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

/** Detect the Mermaid diagram type from the first significant line. */
export function detectType(code: string): DiagramType {
  const first = firstSignificantLine(code);
  if (!first) return "unknown";
  // Normalize: lowercase the first word (which may have a space-separated orientation).
  // Example: "flowchart TD" → check "flowchart"; "sequenceDiagram" → check "sequencediagram"
  const firstToken = first.split(/\s+/)[0].toLowerCase();
  // Match exact keyword first
  if (TYPE_KEYWORDS[firstToken]) return TYPE_KEYWORDS[firstToken];
  // Some declarations use a hyphen (e.g. "stateDiagram-v2")
  const lower = first.toLowerCase();
  for (const key of Object.keys(TYPE_KEYWORDS)) {
    if (lower.startsWith(key)) return TYPE_KEYWORDS[key];
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Split code into trimmed, non-empty, non-comment lines. */
export function codeLines(code: string): string[] {
  if (!code) return [];
  return code
    .split(/\r?\n/)
    .map((l) => stripComment(l))
    .filter(Boolean);
}

/** Validate a flowchart. */
function validateFlowchart(lines: string[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  // First line must start with flowchart|graph
  if (lines.length === 0) return out;
  const first = lines[0].toLowerCase();
  if (!first.startsWith("flowchart") && !first.startsWith("graph")) {
    out.push({ line: 1, message: "Flowchart must start with 'flowchart' or 'graph'", severity: "error" });
  }
  // Subgraph/end matching
  let depth = 0;
  let subgraphLine = 0;
  lines.forEach((l, i) => {
    const lower = l.toLowerCase();
    if (lower.startsWith("subgraph")) {
      depth += 1;
      if (depth === 1) subgraphLine = i + 1;
    }
    if (lower === "end" || lower.startsWith("end ")) {
      if (depth === 0) {
        out.push({ line: i + 1, message: "'end' without matching 'subgraph'", severity: "error" });
      } else {
        depth -= 1;
      }
    }
  });
  if (depth > 0) {
    out.push({ line: subgraphLine, message: "Unclosed 'subgraph' — missing 'end'", severity: "error" });
  }
  return out;
}

/** Validate a sequence diagram. */
function validateSequence(lines: string[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (lines.length === 0) return out;
  if (!lines[0].toLowerCase().startsWith("sequencediagram")) {
    out.push({ line: 1, message: "Sequence diagram must start with 'sequenceDiagram'", severity: "error" });
  }
  // Block matching: alt/else/end, loop/end, opt/end, par/and/end
  const stack: { keyword: string; line: number }[] = [];
  const blocks: Record<string, string> = {
    alt: "end", opt: "end", loop: "end", par: "end", rect: "end", critical: "end", break: "end",
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
    } else if (first === "else" || first === "and") {
      // OK in alt/par
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
  if (lines.length === 0) return out;
  if (!lines[0].toLowerCase().startsWith("classdiagram")) {
    out.push({ line: 1, message: "Class diagram must start with 'classDiagram'", severity: "error" });
  }
  // Check class blocks: class Foo { ... }
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

/** Validate a gantt chart. */
function validateGantt(lines: string[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (lines.length === 0) return out;
  if (!lines[0].toLowerCase().startsWith("gantt")) {
    out.push({ line: 1, message: "Gantt chart must start with 'gantt'", severity: "error" });
  }
  const hasDateFormat = lines.some((l) => l.toLowerCase().startsWith("dateformat"));
  if (!hasDateFormat) {
    out.push({ line: 1, message: "Gantt chart should declare a dateFormat (e.g. 'dateFormat YYYY-MM-DD')", severity: "warn" });
  }
  return out;
}

/** Validate a pie chart. */
function validatePie(lines: string[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (lines.length === 0) return out;
  if (!lines[0].toLowerCase().startsWith("pie")) {
    out.push({ line: 1, message: "Pie chart must start with 'pie'", severity: "error" });
  }
  const hasData = lines.some((l) => l.includes(":") && /:/.test(l) && !l.toLowerCase().startsWith("pie") && !l.toLowerCase().startsWith("title"));
  if (!hasData) {
    out.push({ line: 1, message: "Pie chart needs at least one slice ('\"Label\" : value')", severity: "warn" });
  }
  return out;
}

/** Validate a state diagram. */
function validateState(lines: string[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (lines.length === 0) return out;
  const first = lines[0].toLowerCase();
  if (!first.startsWith("statediagram")) {
    out.push({ line: 1, message: "State diagram must start with 'stateDiagram' or 'stateDiagram-v2'", severity: "error" });
  }
  return out;
}

/** Validate any diagram — dispatcher. */
export function validateCode(code: string): ValidationResult {
  const lines = codeLines(code);
  if (lines.length === 0) {
    return { ok: false, type: "unknown", issues: [{ line: 0, message: "Empty diagram — type some Mermaid syntax", severity: "error" }] };
  }
  const type = detectType(code);
  let issues: ValidationIssue[] = [];
  switch (type) {
    case "flowchart": issues = validateFlowchart(lines); break;
    case "sequence": issues = validateSequence(lines); break;
    case "class": issues = validateClass(lines); break;
    case "gantt": issues = validateGantt(lines); break;
    case "pie": issues = validatePie(lines); break;
    case "state": issues = validateState(lines); break;
    default:
      // For types we don't have a specific validator, only check that there is at least one line
      break;
  }
  const ok = issues.filter((i) => i.severity === "error").length === 0;
  return { ok, type, issues };
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
  // Trim leading blank lines
  while (out.length > 0 && out[0] === "") out.shift();
  // Trim trailing blank lines
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// mermaid.live URL
// ---------------------------------------------------------------------------

/**
 * Encode Mermaid source as base64 for mermaid.live URL fragment.
 * Uses UTF-8 safe encoding via TextEncoder when available (browser), else
 * falls back to a pure-JS UTF-8 → base64 implementation.
 */
export function encodeBase64(input: string): string {
  if (!input) return "";
  // Browser path — fast path.
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    // UTF-8 safe
    try {
      const bytes = new TextEncoder().encode(input);
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      return window.btoa(bin);
    } catch {
      // fall through
    }
  }
  // Pure-JS UTF-8 → base64.
  const bytes = utf8ToBytes(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return bytesToBase64(bin);
}

/** Decode a base64 string back to UTF-8 source. */
export function decodeBase64(b64: string): string {
  if (!b64) return "";
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    try {
      const bin = window.atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    } catch {
      return "";
    }
  }
  // Pure-JS fallback
  const bin = base64ToBytes(b64);
  return bytesToUtf8(bin);
}

function utf8ToBytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6));
      out.push(0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff) {
      // Surrogate pair
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
  return out;
}

function bytesToUtf8(bytes: number[] | Uint8Array): string {
  let out = "";
  const arr = Array.from(bytes);
  for (let i = 0; i < arr.length; ) {
    const b = arr[i++];
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if ((b & 0xe0) === 0xc0) {
      const b2 = arr[i++];
      out += String.fromCharCode(((b & 0x1f) << 6) | (b2 & 0x3f));
    } else if ((b & 0xf0) === 0xe0) {
      const b2 = arr[i++];
      const b3 = arr[i++];
      out += String.fromCharCode(((b & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
    } else if ((b & 0xf8) === 0xf0) {
      const b2 = arr[i++];
      const b3 = arr[i++];
      const b4 = arr[i++];
      const cp = ((b & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
      const adj = cp - 0x10000;
      out += String.fromCharCode(0xd800 | (adj >> 10), 0xdc00 | (adj & 0x3ff));
    }
  }
  return out;
}

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bin: string): string {
  let out = "";
  let i = 0;
  const len = bin.length;
  while (i < len) {
    const b1 = bin.charCodeAt(i++);
    const b2 = i < len ? bin.charCodeAt(i++) : NaN;
    const b3 = i < len ? bin.charCodeAt(i++) : NaN;
    out += B64_CHARS.charAt(b1 >> 2);
    out += B64_CHARS.charAt(((b1 & 0x03) << 4) | (isNaN(b2) ? 0 : (b2 >> 4)));
    out += isNaN(b2) ? "=" : B64_CHARS.charAt(((b2 & 0x0f) << 2) | (isNaN(b3) ? 0 : (b3 >> 6)));
    out += isNaN(b3) ? "=" : B64_CHARS.charAt(b3 & 0x3f);
  }
  return out;
}

function base64ToBytes(b64: string): number[] {
  // Count trailing `=` padding so we know how many bytes to trim.
  const padCount = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  // Pad with 'A' (which maps to 0) so length is a multiple of 4.
  const padded = clean + "A".repeat((4 - (clean.length % 4)) % 4);
  const out: number[] = [];
  for (let i = 0; i + 4 <= padded.length; i += 4) {
    const c1 = B64_CHARS.indexOf(padded.charAt(i));
    const c2 = B64_CHARS.indexOf(padded.charAt(i + 1));
    const c3 = B64_CHARS.indexOf(padded.charAt(i + 2));
    const c4 = B64_CHARS.indexOf(padded.charAt(i + 3));
    if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) break;
    out.push((c1 << 2) | (c2 >> 4));
    out.push(((c2 & 0x0f) << 4) | (c3 >> 2));
    out.push(((c3 & 0x03) << 6) | c4);
  }
  // Trim the bytes that were represented by the `=` padding.
  if (padCount > 0 && out.length >= padCount) {
    return out.slice(0, out.length - padCount);
  }
  return out;
}

/** Build the mermaid.live URL with base64-encoded source. */
export function buildLiveUrl(code: string): string {
  if (!code || !code.trim()) return MERMAID_LIVE_BASE;
  const encoded = encodeBase64(code);
  return `${MERMAID_LIVE_BASE}#base64:${encoded}`;
}

/** Build a Markdown embed snippet linking to the live editor. */
export function buildMarkdownEmbed(code: string, altText?: string): string {
  const url = buildLiveUrl(code);
  const alt = altText || "Mermaid diagram";
  return `[${alt}](${url})`;
}

/** Build a raw mermaid code block (for embedding in a Markdown file rendered by a Mermaid plugin). */
export function buildMermaidCodeBlock(code: string, type?: DiagramType): string {
  const fence = "```";
  const lang = type && type !== "unknown" ? `mermaid` : "mermaid";
  return `${fence}${lang}\n${code}\n${fence}`;
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
      totalLines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
      type: "unknown",
      charCount: 0,
    };
  }
  const allLines = code.split(/\r?\n/);
  let codeCount = 0;
  let commentCount = 0;
  let blankCount = 0;
  for (const raw of allLines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      blankCount += 1;
      continue;
    }
    if (trimmed.startsWith("%%")) {
      commentCount += 1;
      continue;
    }
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
// Templates
// ---------------------------------------------------------------------------

export function getTemplate(type: DiagramType): DiagramTemplate | undefined {
  return TEMPLATES.find((t) => t.type === type);
}

export function getReference(type: DiagramType): SyntaxReference | undefined {
  return SYNTAX_REFERENCE.find((r) => r.type === type);
}

// ---------------------------------------------------------------------------
// Default code
// ---------------------------------------------------------------------------

export function defaultCode(): string {
  return TEMPLATES[0].code;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:mermaid-diagram-live:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  type: DiagramType;
  preview: string; // first ~80 chars of code
  liveUrl: string;
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

export function buildShareUrl(code: string): string {
  if (!code) return "";
  const encoded = encodeBase64(code);
  const params = new URLSearchParams();
  params.set("code", encoded);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#code=${encoded}`;
}

export function parseShareUrl(hash: string): string {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return "";
  const params = new URLSearchParams(clean);
  const code = params.get("code");
  if (!code) return "";
  return decodeBase64(code);
}
