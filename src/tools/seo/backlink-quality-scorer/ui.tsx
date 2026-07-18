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
  scoreAll,
  renderCsv,
  TOXIC_DA_THRESHOLD,
  TOXIC_SPAM_THRESHOLD,
  SUSPICIOUS_DA_THRESHOLD,
  SUSPICIOUS_SPAM_THRESHOLD,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";
import { History, ShieldAlert, Skull, AlertTriangle, CheckCircle2 } from "lucide-react";

const SAMPLE = `url,anchor,source_domain,da,spam_score,link_type
https://example.com/p1,example,forbes.com,95,0,dofollow
https://example.com/p2,best seo tools,moz.com,88,2,dofollow
https://example.com/p3,click here,medium.com,85,5,nofollow
https://example.com/p4,buy now,spammy-blog.xyz,8,75,dofollow
https://example.com/p5,read more,low-quality.com,15,40,nofollow
https://example.com/p6,example,youtube.com,92,0,nofollow
https://example.com/p7,cheap deals,pbn-network.xyz,5,85,dofollow
https://example.com/p8,seo guide,quality-blog.com,55,15,dofollow`;

const CATEGORY_COLORS: Record<string, string> = {
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  suspicious: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  toxic: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

export default function BacklinkQualityScorer() {
  const [input, setInput] = useState("");
  const [targetDomain, setTargetDomain] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) setInput(p.data);
      if (p.target) setTargetDomain(p.target);
      if (p.data || p.target) toast.info("Loaded from share link");
    }
  }, []);

  const parsed = useMemo(() => parseAuto(input, targetDomain), [input, targetDomain]);
  const result = useMemo(() => scoreAll(parsed.backlinks, targetDomain), [parsed, targetDomain]);
  const csv = useMemo(() => renderCsv(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.total > 0) {
      saveHistory({
        ts: Date.now(),
        total: result.total,
        toxic: result.byCategory.toxic,
        suspicious: result.byCategory.suspicious,
        good: result.byCategory.good,
        averageScore: result.averageScore,
      });
      setHistory(loadHistory());
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setInput("");
    setTargetDomain("");
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
            <Label htmlFor="bqs-input">Backlink data (CSV or JSON)</Label>
            <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); toast.info("Sample loaded"); }}>
              Load sample
            </Button>
          </div>
          <Textarea
            id="bqs-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"CSV: url,anchor,source_domain,da,spam_score,link_type\nor JSON array"}
            className="min-h-[150px] resize-y font-mono text-xs"
          />
          <div>
            <Label htmlFor="bqs-target" className="text-xs">Target domain (optional — improves anchor classification)</Label>
            <Input id="bqs-target" value={targetDomain} onChange={(e) => setTargetDomain(e.target.value)} className="h-8 text-xs" placeholder="yourdomain.com" />
          </div>
          {parsed.errors.length > 0 && (
            <ErrorBanner message={`${parsed.errors.length} parse error(s): ${parsed.errors.slice(0, 3).join("; ")}`} />
          )}
        </CardContent>
      </Card>

      {result.total > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" /> Summary ({result.total} backlinks)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Average score" value={result.averageScore} highlight={result.averageScore >= 60 ? "good" : result.averageScore < 30 ? "bad" : undefined} />
                <Stat label="Good" value={result.byCategory.good} highlight="good" />
                <Stat label="Suspicious" value={result.byCategory.suspicious} highlight={result.byCategory.suspicious > 0 ? "bad" : undefined} />
                <Stat label="Toxic" value={result.byCategory.toxic} highlight={result.byCategory.toxic > 0 ? "bad" : "good"} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2">
                <Stat label="DA low (<30)" value={result.daDistribution.low} />
                <Stat label="DA med (30-59)" value={result.daDistribution.medium} />
                <Stat label="DA high (60+)" value={result.daDistribution.high} />
                <Stat label="Spam high (60+)" value={result.spamDistribution.high} highlight={result.spamDistribution.high > 0 ? "bad" : undefined} />
              </div>
              <div className="text-xs text-muted-foreground pt-2">
                <strong>Anchor types:</strong>{" "}
                branded {result.anchorTypeCounts.branded} ·
                exact {result.anchorTypeCounts.exact} ·
                partial {result.anchorTypeCounts.partial} ·
                generic {result.anchorTypeCounts.generic}
              </div>
            </CardContent>
          </Card>

          {result.topToxic.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Skull className="h-4 w-4 text-red-500" /> Top toxic links ({result.topToxic.length})
                </h3>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {result.topToxic.map((s, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-[10px]">score {s.qualityScore}</Badge>
                        <span className="font-mono text-foreground truncate flex-1">{s.url}</span>
                        <Badge variant="outline" className="text-[10px]">DA {s.da}</Badge>
                        <Badge variant="outline" className="text-[10px]">spam {s.spamScore}</Badge>
                      </div>
                      <div className="text-muted-foreground text-[11px]">
                        anchor: {s.anchor || "(empty)"} · from: {s.sourceDomain} · {s.reasons.join("; ")}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">All backlinks</h3>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {result.scored.map((s, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[s.category]}`}>
                        {s.category === "good" ? <CheckCircle2 className="h-3 w-3 mr-0.5" /> :
                          s.category === "suspicious" ? <AlertTriangle className="h-3 w-3 mr-0.5" /> :
                          <Skull className="h-3 w-3 mr-0.5" />}
                        {s.category}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">score {s.qualityScore}</Badge>
                      <span className="font-mono text-foreground truncate flex-1">{s.url}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-muted-foreground text-[11px]">
                      <span>DA <strong className="text-foreground">{s.da}</strong></span>
                      <span>spam <strong className="text-foreground">{s.spamScore}</strong></span>
                      <span>anchor: <strong className="text-foreground">{s.anchor || "(empty)"}</strong> ({s.anchorType})</span>
                      <span>type <strong className="text-foreground">{s.linkType}</strong></span>
                      <span className="italic">{s.recommendation}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return csv; }} label="Copy CSV" />
                <DownloadButton getText={() => { handleSaveHistory(); return csv; }} filename="backlink-quality-scores.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input, targetDomain); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Thresholds:</strong>{" "}
                Toxic: DA &lt; {TOXIC_DA_THRESHOLD} or spam ≥ {TOXIC_SPAM_THRESHOLD}.
                Suspicious: DA &lt; {SUSPICIOUS_DA_THRESHOLD}, spam ≥ {SUSPICIOUS_SPAM_THRESHOLD}, or exact-match anchor.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste backlink data to score"
          hint="CSV (url,anchor,source_domain,da,spam_score,link_type) or JSON array. Click 'Load sample' to see quality scores and toxicity flags."
          icon={<ShieldAlert className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.total} links</Badge>
                  <Badge variant="outline" className="mr-2">avg {h.averageScore}</Badge>
                  <Badge variant="outline" className="mr-2 text-emerald-700 dark:text-emerald-400">{h.good} good</Badge>
                  <Badge variant="outline" className="mr-2 text-amber-700 dark:text-amber-400">{h.suspicious} susp</Badge>
                  <Badge variant="outline" className="mr-2 text-red-700 dark:text-red-400">{h.toxic} toxic</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All scoring runs locally. History is stored in localStorage on this device only.
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
