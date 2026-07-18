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
  TARGET_PRESETS,
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_BAR_COLORS,
  SIGNAL_LABELS,
  WEIGHTS,
  validateInputs,
  normalizeInputs,
  computePageExperienceScore,
  generateRecommendations,
  summarizeStats,
  scoreLabel,
  buildComparison,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PageExperienceInputs,
  type SignalScore,
  type SignalStatus,
  type HistoryEntry,
} from "./logic";
import { History, GaugeCircle, Lightbulb, GitCompare, ShieldCheck } from "lucide-react";

const DEFAULT_INPUTS: PageExperienceInputs = {
  url: "",
  lcpMs: 2500,
  fidMs: 100,
  cls: 0.1,
  inpMs: 200,
  httpsEnabled: true,
  mobileFriendly: true,
  hasIntrusiveInterstitials: false,
  safeBrowsing: true,
};

export default function PageExperienceSignalChecker() {
  const [inputs, setInputs] = useState<PageExperienceInputs>(DEFAULT_INPUTS);
  const [target, setTarget] = useState<PageExperienceInputs>(TARGET_PRESETS[0].inputs as PageExperienceInputs);
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
  const result = useMemo(() => computePageExperienceScore(normInputs), [normInputs]);
  const recommendations = useMemo(() => generateRecommendations(normInputs), [normInputs]);
  const stats = useMemo(() => summarizeStats(result), [result]);

  const normTarget = useMemo(() => normalizeInputs(target), [target]);
  const comparison = useMemo(() => buildComparison(normInputs, normTarget), [normInputs, normTarget]);

  const textReport = useMemo(
    () => renderTextReport(normInputs, result, recommendations),
    [normInputs, result, recommendations],
  );
  const csvReport = useMemo(() => renderCsv(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (!hasErrors) {
      saveHistory({
        ts: Date.now(),
        url: normInputs.url,
        cwvScore: result.cwvScore,
        pageExperienceScore: result.pageExperienceScore,
        goodCount: result.goodCount,
        failedCount: result.failedCount,
      });
      setHistory(loadHistory());
    }
  }, [normInputs, result, hasErrors]);

  const handleClear = useCallback(() => {
    setInputs(DEFAULT_INPUTS);
    toast.info("Cleared inputs");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const updateNum = (field: keyof PageExperienceInputs, value: string) => {
    const num = value === "" ? 0 : Number(value);
    setInputs((prev) => ({ ...prev, [field]: num }));
  };
  const updateBool = (field: keyof PageExperienceInputs, value: boolean) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };
  const updateTargetNum = (field: keyof PageExperienceInputs, value: string) => {
    const num = value === "" ? 0 : Number(value);
    setTarget((prev) => ({ ...prev, [field]: num }));
  };
  const updateTargetBool = (field: keyof PageExperienceInputs, value: boolean) => {
    setTarget((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreset = (key: "good" | "great" | "perfect") => {
    const preset = TARGET_PRESETS.find((p) => p.key === key);
    if (preset) {
      setTarget({ ...DEFAULT_INPUTS, ...preset.inputs } as PageExperienceInputs);
      toast.info(`Loaded ${preset.label} target preset`);
    }
  };

  const peBarColor = barColorForScore(result.pageExperienceScore);
  const cwvBarColor = barColorForScore(result.cwvScore);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Page measurements</Label>
          <div className="space-y-1.5">
            <Label htmlFor="pxc-url" className="text-[11px] text-muted-foreground">Page URL (optional)</Label>
            <Input
              id="pxc-url"
              value={inputs.url}
              onChange={(e) => setInputs((prev) => ({ ...prev, url: e.target.value }))}
              placeholder="https://example.com/page"
              className={`h-8 text-xs ${errors.url ? "border-red-500" : ""}`}
            />
            {errors.url && <p className="text-[10px] text-red-500">{errors.url}</p>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <NumberField label="LCP (ms)" value={inputs.lcpMs} onChange={(v) => updateNum("lcpMs", v)} error={errors.lcpMs} hint={`good ≤ ${2500}`} />
            <NumberField label="FID (ms)" value={inputs.fidMs} onChange={(v) => updateNum("fidMs", v)} error={errors.fidMs} hint="good ≤ 100" />
            <NumberField label="CLS" value={inputs.cls} onChange={(v) => updateNum("cls", v)} error={errors.cls} hint="good ≤ 0.1" step="0.001" />
            <NumberField label="INP (ms)" value={inputs.inpMs} onChange={(v) => updateNum("inpMs", v)} error={errors.inpMs} hint="good ≤ 200" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ToggleField label="HTTPS" checked={inputs.httpsEnabled} onChange={(v) => updateBool("httpsEnabled", v)} weight={`${(WEIGHTS.https * 100).toFixed(0)}%`} />
            <ToggleField label="Mobile-friendly" checked={inputs.mobileFriendly} onChange={(v) => updateBool("mobileFriendly", v)} weight={`${(WEIGHTS.mobileFriendly * 100).toFixed(0)}%`} />
            <ToggleField label="Intrusive interstitials" checked={inputs.hasIntrusiveInterstitials} onChange={(v) => updateBool("hasIntrusiveInterstitials", v)} weight={`${(WEIGHTS.interstitials * 100).toFixed(0)}%`} negative />
            <ToggleField label="Safe browsing" checked={inputs.safeBrowsing} onChange={(v) => updateBool("safeBrowsing", v)} weight={`${(WEIGHTS.safeBrowsing * 100).toFixed(0)}%`} />
          </div>
        </CardContent>
      </Card>

      {!hasErrors ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <GaugeCircle className="h-4 w-4" /> Scores
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Page experience" value={`${result.pageExperienceScore}/100`} hint={stats.pageExperienceLabel} />
                <Stat label="CWV score" value={`${result.cwvScore}/100`} hint={stats.cwvLabel} />
                <Stat label="Good signals" value={`${result.goodCount}/8`} hint={`${stats.goodPercent}% good`} highlight="good" />
                <Stat label="Failed signals" value={`${result.failedCount}/8`} hint={`${stats.failedPercent}% failed`} highlight={result.failedCount > 0 ? "bad" : "good"} />
              </div>
              <ScoreBar label="Page experience" score={result.pageExperienceScore} label2={stats.pageExperienceLabel} barClass={peBarColor} />
              <ScoreBar label="Core Web Vitals" score={result.cwvScore} label2={stats.cwvLabel} barClass={cwvBarColor} />
              {stats.topPriority && (
                <div className="rounded border border-amber-500 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <span className="font-mono mr-2 uppercase text-[10px]">Top priority</span>
                  <span>{stats.topPriority}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Signal status table
              </h3>
              <div className="space-y-1">
                {result.signals.map((s) => (
                  <SignalRow key={s.key} signal={s} />
                ))}
              </div>
            </CardContent>
          </Card>

          {recommendations.length > 0 && (
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
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <GitCompare className="h-4 w-4" /> Comparison (current vs target)
                </h3>
                <div className="flex flex-wrap gap-1">
                  {TARGET_PRESETS.map((p) => (
                    <Button
                      key={p.key}
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px]"
                      onClick={() => handlePreset(p.key)}
                    >+ {p.label}</Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => setShowComparison((s) => !s)}
                  >
                    {showComparison ? "Hide target editor" : "Edit target"}
                  </Button>
                </div>
              </div>
              {showComparison && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded border bg-muted/30 p-2">
                  <NumberField label="Target LCP (ms)" value={target.lcpMs} onChange={(v) => updateTargetNum("lcpMs", v)} />
                  <NumberField label="Target FID (ms)" value={target.fidMs} onChange={(v) => updateTargetNum("fidMs", v)} />
                  <NumberField label="Target CLS" value={target.cls} onChange={(v) => updateTargetNum("cls", v)} step="0.001" />
                  <NumberField label="Target INP (ms)" value={target.inpMs} onChange={(v) => updateTargetNum("inpMs", v)} />
                  <ToggleField label="T: HTTPS" checked={target.httpsEnabled} onChange={(v) => updateTargetBool("httpsEnabled", v)} />
                  <ToggleField label="T: Mobile-friendly" checked={target.mobileFriendly} onChange={(v) => updateTargetBool("mobileFriendly", v)} />
                  <ToggleField label="T: Intrusive interstitials" checked={target.hasIntrusiveInterstitials} onChange={(v) => updateTargetBool("hasIntrusiveInterstitials", v)} negative />
                  <ToggleField label="T: Safe browsing" checked={target.safeBrowsing} onChange={(v) => updateTargetBool("safeBrowsing", v)} />
                </div>
              )}
              <div className="space-y-1">
                {comparison.map((row, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 text-xs rounded border bg-background px-3 py-1.5">
                    <div className="text-muted-foreground truncate">{row.metric}</div>
                    <div className="font-mono text-foreground">{row.current}</div>
                    <div className="font-mono text-foreground">
                      {row.target}
                      <span className={`ml-2 text-[10px] ${row.delta.endsWith("✓") ? "text-emerald-600 dark:text-emerald-400" : row.delta === "—" ? "text-muted-foreground" : "text-red-600 dark:text-red-400"}`}>
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
                className="min-h-[220px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  filename="page-experience-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csvReport}
                  filename="page-experience-signals.csv"
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
          title="Fix input errors to see scores"
          hint="Enter LCP, FID, CLS, INP measurements and toggle the binary signals. Click a target preset for quick comparison."
          icon={<GaugeCircle className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.pageExperienceScore}/100</Badge>
                  <Badge variant="outline" className="mr-2">CWV {h.cwvScore}</Badge>
                  <Badge variant="outline" className="mr-2">{h.goodCount}/8 good</Badge>
                  {h.url && <span className="text-muted-foreground mr-2 truncate">{h.url}</span>}
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
            <strong className="text-foreground">Privacy:</strong> All scoring runs locally in your browser. History is stored in localStorage on this device only. No URL or measurements ever leave the page.
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
  hint,
  step,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  step?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`h-8 text-xs ${error ? "border-red-500" : ""}`}
      />
      {error ? (
        <p className="text-[10px] text-red-500">{error}</p>
      ) : hint ? (
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  weight,
  negative,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  weight?: string;
  negative?: boolean;
}) {
  // For "negative" toggles (intrusive interstitials), checked = bad. So pass = !checked.
  const pass = negative ? !checked : checked;
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">
        {label}{weight && <span className="ml-1 text-[10px]">({weight})</span>}
      </Label>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`h-8 w-full rounded border px-2 text-xs font-medium ${
          pass
            ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        }`}
      >
        {checked ? "Yes" : "No"}
      </button>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string | number;
  hint?: string;
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
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ScoreBar({ label, score, label2, barClass }: { label: string; score: number; label2: string; barClass: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <Badge variant="outline" className="text-[10px]">{label2}</Badge>
      </div>
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${barClass} transition-all`}
          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
        />
      </div>
      <div className="text-xs text-right text-muted-foreground">{score} / 100</div>
    </div>
  );
}

function SignalRow({ signal }: { signal: SignalScore }) {
  const statusLabel = STATUS_LABELS[signal.status];
  const statusColor = STATUS_COLORS[signal.status];
  const barColor = STATUS_BAR_COLORS[signal.status];
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" />
        <span className={`font-medium ${statusColor}`}>{statusLabel}</span>
        <span className="text-muted-foreground flex-1 truncate">{signal.label}</span>
        <span className="font-mono text-foreground">{signal.displayValue}</span>
        <Badge variant="outline" className="text-[10px]">{signal.score}/100</Badge>
        <Badge variant="outline" className="text-[10px]">{(signal.weight * 100).toFixed(0)}%</Badge>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${Math.max(2, Math.min(100, signal.score))}%` }}
        />
      </div>
      {signal.recommendation && (
        <p className="mt-1 text-[10px] text-muted-foreground">{signal.recommendation}</p>
      )}
    </div>
  );
}

function RecRow({ rec }: { rec: { severity: "high" | "medium" | "low"; signal: keyof typeof SIGNAL_LABELS; message: string } }) {
  const sevColor =
    rec.severity === "high"
      ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
      : rec.severity === "medium"
        ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
        : "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300";
  return (
    <div className={`rounded border px-3 py-1.5 text-xs ${sevColor}`}>
      <span className="font-mono mr-2 uppercase text-[10px]">{rec.severity}</span>
      <span className="font-medium mr-2">{SIGNAL_LABELS[rec.signal]}:</span>
      <span>{rec.message}</span>
    </div>
  );
}

function barColorForScore(score: number): string {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 75) return "bg-lime-500";
  if (score >= 50) return "bg-amber-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-red-500";
}

// Suppress unused-import lint
export type _Unused = SignalStatus;
