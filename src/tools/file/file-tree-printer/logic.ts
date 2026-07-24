/**
 * File Tree Printer — pure logic.
 * Works on a generic tree of FileNode objects (UI converts webkitdirectory
 * file list into this shape).
 */

export interface FileNode {
  name: string;
  size: number;
  isDirectory: boolean;
  children?: FileNode[];
}

export interface TreeOptions {
  /** ASCII ─ ├── └── or unicode ├ └ ─. */
  style?: "ascii" | "unicode" | "markdown";
  maxDepth?: number;
  includeHidden?: boolean;
  showSize?: boolean;
  sort?: "name" | "size" | "type";
  excludes?: string[]; // glob-like patterns matched against name
  indent?: number; // spaces per level (default 4 for ASCII, 1 for unicode)
  /** Wrap output in ```markdown code fence. */
  markdownWrap?: boolean;
}

export interface TreeResult {
  text: string;
  fileCount: number;
  dirCount: number;
  totalSize: number;
  truncated: boolean;
  warnings: string[];
}

/** Convert flat webkitdirectory file list to nested FileNode tree. */
export function buildTreeFromPaths(paths: { path: string; size: number }[]): FileNode {
  const root: FileNode = { name: "", size: 0, isDirectory: true, children: [] };
  for (const { path, size } of paths) {
    const parts = path.split("/").filter(Boolean);
    let cursor = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      cursor.children = cursor.children ?? [];
      let next = cursor.children.find((c) => c.name === part && !isLast ? c.isDirectory : c.isDirectory === !isLast);
      // simpler: find by name
      next = cursor.children.find((c) => c.name === part);
      if (!next) {
        next = { name: part, size: isLast ? size : 0, isDirectory: !isLast, children: isLast ? undefined : [] };
        cursor.children.push(next);
      } else if (isLast) {
        next.size = size;
      }
      cursor = next;
    }
  }
  // Compute directory sizes as sum of children
  computeSizes(root);
  return root;
}

function computeSizes(node: FileNode): number {
  if (!node.isDirectory || !node.children) return node.size;
  node.size = node.children.reduce((sum, c) => sum + computeSizes(c), 0);
  return node.size;
}

function matchesGlob(name: string, pattern: string): boolean {
  // simple glob: * = any chars, ? = single char, prefix! = negation
  if (pattern.startsWith("!")) return !matchesGlob(name, pattern.slice(1));
  const regex = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
  return regex.test(name);
}

function isHidden(name: string): boolean {
  return name.startsWith(".") && name !== "." && name !== "..";
}

function sortNodes(nodes: FileNode[], sort: TreeOptions["sort"]): FileNode[] {
  const arr = [...nodes];
  switch (sort) {
    case "size":
      arr.sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
      break;
    case "type":
      arr.sort((a, b) => {
        const extA = a.name.includes(".") ? a.name.split(".").pop()! : "";
        const extB = b.name.includes(".") ? b.name.split(".").pop()! : "";
        return extA.localeCompare(extB) || a.name.localeCompare(b.name);
      });
      break;
    case "name":
    default:
      arr.sort((a, b) => a.name.localeCompare(b.name));
  }
  // Always show dirs first (common convention)
  arr.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory));
  return arr;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
}

const STYLES = {
  ascii: { branch: "|-- ", last: "`-- ", vertical: "|   ", space: "    " },
  unicode: { branch: "├── ", last: "└── ", vertical: "│   ", space: "    " },
  markdown: { branch: "├── ", last: "└── ", vertical: "│   ", space: "    " },
};

