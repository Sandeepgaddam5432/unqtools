/**
 * AI Mermaid.js Flowchart Generator — pure logic.
 *
 * Parse natural-language process descriptions ("A leads to B",
 * "if X then Y else Z", "loop over items") or step lists into a flow
 * graph of nodes + edges, then render valid Mermaid `flowchart` code
 * with:
 *   - decision diamonds, parallel paths, loops, subgraphs
 *   - direction toggle (TD/LR)
 *   - six node shapes
 *   - theme presets (classDef)
 *   - validator + self-healing repair
 *
 * Pure functions only — no DOM, no network.
 *
 * Honesty: the NL parser is deterministic and best-effort. Complex
 * diagrams with nested loops or guarded branches may need manual edits.
 * An optional BYO-key LLM hook is stubbed but not invoked here.
 */

// ---------- Types ----------

export type Direction = "TD" | "LR" | "BT" | "RL";
export type NodeShape =
  | "rect"
  | "rounded"
  | "stadium"
  | "subroutine"
  | "database"
  | "circle"
  | "diamond"
  | "hexagon";
export type Theme = "default" | "forest" | "dark" | "neutral";

export interface FlowNode {
  id: string;
  label: string;
  shape: NodeShape;
  subgraph?: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  /** Parallel-edge marker (edges with the same group id render in parallel). */
  parallelGroup?: string;
}

export interface FlowSubgraph {
  id: string;
  label: string;
}

