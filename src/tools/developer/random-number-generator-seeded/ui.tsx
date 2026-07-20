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
  PRNG_ALGORITHMS,
  DISTRIBUTIONS,
  DEFAULT_OPTIONS,
  MAX_COUNT,
  SAMPLE_SEED,
  execute,
  computeHistogram,
  renderText,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  isCsprngAvailable,
  type GenerateOptions,
  type HistoryEntry,
} from "./logic";
import { History, Shuffle, Shield, BarChart3, AlertTriangle } from "lucide-react";

type OutputFormat = "text" | "csv" | "json";

export default function RandomNumberGeneratorSeeded() {
  const [opts, setOpts] = useState<GenerateOptions>({ ...DEFAULT_OPTIONS });
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("text");
  const [sortMode, setSortMode] = useState<"none" | "asc" | "desc" | "shuffle">("none");
  const [values, setValues] = useState<number[]>([]);
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

  const result = useMemo(() => {
    if (values.length === 0) return null;
    const v = sortMode === "asc" ? [...values].sort((a, b) => a - b)
      : sortMode === "desc" ? [...values].sort((a, b) => b - a)
      : sortMode === "shuffle" ? [...values].sort(() => Math.random() - 0.5)
      : values;
    if (outputFormat === "csv") return renderCsv(v);
    if (outputFormat === "json") return renderJson(v);
    return renderText(v);
  }, [values, outputFormat, sortMode]);

  const histogram = useMemo(() => {
    if (values.length === 0) return [];
    return computeHistogram(values, 10);
  }, [values]);

  const stats = useMemo(() => {
    if (values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    let variance = 0;
    for (const v of values) variance += (v - mean) ** 2;
    return { count: values.length, sum, mean, min, max, std: Math.sqrt(variance / values.length) };
  }, [values]);

  const handleGenerate = useCallback(() => {
    const r = execute(opts);
    if (!r.ok) {
      setError(r.error);
      setValues([]);
      toast.error(r.error);
      return;
    }
    setError(null);
    setValues(r.values);
    saveHistory({
      ts: Date.now(),
      algorithm: r.algorithm,
      seed: r.seed,
      distribution: r.distribution,
      count: r.values.length,
      min: opts.min,
      max: opts.max,
      preview: r.values.slice(0, 8).join(", "),
    });
    setHistory(loadHistory());
    toast.success(`Generated ${r.values.length} value(s)`);
  }, [opts]);

  const handleRandomSeed = useCallback(() => {
    const s = Math.floor(Math.random() * 0x100000000) >>> 0;
    setOpt("seed", s);
    toast.info(`Seed: ${s}`);
  }, [setOpt]);

  const handleClear = useCallback(() => {
    setValues([]);
    setError(null);
    setSortMode("none");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback(() => {
    setOpts({ ...DEFAULT_OPTIONS, seed: SAMPLE_SEED, count: 20, distribution: "uniform", min: 1, max: 100 });
    toast.info("Loaded sample config");
  }, []);

  const csprngAvailable = isCsprngAvailable();

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Shuffle className="h-4 w-4" /> Configuration
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleLoadSample}>Sample</Button>
              <Button variant="outline" size="sm" onClick={handleRandomSeed}>Random seed</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Field label="Algorithm">
              <select
                value={opts.algorithm}
                onChange={(e) => setOpt("algorithm", e.target.value as GenerateOptions["algorithm"])}
                disabled={opts.csprng}
                className="h-8 w-full text-xs rounded border bg-background px-2 disabled:opacity-50"
              >
                {PRNG_ALGORITHMS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>
            <Field label="Seed (uint32)">
              <Input
                type="number"
                min={0}
                max={4294967295}
                value={opts.seed}
                onChange={(e) => setOpt("seed", Math.max(0, Math.min(4294967295, Number(e.target.value) || 0)))}
                disabled={opts.csprng}
                className="h-8 text-xs disabled:opacity-50"
              />
            </Field>
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
            <Field label="Distribution">
              <select
                value={opts.distribution}
                onChange={(e) => setOpt("distribution", e.target.value as GenerateOptions["distribution"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {DISTRIBUTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
            {opts.distribution === "uniform" && (
              <>
                <Field label="Min">
                  <Input
                    type="number"
                    value={opts.min}
                    onChange={(e) => setOpt("min", Number(e.target.value) || 0)}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="Max">
                  <Input
                    type="number"
                    value={opts.max}
                    onChange={(e) => setOpt("max", Number(e.target.value) || 0)}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label={`Decimals (0..12)`}>
                  <Input
                    type="number"
                    min={0}
                    max={12}
                    value={opts.decimals}
                    onChange={(e) => setOpt("decimals", Math.max(0, Math.min(12, Number(e.target.value) || 0)))}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="Unique (no repeats)">
                  <input
                    type="checkbox"
                    checked={opts.unique}
                    onChange={(e) => setOpt("unique", e.target.checked)}
                    disabled={opts.decimals > 0}
                  />
                </Field>
              </>
            )}
            {opts.distribution === "normal" && (
              <>
                <Field label="Mean (μ)">
                  <Input
                    type="number"
                    value={opts.mean}
                    onChange={(e) => setOpt("mean", Number(e.target.value) || 0)}
                    className="h-8 text-xs"
                  />
                </Field>
                <Field label="Std dev (σ)">
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={opts.std}
                    onChange={(e) => setOpt("std", Math.max(0, Number(e.target.value) || 0))}
                    className="h-8 text-xs"
                  />
                </Field>
              </>
            )}
            {(opts.distribution === "exponential" || opts.distribution === "poisson") && (
              <Field label="Lambda (λ)">
                <Input
                  type="number"
                  min={0.001}
                  step={0.1}
                  value={opts.lambda}
                  onChange={(e) => setOpt("lambda", Math.max(0.001, Number(e.target.value) || 0.001))}
                  className="h-8 text-xs"
                />
              </Field>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={opts.csprng}
                onChange={(e) => setOpt("csprng", e.target.checked)}
                disabled={!csprngAvailable}
              />
              <Shield className="h-3.5 w-3.5" />
              CSPRNG mode (crypto.getRandomValues)
            </label>
            {opts.csprng && (
              <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300 border-amber-500/40">
                Non-reproducible · uniform only · NOT seeded
              </Badge>
            )}
          </div>
          {opts.csprng && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>
                CSPRNG mode draws from the browser's <code>crypto.getRandomValues</code> — values are
                cryptographically secure but <strong>not reproducible</strong>. Only uniform distribution is
                supported. For reproducible sequences, disable CSPRNG and pick a seeded PRNG.
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={handleGenerate} className="gap-1.5">
              <Shuffle className="h-3.5 w-3.5" /> Generate
            </Button>
            <ClearButton onClick={handleClear} disabled={values.length === 0} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {values.length > 0 ? (
        <>
          {stats && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" /> Stats & histogram
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                  <Stat label="Count" value={stats.count} />
                  <Stat label="Sum" value={formatNum(stats.sum)} />
                  <Stat label="Mean" value={formatNum(stats.mean)} />
                  <Stat label="Std" value={formatNum(stats.std)} />
                  <Stat label="Min" value={formatNum(stats.min)} />
                  <Stat label="Max" value={formatNum(stats.max)} />
                  <Stat label="Range" value={formatNum(stats.max - stats.min)} />
                </div>
                {histogram.length > 0 && (
                  <div className="space-y-1 pt-2">
                    {histogram.map((b, i) => {
                      const max = Math.max(...histogram.map((x) => x.count), 1);
                      const pct = (b.count / max) * 100;
                      return (
                        <div key={i} className="flex items-center gap-2 text-[10px]">
                          <span className="font-mono text-muted-foreground w-24 text-right">
                            {formatNum(b.min)}–{formatNum(b.max)}
                          </span>
                          <div className="flex-1 bg-muted rounded h-3 overflow-hidden">
                            <div
                              className="bg-primary h-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-8 text-right font-mono">{b.count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Shuffle className="h-4 w-4" /> Output ({values.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="text">Plain text</option>
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="none">As generated</option>
                    <option value="asc">Sort ↑</option>
                    <option value="desc">Sort ↓</option>
                    <option value="shuffle">Shuffle</option>
                  </select>
                </div>
              </div>
              <Textarea
                readOnly
                value={result ?? ""}
                className="min-h-[200px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => result ?? ""} label="Copy" />
                <DownloadButton
                  getText={() => result ?? ""}
                  filename={
                    outputFormat === "csv" ? "random-numbers.csv"
                    : outputFormat === "json" ? "random-numbers.json"
                    : "random-numbers.txt"
                  }
                  mime={
                    outputFormat === "csv" ? "text/csv"
                    : outputFormat === "json" ? "application/json"
                    : "text/plain"
                  }
                  label={`Download .${outputFormat === "text" ? "txt" : outputFormat}`}
                />
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Pick an algorithm and seed, then generate"
          hint="Four PRNGs (mulberry32, LCG, xorshift, Mersenne-Twister), four distributions (uniform, normal, exponential, Poisson), unique-set mode, histogram preview, and CSPRNG mode for security. 100% client-side."
          icon={<Shuffle className="h-8 w-8" />}
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
                    <Badge variant="outline" className="text-[10px]">{h.algorithm}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.distribution}</Badge>
                    {!h.algorithm.includes("csprng") && (
                      <Badge variant="outline" className="text-[10px]">seed={h.seed}</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">{h.count} vals</Badge>
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
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All generation runs locally in your browser —
            nothing is uploaded. History (last 20) is stored in localStorage on this device only. The share URL
            encodes your config in the URL fragment, which browsers never send to servers.
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

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

function formatNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(4).replace(/\.?0+$/, "");
}