export function printTree(root: FileNode, options: TreeOptions = {}): TreeResult {
  const style = options.style ?? "unicode";
  const chars = STYLES[style];
  const maxDepth = options.maxDepth ?? 100;
  const includeHidden = options.includeHidden ?? false;
  const showSize = options.showSize ?? false;
  const sort = options.sort ?? "name";
  const excludes = options.excludes ?? [];
  const markdownWrap = options.markdownWrap ?? false;

  let fileCount = 0;
  let dirCount = 0;
  let totalSize = 0;
  let truncated = false;
  const warnings: string[] = [];

  function render(node: FileNode, prefix: string, depth: number): string {
    if (depth > maxDepth) {
      truncated = true;
      return "";
    }
    // Apply filters
    if (!includeHidden && isHidden(node.name)) return "";
    if (excludes.some((p) => matchesGlob(node.name, p))) return "";

    let line = prefix + node.name;
    if (node.isDirectory) {
      dirCount++;
    } else {
      fileCount++;
      totalSize += node.size;
    }
    if (showSize) line += `  [${formatSize(node.size)}]`;
    line += "\n";

    if (node.isDirectory && node.children && depth < maxDepth) {
      const sorted = sortNodes(node.children, sort);
      sorted.forEach((child, i) => {
        const isLast = i === sorted.length - 1;
        const childPrefix = prefix + (isLast ? chars.space : chars.vertical);
        const childConnector = isLast ? chars.last : chars.branch;
        line += render({ ...child, name: child.name }, childConnector.slice(0, -1) + prefix.slice(-0) + "", depth + 1);
      });
      // Simpler: just recurse with proper prefix
    }
    return line;
  }

  // Restart with cleaner recursion
  fileCount = 0; dirCount = 0; totalSize = 0; truncated = false;

  function renderClean(node: FileNode, prefix: string, depth: number): string {
    if (depth > maxDepth) {
      truncated = true;
      return "";
    }
    if (!includeHidden && depth > 0 && isHidden(node.name)) return "";
    if (excludes.some((p) => matchesGlob(node.name, p))) return "";

    let line = prefix + node.name;
    if (node.isDirectory) {
      if (depth > 0) dirCount++;
    } else {
      fileCount++;
      totalSize += node.size;
    }
    if (showSize) line += `  [${formatSize(node.size)}]`;
    line += "\n";

    if (node.isDirectory && node.children && depth < maxDepth) {
      const sorted = sortNodes(node.children, sort);
      const visibleChildren = sorted.filter((c) =>
        (includeHidden || !isHidden(c.name)) && !excludes.some((p) => matchesGlob(c.name, p))
      );
      visibleChildren.forEach((child, i) => {
        const isLast = i === visibleChildren.length - 1;
        const newPrefix = prefix + (isLast ? chars.space : chars.vertical);
        const connector = isLast ? chars.last : chars.branch;
        // Replace the leading space of newPrefix with the connector
        const childLine = renderClean(child, newPrefix.slice(0, -chars.space.length), depth + 1);
        if (childLine) {
          line += connector + childLine.slice(prefix.length);
        }
      });
    } else if (node.isDirectory && node.children && node.children.length > 0 && depth >= maxDepth) {
      // We have children but didn't recurse — flag as truncated
      truncated = true;
    }
    return line;
  }

  let text = renderClean(root, "", 0);

  if (markdownWrap) {
    text = "```\n" + text + "```\n";
  }

  if (truncated) warnings.push(`Tree truncated at depth ${maxDepth}.`);
  if (fileCount + dirCount === 0) warnings.push("No files or directories matched the current filters.");

  return { text, fileCount, dirCount, totalSize, truncated, warnings };
}

export function treeToCsv(root: FileNode, options: TreeOptions = {}): string {
  const lines = ["Path,Type,Size"];
  function walk(node: FileNode, path: string) {
    const fullPath = path ? `${path}/${node.name}` : node.name;
    if (!options.includeHidden && isHidden(node.name)) return;
    if (options.excludes?.some((p) => matchesGlob(node.name, p))) return;
    lines.push(`"${fullPath}",${node.isDirectory ? "dir" : "file"},${node.size}`);
    if (node.isDirectory && node.children) {
      for (const child of node.children) walk(child, fullPath);
    }
  }
  walk(root, "");
  return lines.join("\n");
}

export function treeToJson(root: FileNode, options: TreeOptions = {}): string {
  function clean(node: FileNode, path: string): unknown {
    if (!options.includeHidden && isHidden(node.name)) return null;
    if (options.excludes?.some((p) => matchesGlob(node.name, p))) return null;
    const fullPath = path ? `${path}/${node.name}` : node.name;
    if (!node.isDirectory) return { path: fullPath, type: "file", size: node.size };
    const children = (node.children ?? []).map((c) => clean(c, fullPath)).filter(Boolean);
    return { path: fullPath, type: "dir", size: node.size, children };
  }
  return JSON.stringify(clean(root, ""), null, 2);
}

/** Common ignore patterns preset. */
export const COMMON_IGNORES = ["node_modules", ".git", "dist", "build", ".next", "*.log", ".DS_Store", "Thumbs.db"];