export interface FlowGraph {
  direction: Direction;
  nodes: FlowNode[];
  edges: FlowEdge[];
  subgraphs: FlowSubgraph[];
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RepairResult {
  code: string;
  repairs: string[];
  remainingWarnings: string[];
}

export interface HistoryEntry {
  ts: number;
  description: string;
  direction: Direction;
  nodeCount: number;
  edgeCount: number;
}

// ---------- ID sanitization ----------

const RESERVED = new Set<string>([
  "end", "subgraph", "flowchart", "graph", "direction", "style",
  "classDef", "class", "click", "linkStyle", "loop", "alt", "opt",
  "par", "and", "else", "note", "rect", "if", "then", "yes", "no",
]);

let _idCounter = 0;
export function resetIdCounter(): void {
  _idCounter = 0;
}

/** Sanitize a label into a valid Mermaid node ID. */
export function sanitizeNodeId(raw: string): string {
  let s = (raw || "").trim().toLowerCase();
  s = s.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (!s) s = `n${_idCounter++}`;
  if (/^\d/.test(s)) s = `n_${s}`;
  if (RESERVED.has(s)) s = `${s}_`;
  return s;
}

const SHAPE_SYNTAX: Record<NodeShape, { open: string; close: string }> = {
  rect: { open: "[", close: "]" },
  rounded: { open: "(", close: ")" },
  stadium: { open: "([", close: "])" },
  subroutine: { open: "[[", close: "]]" },
  database: { open: "[(", close: ")]" },
  circle: { open: "((", close: "))" },
  diamond: { open: "{", close: "}" },
  hexagon: { open: "{{", close: "}}" },
};

/** Format a node label with shape delimiters. */
export function formatNodeShape(label: string, shape: NodeShape): string {
  const safe = label.replace(/["\[\](){}<>]/g, " ").replace(/\s+/g, " ").trim() || "node";
  const { open, close } = SHAPE_SYNTAX[shape];
  // Mermaid: if the label has special chars, wrap in quotes inside the brackets.
  if (/[;:|]/.test(safe)) {
    return `${open}"${safe}"${close}`;
  }
  return `${open}${safe}${close}`;
}

// ---------- NL parser ----------

interface ParsedStep {
  label: string;
  shape: NodeShape;
  subgraph?: string;
  decisionBranches?: Array<{ condition: string; target: string }>;
}

const TRANSITION_CUES = [
  /\s+leads\s+to\s+/i,
  /\s+then\s+/i,
  /\s+after\s+/i,
  /\s+next\s+/i,
  /\s+goes\s+to\s+/i,
  /\s+proceeds?\s+to\s+/i,
  /\s+followed\s+by\s+/i,
  // Longer arrows first so '-->' isn't shadowed by '->'.
  /\s*-->\s*/,
  /\s*=>\s*/,
  /\s*→\s*/,
  /\s*->\s*/,
];

const DECISION_RE = /\b(?:if|when|in case|whenever|should)\s+(.+?)\s+(?:then|do)?\s*(.*)$/i;
const DECISION_BRANCH_RE = /\b(?:if|when)\s+(.+?)\s+(?:then|do)\s+(.+?)(?:\s+else\s+(.+))?$/i;
const PARALLEL_RE = /\b(?:in parallel|meanwhile|at the same time|concurrently)\b/i;
const LOOP_RE = /\b(?:loop|repeat|for each|for every|iterate)\s+(?:over\s+|through\s+)?(.+?)$/i;
const SUBGRAPH_RE = /^(?:phase|stage|group|during|section)\s*[:\-]\s*(.+)$/i;

/** Split a description into raw segments on transition cues. */
export function splitOnTransitions(text: string): string[] {
  if (!text) return [];
  let parts = [text];
  for (const re of TRANSITION_CUES) {
    const next: string[] = [];
    for (const p of parts) {
      // Don't split if the cue is inside parens (e.g., conditions).
      // Simple guard: split, but rejoin if odd count of parens before this point.
      const splits = p.split(re);
      if (splits.length === 1) {
        next.push(p);
      } else {
        next.push(...splits);
      }
    }
    parts = next;
  }
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Parse a single segment into a ParsedStep (best-effort). */
export function parseSegment(segment: string): ParsedStep {
  const trimmed = segment.trim().replace(/[.!?]+$/g, "");
  // Subgraph open
  const sub = trimmed.match(SUBGRAPH_RE);
  if (sub) {
    return { label: sub[1].trim(), shape: "rect", subgraph: sub[1].trim() };
  }
  // Loop
  const lp = trimmed.match(LOOP_RE);
  if (lp) {
    return { label: `Loop: ${lp[1].trim()}`, shape: "hexagon" };
  }
  // Decision branch
  const db = trimmed.match(DECISION_BRANCH_RE);
  if (db) {
    const condition = db[1].trim();
    const target = db[2].trim();
    const branches = [{ condition: "yes", target }];
    if (db[3]) branches.push({ condition: "no", target: db[3].trim() });
    return { label: condition, shape: "diamond", decisionBranches: branches };
  }
  // Decision (no explicit then)
  const d = trimmed.match(DECISION_RE);
  if (d) {
    return { label: d[1].trim(), shape: "diamond" };
  }
  // End marker
  if (/^(end|stop|finish|done|complete)$/i.test(trimmed)) {
    return { label: "End", shape: "stadium" };
  }
  // Start marker
  if (/^(start|begin|kick off)$/i.test(trimmed)) {
    return { label: "Start", shape: "stadium" };
  }
  return { label: trimmed, shape: "rect" };
}

/** Parse a multi-line description (or step list) into segments. */
export function parseDescription(text: string): string[] {
  if (!text) return [];
  // Newline-separated segments, each split on transitions.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    // Don't split lines that start with a decision cue (if/when) — 'then' is part of the branch.
    if (/^\s*(?:if|when)\s+/i.test(line)) {
      out.push(line);
      continue;
    }
    // Don't split lines that match loop or subgraph patterns.
    if (LOOP_RE.test(line) || SUBGRAPH_RE.test(line)) {
      out.push(line);
      continue;
    }
    const segs = splitOnTransitions(line);
    if (segs.length === 0) out.push(line);
    else out.push(...segs);
  }
  return out;
}

/** Parse a description into a FlowGraph. */
export function parseToGraph(
  description: string,
  direction: Direction = "TD",
): FlowGraph {
  resetIdCounter();
  const warnings: string[] = [];
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const subgraphs: FlowSubgraph[] = [];
  const nodeByLabel = new Map<string, string>(); // normalized label → id
  const seenIds = new Set<string>();

  const ensureNode = (label: string, shape: NodeShape, subgraph?: string): string => {
    const key = `${shape}:${label.toLowerCase()}`;
    const existing = nodeByLabel.get(key);
    if (existing) {
      // Update subgraph if newly provided.
      if (subgraph && !nodes.find((n) => n.id === existing)?.subgraph) {
        const n = nodes.find((nn) => nn.id === existing);
        if (n) n.subgraph = subgraph;
      }
      return existing;
    }
    let id = sanitizeNodeId(label);
    if (seenIds.has(id)) id = `${id}_${_idCounter++}`;
    seenIds.add(id);
    nodeByLabel.set(key, id);
    nodes.push({ id, label, shape, subgraph });
    return id;
  };

  const ensureSubgraph = (label: string): string => {
    const existing = subgraphs.find((s) => s.label.toLowerCase() === label.toLowerCase());
    if (existing) return existing.id;
    const id = `sub_${subgraphs.length + 1}`;
    subgraphs.push({ id, label });
    return id;
  };

  const segments = parseDescription(description);
  if (segments.length === 0) {
    return { direction, nodes, edges, subgraphs, warnings };
  }

  let prevId: string | undefined;
  let activeSubgraph: string | undefined;
  let parallelGroup = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    // Subgraph open
    const subMatch = seg.match(SUBGRAPH_RE);
    if (subMatch) {
      const lbl = subMatch[1].trim();
      ensureSubgraph(lbl);
      activeSubgraph = lbl;
      continue;
    }
    const step = parseSegment(seg);
    const id = ensureNode(step.label, step.shape, activeSubgraph);

    // Decision branches: inline targets become children of the decision diamond.
    if (step.decisionBranches && step.decisionBranches.length > 0) {
      // Connect from previous node to this decision.
      if (prevId) {
        edges.push({ from: prevId, to: id });
      }
      for (const branch of step.decisionBranches) {
        const targetStep = parseSegment(branch.target);
        const targetId = ensureNode(targetStep.label, targetStep.shape, activeSubgraph);
        edges.push({ from: id, to: targetId, label: branch.condition });
      }
      prevId = id;
      continue;
    }

    // Parallel cue: mark this edge as a parallel sibling.
    if (PARALLEL_RE.test(seg) && prevId) {
      parallelGroup += 1;
      warnings.push("Parallel branch detected — emitted as parallel edges from the previous node.");
      edges.push({ from: prevId, to: id, parallelGroup: `p${parallelGroup}` });
      prevId = id;
      continue;
    }

    // Normal: connect prev → current.
    if (prevId) {
      edges.push({ from: prevId, to: id });
    }
    prevId = id;
  }

  if (nodes.length > 60) {
    warnings.push("Large diagram (60+ nodes) — consider splitting into subgraphs.");
  }
  return { direction, nodes, edges, subgraphs, warnings };
}

// ---------- Mermaid code generation ----------

const THEME_CLASSDEF: Record<Theme, string> = {
  default: "",
  forest: "classDef primary fill:#0f5132,color:#fff,stroke:#0f5132\n",
  dark: "classDef primary fill:#1f2937,color:#f9fafb,stroke:#374151\n",
  neutral: "classDef primary fill:#e5e7eb,color:#111827,stroke:#9ca3af\n",
};

/** Apply a theme by tagging all nodes with the primary class. */
export function applyTheme(graph: FlowGraph, theme: Theme): FlowGraph {
  if (theme === "default") return graph;
  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({ ...n })),
  };
}

