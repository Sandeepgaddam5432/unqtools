"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CopyButton, DownloadButton, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseContentItems,
  auditItems,
  summarizeAudit,
  renderTextTable,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  PRESET_THRESHOLDS,
  PRESET_LABELS,
  type Preset,
  type Thresholds,
  type HistoryEntry,
  type AuditedItem,
  type Decision,
} from "./logic";
import { History, Scissors, ShieldCheck, AlertTriangle, SlidersHorizontal } from "lucide-react";

const DECISION_STYLES: Record<Decision, string> = {
  keep: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  improve: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  merge: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400",
  redirect: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  delete: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
};

const PRESET_LIST: Preset[] = ["conservative", "balanced", "aggressive"];

export default function ContentPruningAuditor() {
  const [input, setInput] = useState("");
  const [preset, setPreset] = useState<Preset>("balanced");
  const [filter, setFilter] = useState<"all" | "prune">("all");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [overrides, setOverrides] = useState<Partial<Thresholds>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) {
        setInput(p.input);
        setPreset(p.preset);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const items = useMemo(() => parseContentItems(input), [input]);
  const audited = useMemo(() => auditItems(items, preset, overrides), [items, preset, overrides]);
  const summary = useMemo(() => summarizeAudit(audited), [audited]);
  const textTable = useMemo(() => renderTextTable(audited), [audited]);
  const csv = useMemo(() => renderCsv(audited), [audited]);

  const filtered = useMemo(
    () =>
      filter === "prune"
        ? audited.filter((a) => a.decision !== "keep" && a.decision !== "improve")
        : audited,
    [audited, filter],
  );

  const handleSaveHistory = useCallback(() => {
    if (audited.length > 0) {
      saveHistory({
        ts: Date.now(),
        total: summary.total,
        keep: summary.keep,
        improve: summary.improve,
        merge: summary.merge,
        redirect: summary.redirect,
        delete: summary.delete,
        avgScore: summary.avgPruningScore,
      });
      setHistory(loadHistory());
    }
  }, [audited.length, summary]);

  const handleClear = useCallback(() => {
    setInput("");
    setOverrides({});
    setFilter("all");
    toast.info("Form cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const updateOverride = useCallback(
    (key: keyof Thresholds, value: number) => {
      setOverrides((o) => ({ ...o, [key]: value }));
    },
    [],
  );

  const resetOverrides = useCallback(() => {
    setOverrides({});
    toast.info("Thresholds reset to preset");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cp-input">
              Content inventory — one URL per line, format:{" "}
              <code className="text-xs">url,traffic,backlinks,word_count,age_months,last_updated_months_ago</code>
            </Label>
            <Textarea
              id="cp-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"https://example.com/blog/seo-guide,500,8,1200,18,3\nhttps://example.com/old-post,0,0,150,36,30\nhttps://example.com/legacy/seo-tips,5,0,800,30,1"}
              className="min-h-[160px] resize-y font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs">Preset:</Label>
              {PRESET_LIST.map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={preset === p ? "default" : "outline"}
                  onClick={() => setPreset(p)}
                  className="text-xs"
                >
                  {PRESET_LABELS[p]}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="text-xs gap-1"
                onClick={() => setAdvancedOpen((v) => !v)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {advancedOpen ? "Hide thresholds" : "Custom thresholds"}
              </Button>
            </div>
            {advancedOpen && (
              <div className="rounded border bg-muted/40 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                {(Object.keys(PRESET_THRESHOLDS[preset]) as (keyof Thresholds)[]).map((key) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={`cp-${key}`} className="text-[10px] uppercase tracking-wide">
                      {key}
                    </Label>
                    <Input
                      id={`cp-${key}`}
                      type="number"
                      min={0}
                      value={overrides[key] ?? PRESET_THRESHOLDS[preset][key]}
                      onChange={(e) => updateOverride(key, Math.max(0, Number(e.target.value) || 0))}
                      className="h-8 text-xs"
                    />
                  </div>
                ))}
                <div className="col-span-full flex justify-end">
                  <Button size="sm" variant="ghost" className="text-xs" onClick={resetOverrides}>
                    Reset to preset
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{items.length} parsed</Badge>
            <Badge variant="outline">avg score {summary.avgPruningScore}</Badge>
            <Badge variant="outline">{summary.totalTraffic} total traffic</Badge>
            <Badge variant="outline">{summary.totalBacklinks} total backlinks</Badge>
            {summary.highRiskCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {summary.highRiskCount} high-risk
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {items.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(["keep", "improve", "merge", "redirect", "delete"] as Decision[]).map((d) => (
                  <div key={d} className={`rounded border p-2 ${DECISION_STYLES[d]}`}>
                    <div className="text-[10px] uppercase tracking-wide opacity-80">{d}</div>
                    <div className="text-xl font-bold">{summary[d]}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs">Filter:</Label>
                <Button
                  size="sm"
                  variant={filter === "all" ? "default" : "outline"}
                  onClick={() => setFilter("all")}
                  className="text-xs"
                >
                  All ({summary.total})
                </Button>
                <Button
                  size="sm"
                  variant={filter === "prune" ? "default" : "outline"}
                  onClick={() => setFilter("prune")}
                  className="text-xs"
                >
                  Prune candidates ({summary.merge + summary.redirect + summary.delete})
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Scissors className="h-4 w-4" /> Audit results ({filtered.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => {
                      handleSaveHistory();
                      return textTable;
                    }}
                    label="Copy TXT"
                  />
                  <DownloadButton getText={() => textTable} filename="content-pruning-audit.txt" mime="text/plain" label="TXT" />
                  <DownloadButton getText={() => csv} filename="content-pruning-audit.csv" mime="text/csv" label="CSV" />
                  <ShareButton
                    getUrl={() => {
                      handleSaveHistory();
                      return buildShareUrl(input, preset);
                    }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {filtered.map((a, i) => (
                  <DecisionRow key={i} item={a} />
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste a content inventory to audit"
          hint="We'll classify each URL as keep / improve / merge / redirect / delete and compute a weighted pruning score per page."
          icon={<Scissors className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{h.total} items</Badge>
                  <Badge variant="outline">avg {h.avgScore}</Badge>
                  {h.delete > 0 && <Badge variant="destructive">{h.delete} del</Badge>}
                  {h.redirect > 0 && <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">{h.redirect} redir</Badge>}
                  {h.merge > 0 && <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20">{h.merge} merge</Badge>}
                  {h.improve > 0 && <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">{h.improve} impr</Badge>}
                  {h.keep > 0 && <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">{h.keep} keep</Badge>}
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> the entire audit runs locally in your browser. History is stored in localStorage on this device only and never uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DecisionRow({ item }: { item: AuditedItem }) {
  return (
    <div className={`rounded border p-3 text-xs space-y-1.5 ${DECISION_STYLES[item.decision]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono break-all font-semibold">{item.url}</div>
        <Badge variant="outline" className="shrink-0">{item.decision.toUpperCase()}</Badge>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 opacity-90">
        <span>traffic: <strong>{item.traffic}</strong></span>
        <span>backlinks: <strong>{item.backlinks}</strong></span>
        <span>words: <strong>{item.wordCount}</strong></span>
        <span>age: <strong>{item.ageMonths}mo</strong></span>
        <span>score: <strong>{item.pruningScore}</strong></span>
      </div>
      <div className="opacity-90">{item.reason}</div>
      {item.redirectTo && (
        <div className="opacity-90">
          → redirect to: <span className="font-mono break-all">{item.redirectTo}</span>
        </div>
      )}
      {item.mergeWith && (
        <div className="opacity-90">
          ⤳ merge with: <span className="font-mono break-all">{item.mergeWith}</span>
        </div>
      )}
    </div>
  );
}
