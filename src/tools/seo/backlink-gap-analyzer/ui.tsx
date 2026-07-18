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
  parseAuto,
  analyze,
  renderCsv,
  MAX_COMPETITORS,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Backlink,
  type HistoryEntry,
} from "./logic";
import { History, SplitSquareHorizontal, Trophy, Target } from "lucide-react";

const SAMPLE_YOU = `url,anchor,source_domain,da,link_type
https://yoursite.com/p1,best seo tools,ahrefs.com,90,dofollow
https://yoursite.com/p2,seo guide,moz.com,85,dofollow`;

const SAMPLE_C1 = `url,anchor,source_domain,da,link_type
https://yoursite.com/p1,best seo tools,ahrefs.com,90,dofollow
https://yoursite.com/p3,seo tools,semrush.com,88,dofollow
https://yoursite.com/p4,click here,neilpatel.com,82,dofollow`;

const SAMPLE_C2 = `url,anchor,source_domain,da,link_type
https://yoursite.com/p3,seo tools,semrush.com,88,dofollow
https://yoursite.com/p5,read more,backlinko.com,87,dofollow
https://yoursite.com/p6,best tools,searchengineland.com,80,dofollow`;

export default function BacklinkGapAnalyzer() {
  const [youText, setYouText] = useState("");
  const [comps, setComps] = useState<{ name: string; data: string }[]>(
    Array.from({ length: MAX_COMPETITORS }, () => ({ name: "", data: "" })),
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.you) setYouText(p.you);
      if (p.competitors.length > 0) {
        setComps((prev) => {
          const next = [...prev];
          p.competitors.forEach((c, i) => {
            if (i < MAX_COMPETITORS) next[i] = c;
          });
          return next;
        });
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const youParsed = useMemo(() => parseAuto(youText), [youText]);
  const compParsed = useMemo(
    () => comps.map((c) => ({ name: c.name || `competitor-${comps.indexOf(c) + 1}`, parsed: parseAuto(c.data) })),
    [comps],
  );
  const competitorBacklinks = useMemo(
    () => compParsed
      .filter((c) => c.parsed.backlinks.length > 0)
      .map((c) => ({ name: c.name, backlinks: c.parsed.backlinks })),
    [compParsed],
  );
  const result = useMemo(
    () => analyze(youParsed.backlinks, competitorBacklinks),
    [youParsed, competitorBacklinks],
  );
  const csv = useMemo(() => renderCsv(result), [result]);

  const updateComp = (i: number, field: "name" | "data", value: string) => {
    setComps((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const handleSaveHistory = useCallback(() => {
    if (result.totalOpportunities > 0 || youParsed.backlinks.length > 0) {
      const topScore = result.opportunities[0]?.opportunityScore ?? 0;
      saveHistory({
        ts: Date.now(),
        opportunities: result.totalOpportunities,
        shared: result.totalShared,
        topScore,
      });
      setHistory(loadHistory());
    }
  }, [result, youParsed]);

  const handleClear = useCallback(() => {
    setYouText("");
    setComps(Array.from({ length: MAX_COMPETITORS }, () => ({ name: "", data: "" })));
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadSample = useCallback(() => {
    setYouText(SAMPLE_YOU);
    setComps([
      { name: "competitor-1.com", data: SAMPLE_C1 },
      { name: "competitor-2.com", data: SAMPLE_C2 },
      { name: "", data: "" },
    ]);
    toast.info("Sample loaded");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="bga-you" className="text-sm font-semibold">Your backlinks (CSV or JSON)</Label>
            <Button variant="ghost" size="sm" onClick={loadSample}>Load sample</Button>
          </div>
          <Textarea
            id="bga-you"
            value={youText}
            onChange={(e) => setYouText(e.target.value)}
            placeholder={"url,anchor,source_domain,da,link_type\n..."}
            className="min-h-[100px] resize-y font-mono text-xs"
          />
          <Label className="text-sm font-semibold">Competitor backlinks (up to {MAX_COMPETITORS})</Label>
          <div className="space-y-2">
            {comps.map((c, i) => (
              <div key={i} className="space-y-1.5">
                <Input
                  placeholder={`Competitor ${i + 1} name`}
                  value={c.name}
                  onChange={(e) => updateComp(i, "name", e.target.value)}
                  className="h-8 text-xs"
                />
                <Textarea
                  placeholder={`Competitor ${i + 1} backlinks (CSV or JSON)`}
                  value={c.data}
                  onChange={(e) => updateComp(i, "data", e.target.value)}
                  className="min-h-[80px] resize-y font-mono text-xs"
                />
              </div>
            ))}
          </div>
          {youParsed.errors.length > 0 && (
            <ErrorBanner message={`Your backlinks: ${youParsed.errors.length} parse error(s)`} />
          )}
        </CardContent>
      </Card>

      {(result.totalOpportunities > 0 || result.totalShared > 0) ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <SplitSquareHorizontal className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Opportunities" value={result.totalOpportunities} highlight="good" />
                <Stat label="Shared backlinks" value={result.totalShared} />
                <Stat
                  label="Top opportunity score"
                  value={result.opportunities[0]?.opportunityScore ?? 0}
                  highlight="good"
                />
                <Stat label="Your backlinks" value={youParsed.backlinks.length} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Trophy className="h-4 w-4" /> Domain stats
              </h3>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left p-1.5 border-b">domain</th>
                      <th className="text-right p-1.5 border-b">total</th>
                      <th className="text-right p-1.5 border-b">unique</th>
                      <th className="text-right p-1.5 border-b">avg DA</th>
                      <th className="text-right p-1.5 border-b">gap count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.stats.map((s) => (
                      <tr key={s.domain}>
                        <td className="p-1.5 border-b font-mono">{s.domain}{s.isYou ? " (you)" : ""}</td>
                        <td className="p-1.5 border-b text-right">{s.totalBacklinks}</td>
                        <td className="p-1.5 border-b text-right">{s.uniqueDomains}</td>
                        <td className="p-1.5 border-b text-right">{s.averageDa}</td>
                        <td className="p-1.5 border-b text-right">{s.isYou ? "—" : (result.byCompetitor[s.domain] ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {result.opportunities.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-amber-500" /> Top opportunities ({result.opportunities.length})
                </h3>
                <p className="text-xs text-muted-foreground">Backlinks competitors have but you don't — sorted by opportunity score.</p>
                <div className="space-y-1 max-h-[500px] overflow-auto">
                  {result.opportunities.slice(0, 50).map((o, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="default" className="text-[10px]">score {o.opportunityScore}</Badge>
                        <Badge variant="secondary" className="text-[10px]">DA {o.da}</Badge>
                        <span className="font-mono text-foreground truncate flex-1">{o.url}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-muted-foreground text-[11px] pt-1">
                        <span>from: <strong className="text-foreground">{o.sourceDomain}</strong></span>
                        <span>linked by: <strong className="text-foreground">{o.linkingCompetitors.join(", ")}</strong></span>
                        <span>anchor: {o.anchor || "(empty)"}</span>
                      </div>
                    </div>
                  ))}
                  {result.opportunities.length > 50 && (
                    <p className="text-xs text-muted-foreground italic">+ {result.opportunities.length - 50} more — see CSV export.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {result.sharedBacklinks.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Shared backlinks ({result.sharedBacklinks.length})</h3>
                <p className="text-xs text-muted-foreground">Backlinks both you and at least one competitor have.</p>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {result.sharedBacklinks.slice(0, 20).map((b, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="secondary" className="text-[10px]">DA {b.da}</Badge>
                      <span className="font-mono text-foreground truncate flex-1">{b.url}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return csv; }} label="Copy CSV" />
            <DownloadButton getText={() => { handleSaveHistory(); return csv; }} filename="backlink-gap-analysis.csv" mime="text/csv" label="Download CSV" />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(youText, comps.filter((c) => c.data)); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste your + competitor backlinks"
          hint="CSV (url,anchor,source_domain,da,link_type) or JSON. Click 'Load sample' to see gap opportunities sorted by score."
          icon={<SplitSquareHorizontal className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.opportunities} opps</Badge>
                  <Badge variant="outline" className="mr-2">{h.shared} shared</Badge>
                  <Badge variant="outline" className="mr-2">top {h.topScore}</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All analysis runs locally. History is stored in localStorage on this device only.
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