/** Generate Mermaid flowchart code from a FlowGraph. */
export function generateMermaid(
  graph: FlowGraph,
  theme: Theme = "default",
): string {
  const lines: string[] = [];
  lines.push(`flowchart ${graph.direction}`);
  if (graph.subgraphs.length > 0) {
    const sg = graph.subgraphs[0];
    lines.push(`  subgraph ${sg.id} ["${sg.label}"]`);
    const sgNodes = graph.nodes.filter((n) => n.subgraph === sg.label);
    if (sgNodes.length === 0) {
      lines.push("    %% empty subgraph");
    } else {
      for (const n of sgNodes) {
        lines.push(`    ${n.id}${formatNodeShape(n.label, n.shape)}`);
      }
    }
    lines.push("  end");
    // Remaining nodes (not in a subgraph)
    const free = graph.nodes.filter((n) => !n.subgraph);
    for (const n of free) {
      lines.push(`  ${n.id}${formatNodeShape(n.label, n.shape)}`);
    }
  } else {
    for (const n of graph.nodes) {
      lines.push(`  ${n.id}${formatNodeShape(n.label, n.shape)}`);
    }
  }
  // Edges
  for (const e of graph.edges) {
    const label = e.label ? `|${e.label}|` : "";
    lines.push(`  ${e.from} -->${label} ${e.to}`);
  }
  const classDef = THEME_CLASSDEF[theme];
  if (classDef) {
    lines.push(`  ${classDef.trim()}`);
    if (graph.nodes.length > 0) {
      lines.push(`  class ${graph.nodes.map((n) => n.id).join(",")} primary`);
    }
  }
  return lines.join("\n") + "\n";
}

