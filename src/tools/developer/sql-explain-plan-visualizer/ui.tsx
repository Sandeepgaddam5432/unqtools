"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  SAMPLE_POSTGRES_TEXT,
  SAMPLE_POSTGRES_JSON,
  SAMPLE_MYSQL_JSON,
  SAMPLE_SQLSERVER_XML,
  HOWTO_COLLECT,
  detectFormat,
  parsePlan,
  computeMisestimates,
  computeTimePercentages,
  findBottlenecks,
  generateAdvice,
  computeStats,
  renderTreeText,
  renderMarkdown,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PlanFormat,
  type ShareOptions,
  type HistoryEntry,
} from "./logic";
import {
  History, GitFork, FileText, Database, Lightbulb,
  AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight,
} from "lucide-react";

const SAMPLES: { label: string; format: PlanFormat; code: string }[] = [
  { label: "PostgreSQL (TEXT)", format: "postgres-text", code: SAMPLE_POSTGRES_TEXT },
  { label: "PostgreSQL (JSON)", format: "postgres-json", code: SAMPLE_POSTGRES_JSON },
  { label: "MySQL (JSON)", format: "mysql-json", code: SAMPLE_MYSQL_JSON },
  { label: "SQL Server (XML)", format: "sqlserver-xml", code: SAMPLE_SQLSERVER_XML },
];

