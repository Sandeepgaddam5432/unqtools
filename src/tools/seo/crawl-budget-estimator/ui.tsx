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
  SITE_PRESETS,
  validateInputs,
  normalizeInputs,
  computeEstimate,
  generateRecommendations,
  scoreColor,
  formatTime,
  formatNumber,
  buildComparison,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CrawlInputs,
  type Recommendation,
  type HistoryEntry,
  type SitePresetKey,
} from "./logic";
import { History, Gauge, Lightbulb, GitCompare } from "lucide-react";

export default function CrawlBudgetEstimator() {
  const [inputs, setInputs] = useState<Partial<CrawlInputs>>({
    totalPages: 1000,
    avgPageSizeKb: 850,
    avgServerResponseMs: 350,
    crawlErrorsPercent: 5,
    duplicateContentPercent: 15,
    facetUrlCount: 300,
  });
  const [optimized, setOptimized] = useState<Partial<CrawlInputs>>({
    totalPages: 1000,
    avgPageSizeKb: 500,
    avgServerResponseMs: 150,
    crawlErrorsPercent: 1,
    duplicateContentPercent: 5,
    facetUrlCount: 50,
  });
  const [showComparison, setShowComparison] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setInputs((prev) => ({ ...prev, ...p }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const errors = useMemo(() => validateInputs(inputs), [inputs]);
  const hasErrors = Object.keys(errors).length > 0;

  const normInputs = useMemo(() => normalizeInputs(inputs), [inputs]);
  const estimate = useMemo(() => computeEstimate(normInputs), [normInputs]);
  const recommendations = useMemo(
    () => generateRecommendations(normInputs, estimate),
    [normInputs, estimate],
  );

  const normOpt = useMemo(() => normalizeInputs(optimized), [optimized]);
  const comparison = useMemo(
    () => buildComparison(normInputs, normOpt),
    [normInputs, normOpt],
  );

  const textReport = useMemo(
    () => renderTextReport(normInputs, estimate, recommendations),
    [normInputs, estimate, recommendations],
  );
  const csvReport = useMemo(
    () => renderCsv(normInputs, estimate, recommendations),
    [normInputs, estimate, recommendations],
  );

  const sc = scoreColor(estimate.score);
  const scoreBadgeClass =
    sc.color === "emerald" ? "text-emerald-600 dark:text-emerald-400"
    : sc.color === "lime" ? "text-lime-600 dark:text-lime-400"
    : sc.color === "amber" ? "text-amber-600 dark:text-amber-400"
    : sc.color === "orange" ? "text-orange-600 dark:text-orange-400"
    : "text-red-600 dark:text-red-400";
  const scoreBarClass =
    sc.color === "emerald" ? "bg-emerald-500"
    : sc.color === "lime" ? "bg-lime-500"
    : sc.color === "amber" ? "bg-amber-500"
    : sc.color === "orange" ? "bg-orange-500"
    : "bg-red-500";

  const handleSaveHistory = useCallback(() => {
    if (!hasErrors) {
      saveHistory({
        ts: Date.now(),
        inputs: normInputs,
        estimate,
        recommendationCount: recommendations.length,
      });
      setHistory(loadHistory());
    }
  }, [normInputs, estimate, recommendations, hasErrors]);

  const handlePreset = (key: SitePresetKey) => {
    const preset = SITE_PRESETS.find((p) => p.key === key);
    if (preset) {
      setInputs(preset.inputs);
      toast.info(`Loaded ${preset.label} preset`);
    }
  };

  const handleClear = useCallback(() => {
    setInputs({
      totalPages: 0,
      avgPageSizeKb: 0,
      avgServerResponseMs: 0,
      crawlErrorsPercent: 0,
      duplicateContentPercent: 0,
      facetUrlCount: 0,
    });
    toast.info("Cleared inputs");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const updateField = (field: keyof CrawlInputs, value: string) => {
    const num = value === "" ? undefined : Number(value);
    setInputs((prev) => ({ ...prev, [field]: num }));
  };
  const updateOpt = (field: keyof CrawlInputs, value: string) => {
    const num = value === "" ? undefined : Number(value);
    setOptimized((prev) => ({ ...prev, [field]: num }));
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-sm font-semibold">Site metrics</Label>
            <div className="flex flex-wrap gap-1">
              {SITE_PRESETS.map((p) => (
                <Button
                  key={p.key}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handlePreset(p.key)}
                >+ {p.label}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <NumberField label="Total pages" value={inputs.totalPages} onChange={(v) => updateField("totalPages", v)} error={errors.totalPages} />
            <NumberField label="Avg page size (KB)" value={inputs.avgPageSizeKb} onChange={(v) => updateField("avgPageSizeKb", v)} error={errors.avgPageSizeKb} />
            <NumberField label="Avg server response (ms)" value={inputs.avgServerResponseMs} onChange={(v) => updateField("avgServerResponseMs", v)} error={errors.avgServerResponseMs} />
            <NumberField label="Crawl errors %" value={inputs.crawlErrorsPercent} onChange={(v) => updateField("crawlErrorsPercent", v)} error={errors.crawlErrorsPercent} />
            <NumberField label="Duplicate content %" value={inputs.duplicateContentPercent} onChange={(v) => updateField("duplicateContentPercent", v)} error={errors.duplicateContentPercent} />
            <NumberField label="Faceted-nav URL count" value={inputs.facetUrlCount} onChange={(v) => updateField("facetUrlCount", v)} error={errors.facetUrlCount} />
            <NumberField label="Daily crawl reqs (opt.)" value={inputs.dailyCrawlRequests} onChange={(v) => updateField("dailyCrawlRequests", v)} error={errors.dailyCrawlRequests} />
          </div>
        </CardContent>
      </Card>

      {!hasErrors && normInputs.totalPages > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Gauge className="h-4 w-4" /> Estimates
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Effective budget" value={formatNumber(estimate.effectiveBudget)} hint={`${(estimate.facetPenalty * 100).toFixed(1)}% facet penalty`} />
                <Stat label="Crawl rate" value={`${estimate.crawlRatePerPageMin.toFixed(2)}`} hint="pages / min" />
                <Stat label="Efficiency" value={`${estimate.efficiencyPercent.toFixed(1)}%`} hint={`dup ${(estimate.duplicatePenalty * 100).toFixed(0)}%`} />
                <Stat label="Time to full crawl" value={formatTime(estimate.timeToFullCrawlMin)} hint={`~${formatNumber(estimate.estimatedDailyCrawlRequests)} reqs/day`} />
              </div>
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Crawl score</span>
                  <Badge variant="outline" className={`text-[10px] ${scoreBadgeClass}`}>
                    {sc.label}
                  </Badge>
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${scoreBarClass} transition-all`}
                    style={{ width: `${Math.max(2, Math.min(100, estimate.score))}%` }}
                  />
                </div>
                <div className="text-xs text-right text-muted-foreground">
                  {estimate.score} / 100
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Lightbulb className="h-4 w-4" /> Recommendations ({recommendations.length})
              </h3>
              <div className="space-y-1.5">
                {recommendations.map((r, i) => (
                  <RecRow key={i} rec={r} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <GitCompare className="h-4 w-4" /> Comparison
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setShowComparison((s) => !s)}
                >
                  {showComparison ? "Hide optimized inputs" : "Edit optimized inputs"}
                </Button>
              </div>
              {showComparison && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded border bg-muted/30 p-2">
                  <NumberField label="Opt. pages" value={optimized.totalPages} onChange={(v) => updateOpt("totalPages", v)} />
                  <NumberField label="Opt. size (KB)" value={optimized.avgPageSizeKb} onChange={(v) => updateOpt("avgPageSizeKb", v)} />
                  <NumberField label="Opt. TTFB (ms)" value={optimized.avgServerResponseMs} onChange={(v) => updateOpt("avgServerResponseMs", v)} />
                  <NumberField label="Opt. errors %" value={optimized.crawlErrorsPercent} onChange={(v) => updateOpt("crawlErrorsPercent", v)} />
                  <NumberField label="Opt. dup %" value={optimized.duplicateContentPercent} onChange={(v) => updateOpt("duplicateContentPercent", v)} />
                  <NumberField label="Opt. facets" value={optimized.facetUrlCount} onChange={(v) => updateOpt("facetUrlCount", v)} />
                </div>
              )}
              <div className="space-y-1">
                {comparison.map((row, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 text-xs rounded border bg-background px-3 py-1.5">
                    <div className="text-muted-foreground truncate">{row.metric}</div>
                    <div className="font-mono text-foreground">{row.current}</div>
                    <div className="font-mono text-foreground">
                      {row.optimized}
                      <span className={`ml-2 text-[10px] ${row.delta.startsWith("+") ? "text-emerald-600 dark:text-emerald-400" : row.delta === "—" ? "text-muted-foreground" : "text-red-600 dark:text-red-400"}`}>
                        {row.delta}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Export</h3>
              <Textarea
                readOnly
                value={textReport}
                className="min-h-[200px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  filename="crawl-budget-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csvReport}
                  filename="crawl-budget-report.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(normInputs); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title={hasErrors ? "Fix input errors to see estimates" : "Enter site metrics to estimate crawl budget"}
          hint="Total pages, avg page size, server response time, and SEO quality metrics. Click a preset for quick start."
          icon={<Gauge className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{formatNumber(h.inputs.totalPages)} pages</Badge>
                  <Badge variant="outline" className="mr-2">{h.estimate.score}/100</Badge>
                  <Badge variant="outline" className="mr-2">{h.recommendationCount} recs</Badge>
                  <span className="text-muted-foreground ml-2">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All calculations run locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 text-xs ${error ? "border-red-500" : ""}`}
      />
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function RecRow({ rec }: { rec: Recommendation }) {
  const sevColor =
    rec.severity === "critical"
      ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
      : rec.severity === "warning"
        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
        : "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300";
  return (
    <div className={`rounded border px-3 py-1.5 text-xs ${sevColor}`}>
      <span className="font-mono mr-2 uppercase text-[10px]">{rec.severity}</span>
      <span>{rec.message}</span>
    </div>
  );
}
