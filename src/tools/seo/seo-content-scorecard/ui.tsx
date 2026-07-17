"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  DEFAULT_THRESHOLDS,
  audit,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Check,
  type HistoryEntry,
  type ScorecardThresholds,
} from "./logic";
import { History, ClipboardCheck, AlertTriangle, CheckCircle2, XCircle, Lightbulb } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  pass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  fail: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex flex-col items-center">
      <div className={`text-4xl font-bold ${color}`}>{score}</div>
      <div className="text-xs text-muted-foreground">/ 100</div>
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const Icon = check.status === "pass" ? CheckCircle2 : check.status === "warn" ? AlertTriangle : XCircle;
  return (
    <div className={`rounded border p-2 text-xs ${STATUS_STYLES[check.status]}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium">
          <Icon className="h-3.5 w-3.5" />
          {check.label}
        </div>
        <Badge variant="outline" className="text-xs">{check.category}</Badge>
      </div>
      <div className="mt-1 opacity-90">{check.message}</div>
      {check.recommendation && (
        <div className="mt-1 opacity-75">→ {check.recommendation}</div>
      )}
    </div>
  );
}

export default function SeoContentScorecard() {
  const [content, setContent] = useState("");
  const [keyword, setKeyword] = useState("");
  const [titleMin, setTitleMin] = useState(DEFAULT_THRESHOLDS.titleMin);
  const [titleMax, setTitleMax] = useState(DEFAULT_THRESHOLDS.titleMax);
  const [metaMin, setMetaMin] = useState(DEFAULT_THRESHOLDS.metaMin);
  const [metaMax, setMetaMax] = useState(DEFAULT_THRESHOLDS.metaMax);
  const [wordCountMin, setWordCountMin] = useState(DEFAULT_THRESHOLDS.wordCountMin);
  const [densityMax, setDensityMax] = useState(DEFAULT_THRESHOLDS.densityMax);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.content) {
        setContent(p.content);
        setKeyword(p.keyword);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const thresholds: ScorecardThresholds = useMemo(
    () => ({
      titleMin,
      titleMax,
      metaMin,
      metaMax,
      wordCountMin,
      densityMin: DEFAULT_THRESHOLDS.densityMin,
      densityMax,
      readabilityMin: DEFAULT_THRESHOLDS.readabilityMin,
    }),
    [titleMin, titleMax, metaMin, metaMax, wordCountMin, densityMax],
  );

  const result = useMemo(() => audit(content, keyword, thresholds), [content, keyword, thresholds]);
  const markdown = useMemo(() => renderMarkdown(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (content.trim()) {
      saveHistory({
        ts: Date.now(),
        score: result.score,
        passCount: result.passCount,
        warnCount: result.warnCount,
        failCount: result.failCount,
      });
      setHistory(loadHistory());
    }
  }, [content, result]);

  const handleClear = useCallback(() => {
    setContent("");
    setKeyword("");
    toast.info("Form cleared");
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
          <div className="space-y-1.5">
            <Label htmlFor="sc-content">Content (text or HTML)</Label>
            <Textarea
              id="sc-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"<!DOCTYPE html><html><head><title>...</title>...</head><body><h1>...</h1><p>...</p></body></html>\n\n(or paste plain text)"}
              className="min-h-[160px] resize-y font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sc-keyword">Target keyword</Label>
            <Input
              id="sc-keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="SEO tools"
            />
          </div>
          <details className="rounded border bg-background p-3">
            <summary className="cursor-pointer text-xs font-medium text-foreground">Custom thresholds</summary>
            <div className="grid gap-3 sm:grid-cols-3 mt-3">
              <div className="space-y-1">
                <Label htmlFor="sc-tmin" className="text-xs">Title min</Label>
                <Input id="sc-tmin" type="number" value={titleMin} onChange={(e) => setTitleMin(parseInt(e.target.value, 10) || 0)} className="text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sc-tmax" className="text-xs">Title max</Label>
                <Input id="sc-tmax" type="number" value={titleMax} onChange={(e) => setTitleMax(parseInt(e.target.value, 10) || 0)} className="text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sc-mmin" className="text-xs">Meta min</Label>
                <Input id="sc-mmin" type="number" value={metaMin} onChange={(e) => setMetaMin(parseInt(e.target.value, 10) || 0)} className="text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sc-mmax" className="text-xs">Meta max</Label>
                <Input id="sc-mmax" type="number" value={metaMax} onChange={(e) => setMetaMax(parseInt(e.target.value, 10) || 0)} className="text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sc-wmin" className="text-xs">Word count min</Label>
                <Input id="sc-wmin" type="number" value={wordCountMin} onChange={(e) => setWordCountMin(parseInt(e.target.value, 10) || 0)} className="text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sc-dmax" className="text-xs">Density max (%)</Label>
                <Input id="sc-dmax" type="number" step="0.1" value={densityMax} onChange={(e) => setDensityMax(parseFloat(e.target.value) || 0)} className="text-xs" />
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      {content.trim() ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-4">
                <ScoreRing score={result.score} />
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {result.passCount} pass
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-600" /> {result.warnCount} warn
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <XCircle className="h-3 w-3 text-red-600" /> {result.failCount} fail
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scored {result.earnedWeight.toFixed(0)} / {result.totalWeight} weighted points
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {result.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" /> Prioritized recommendations
                </h3>
                <div className="space-y-1">
                  {result.recommendations.map((c, i) => (
                    <CheckRow key={c.id + i} check={c} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ClipboardCheck className="h-4 w-4" /> All checks
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => {
                      handleSaveHistory();
                      return markdown;
                    }}
                    label="Copy MD"
                  />
                  <DownloadButton getText={() => markdown} filename="seo-scorecard.md" mime="text/markdown" label="MD" />
                  <ShareButton
                    getUrl={() => {
                      handleSaveHistory();
                      return buildShareUrl({ content, keyword });
                    }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <div className="space-y-1">
                {result.checks.map((c, i) => (
                  <CheckRow key={c.id + i} check={c} />
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste content to audit SEO"
          hint="We'll score 10+ categories — title, meta, headings, density, word count, readability, links, alt text, schema, viewport."
          icon={<ClipboardCheck className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">score {h.score}</Badge>
                  <Badge variant="outline" className="mr-2">{h.passCount} pass</Badge>
                  <Badge variant="outline" className="mr-2">{h.warnCount} warn</Badge>
                  <Badge variant="outline" className="mr-2">{h.failCount} fail</Badge>
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
            <strong className="text-foreground">Privacy:</strong> content auditing runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
