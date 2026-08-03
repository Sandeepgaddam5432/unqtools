"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyButton, ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { parseCode, formatTokenTable, formatAstJson } from "./logic";
import { Code2, ListTree, Table2, GitBranch, BarChart3, FileCode } from "lucide-react";

const SAMPLE_CODE = `// AST Explorer Demo
const greeting = "Hello, World!";

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

class Calculator {
  #history = [];

  add(a, b) {
    const result = a + b;
    this.#history.push(result);
    return result;
  }

  get history() {
    return [...this.#history];
  }
}

const calc = new Calculator();
console.log(calc.add(2, 3));
console.log(fibonacci(10));
`;

type ViewMode = "tokens" | "ast-json" | "ast-tree";

export default function AstExplorer() {
  const [code, setCode] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("tokens");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    if (!code.trim()) return null;
    return parseCode(code);
  }, [code]);

  const loadSample = useCallback(() => {
    setCode(SAMPLE_CODE);
    setError(null);
    toast.info("Sample code loaded");
  }, []);

  const clear = useCallback(() => {
    setCode("");
    setError(null);
  }, []);

  const tokenTable = useMemo(() => {
    if (!result || !result.ok) return "";
    return formatTokenTable(result.tokens);
  }, [result]);

  const astJson = useMemo(() => {
    if (!result || !result.ok) return "";
    return formatAstJson(result.ast);
  }, [result]);

  return (
    <div className="space-y-4">
      {/* Code input */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-primary" />
              <Label htmlFor="ast-code" className="text-sm font-medium">Source Code</Label>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={loadSample}>Load sample</Button>
              <Button variant="ghost" size="sm" onClick={clear} disabled={!code}>Clear</Button>
            </div>
          </div>
          <Textarea
            id="ast-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste JavaScript or TypeScript code here…"
            className="min-h-[200px] font-mono text-sm resize-y"
            spellCheck={false}
          />
          {result && result.ok && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1">
                <BarChart3 className="h-3 w-3" /> {result.stats.tokenCount} tokens
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Code2 className="h-3 w-3" /> {result.stats.lineCount} lines
              </Badge>
              <Badge variant="outline" className="gap-1">
                <GitBranch className="h-3 w-3" /> {result.stats.nodeCount} nodes
              </Badge>
              <Badge variant="outline" className="gap-1">
                <ListTree className="h-3 w-3" /> depth {result.stats.maxDepth}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {/* Output */}
      {result && result.ok && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTree className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">AST View</h3>
              </div>
              <div className="flex items-center gap-2">
                <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                  <SelectTrigger className="w-36" aria-label="View mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tokens">Token Table</SelectItem>
                    <SelectItem value="ast-json">JSON Tree</SelectItem>
                    <SelectItem value="ast-tree">Visual Tree</SelectItem>
                  </SelectContent>
                </Select>
                <CopyButton getText={() => viewMode === "tokens" ? tokenTable : astJson} />
              </div>
            </div>

            {viewMode === "tokens" && (
              <div className="rounded-lg border bg-muted/30 overflow-auto max-h-[400px]">
                <table className="w-full text-xs font-mono">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr>
                      <th className="text-left p-2 border-b">Line</th>
                      <th className="text-left p-2 border-b">Col</th>
                      <th className="text-left p-2 border-b">Type</th>
                      <th className="text-left p-2 border-b">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.tokens.map((t, i) => (
                      <tr key={i} className="hover:bg-muted/50">
                        <td className="p-2 border-b text-muted-foreground">{t.line}</td>
                        <td className="p-2 border-b text-muted-foreground">{t.column}</td>
                        <td className="p-2 border-b">
                          <Badge variant="outline" className="text-[10px]">{t.type}</Badge>
                        </td>
                        <td className="p-2 border-b break-all">{t.value.length > 50 ? t.value.slice(0, 50) + "…" : t.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {viewMode === "ast-json" && (
              <pre className="rounded-lg border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
                {astJson}
              </pre>
            )}

            {viewMode === "ast-tree" && (
              <div className="rounded-lg border bg-muted/30 p-3 overflow-auto max-h-[400px]">
                <AstTreeView node={result.ast} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!result && !code.trim() && (
        <Card>
          <CardContent className="p-8 text-center">
            <Code2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Paste JavaScript or TypeScript code above to see its tokenized AST structure.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All parsing happens 100% locally in your browser. Your code never leaves your device. This is a lightweight tokenizer/parser for educational purposes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AstTreeView({ node }: { node: { type: string; value?: string; children: any[]; depth: number } }) {
  const [expanded, setExpanded] = useState(node.depth < 3);

  const typeColor = node.type.startsWith("Keyword") ? "text-purple-600" :
    node.type.startsWith("Literal") ? "text-emerald-600" :
    node.type === "Identifier" ? "text-blue-600" :
    node.type === "Comment" ? "text-muted-foreground italic" :
    node.type === "Block" ? "text-orange-600" :
    "text-foreground";

  return (
    <div className="ml-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1 text-xs py-0.5 hover:bg-muted/50 rounded px-1 ${typeColor}`}
      >
        {node.children.length > 0 && (
          <span className="text-muted-foreground w-3">{expanded ? "▾" : "▸"}</span>
        )}
        {node.children.length === 0 && <span className="w-3" />}
        <span className="font-medium">{node.type}</span>
        {node.value && (
          <span className="text-muted-foreground ml-1 truncate max-w-[200px]">
            "{node.value.length > 40 ? node.value.slice(0, 40) + "…" : node.value}"
          </span>
        )}
      </button>
      {expanded && node.children.map((child: any, i: number) => (
        <AstTreeView key={i} node={child} />
      ))}
    </div>
  );
}
