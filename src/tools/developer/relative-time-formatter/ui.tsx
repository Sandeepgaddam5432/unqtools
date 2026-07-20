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
  LOCALES,
  NUMERIC_MODES,
  STYLE_MODES,
  DEFAULT_OPTIONS,
  DEFAULT_THRESHOLDS,
  SAMPLE_DATES,
  SNIPPET_LIBRARIES,
  parseDateInput,
  toIsoString,
  formatRelative,
  formatAcrossLocales,
  computeBreakdown,
  getSnippet,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Locale,
  type FormatOptions,
  type SnippetLibrary,
  type HistoryEntry,
} from "./logic";
import { History, Clock, Globe, Code2, Calendar, ArrowRight } from "lucide-react";

const THRESHOLD_FIELDS: Array<{
  key: keyof FormatOptions["thresholds"];
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}> = [
  { key: "justNowSec", label: "Just-now window", min: 0, max: 120, step: 5, unit: "s" },
  { key: "minuteSec", label: "Seconds → minute", min: 46, max: 120, step: 1, unit: "s" },
  { key: "hourMin", label: "Minutes → hour", min: 1, max: 60, step: 1, unit: "min" },
  { key: "dayHour", label: "Hours → day", min: 1, max: 30, step: 1, unit: "h" },
  { key: "weekDay", label: "Days → week", min: 1, max: 14, step: 1, unit: "d" },
  { key: "monthDay", label: "Weeks → month", min: 7, max: 40, step: 1, unit: "d" },
  { key: "yearMonth", label: "Months → year", min: 1, max: 12, step: 1, unit: "mo" },
];

