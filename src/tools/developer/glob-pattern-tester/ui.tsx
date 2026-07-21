"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, FileSearch, Plus, Trash2, Eye, Code2, ListTree,
  Settings2, CheckCircle2, XCircle, AlertTriangle, Folder, FileText,
} from "lucide-react";
import {
  FLAVORS,
  DEFAULT_OPTIONS,
  SAMPLE_PATHS,
  PRESET_PATTERNS,
  parsePathList,
  globToRegex,
  matchMultiPatterns,
  explainPattern,
  buildTree,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  makePatternEntry,
  type ConvertOptions,
  type PatternEntry,
  type GlobFlavor,
  type HistoryEntry,
  type TreeNode,
} from "./logic";

const FLAVOR_LABELS: Record<GlobFlavor, string> = {
  shell: "Shell glob",
  gitignore: ".gitignore",
  minimatch: "minimatch",
  tsconfig: "tsconfig",
};

export default function GlobPatternTester() {
  const [patterns, setPatterns] = useState<PatternEntry[]>([
    makePatternEntry("**/*.{ts,tsx}", false),
    makePatternEntry("**/*.test.*", true),
  ]);
  const [pathsText, setPathsText] = useState(SAMPLE_PATHS.join("\n"));
  const [opts, setOpts] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.patterns.length > 0 || parsed.paths) {
        setPatterns(parsed.patterns);
        setPathsText(parsed.paths);
        setOpts(parsed.options);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const paths = useMemo(() => parsePathList(pathsText), [pathsText]);
  const matchSet = useMemo(
    () => matchMultiPatterns(patterns, paths, opts),
    [patterns, paths, opts],
  );
  const stats = useMemo(
    () => computeStats(patterns, paths, matchSet, opts),
    [patterns, paths, matchSet, opts],
  );
  const tree = useMemo(
    () => buildTree(paths, matchSet),
    [paths, matchSet],
  );
  // For the first include pattern (or first pattern), show explanation + regex
  const explainPatternEntry = patterns[0];
  const explain = useMemo(
    () => explainPatternEntry
      ? globToRegex(explainPatternEntry.pattern, opts)
      : null,
    [explainPatternEntry, opts],
  );

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      flavor: opts.flavor,
      patternCount: patterns.length,
      pathCount: paths.length,
      matchCount: matchSet.matched.length,
    });
    setHistory(loadHistory());
  }, [opts.flavor, patterns.length, paths.length, matchSet.matched.length]);

  const addPattern = useCallback((exclude: boolean) => {
    const entry = makePatternEntry("", exclude);
    setPatterns((prev) => [...prev, entry]);
  }, []);

  const updatePattern = useCallback((id: string, patch: Partial<PatternEntry>) => {
    setPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const deletePattern = useCallback((id: string) => {
    setPatterns((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const loadPreset = useCallback((presetId: string) => {
    const preset = PRESET_PATTERNS.find((p) => p.id === presetId);
    if (!preset) return;
    setPatterns([makePatternEntry(preset.pattern, false)]);
    setOpts((prev) => ({ ...prev, flavor: preset.flavor }));
    toast.success(`Loaded preset: ${preset.label}`);
  }, []);

  const loadSamplePaths = useCallback(() => {
    setPathsText(SAMPLE_PATHS.join("\n"));
    toast.success("Loaded sample paths");
  }, []);

  const handleClear = useCallback(() => {
    setPatterns([]);
    setPathsText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const matchedText = useMemo(() => matchSet.matched.join("\n"), [matchSet.matched]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Settings2 className="h-4 w-4" /> Flavor & Toggles
            </h3>
            <div className="flex flex-wrap gap-1">
              {PRESET_PATTERNS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => loadPreset(p.id)}
                  title={p.description}
                >{p.label}</Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-xs">Flavor:</Label>
            <select
              value={opts.flavor}
              onChange={(e) => setOpts((prev) => ({ ...prev, flavor: e.target.value as GlobFlavor }))}
              className="h-7 text-xs rounded border bg-background px-2"
            >
              {FLAVORS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={opts.caseSensitive}
                onChange={(e) => setOpts((prev) => ({ ...prev, caseSensitive: e.target.checked }))}
              />
              Case-sensitive
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={opts.dot}
                onChange={(e) => setOpts((prev) => ({ ...prev, dot: e.target.checked }))}
              />
              Match dotfiles
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={opts.globstar}
                onChange={(e) => setOpts((prev) => ({ ...prev, globstar: e.target.checked }))}
              />
              Globstar `**`
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {FLAVORS.find((f) => f.id === opts.flavor)?.description}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Code2 className="h-4 w-4" /> Patterns ({patterns.length})
            </h3>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => addPattern(false)}>
                <Plus className="h-3 w-3 mr-1" /> Include
              </Button>
              <Button variant="outline" size="sm" onClick={() => addPattern(true)}>
                <Plus className="h-3 w-3 mr-1" /> Exclude
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            {patterns.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <Badge
                  variant={p.exclude ? "destructive" : "default"}
                  className="text-[10px] w-16 justify-center"
                >{p.exclude ? "Exclude" : "Include"}</Badge>
                <Input
                  value={p.pattern}
                  onChange={(e) => updatePattern(p.id, { pattern: e.target.value })}
                  placeholder={p.exclude ? "e.g. **/*.test.*" : "e.g. **/*.ts"}
                  className="font-mono text-xs"
                />
                <Button
                  variant="ghost" size="icon-sm" className="h-7 w-7 text-destructive"
                  onClick={() => deletePattern(p.id)}
                ><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
            {patterns.length === 0 && (
              <p className="text-xs text-muted-foreground">No patterns yet — add an Include or Exclude above. With no patterns, all paths are unmatched.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> File paths ({paths.length})
            </h3>
            <Button variant="ghost" size="sm" onClick={loadSamplePaths}>Load sample</Button>
          </div>
          <Textarea
            value={pathsText}
            onChange={(e) => setPathsText(e.target.value)}
            placeholder={"src/index.ts\nsrc/utils/helpers.ts\nREADME.md"}
            className="min-h-[120px] resize-y font-mono text-xs"
          />
        </CardContent>
      </Card>

      {patterns.length > 0 && paths.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Eye className="h-4 w-4" /> Stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total paths" value={stats.total} />
                <Stat label="Matched" value={stats.matched} highlight="good" />
                <Stat label="Unmatched" value={stats.unmatched} />
                <Stat label="Excluded" value={stats.excluded} highlight="bad" />
              </div>
            </CardContent>
          </Card>

          {explain && explainPatternEntry && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Code2 className="h-4 w-4" /> Pattern explanation
                  <Badge variant="outline" className="text-[10px] ml-1">
                    {explainPatternEntry.exclude ? "Exclude" : "Include"} #1
                  </Badge>
                </h3>
                <div className="rounded border bg-muted/30 p-2 font-mono text-xs break-all">
                  {explainPatternEntry.pattern || "(empty)"}
                </div>
                <div>
                  <Label className="text-xs">Regex source</Label>
                  <pre className="rounded border bg-muted/30 p-2 mt-1 font-mono text-xs whitespace-pre-wrap break-all">
                    {explain.source}
                  </pre>
                </div>
                <div>
                  <Label className="text-xs">Token-by-token</Label>
                  <div className="space-y-1 mt-1">
                    {explain.tokens.map((t, i) => (
                      <div key={i} className="flex items-start gap-2 rounded border bg-background px-2 py-1.5 text-xs">
                        <Badge variant="outline" className="text-[10px] w-20 justify-center flex-shrink-0">{t.kind}</Badge>
                        <code className="font-mono text-foreground flex-shrink-0 min-w-[60px]">{t.raw || "(empty)"}</code>
                        <span className="text-muted-foreground">{t.explanation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListTree className="h-4 w-4" /> Tree view
              </h3>
              <div className="rounded border bg-muted/10 p-2 max-h-[400px] overflow-auto">
                <TreeRow node={tree} depth={0} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Matched ({matchSet.matched.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return matchedText; }}
                    label="Copy matched"
                  />
                  <DownloadButton
                    getText={() => matchedText}
                    filename="matched-paths.txt"
                    mime="text/plain"
                    label="Download"
                  />
                  <ShareButton
                    getUrl={() => { handleSaveHistory(); return buildShareUrl(patterns, pathsText, opts); }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {matchSet.matched.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No paths matched.</p>
                ) : (
                  matchSet.matched.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 px-2 py-1 text-xs font-mono">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span className="text-foreground truncate">{p}</span>
                    </div>
                  ))
                )}
              </div>
              {matchSet.unmatched.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground pt-1">
                    Unmatched ({matchSet.unmatched.length})
                  </summary>
                  <div className="space-y-1 mt-1">
                    {matchSet.unmatched.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 rounded border bg-background px-2 py-1 text-xs font-mono">
                        <XCircle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground truncate">{p}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Add patterns and paths to test"
          hint="Enter at least one glob pattern (e.g. **/*.ts) and a list of file paths (one per line). Toggle the flavor and dot/case/globstar options to see how matching changes."
          icon={<FileSearch className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{FLAVOR_LABELS[h.flavor]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.patternCount} patterns</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.pathCount} paths</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.matchCount} matched</Badge>
                  <span className="text-muted-foreground">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All matching runs locally. Paths are never uploaded — they stay in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TreeRow({ node, depth }: { node: TreeNode; depth: number }) {
  if (depth === 0) {
    // Root: render children only
    return (
      <div>
        {node.children.map((c) => (
          <TreeRow key={c.fullPath} node={c} depth={1} />
        ))}
      </div>
    );
  }
  const icon = node.isDir
    ? <Folder className="h-3 w-3 text-amber-500 flex-shrink-0" />
    : <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />;
  const bg = node.matched
    ? "bg-emerald-50 dark:bg-emerald-950/30"
    : node.excluded
      ? "bg-red-50 dark:bg-red-950/30"
      : "hover:bg-muted/30";
  const text = node.matched
    ? "text-emerald-700 dark:text-emerald-300"
    : node.excluded
      ? "text-red-700 dark:text-red-300 line-through"
      : "text-foreground";
  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs font-mono ${bg} ${text}`}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {icon}
        <span className="truncate">{node.name}</span>
        {node.matched && <CheckCircle2 className="h-3 w-3 ml-auto text-emerald-600 dark:text-emerald-400 flex-shrink-0" />}
        {node.excluded && <AlertTriangle className="h-3 w-3 ml-auto text-red-600 dark:text-red-400 flex-shrink-0" />}
      </div>
      {node.children.map((c) => (
        <TreeRow key={c.fullPath} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
