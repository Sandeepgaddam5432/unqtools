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
  parseToGraph,
  generateMermaid,
  generateFlowchart,
  refineFlowchart,
  validateMermaid,
  repairMermaid,
  mermaidLiveUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Direction,
  type Theme,
  type HistoryEntry,
} from "./logic";
import {
  Workflow, History, ExternalLink, AlertTriangle,
  Wand2, Sparkles, CheckCircle2,
} from "lucide-react";

const SAMPLE_DESCRIPTION = `Start leads to Check credentials
if valid then dashboard else login error
dashboard leads to Show recommendations
loop over user preferences
Show recommendations leads to End`;

const DIRECTIONS: Direction[] = ["TD", "LR", "BT", "RL"];
const THEMES: Theme[] = ["default", "forest", "dark", "neutral"];

export default function AiMermaidFlowchartGenerator() {
  const [description, setDescription] = useState("");
  const [direction, setDirection] = useState<Direction>("TD");
  const [theme, setTheme] = useState<Theme>("default");
  const [refinement, setRefinement] = useState("");
  const [code, setCode] = useState("");
  const [repairs, setRepairs] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [stats, setStats] = useState<{ nodes: number; edges: number } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.description) {
        setDescription(p.description);
        setDirection(p.direction);
        setTheme(p.theme);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const runGenerate = useCallback(
    (text: string, dir: Direction, thm: Theme) => {
      if (!text.trim()) {
        toast.error("Describe a process first");
        return;
      }
      const r = generateFlowchart(text, { direction: dir, theme: thm, autoRepair: true });
      setCode(r.code);
      setRepairs(r.repairs);
      setWarnings(r.warnings);
      setStats({ nodes: r.graph.nodes.length, edges: r.graph.edges.length });
      const v = validateMermaid(r.code);
      setValidation({ valid: v.valid, errors: v.errors });
      saveHistory({
        ts: Date.now(),
        description: text,
        direction: dir,
        nodeCount: r.graph.nodes.length,
        edgeCount: r.graph.edges.length,
      });
      setHistory(loadHistory());
      toast.success(
        `Generated ${r.graph.nodes.length} nodes / ${r.graph.edges.length} edges${r.repairs.length ? ` · ${r.repairs.length} auto-fix(es)` : ""}`,
      );
    },
    [],
  );

  const handleRun = useCallback(() => {
    runGenerate(description, direction, theme);
  }, [description, direction, theme, runGenerate]);

  const handleRefine = useCallback(() => {
    if (!refinement.trim()) {
      toast.error("Type a refinement instruction");
      return;
    }
    const r = refineFlowchart(description, refinement, { direction, theme, autoRepair: true });
    setCode(r.code);
    setRepairs(r.repairs);
    setWarnings(r.warnings);
    setStats({ nodes: r.graph.nodes.length, edges: r.graph.edges.length });
    const v = validateMermaid(r.code);
    setValidation({ valid: v.valid, errors: v.errors });
    setDescription((prev) => `${prev}\n${refinement}`.trim());
    setRefinement("");
    saveHistory({
      ts: Date.now(),
      description: refinement,
      direction,
      nodeCount: r.graph.nodes.length,
      edgeCount: r.graph.edges.length,
    });
    setHistory(loadHistory());
    toast.success("Refined flowchart");
  }, [refinement, description, direction, theme]);

  const handleRepair = useCallback(() => {
    if (!code) return;
    const r = repairMermaid(code);
    setCode(r.code);
    setRepairs((prev) => [...prev, ...r.repairs]);
    const v = validateMermaid(r.code);
    setValidation({ valid: v.valid, errors: v.errors });
    toast.success(`Self-heal applied (${r.repairs.length} repairs)`);
  }, [code]);

  const handleClear = useCallback(() => {
    setDescription("");
    setRefinement("");
    setCode("");
    setRepairs([]);
    setWarnings([]);
    setValidation(null);
    setStats(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const mermaidUrl = useMemo(() => (code ? mermaidLiveUrl(code) : ""), [code]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mfg-desc">Process description (natural language or step list)</Label>
            <Textarea
              id="mfg-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"Start leads to Check creds\nif valid then dashboard else error\ndashboard leads to End"}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDescription(SAMPLE_DESCRIPTION)}
              >Load sample</Button>
              <Label className="text-xs ml-2">Direction:</Label>
              {DIRECTIONS.map((d) => (
                <Button
                  key={d}
                  variant={direction === d ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDirection(d)}
                >{d}</Button>
              ))}
              <Label className="text-xs ml-2">Theme:</Label>
              {THEMES.map((t) => (
                <Button
                  key={t}
                  variant={theme === t ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs capitalize"
                  onClick={() => setTheme(t)}
                >{t}</Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleRun} className="gap-1.5">
              <Workflow className="h-3.5 w-3.5" /> Generate flowchart
            </Button>
            <ClearButton onClick={handleClear} />
            <ShareButton
              getUrl={() => buildShareUrl(description, direction, theme)}
            />
          </div>
        </CardContent>
      </Card>

      {warnings.length > 0 ? (
        <ErrorBanner message={warnings.join(" ")} />
      ) : null}

      {validation && !validation.valid ? (
        <ErrorBanner message={`Validation: ${validation.errors.join(" ")}`} />
      ) : null}

      {code ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Nodes" value={stats?.nodes ?? 0} highlight="good" />
                <Stat label="Edges" value={stats?.edges ?? 0} highlight="good" />
                <Stat label="Auto-fixes" value={repairs.length} highlight={repairs.length ? "bad" : "good"} />
                <Stat label="Valid" value={validation?.valid ? "yes" : "no"} highlight={validation?.valid ? "good" : "bad"} />
              </div>
              {repairs.length > 0 && (
                <div className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    <Wand2 className="h-3.5 w-3.5" /> Self-healing applied:
                  </div>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {repairs.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Workflow className="h-4 w-4" /> Mermaid code
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={handleRepair}
                  ><Wand2 className="h-3.5 w-3.5" /> Self-heal</Button>
                  <CopyButton getText={() => code} />
                  <DownloadButton
                    getText={() => code}
                    filename="flowchart.mmd"
                    mime="text/plain"
                    label="Download .mmd"
                  />
                  <a href={mermaidUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" /> Open in mermaid.live
                    </Button>
                  </a>
                </div>
              </div>
              <Textarea
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  const v = validateMermaid(e.target.value);
                  setValidation({ valid: v.valid, errors: v.errors });
                }}
                className="min-h-[260px] resize-y font-mono text-xs"
              />
              {validation?.valid ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Valid Mermaid syntax
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label htmlFor="mfg-refine" className="text-xs">Refine via follow-up (append + regenerate)</Label>
              <div className="flex flex-wrap gap-2">
                <Textarea
                  id="mfg-refine"
                  value={refinement}
                  onChange={(e) => setRefinement(e.target.value)}
                  placeholder="add an error path after the decision"
                  className="min-h-[60px] resize-y font-mono text-xs flex-1"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefine}
                className="gap-1.5"
              ><Sparkles className="h-3.5 w-3.5" /> Refine</Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Describe a process to generate a Mermaid flowchart"
          hint="Natural language ('A leads to B; if X then Y else Z; loop over items') or one step per line with arrows. Decisions become diamonds, parallel cues create parallel edges, 'phase:' opens a subgraph. Self-healing fixes common syntax errors."
          icon={<Workflow className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.direction}</Badge>
                  <Badge variant="outline" className="mr-2">{h.nodeCount} nodes</Badge>
                  <Badge variant="outline" className="mr-2">{h.edgeCount} edges</Badge>
                  <span className="text-muted-foreground truncate">{h.description.slice(0, 80)}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Privacy + honesty:
            </strong>{" "}
            All parsing, generation, validation, and self-healing run locally. History is stored in localStorage on this device only. The NL parser is best-effort — review complex diagrams before relying on them.
          </p>
        </CardContent>
      </Card>
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