export default function SqlExplainPlanVisualizer() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<ShareOptions>({ format: "unknown", showAdvice: true, showBuffers: false, view: "tree" });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHowto, setShowHowto] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setOpts(parsed);
      toast.info("Loaded options from share link");
    }
  }, []);

  const detected = useMemo(() => (input.trim() ? detectFormat(input) : "unknown"), [input]);
  const parseResult = useMemo(() => {
    if (!input.trim()) return null;
    const r = parsePlan(input, opts.format);
    if (r.ok) {
      computeMisestimates(r.plan);
      computeTimePercentages(r.plan);
    }
    return r;
  }, [input, opts.format]);

  const advice = useMemo(() => (parseResult?.ok ? generateAdvice(parseResult.plan) : []), [parseResult]);
  const findings = useMemo(() => (parseResult?.ok ? findBottlenecks(parseResult.plan) : []), [parseResult]);
  const stats = useMemo(() => (parseResult?.ok ? computeStats(parseResult.plan) : null), [parseResult]);

  const treeText = useMemo(() => (parseResult?.ok ? renderTreeText(parseResult.plan) : ""), [parseResult]);
  const markdown = useMemo(() => (parseResult?.ok ? renderMarkdown(parseResult.plan) : ""), [parseResult]);
  const csv = useMemo(() => (parseResult?.ok ? renderCsv(parseResult.plan) : ""), [parseResult]);
  const json = useMemo(() => (parseResult?.ok ? renderJson(parseResult.plan) : ""), [parseResult]);

  const handleLoadSample = useCallback((fmt: PlanFormat) => {
    const s = SAMPLES.find((x) => x.format === fmt);
    if (s) {
      setInput(s.code);
      setOpts((prev) => ({ ...prev, format: "unknown" })); // let auto-detect work
      toast.info(`Loaded sample: ${s.label}`);
    }
  }, []);

  const handleClear = useCallback(() => {
    setInput("");
    setCollapsed(new Set());
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const recordHistory = useCallback(() => {
    if (parseResult?.ok && input.trim()) {
      saveHistory({
        ts: Date.now(),
        format: parseResult.plan.format,
        totalNodes: parseResult.plan.flat.length,
        executionTime: parseResult.plan.executionTime,
        findings: findings.length,
        preview: input.slice(0, 80),
      });
      setHistory(loadHistory());
    }
  }, [parseResult, input, findings]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="explain-input" className="text-sm font-semibold flex items-center gap-1.5">
              <Database className="h-4 w-4" /> EXPLAIN output
            </Label>
            <div className="flex flex-wrap gap-2">
              <select
                value=""
                onChange={(e) => e.target.value && handleLoadSample(e.target.value as PlanFormat)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="">Load sample…</option>
                {SAMPLES.map((s) => <option key={s.format} value={s.format}>{s.label}</option>)}
              </select>
              <Button variant="outline" size="sm" onClick={() => setShowHowto((v) => !v)}>How to collect</Button>
              <ClearButton onClick={handleClear} disabled={!input} />
            </div>
          </div>
          <Textarea
            id="explain-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"Paste EXPLAIN / EXPLAIN ANALYZE output here…\n\nSupports:\n• PostgreSQL TEXT (indented)\n• PostgreSQL JSON (FORMAT JSON)\n• MySQL JSON (EXPLAIN FORMAT=JSON)\n• SQL Server XML (SHOWPLAN_XML)"}
            className="min-h-[180px] resize-y font-mono text-xs"
          />
          {input.trim() && (
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              <Badge variant="outline">Detected: {detected}</Badge>
              <select
                value={opts.format}
                onChange={(e) => setOpts((prev) => ({ ...prev, format: e.target.value as PlanFormat }))}
                className="h-7 text-xs rounded border bg-background px-2"
              >
                <option value="unknown">Auto-detect</option>
                <option value="postgres-text">Force PG text</option>
                <option value="postgres-json">Force PG JSON</option>
                <option value="mysql-json">Force MySQL JSON</option>
                <option value="sqlserver-xml">Force SQL Server XML</option>
              </select>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={opts.showAdvice}
                  onChange={(e) => setOpts((prev) => ({ ...prev, showAdvice: e.target.checked }))}
                /> Show advice
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {showHowto && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Info className="h-4 w-4" /> How to collect EXPLAIN output
            </h3>
            <pre className="text-[11px] bg-muted/40 rounded p-3 overflow-auto whitespace-pre-wrap">{HOWTO_COLLECT.join("\n")}</pre>
          </CardContent>
        </Card>
      )}

      {parseResult && !parseResult.ok && (
        <ErrorBanner message={`Parse error: ${parseResult.error}`} />
      )}

      {parseResult?.ok && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <GitFork className="h-4 w-4" /> Plan overview
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={opts.view === "tree" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOpts((prev) => ({ ...prev, view: "tree" }))}
                  >Tree view</Button>
                  <Button
                    variant={opts.view === "text" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOpts((prev) => ({ ...prev, view: "text" }))}
                  >Text view</Button>
                </div>
              </div>
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                  <Stat label="Nodes" value={stats.totalNodes} />
                  <Stat label="Max depth" value={stats.maxDepth} />
                  <Stat label="Format" value={parseResult.plan.format.replace("-", " ")} />
                  <Stat label="Findings" value={findings.length} highlight={findings.length > 0 ? "bad" : "good"} />
                  {stats.executionTime !== undefined && (
                    <Stat label="Execution (ms)" value={stats.executionTime.toFixed(2)} />
                  )}
                  <Stat
                    label="Actuals"
                    value={parseResult.plan.hasActuals ? "yes" : "no"}
                    highlight={parseResult.plan.hasActuals ? "good" : "bad"}
                  />
                </div>
              )}
              {stats && Object.keys(stats.scanTypes).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(stats.scanTypes).map(([t, c]) => (
                    <Badge key={t} variant="outline" className="text-[10px]">{t}: {c}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {opts.showAdvice && advice.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" /> Advice
                </h3>
                <ul className="space-y-1.5 text-xs">
                  {advice.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 rounded border bg-background px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                      <span className="text-foreground">{a}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {findings.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Findings ({findings.length})
                </h3>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {findings.map((f, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={f.severity} />
                        <span className="font-mono font-medium text-foreground">{f.nodeType}</span>
                        {f.relationName && <span className="text-muted-foreground">on {f.relationName}</span>}
                      </div>
                      <p className="mt-1 text-foreground">{f.message}</p>
                      <p className="mt-0.5 text-muted-foreground"><strong>Advice:</strong> {f.advice}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> {opts.view === "tree" ? "Plan tree" : "Plan text"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => { recordHistory(); return opts.view === "tree" ? treeText : treeText; }} label="Copy" />
                  <DownloadButton getText={() => markdown} filename="explain-plan-report.md" mime="text/markdown" label="Download .md" />
                  <DownloadButton getText={() => csv} filename="explain-plan.csv" mime="text/csv" label="CSV" />
                  <DownloadButton getText={() => json} filename="explain-plan.json" mime="application/json" label="JSON" />
                  <ShareButton getUrl={() => buildShareUrl(opts)} />
                </div>
              </div>
              {opts.view === "tree" && parseResult.plan.root ? (
                <div className="max-h-[500px] overflow-auto rounded border bg-background p-3">
                  <PlanTreeView
                    node={parseResult.plan.root}
                    collapsed={collapsed}
                    onToggle={toggleCollapse}
                    showBuffers={opts.showBuffers}
                  />
                </div>
              ) : (
                <Textarea
                  readOnly
                  value={treeText}
                  className="min-h-[300px] resize-y font-mono text-xs"
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!input.trim() && (
        <EmptyState
          title="Paste EXPLAIN output to visualize the plan"
          hint="Supports PostgreSQL (text + JSON), MySQL (JSON), and SQL Server (XML). All parsing runs locally — your plans never leave the browser."
          icon={<GitFork className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.format}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.totalNodes} nodes</Badge>
                    {h.executionTime !== undefined && (
                      <Badge variant="outline" className="text-[10px]">{h.executionTime.toFixed(2)} ms</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">{h.findings} findings</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate">{h.preview}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Plans are parsed and analyzed entirely in your browser. Nothing is uploaded. History (last 20) is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Plan tree rendering ----

function PlanTreeView({
  node,
  collapsed,
  onToggle,
  showBuffers,
}: {
  node: import("./logic").PlanNode;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  showBuffers: boolean;
}) {
  return <PlanTreeRow node={node} collapsed={collapsed} onToggle={onToggle} showBuffers={showBuffers} />;
}

function PlanTreeRow({
  node,
  collapsed,
  onToggle,
  showBuffers,
}: {
  node: import("./logic").PlanNode;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  showBuffers: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.id);
  const misestimateBad = node.misestimateRatio !== undefined &&
    (node.misestimateRatio >= 10 || node.misestimateRatio <= 0.1);
  const heatClass =
    node.totalTimePctOfRoot === undefined ? "" :
    node.totalTimePctOfRoot >= 50 ? "bg-red-500/10" :
    node.totalTimePctOfRoot >= 30 ? "bg-orange-500/10" :
    node.totalTimePctOfRoot >= 10 ? "bg-yellow-500/10" : "";

  return (
    <div>
      <div
        className={`flex items-start gap-1.5 px-2 py-1 rounded text-xs ${heatClass}`}
        style={{ marginLeft: node.depth * 16 }}
      >
        {hasChildren ? (
          <button
            onClick={() => onToggle(node.id)}
            className="mt-0.5 text-muted-foreground hover:text-foreground"
            aria-label={isCollapsed ? "expand" : "collapse"}
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3 inline-block" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono font-medium text-foreground">{node.nodeType}</span>
            {node.relationName && (
              <span className="text-muted-foreground">on <span className="font-mono">{node.relationName}</span></span>
            )}
            {node.alias && node.alias !== node.relationName && (
              <span className="text-muted-foreground font-mono">[{node.alias}]</span>
            )}
            {misestimateBad && (
              <Badge variant="outline" className="text-[9px] text-amber-600 dark:text-amber-400 border-amber-500/40">⚠ misestimate</Badge>
            )}
            {node.totalTimePctOfRoot !== undefined && node.totalTimePctOfRoot >= 30 && node.depth > 0 && (
              <Badge variant="outline" className="text-[9px] text-red-600 dark:text-red-400 border-red-500/40">hot</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-0.5 text-[10px] text-muted-foreground">
            {node.startupCost !== undefined && node.totalCost !== undefined && (
              <span>cost={node.startupCost.toFixed(2)}..{node.totalCost.toFixed(2)}</span>
            )}
            {node.estimatedRows !== undefined && (
              <span>est rows={node.estimatedRows.toLocaleString()}</span>
            )}
            {node.actualRows !== undefined && (
              <span>actual rows={node.actualRows.toLocaleString()}</span>
            )}
            {node.actualLoops !== undefined && node.actualLoops > 1 && (
              <span>loops={node.actualLoops.toLocaleString()}</span>
            )}
            {node.actualTotalTime !== undefined && (
              <span>time={node.actualTotalTime.toFixed(3)}ms</span>
            )}
            {node.totalTimePctOfRoot !== undefined && (
              <span>({node.totalTimePctOfRoot.toFixed(1)}%)</span>
            )}
            {showBuffers && node.sharedHitBlocks !== undefined && (
              <span>hit={node.sharedHitBlocks}</span>
            )}
            {showBuffers && node.sharedReadBlocks !== undefined && (
              <span>read={node.sharedReadBlocks}</span>
            )}
          </div>
          {node.filter && <div className="mt-0.5 text-[10px] font-mono text-muted-foreground">Filter: {node.filter}</div>}
          {node.indexCond && <div className="mt-0.5 text-[10px] font-mono text-muted-foreground">Index Cond: {node.indexCond}</div>}
          {node.hashCond && <div className="mt-0.5 text-[10px] font-mono text-muted-foreground">Hash Cond: {node.hashCond}</div>}
          {node.sortKey && <div className="mt-0.5 text-[10px] font-mono text-muted-foreground">Sort Key: {node.sortKey.join(", ")}</div>}
          {Object.entries(node.extraInfo).slice(0, 3).map(([k, v]) => (
            <div key={k} className="mt-0.5 text-[10px] font-mono text-muted-foreground">{k}: {v}</div>
          ))}
        </div>
      </div>
      {hasChildren && !isCollapsed && (
        <div>
          {node.children.map((c) => (
            <PlanTreeRow
              key={c.id}
              node={c}
              collapsed={collapsed}
              onToggle={onToggle}
              showBuffers={showBuffers}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: "info" | "warning" | "critical" }) {
  const cls = severity === "critical"
    ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/40"
    : severity === "warning"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/40"
      : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/40";
  return <Badge variant="outline" className={`text-[9px] ${cls}`}>{severity}</Badge>;
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
