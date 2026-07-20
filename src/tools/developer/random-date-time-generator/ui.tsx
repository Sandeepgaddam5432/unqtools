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
  OUTPUT_FORMATS,
  GRANULARITIES,
  TIMEZONES,
  FORMAT_PATTERNS,
  DEFAULT_OPTIONS,
  MAX_COUNT,
  SAMPLE_SEED,
  generateBatch,
  formatDate,
  computeStats,
  renderText,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type GenerateOptions,
  type OutputFormat,
  type Granularity,
  type SortMode,
  type HistoryEntry,
} from "./logic";
import { History, Calendar, Shuffle, BarChart3, Dices, AlertTriangle } from "lucide-react";

type RenderFormat = "text" | "csv" | "json";

/** Convert ms-since-epoch → "YYYY-MM-DDTHH:MM" suitable for <input type="datetime-local">. */
function msToDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/** Convert "YYYY-MM-DDTHH:MM" (interpreted as UTC) → ms-since-epoch. */
function datetimeLocalToMs(s: string): number {
  if (!s) return Date.now();
  // Treat the input as UTC by appending "Z" if no offset is present.
  const withZ = /[+-]\d{2}:?\d{2}$/.test(s) || s.endsWith("Z") ? s : `${s}:00Z`;
  const t = Date.parse(withZ);
  return Number.isFinite(t) ? t : Date.now();
}

