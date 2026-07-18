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
  compare,
  renderCsv,
  renderReport,
  MAX_COMPETITORS,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";
import { History, Swords, Trophy, Target, Layers } from "lucide-react";

const SAMPLE = `keyword,you,competitor-a.com,competitor-b.com
best seo tools,5,1,3
seo software,2,8,4
keyword research tool,1,5,10
seo audit tool,8,3,2
backlink checker,15,2,3
content marketing guide,3,3,1`;

export default function CompetitorRankComparison() {
  const [input, setInput] = useState("");
  const [yourDomain, setYourDomain] = useState("you");
  const [competitorInput, setCompetitorInput] = useState("competitor-a.com, competitor-b.com");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) setInput(p.data);
      if (p.you) setYourDomain(p.you);
      if (p.comp.length > 0) setCompetitorInput(p.comp.join(", "));
      if (p.data || p.you) toast.info("Loaded from share link");
    }
  }, []);

  const competitors = useMemo(
    () => competitorInput.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).slice(0, MAX_COMPETITORS),
    [competitorInput],
  );
  const parsed = useMemo(() => parseInput(input, yourDomain, competitors), [input, yourDomain, competitors]);
  const result = useMemo(() => compare(parsed.rows, parsed.domains, yourDomain, competitors), [parsed, yourDomain, competitors]);
  const csv = useMemo(() => renderCsv(result), [result]);
  const report = useMemo(() => renderReport(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.totalKeywords > 0) {
      const youStats = result.stats.find((s) => s.isYou);
      saveHistory({
        ts: Date.now(),
        totalKeywords: result.totalKeywords,
        opportunities: result.opportunities.length,
        yourWins: youStats?.winsCount ?? 0,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="crc-you" className="text-xs">Your domain</Label>
              <Input id="crc-you" value={yourDomain} onChange={(e) => setYourDomain(e.target.value)} className="h-8 text-xs" placeholder="yourdomain.com" />
            </div>
            <div>
              <Label htmlFor="crc-comp" className="text-xs">Competitor domains (comma-separated, max {MAX_COMPETITORS})</Label>
              <Input id="crc-comp" value={competitorInput} onChange={(e) => setCompetitorInput(e.target.value)} className="h-8 text-xs" placeholder="comp1.com, comp2.com" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="crc-input">Keyword positions (CSV: keyword,your_pos,comp1_pos,comp2_pos,…)</Label>
            <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); toast.info("Sample loaded"); }}>
              Load sample
            </Button>
          </div>
          <Textarea
            id="crc-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"keyword,you,competitor-a.com\nbest seo tools,5,1\nseo software,2,8"}
            className="min-h-[150px] resize-y font-mono text-xs"
          />
          {parsed.errors.length > 0 && (
            <ErrorBanner message={`${parsed.errors.length} parse error(s): ${parsed.errors.slice(0, 3).join("; ")}`} />
          )}
        </CardContent>
      </Card>

      {result.totalKeywords > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4" /> Leaderboard
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total keywords" value={result.totalKeywords} />
                <Stat label="Opportunities" value={result.opportunities.length} highlight={result.opportunities.length > 0 ? "bad" : "good"} />
                <Stat label="Overlap (all rank)" value={result.overlap} />
                <Stat
                  label="Your wins"
                  value={result.stats.find((s) => s.isYou)?.winsCount ?? 0}
                  highlight="good"
                />
              </div>
              <div className="space-y-1 pt-2">
                {result.leaderboard.map((s, i) => (
                  <div key={s.domain} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <div className="w-5 text-muted-foreground">{i + 1}.</div>
                    <div className="flex-1 font-mono font-medium text-foreground">{s.domain}{s.isYou && <span className="text-muted-foreground ml-1">(you)</span>}</div>
                    <Badge variant="outline">{s.winsCount} wins</Badge>
                    <Badge variant="outline">avg {s.avgPosition ?? "—"}</Badge>
                    <Badge variant="outline">top10 {s.top10Count}</Badge>
                    <Badge variant="outline">{s.keywordCount} kw</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Swords className="h-4 w-4" /> Side-by-side rankings ({result.rows.length})
              </h3>
              <div className="overflow-auto max-h-[400px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-background">
                    <tr>
                      <th className="text-left p-1.5 border-b">keyword</th>
                      {result.domains.map((d) => (
                        <th key={d} className="text-right p-1.5 border-b font-mono">
                          {d}{d === yourDomain ? " (you)" : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => {
                      // Find winner
                      let winner: string | null = null;
                      let winnerPos = Infinity;
                      for (const d of result.domains) {
                        const p = row.positions[d];
                        if (p && p > 0 && p < winnerPos) { winnerPos = p; winner = d; }
                      }
                      return (
                        <tr key={i}>
                          <td className="p-1.5 border-b font-mono">{row.keyword}</td>
                          {result.domains.map((d) => {
                            const pos = row.positions[d] ?? 0;
                            return (
                              <td key={d} className="p-1.5 border-b text-right font-mono">
                                {pos > 0 ? (
                                  <span className={d === winner ? "font-bold text-emerald-600 dark:text-emerald-400" : ""}>{pos}</span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {result.opportunities.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-amber-500" /> Opportunities ({result.opportunities.length})
                </h3>
                <p className="text-xs text-muted-foreground">Keywords where you rank worse than a competitor — sorted by gap.</p>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {result.opportunities.slice(0, 50).map((o, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex-1 font-mono text-foreground truncate">{o.keyword}</div>
                      <Badge variant="outline">you {o.yourPosition || "—"}</Badge>
                      <Badge variant="outline">{o.competitor} {o.competitorPosition}</Badge>
                      <Badge variant="destructive">gap {o.gap}</Badge>
                    </div>
                  ))}
                  {result.opportunities.length > 50 && (
                    <p className="text-xs text-muted-foreground italic">+ {result.opportunities.length - 50} more — see CSV export.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4" /> Domain stats
              </h3>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left p-1.5 border-b">domain</th>
                      <th className="text-right p-1.5 border-b">keywords</th>
                      <th className="text-right p-1.5 border-b">avg pos</th>
                      <th className="text-right p-1.5 border-b">top 3</th>
                      <th className="text-right p-1.5 border-b">top 10</th>
                      <th className="text-right p-1.5 border-b">wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.stats.map((s) => (
                      <tr key={s.domain}>
                        <td className="p-1.5 border-b font-mono">{s.domain}{s.isYou ? " (you)" : ""}</td>
                        <td className="p-1.5 border-b text-right">{s.keywordCount}</td>
                        <td className="p-1.5 border-b text-right">{s.avgPosition ?? "—"}</td>
                        <td className="p-1.5 border-b text-right">{s.top3Count}</td>
                        <td className="p-1.5 border-b text-right">{s.top10Count}</td>
                        <td className="p-1.5 border-b text-right">{s.winsCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return csv; }} label="Copy CSV" />
                <DownloadButton getText={() => { handleSaveHistory(); return csv; }} filename="competitor-rank-comparison.csv" mime="text/csv" label="Download CSV" />
                <CopyButton getText={() => report} label="Copy report" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input, yourDomain, competitors); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter keyword positions to compare"
          hint="Set your domain + competitor domains, then paste CSV rows. Click 'Load sample' to see the leaderboard, opportunities, and side-by-side table."
          icon={<Swords className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.opportunities} opps</Badge>
                  <Badge variant="outline" className="mr-2">{h.yourWins} wins</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All comparison runs locally. History is stored in localStorage on this device only.
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