export default function RelativeTimeFormatter() {
  const [inputText, setInputText] = useState<string>(() => toIsoString(Date.now()));
  const [nowText, setNowText] = useState<string>(() => toIsoString(Date.now()));
  const [opts, setOpts] = useState<FormatOptions>({ ...DEFAULT_OPTIONS, thresholds: { ...DEFAULT_THRESHOLDS } });
  const [snippetLib, setSnippetLib] = useState<SnippetLibrary>("intl");
  const [gridLocales, setGridLocales] = useState<Locale[]>(LOCALES.map((l) => l.value));
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setOpts(parsed.options);
      if (parsed.inputIso) setInputText(parsed.inputIso);
      if (parsed.nowIso) setNowText(parsed.nowIso);
      if (parsed.inputIso || parsed.nowIso) toast.info("Loaded from share link");
    }
  }, []);

  const targetMs = useMemo(() => {
    try { return parseDateInput(inputText); } catch { return null; }
  }, [inputText]);

  const nowMs = useMemo(() => {
    try { return parseDateInput(nowText); } catch { return null; }
  }, [nowText]);

  const phrase = useMemo(() => {
    if (targetMs == null || nowMs == null) return "";
    try {
      return formatRelative(targetMs, nowMs, opts);
    } catch {
      return "";
    }
  }, [targetMs, nowMs, opts]);

  const localeGrid = useMemo(() => {
    if (targetMs == null || nowMs == null) return [];
    try {
      return formatAcrossLocales(targetMs, gridLocales, nowMs, opts);
    } catch {
      return [];
    }
  }, [targetMs, nowMs, opts, gridLocales]);

  const breakdown = useMemo(() => {
    if (targetMs == null || nowMs == null) return null;
    try { return computeBreakdown(targetMs, nowMs); } catch { return null; }
  }, [targetMs, nowMs]);

  const snippet = useMemo(() => getSnippet(snippetLib, opts), [snippetLib, opts]);

  const setOpt = useCallback(
    <K extends keyof FormatOptions>(key: K, value: FormatOptions[K]) => {
      setOpts((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setThreshold = useCallback(
    (key: keyof FormatOptions["thresholds"], value: number) => {
      setOpts((prev) => ({ ...prev, thresholds: { ...prev.thresholds, [key]: value } }));
    },
    [],
  );

  const toggleGridLocale = (loc: Locale) => {
    setGridLocales((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc],
    );
  };

  const handleLoadSample = (offsetMs: number) => {
    const now = Date.now();
    setNowText(toIsoString(now));
    setInputText(toIsoString(now + offsetMs));
    toast.info("Loaded sample");
  };

  const handleUseNow = useCallback(() => {
    const now = Date.now();
    setNowText(toIsoString(now));
    toast.info("Set 'now' to current time");
  }, []);

  const handleClear = useCallback(() => {
    setInputText("");
    setNowText(toIsoString(Date.now()));
    toast.info("Cleared input");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRecordHistory = useCallback(() => {
    if (phrase && targetMs != null && nowMs != null) {
      saveHistory({
        ts: Date.now(),
        inputIso: toIsoString(targetMs),
        nowIso: toIsoString(nowMs),
        phrase,
        locale: opts.locale,
        numeric: opts.numeric,
        style: opts.style,
      });
      setHistory(loadHistory());
    }
  }, [phrase, targetMs, nowMs, opts]);

  const valid = targetMs != null && nowMs != null;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rtf-input" className="text-sm font-semibold">Target date / timestamp</Label>
              <Input
                id="rtf-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="2025-01-15T12:00:00 or 1705315200000"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rtf-now" className="text-sm font-semibold flex items-center gap-1.5">
                Reference "now"
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={handleUseNow}>Use current</Button>
              </Label>
              <Input
                id="rtf-now"
                value={nowText}
                onChange={(e) => setNowText(e.target.value)}
                placeholder="2025-01-20T12:00:00"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Quick samples</Label>
            <div className="flex flex-wrap gap-1 pt-1">
              {SAMPLE_DATES.map((s) => (
                <Button
                  key={s.label}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handleLoadSample(s.offsetMs)}
                >{s.label}</Button>
              ))}
              <ClearButton onClick={handleClear} disabled={!inputText} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Format options
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Locale">
              <select
                value={opts.locale}
                onChange={(e) => setOpt("locale", e.target.value as Locale)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
            <Field label="Numeric">
              <select
                value={opts.numeric}
                onChange={(e) => setOpt("numeric", e.target.value as FormatOptions["numeric"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {NUMERIC_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Style">
              <select
                value={opts.style}
                onChange={(e) => setOpt("style", e.target.value as FormatOptions["style"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {STYLE_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Thresholds (auto unit selection)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {THRESHOLD_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{f.label}</span>
                    <Badge variant="outline" className="text-[10px]">{opts.thresholds[f.key]}{f.unit}</Badge>
                  </div>
                  <input
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={opts.thresholds[f.key]}
                    onChange={(e) => setThreshold(f.key, parseInt(e.target.value, 10))}
                    className="w-full h-1.5"
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {valid ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> Preview
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleRecordHistory(); return phrase; }}
                    label="Copy phrase"
                  />
                  <DownloadButton
                    getText={() => localeGrid.map((p) => `${p.locale}: ${p.phrase}`).join("\n")}
                    filename="relative-time.txt"
                    label="Download grid"
                  />
                  <ShareButton getUrl={() => { handleRecordHistory(); return buildShareUrl(opts, inputText, nowText); }} />
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-center">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  {opts.locale} · {opts.numeric} · {opts.style}
                </div>
                <div className="text-3xl font-semibold text-foreground">{phrase}</div>
                {breakdown && (
                  <div className="text-[11px] text-muted-foreground mt-2">
                    {breakdown.direction === "past" && "→ past"}
                    {breakdown.direction === "future" && "→ future"}
                    {breakdown.direction === "now" && "→ now"}
                    {" · "}
                    {breakdown.totalDays.toFixed(2)} days total
                  </div>
                )}
              </div>

              <div>
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Multi-locale grid</Label>
                <div className="flex flex-wrap gap-1 pt-1 pb-2">
                  {LOCALES.map((l) => (
                    <label key={l.value} className="flex items-center gap-1 text-[11px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={gridLocales.includes(l.value)}
                        onChange={() => toggleGridLocale(l.value)}
                      />
                      {l.value}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {localeGrid.map((p) => (
                    <div key={p.locale} className="rounded border bg-background px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{p.locale}</div>
                      <div className="text-sm font-medium text-foreground">{p.phrase}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {breakdown && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> Full breakdown
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                  <Stat label="Years" value={breakdown.years} />
                  <Stat label="Months" value={breakdown.months} />
                  <Stat label="Weeks" value={breakdown.weeks} />
                  <Stat label="Days" value={breakdown.days} />
                  <Stat label="Hours" value={breakdown.hours} />
                  <Stat label="Minutes" value={breakdown.minutes} />
                  <Stat label="Seconds" value={breakdown.seconds} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs pt-1 border-t">
                  <Stat label="Total days" value={breakdown.totalDays.toFixed(2)} />
                  <Stat label="Total hours" value={breakdown.totalHours.toFixed(2)} />
                  <Stat label="Total minutes" value={breakdown.totalMinutes.toFixed(1)} />
                  <Stat label="Total seconds" value={breakdown.totalSeconds.toFixed(0)} />
                  <Stat label="Total weeks" value={breakdown.totalWeeks.toFixed(2)} />
                  <Stat label="Total ms" value={breakdown.totalMs} />
                  <Stat label="Direction" value={breakdown.direction} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Code2 className="h-4 w-4" /> Code snippet
                </h3>
                <div className="flex flex-wrap gap-1">
                  {SNIPPET_LIBRARIES.map((lib) => (
                    <Button
                      key={lib.value}
                      variant={snippetLib === lib.value ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setSnippetLib(lib.value)}
                    >{lib.label}</Button>
                  ))}
                </div>
              </div>
              <Textarea
                readOnly
                value={snippet}
                className="min-h-[180px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => snippet} label="Copy snippet" />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a target date and reference 'now' to preview"
          hint="Supports YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS, or Unix timestamps. Pick a locale, numeric mode, and style; tune thresholds; preview across 5 locales at once; copy code for Intl, Luxon, Day.js, or date-fns."
          icon={<Clock className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.locale}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.numeric}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.style}</Badge>
                    <span className="ml-auto text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                    <code className="text-muted-foreground truncate">{h.inputIso}</code>
                    <ArrowRight className="h-3 w-3 flex-shrink-0" />
                    <span className="font-medium text-foreground">{h.phrase}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All relative-time formatting runs locally with
            Intl.RelativeTimeFormat. Nothing is uploaded. History (last 20) is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