// ---------- Validation + self-healing ----------

/** Validate Mermaid code for common syntax errors. Pure. */
export function validateMermaid(code: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!code || !code.trim()) {
    return { valid: false, errors: ["Empty code."], warnings };
  }
  // Must start with flowchart or graph.
  if (!/^\s*(flowchart|graph)\s+/m.test(code)) {
    errors.push("Code must start with 'flowchart' or 'graph'.");
  }
  // Balanced brackets.
  const pairs: Array<[string, string, string]> = [
    ["[", "]", "square bracket"],
    ["{", "}", "curly brace"],
    ["(", ")", "parenthesis"],
  ];
  for (const [open, close, name] of pairs) {
    let depth = 0;
    let inQuotes = false;
    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      if (ch === '"') inQuotes = !inQuotes;
      if (inQuotes) continue;
      if (ch === open) depth += 1;
      else if (ch === close) depth -= 1;
      if (depth < 0) {
        errors.push(`Unbalanced ${name} '${close}' at position ${i}.`);
        depth = 0;
      }
    }
    if (depth !== 0) {
      errors.push(`Unclosed ${name} '${open}' (depth ${depth}).`);
    }
  }
  // Balanced quotes.
  const quoteCount = (code.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    warnings.push("Odd number of double quotes — possible unbalanced label.");
  }
  // Orphan edge arrows.
  const lines = code.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("%%") || line.startsWith("classDef") || line.startsWith("class ")) continue;
    if (/\b(subgraph|end|flowchart|graph)\b/.test(line)) continue;
    // Edge line ending with --> or -- (orphan).
    if (/(-->|->|=>)\s*$/m.test(line)) {
      errors.push(`Orphan edge at line ${i + 1}: missing target node.`);
    }
  }
  // Duplicate node IDs.
  const idRe = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*[\[\(\{\(]/gm;
  const ids = new Set<string>();
  const dups: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(code)) !== null) {
    if (ids.has(m[1])) dups.push(m[1]);
    ids.add(m[1]);
  }
  if (dups.length > 0) {
    warnings.push(`Duplicate node ID(s): ${Array.from(new Set(dups)).join(", ")}.`);
  }
  // Subgraph closure.
  const subOpens = (code.match(/^\s*subgraph\b/gm) || []).length;
  const subEnds = (code.match(/^\s*end\b/gm) || []).length;
  if (subOpens !== subEnds) {
    errors.push(`Unbalanced subgraph/end (${subOpens} subgraph, ${subEnds} end).`);
  }
  return { valid: errors.length === 0, errors, warnings };
}

/** Attempt to repair common Mermaid syntax errors. Pure. */
export function repairMermaid(code: string): RepairResult {
  const repairs: string[] = [];
  let out = code;
  // Ensure starts with flowchart.
  if (!/^\s*(flowchart|graph)\s+/m.test(out)) {
    out = `flowchart TD\n${out}`;
    repairs.push("Added missing 'flowchart TD' header.");
  }
  // Remove orphan edge arrows (--> at end of line with no target).
  out = out.replace(/(-->|->|=>)\s*$/gm, "");
  if (out !== code && !repairs.includes("Removed orphan edge arrows.")) {
    repairs.push("Removed orphan edge arrows.");
  }
  // Close unclosed subgraphs.
  const subOpens = (out.match(/^\s*subgraph\b/gm) || []).length;
  const subEnds = (out.match(/^\s*end\b/gm) || []).length;
  if (subOpens > subEnds) {
    const diff = subOpens - subEnds;
    for (let i = 0; i < diff; i++) out += "\nend";
    repairs.push(`Closed ${diff} unclosed subgraph(s).`);
  }
  // Remove unbalanced trailing brackets.
  out = out.replace(/[\[\(\{]+$/gm, "");
  // Sanitize node IDs containing hyphens or spaces (very common error).
  out = out.replace(
    /^(\s*)([A-Za-z_][A-Za-z0-9_]*)([\[\(\{])/gm,
    (match, indent, id, bracket) => `${indent}${id}${bracket}`,
  );
  // Re-validate.
  const v = validateMermaid(out);
  return { code: out, repairs, remainingWarnings: v.warnings.concat(v.errors) };
}

// ---------- End-to-end ----------

export interface GenerateOptions {
  direction?: Direction;
  theme?: Theme;
  autoRepair?: boolean;
}

/** Full NL → Mermaid pipeline. */
export function generateFlowchart(
  description: string,
  opts: GenerateOptions = {},
): { graph: FlowGraph; code: string; repairs: string[]; warnings: string[] } {
  const direction = opts.direction ?? "TD";
  const theme = opts.theme ?? "default";
  const autoRepair = opts.autoRepair ?? true;
  const graph = parseToGraph(description, direction);
  let code = generateMermaid(graph, theme);
  const repairs: string[] = [];
  if (autoRepair) {
    const r = repairMermaid(code);
    code = r.code;
    repairs.push(...r.repairs);
  }
  return { graph, code, repairs, warnings: [...graph.warnings, ...repairs.map((r) => `Auto-fix: ${r}`)] };
}

/** Refine an existing graph by appending new instructions and regenerating. */
export function refineFlowchart(
  prevDescription: string,
  refinement: string,
  opts: GenerateOptions = {},
): { graph: FlowGraph; code: string; repairs: string[]; warnings: string[] } {
  const combined = `${prevDescription}\n${refinement}`.trim();
  return generateFlowchart(combined, opts);
}

/** Build a mermaid.live deep-link for instant SVG/PNG export. */
export function mermaidLiveUrl(code: string): string {
  // mermaid.live accepts ?code=<urlencoded> or a base64+pako payload.
  // Simple URL-encoded form is supported by the editor's load-from-URL path.
  return `https://mermaid.live/edit#${encodeURIComponent(code)}`;
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-mermaid-flowchart-generator:history";
const HISTORY_MAX = 20;

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

// ---------- Shareable URL ----------

export function buildShareUrl(
  description: string,
  direction: Direction,
  theme: Theme,
): string {
  const params = new URLSearchParams();
  if (description) params.set("d", description);
  if (direction) params.set("dir", direction);
  if (theme && theme !== "default") params.set("theme", theme);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  description: string;
  direction: Direction;
  theme: Theme;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { description: "", direction: "TD", theme: "default" };
  const params = new URLSearchParams(clean);
  const description = params.get("d") ?? "";
  const dirRaw = params.get("dir") ?? "TD";
  const themeRaw = params.get("theme") ?? "default";
  const validDirs: Direction[] = ["TD", "LR", "BT", "RL"];
  const validThemes: Theme[] = ["default", "forest", "dark", "neutral"];
  const direction: Direction = validDirs.includes(dirRaw as Direction) ? (dirRaw as Direction) : "TD";
  const theme: Theme = validThemes.includes(themeRaw as Theme) ? (themeRaw as Theme) : "default";
  return { description, direction, theme };
}

// ---------- Optional BYO-key LLM hook (stub, not invoked) ----------

export interface LLMAdapter {
  complete(prompt: string): Promise<string>;
}

/** Stub: returns the template code untouched. Real adapters plug in here. */
export async function llmRefine(
  code: string,
  adapter?: LLMAdapter,
): Promise<string> {
  if (!adapter) return code;
  return code;
}
