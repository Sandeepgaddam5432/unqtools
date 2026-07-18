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
  EXPERIMENT_TYPE_PRESETS,
  CONTROL_METRIC_PRESETS,
  SIGNIFICANCE_LABELS,
  RECOMMENDATION_LABELS,
  STATUS_LABELS,
  todayIso,
  parseBeforeAfterCsv,
  scoreAllPages,
  computeAggregate,
  checkSignificance,
  computeStatus,
  generateRecommendation,
  computeConfidence,
  runExperiment,
  filterPages,
  computeSummaryStats,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ExperimentType,
  type ControlMetric,
  type FilterMode,
  type ExperimentInput,
  type HistoryEntry,
} from "./logic";
import { FlaskConical, History, TrendingUp, TrendingDown, Minus } from "lucide-react";

const DEFAULT_INPUT: ExperimentInput = {
  name: "",
  type: "title-tag",
  hypothesis: EXPERIMENT_TYPE_PRESETS["title-tag"].hypothesis,
  startDate: "",
  endDate: "",
  pagesAffected: 0,
  controlMetric: "organic-traffic",
  beforeData: "",
  afterData: "",
};

export default function ExperimentTracker() {
  const [input, setInput] = useState<ExperimentInput>(DEFAULT_INPUT);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => runExperiment(input), [input]);
  const filteredPages = useMemo(
    () => filterPages(result.pages, filterMode),
    [result.pages, filterMode],
  );
  const stats = useMemo(() => computeSummaryStats(result), [result]);
  const text = useMemo(() => renderText(input, result), [input, result]);
  const csv = useMemo(() => renderCsv(result), [result]);

  const update = useCallback(
    <K extends keyof ExperimentInput>(key: K, value: ExperimentInput[K]) => {
      setInput((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleTypeChange = useCallback((t: ExperimentType) => {
    setInput((prev) => ({
      ...prev,
      type: t,
      hypothesis: EXPERIMENT_TYPE_PRESETS[t].hypothesis,
    }));
  }, []);

  const parsedBeforeCount = useMemo(
    () => parseBeforeAfterCsv(input.beforeData, input.afterData).length,
    [input.beforeData, input.afterData],
  );

  const handleSaveHistory = useCallback(() => {
    if (result.pages.length > 0) {
      saveHistory({
        ts: Date.now(),
        name: input.name || "(unnamed)",
        type: input.type,
        controlMetric: input.controlMetric,
        pages: result.pages.length,
        avgPctChange: result.aggregate.avgPctChange,
        significance: result.significance,
        recommendation: result.recommendation,
      });
      setHistory(loadHistory());
    }
  }, [result, input]);

  const handleClear = useCallback(() => {
    setInput(DEFAULT_INPUT);
    setFilterMode("all");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const sigColor =
    result.significance === "winning"
      ? "text-emerald-600 dark:text-emerald-400"
      : result.significance === "losing"
        ? "text-red-600 dark:text-red-400"
        : "text-amber-600 dark:text-amber-400";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="et-name" className="text-xs">Experiment name</Label>
              <Input
                id="et-name"
                value={input.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Title tag test — blog posts"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="et-type" className="text-xs">Experiment type</Label>
              <select
                id="et-type"
                value={input.type}
                onChange={(e) => handleTypeChange(e.target.value as ExperimentType)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {(Object.keys(EXPERIMENT_TYPE_PRESETS) as ExperimentType[]).map((t) => (
                  <option key={t} value={t}>{EXPERIMENT_TYPE_PRESETS[t].label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="et-metric" className="text-xs">Control metric</Label>
              <select
                id="et-metric"
                value={input.controlMetric}
                onChange={(e) => update("controlMetric", e.target.value as ControlMetric)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {(Object.keys(CONTROL_METRIC_PRESETS) as ControlMetric[]).map((m) => (
                  <option key={m} value={m}>{CONTROL_METRIC_PRESETS[m]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="et-pages" className="text-xs">Pages affected</Label>
              <Input
                id="et-pages"
                type="number"
                min={0}
                value={input.pagesAffected}
                onChange={(e) => update("pagesAffected", Math.max(0, Number(e.target.value) || 0))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="et-start" className="text-xs">Start date</Label>
              <Input
                id="et-start"
                type="date"
                value={input.startDate}
                onChange={(e) => update("startDate", e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="et-end" className="text-xs">End date</Label>
              <Input
                id="et-end"
                type="date"
                value={input.endDate}
                onChange={(e) => update("endDate", e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="et-hyp" className="text-xs">Hypothesis (what you expect to happen)</Label>
            <Textarea
              id="et-hyp"
              value={input.hypothesis}
              onChange={(e) => update("hypothesis", e.target.value)}
              placeholder="Describe what you expect to happen..."
              className="min-h-[60px] resize-y text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="et-before" className="text-xs">
                Before data (CSV: page,metric_value)
              </Label>
              <Textarea
                id="et-before"
                value={input.beforeData}
                onChange={(e) => update("beforeData", e.target.value)}
                placeholder={"/page1,1200\n/page2,800\n/page3,1500"}
                className="min-h-[120px] resize-y font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="et-after" className="text-xs">
                After data (CSV: page,metric_value)
              </Label>
              <Textarea
                id="et-after"
                value={input.afterData}
                onChange={(e) => update("afterData", e.target.value)}
                placeholder={"/page1,1400\n/page2,750\n/page3,1700"}
                className="min-h-[120px] resize-y font-mono text-xs"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {parsedBeforeCount} page(s) matched between before/after data.
            Today: {todayIso()}
          </p>
        </CardContent>
      </Card>

      {result.pages.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4" /> Experiment Results
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Total pages" value={stats.totalPages} />
                <Stat label="Avg % change" value={`${stats.avgPctChange}%`} highlight={stats.avgPctChange > 0 ? "good" : stats.avgPctChange < 0 ? "bad" : undefined} />
                <Stat label="Total delta" value={stats.totalDelta} highlight={stats.totalDelta > 0 ? "good" : stats.totalDelta < 0 ? "bad" : undefined} />
                <Stat label="Confidence" value={`${stats.confidence}/100`} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded border bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    <TrendingUp className="h-3 w-3" /> Winners
                  </div>
                  <div className="text-base font-semibold text-emerald-700 dark:text-emerald-400">{stats.winners}</div>
                </div>
                <div className="rounded border bg-red-50 dark:bg-red-950/30 px-3 py-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-red-700 dark:text-red-400">
                    <TrendingDown className="h-3 w-3" /> Losers
                  </div>
                  <div className="text-base font-semibold text-red-700 dark:text-red-400">{stats.losers}</div>
                </div>
                <div className="rounded border bg-muted px-3 py-2">
                  <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <Minus className="h-3 w-3" /> Neutral
                  </div>
                  <div className="text-base font-semibold text-foreground">{stats.neutral}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Status" value={STATUS_LABELS[stats.status]} />
                <Stat label="Significance" value={SIGNIFICANCE_LABELS[stats.significance]} highlight={stats.significance === "winning" ? "good" : stats.significance === "losing" ? "bad" : undefined} />
                <Stat label="Recommendation" value={RECOMMENDATION_LABELS[stats.recommendation]} />
                <Stat label="Type" value={EXPERIMENT_TYPE_PRESETS[input.type].label} />
              </div>
              <div className={`rounded border bg-background px-3 py-2 text-sm font-medium ${sigColor}`}>
                Verdict: {SIGNIFICANCE_LABELS[result.significance]} → {RECOMMENDATION_LABELS[result.recommendation]}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4" /> Per-page results ({filteredPages.length})
                </h3>
                <select
                  value={filterMode}
                  onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="all">All pages</option>
                  <option value="winners">Winners only</option>
                  <option value="losers">Losers only</option>
                </select>
              </div>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {filteredPages.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs"
                  >
                    <Badge
                      variant="outline"
                      className={
                        p.category === "winner"
                          ? "text-[10px] border-emerald-500 text-emerald-700 dark:text-emerald-400"
                          : p.category === "loser"
                            ? "text-[10px] border-red-500 text-red-700 dark:text-red-400"
                            : "text-[10px]"
                      }
                    >
                      {p.category}
                    </Badge>
                    <span className="font-mono text-foreground flex-1 truncate">{p.page}</span>
                    <span className="font-mono text-muted-foreground">{p.before} → {p.after}</span>
                    <span
                      className={`font-mono font-medium ${
                        p.delta > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : p.delta < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground"
                      }`}
                    >
                      {p.delta > 0 ? "+" : ""}{p.delta} ({p.before === 0 ? "n/a" : `${p.pctChange > 0 ? "+" : ""}${p.pctChange}%`})
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename="seo-experiment-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="seo-experiment-pages.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter before/after CSV data to track your experiment"
          hint="Two columns per row: page,metric_value. Pages are matched by name across before/after datasets. Click a date preset to populate the date range quickly."
          icon={<FlaskConical className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent experiments ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{EXPERIMENT_TYPE_PRESETS[h.type].label}</Badge>
                  <Badge variant="outline" className="mr-2">{CONTROL_METRIC_PRESETS[h.controlMetric]}</Badge>
                  <Badge
                    variant="outline"
                    className={`mr-2 ${
                      h.significance === "winning"
                        ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                        : h.significance === "losing"
                          ? "border-red-500 text-red-700 dark:text-red-400"
                          : ""
                    }`}
                  >
                    {SIGNIFICANCE_LABELS[h.significance]}
                  </Badge>
                  <span className="font-medium text-foreground">{h.name}</span>
                  <span className="text-muted-foreground ml-2">
                    · {h.pages} pages · avg {h.avgPctChange}% · {RECOMMENDATION_LABELS[h.recommendation]}
                  </span>
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
            <strong className="text-foreground">Privacy:</strong> All experiment analysis runs locally. History is stored in localStorage on this device only.
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
