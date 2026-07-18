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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  parseInput,
  calculate,
  renderCsv,
  positionWeight,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";
import { History, PieChart, Trophy, BarChart3 } from "lucide-react";

const SAMPLE = `keyword,volume,you,competitor-a,competitor-b
best seo tools,5000,2,1,5
seo software,3000,5,3,8
keyword research tool,2000,1,10,15
seo audit tool,1500,8,4,2
backlink checker,2500,15,2,3`;

export default function ShareOfVoiceCalculator() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) {
        setInput(p.data);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parseInput(input), [input]);
  const result = useMemo(() => calculate(parsed.rows, parsed.domains), [parsed]);
  const csv = useMemo(() => renderCsv(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.totalKeywords > 0 && result.domains.length > 0) {
      saveHistory({
        ts: Date.now(),
        totalKeywords: result.totalKeywords,
        totalVolume: result.totalVolume,
        topDomain: result.domains[0].domain,
        topSov: result.domains[0].sovPercentage,
      });
      setHistory(loadHistory());
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setInput("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="sov-input">Keyword rankings + search volume (CSV)</Label>
            <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); toast.info("Sample loaded"); }}>
              Load sample
            </Button>
          </div>
          <Textarea
            id="sov-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"keyword,volume,you,competitor-a\nbest seo tools,5000,2,1\nOR\nseo,1000,you:5,competitor:3"}
            className="min-h-[150px] resize-y font-mono text-xs"
          />
          {parsed.errors.length > 0 && (
            <ErrorBanner message={`${parsed.errors.length} parse error(s): ${parsed.errors.slice(0, 3).join("; ")}`} />
          )}
          <div className="text-xs text-muted-foreground">
            Two formats: (a) header <code>keyword,volume,domain1,domain2,…</code> with positions in order,
            or (b) headerless rows <code>keyword,volume,domain:position,domain:position</code>.
          </div>
        </CardContent>
      </Card>

      {result.totalKeywords > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <PieChart className="h-4 w-4" /> Share of Voice ({result.domains.length} domains)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total keywords" value={result.totalKeywords} />
                <Stat label="Total volume" value={result.totalVolume.toLocaleString()} />
                <Stat label="Total visibility" value={Math.round(result.totalVisibility).toLocaleString()} />
                <Stat
                  label="Top domain"
                  value={result.domains[0]?.domain ?? "—"}
                  highlight="good"
                />
              </div>
              <div className="space-y-2 pt-2">
                {result.domains.map((d) => (
                  <div key={d.domain} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-mono font-medium text-foreground">{d.domain}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant={d.sovPercentage >= 50 ? "default" : d.sovPercentage >= 25 ? "secondary" : "outline"}>
                          SOV {d.sovPercentage}%
                        </Badge>
                        {d.domain === result.domains[0]?.domain && (
                          <Badge variant="default" className="gap-0.5">
                            <Trophy className="h-3 w-3" /> Leader
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded overflow-hidden mb-2">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.max(2, d.sovPercentage)}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-3 text-muted-foreground">
                      <span>vis score: <strong className="text-foreground">{d.visibilityScore}</strong></span>
                      <span>keywords: <strong className="text-foreground">{d.keywordCount}</strong></span>
                      <span>avg pos: <strong className="text-foreground">{d.avgPosition ?? "—"}</strong></span>
                      <span>top 3: <strong className="text-foreground">{d.top3Count}</strong></span>
                      <span>top 10: <strong className="text-foreground">{d.top10Count}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Per-keyword breakdown ({result.keywords.length})
              </h3>
              <div className="overflow-auto max-h-[400px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr>
                      <th className="text-left p-1.5 border-b">keyword</th>
                      <th className="text-right p-1.5 border-b">volume</th>
                      <th className="text-left p-1.5 border-b">leader</th>
                      {result.domains.map((d) => (
                        <th key={d.domain} className="text-right p-1.5 border-b font-mono">{d.domain}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.keywords.map((k, i) => (
                      <tr key={i}>
                        <td className="p-1.5 border-b font-mono">{k.keyword}</td>
                        <td className="p-1.5 border-b text-right">{k.searchVolume.toLocaleString()}</td>
                        <td className="p-1.5 border-b">
                          {k.leader ? <Badge variant="outline" className="text-[10px]">{k.leader}</Badge> : "—"}
                        </td>
                        {result.domains.map((d) => {
                          const pos = k.positions[d.domain] ?? 0;
                          return (
                            <td key={d.domain} className="p-1.5 border-b text-right font-mono">
                              {pos > 0 ? pos : <span className="text-muted-foreground">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return csv; }} label="Copy CSV" />
                <DownloadButton getText={() => { handleSaveHistory(); return csv; }} filename="share-of-voice.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Position weight curve:</strong>{" "}
                pos 1 = {positionWeight(1).toFixed(2)}, pos 3 = {positionWeight(3).toFixed(2)},
                pos 10 = {positionWeight(10).toFixed(2)}, pos 20 = {positionWeight(20).toFixed(2)},
                pos 51+ = {positionWeight(51).toFixed(2)}.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste keyword rankings to compute SOV"
          hint="CSV with header `keyword,volume,domain1,domain2,…`. Click 'Load sample' to see SOV, visibility, and competitor comparison."
          icon={<PieChart className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.totalKeywords} kw</Badge>
                  <Badge variant="outline" className="mr-2">vol {h.totalVolume.toLocaleString()}</Badge>
                  <Badge variant="outline" className="mr-2">{h.topDomain} @ {h.topSov}%</Badge>
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All SOV computation runs locally. History is stored in localStorage on this device only.
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
