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
  THRESHOLDS,
  analyze,
  renderReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
  type Rating,
} from "./logic";
import { History, Gauge, CheckCircle2, AlertTriangle, XCircle, MinusCircle } from "lucide-react";

const SAMPLE = JSON.stringify({
  lighthouseResult: {
    finalUrl: "https://example.com",
    fetchTime: "2025-01-15T12:34:56.789Z",
    configSettings: { formFactor: "mobile" },
    audits: {
      "largest-contentful-paint": { numericValue: 2800, displayValue: "2.8 s" },
      "interaction-to-next-paint": { numericValue: 220, displayValue: "220 ms" },
      "cumulative-layout-shift": { numericValue: 0.15, displayValue: "0.15" },
      "first-contentful-paint": { numericValue: 1600, displayValue: "1.6 s" },
      "server-response-time": { numericValue: 950, displayValue: "950 ms" },
      "total-blocking-time": { numericValue: 350, displayValue: "350 ms" },
      "speed-index": { numericValue: 4000, displayValue: "4.0 s" },
    },
  },
}, null, 2);

const RATING_COLORS: Record<Rating, string> = {
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "needs-improvement": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  poor: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  missing: "bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/30",
};

const RATING_ICONS: Record<Rating, typeof CheckCircle2> = {
  good: CheckCircle2,
  "needs-improvement": AlertTriangle,
  poor: XCircle,
  missing: MinusCircle,
};

export default function CoreWebVitalsAnalyzer() {
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

  const { result, errors } = useMemo(() => analyze(input), [input]);
  const report = useMemo(() => result ? renderReport(result) : "", [result]);
  const csv = useMemo(() => result ? renderCsv(result) : "", [result]);

  const handleSaveHistory = useCallback(() => {
    if (result) {
      saveHistory({
        ts: Date.now(),
        url: result.url,
        score: result.score,
        rating: result.rating,
        passCount: result.passCount,
        warnCount: result.warnCount,
        failCount: result.failCount,
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
            <Label htmlFor="cwv-input">PageSpeed Insights JSON response</Label>
            <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); toast.info("Sample loaded"); }}>
              Load sample
            </Button>
          </div>
          <Textarea
            id="cwv-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'Paste the full PageSpeed Insights JSON response here.\n\nGet it from pagespeed.web.dev → DevTools → Network → runPagespeed API call → Response.'}
            className="min-h-[150px] resize-y font-mono text-xs"
          />
          {errors.length > 0 && input.trim() && (
            <ErrorBanner message={`${errors.length} error(s): ${errors.join("; ")}`} />
          )}
        </CardContent>
      </Card>

      {result ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Gauge className="h-4 w-4" /> Overall score
                </h3>
                <Badge className={`text-base font-bold ${RATING_COLORS[result.rating]}`}>
                  {result.score}/100 · {result.rating.replace("-", " ")}
                </Badge>
              </div>
              {result.url && (
                <div className="text-xs">
                  <span className="text-muted-foreground">URL: </span>
                  <code className="font-mono text-foreground break-all">{result.url}</code>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Pass" value={result.passCount} highlight="good" />
                <Stat label="Warn" value={result.warnCount} highlight={result.warnCount > 0 ? "bad" : undefined} />
                <Stat label="Fail" value={result.failCount} highlight={result.failCount > 0 ? "bad" : undefined} />
                <Stat label="Missing" value={result.missingCount} />
              </div>
              {(result.fetchedAt || result.strategy) && (
                <div className="text-xs text-muted-foreground">
                  {result.fetchedAt && <div>Fetched: {new Date(result.fetchedAt).toLocaleString()}</div>}
                  {result.strategy && <div>Strategy: {result.strategy}</div>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Metrics</h3>
              <div className="space-y-2">
                {result.metrics.map((m) => {
                  const Icon = RATING_ICONS[m.rating];
                  return (
                    <div key={m.name} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${RATING_COLORS[m.rating]}`}>
                          <Icon className="h-3 w-3 mr-0.5" />
                          {m.rating.replace("-", " ")}
                        </Badge>
                        <code className="font-mono font-medium text-foreground">{m.name}</code>
                        <span className="text-foreground font-semibold">{m.displayValue}</span>
                        <span className="text-muted-foreground flex-1">{m.label}</span>
                      </div>
                      <div className="text-muted-foreground text-[11px]">
                        {m.description}
                      </div>
                      <div className="text-muted-foreground text-[11px]">
                        Threshold: good ≤ {m.threshold.good}{m.unit}, poor &gt; {m.threshold.poor}{m.unit}
                      </div>
                      {m.rating !== "good" && m.rating !== "missing" && (
                        <div className="text-amber-700 dark:text-amber-400 text-[11px] italic">{m.recommendation}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {result.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Prioritized recommendations ({result.recommendations.length})
                </h3>
                <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
                  {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return report; }} label="Copy report" />
            <DownloadButton getText={() => { handleSaveHistory(); return csv; }} filename="core-web-vitals.csv" mime="text/csv" label="Download CSV" />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste PageSpeed Insights JSON to analyze"
          hint="Get the JSON from pagespeed.web.dev → DevTools → Network → runPagespeed API call. Click 'Load sample' to see how the analysis works."
          icon={<Gauge className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Threshold reference (Google Core Web Vitals)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {Object.entries(THRESHOLDS).map(([key, t]) => (
              <div key={key} className="rounded border bg-background px-2 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <code className="font-mono font-medium text-foreground">{key}</code>
                  <span className="text-muted-foreground">{t.label}</span>
                </div>
                <div className="text-muted-foreground mt-0.5">
                  Good: ≤{t.good}{t.unit} · Poor: &gt;{t.poor}{t.unit}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
                  <Badge variant="outline" className={`mr-2 ${RATING_COLORS[h.rating as Rating]}`}>{h.score}/100</Badge>
                  <Badge variant="outline" className="mr-2 text-emerald-700 dark:text-emerald-400">{h.passCount} pass</Badge>
                  <Badge variant="outline" className="mr-2 text-amber-700 dark:text-amber-400">{h.warnCount} warn</Badge>
                  <Badge variant="outline" className="mr-2 text-red-700 dark:text-red-400">{h.failCount} fail</Badge>
                  {h.url && <code className="font-mono text-[11px]">{h.url}</code>}
                  <div className="text-muted-foreground/70 mt-1">{new Date(h.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> This tool does NOT call the PageSpeed API. You paste the JSON response yourself. All parsing runs locally. History is stored in localStorage on this device only.
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
  const color = highlight === "good"
    ? "text-emerald-600 dark:text-emerald-400"
    : highlight === "bad"
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