export default function RandomDateTimeGenerator() {
  const [opts, setOpts] = useState<GenerateOptions>({ ...DEFAULT_OPTIONS });
  const [renderFormat, setRenderFormat] = useState<RenderFormat>("text");
  const [result, setResult] = useState<{ formatted: string[]; raw: number[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setOpts(parsed);
      toast.info("Loaded config from share link");
    }
  }, []);

  const setOpt = useCallback(
    <K extends keyof GenerateOptions>(key: K, value: GenerateOptions[K]) => {
      setOpts((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const stats = useMemo(() => (result ? computeStats(result.raw) : null), [result]);

  const outputText = useMemo(() => {
    if (!result) return "";
    if (renderFormat === "csv") return renderCsv(result.formatted, result.raw);
    if (renderFormat === "json") return renderJson(result.formatted, result.raw);
    return renderText(result.formatted);
  }, [result, renderFormat]);

  const formatPreview = useMemo(() => {
    const sampleMs = Date.UTC(2025, 0, 15, 13, 45, 30);
    try {
      return formatDate(sampleMs, opts.format, opts.timezone, opts.customPattern);
    } catch {
      return "(invalid pattern)";
    }
  }, [opts.format, opts.timezone, opts.customPattern]);

  const handleGenerate = useCallback(() => {
    const r = generateBatch(opts);
    if (!r.ok) {
      setError(r.error);
      setResult(null);
      toast.error(r.error);
      return;
    }
    setError(null);
    setResult({ formatted: r.formatted, raw: r.raw });
    saveHistory({
      ts: Date.now(),
      seed: r.seed,
      count: r.formatted.length,
      startMs: opts.startMs,
      endMs: opts.endMs,
      format: opts.format,
      preview: r.formatted.slice(0, 4).join(", "),
    });
    setHistory(loadHistory());
    toast.success(`Generated ${r.formatted.length} date(s)`);
  }, [opts]);

  const handleRandomSeed = useCallback(() => {
    const s = Math.floor(Math.random() * 0x100000000) >>> 0;
    setOpt("seed", s);
    toast.info(`Seed: ${s}`);
  }, [setOpt]);

  const handleClear = useCallback(() => {
    setResult(null);
    setError(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback(() => {
    setOpts({
      ...DEFAULT_OPTIONS,
      seed: SAMPLE_SEED,
      count: 20,
      format: "iso",
      granularity: "datetime",
      sort: "asc",
    });
    toast.info("Loaded sample config");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> Configuration
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleLoadSample}>Sample</Button>
              <Button variant="outline" size="sm" onClick={handleRandomSeed} className="gap-1.5">
                <Dices className="h-3.5 w-3.5" /> Random seed
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Start date (UTC)">
              <Input
                type="datetime-local"
                value={msToDatetimeLocal(opts.startMs)}
                onChange={(e) => setOpt("startMs", datetimeLocalToMs(e.target.value))}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="End date (UTC)">
              <Input
                type="datetime-local"
                value={msToDatetimeLocal(opts.endMs)}
                onChange={(e) => setOpt("endMs", datetimeLocalToMs(e.target.value))}
                className="h-8 text-xs"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Field label={`Count (1..${MAX_COUNT.toLocaleString()})`}>
              <Input
                type="number"
                min={1}
                max={MAX_COUNT}
                value={opts.count}
                onChange={(e) => setOpt("count", Math.max(1, Math.min(MAX_COUNT, Number(e.target.value) || 1)))}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Seed (uint32)">
              <Input
                type="number"
                min={0}
                max={4294967295}
                value={opts.seed}
                onChange={(e) => setOpt("seed", Math.max(0, Math.min(4294967295, Number(e.target.value) || 0)))}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Output format">
              <select
                value={opts.format}
                onChange={(e) => setOpt("format", e.target.value as OutputFormat)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {OUTPUT_FORMATS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Timezone">
              <select
                value={opts.timezone}
                onChange={(e) => setOpt("timezone", e.target.value)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
            <Field label="Granularity">
              <select
                value={opts.granularity}
                onChange={(e) => setOpt("granularity", e.target.value as Granularity)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {GRANULARITIES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </Field>
            <Field label="Sort">
              <select
                value={opts.sort}
                onChange={(e) => setOpt("sort", e.target.value as SortMode)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                <option value="none">As generated</option>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </Field>
            <Field label="Business days only (Mon-Fri)">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer h-8">
                <input
                  type="checkbox"
                  checked={opts.businessDaysOnly}
                  onChange={(e) => setOpt("businessDaysOnly", e.target.checked)}
                />
                <span>Exclude weekends</span>
              </label>
            </Field>
            <Field label="Unique (no repeats)">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer h-8">
                <input
                  type="checkbox"
                  checked={opts.unique}
                  onChange={(e) => setOpt("unique", e.target.checked)}
                />
                <span>Dedupe by bucket</span>
              </label>
            </Field>
          </div>

          {opts.format === "custom" && (
            <div className="space-y-2">
              <Field label="strftime-like pattern">
                <Input
                  type="text"
                  value={opts.customPattern}
                  onChange={(e) => setOpt("customPattern", e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="%Y-%m-%d %H:%M:%S"
                />
              </Field>
              <div className="flex flex-wrap gap-1">
                {FORMAT_PATTERNS.map((p) => (
                  <Button
                    key={p.value}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] font-mono"
                    onClick={() => setOpt("customPattern", p.value)}
                    title={p.label}
                  >
                    {p.value}
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Tokens: <code>%Y</code> year, <code>%y</code> 2-digit year, <code>%m</code> month,
                <code> %d</code> day, <code>%H</code> hour (24h), <code>%M</code> minute, <code>%S</code> second,
                <code> %I</code> hour (12h), <code>%p</code> AM/PM, <code>%A</code>/<code>%a</code> weekday,
                <code> %B</code>/<code>%b</code> month name, <code>%j</code> day-of-year, <code>%z</code> tz offset,
                <code> %%</code> literal %.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 rounded border bg-muted/40 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Format preview:</span>
            <code className="text-xs text-foreground font-mono">{formatPreview}</code>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={handleGenerate} className="gap-1.5">
              <Shuffle className="h-3.5 w-3.5" /> Generate
            </Button>
            <ClearButton onClick={handleClear} disabled={!result} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          {stats && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" /> Stats
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
                  <Stat label="Count" value={stats.count} />
                  <Stat label="Min" value={new Date(stats.minMs).toISOString()} />
                  <Stat label="Max" value={new Date(stats.maxMs).toISOString()} />
                  <Stat label="Span (ms)" value={stats.spanMs.toLocaleString()} />
                  <Stat label="Span (days)" value={stats.spanDays.toFixed(2)} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> Output ({result.formatted.length})
                </h3>
                <select
                  value={renderFormat}
                  onChange={(e) => setRenderFormat(e.target.value as RenderFormat)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="text">Plain text</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <Textarea
                readOnly
                value={outputText}
                className="min-h-[260px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => outputText} label="Copy" />
                <DownloadButton
                  getText={() => outputText}
                  filename={
                    renderFormat === "csv" ? "random-dates.csv"
                    : renderFormat === "json" ? "random-dates.json"
                    : "random-dates.txt"
                  }
                  mime={
                    renderFormat === "csv" ? "text/csv"
                    : renderFormat === "json" ? "application/json"
                    : "text/plain"
                  }
                  label={`Download .${renderFormat === "text" ? "txt" : renderFormat}`}
                />
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && !error && (
        <EmptyState
          title="Set a date range, then click Generate"
          hint="Eight output formats (ISO, Unix s/ms, locale, custom strftime, relative 'time ago', date-only, time-only), timezone-aware, business-day filter, unique mode, and seeded reproducibility. 100% client-side."
          icon={<Calendar className="h-8 w-8" />}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{h.format}</Badge>
                    <Badge variant="outline" className="text-[10px]">seed={h.seed}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.count} dates</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate">{h.preview}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All generation runs locally in your browser —
            nothing is uploaded. History (last 20) is stored in localStorage on this device only. The share URL
            encodes your config in the URL fragment, which browsers never send to servers.
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span>
              The mulberry32 PRNG is deterministic and reproducible — <strong>not</strong> for cryptography or
              security-sensitive use.
            </span>
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
      <div className="text-xs font-semibold text-foreground font-mono break-all">{value}</div>
    </div>
  );
}
