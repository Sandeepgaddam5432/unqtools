"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  PII_TYPE_LIST,
  PII_TYPE_LABELS,
  STRATEGY_LIST,
  STRATEGY_LABELS,
  STRATEGY_DESCRIPTIONS,
  HONESTY_BANNER,
  MAX_INPUT_BYTES,
  DEFAULT_CONFIG,
  detectFormat,
  detectAllPii,
  detectColumnPii,
  parseCsv,
  resolveStrategy,
  anonymize,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PiiType,
  type Strategy,
  type StrategyConfig,
  type InputFormat,
  type HistoryEntry,
} from "./logic";
import {
  EyeOff,
  History,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Database,
  Eye,
  FileText,
  Table,
  Braces,
} from "lucide-react";

export default function TestDataAnonymizer() {
  const [input, setInput] = useState("");
  const [seed, setSeed] = useState("anon-seed");
  const [defaultStrategy, setDefaultStrategy] = useState<Strategy>("pseudonymize");
  const [perType, setPerType] = useState<Partial<Record<PiiType, Strategy>>>({
    "credit-card": "preserve-format",
    "dob": "generalize",
    "zipcode": "generalize",
  });
  const [autoDetect, setAutoDetect] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.seed) setSeed(p.seed);
      if (p.defaultStrategy) setDefaultStrategy(p.defaultStrategy);
      if (Object.keys(p.perType).length > 0) setPerType(p.perType);
      if (p.seed || p.defaultStrategy) toast.info("Loaded from share link");
    }
  }, []);

  const config: StrategyConfig = useMemo(
    () => ({ default: defaultStrategy, perType }),
    [defaultStrategy, perType],
  );

  const detectedFormat: InputFormat = useMemo(() => detectFormat(input), [input]);

  const inputBytes = useMemo(() => new Blob([input]).size, [input]);
  const tooLarge = inputBytes > MAX_INPUT_BYTES;

  // Preview: detect PII in input (for the first 5000 chars only, for perf).
  const previewMatches = useMemo(() => {
    if (!input) return [];
    return detectAllPii(input.slice(0, 5000));
  }, [input]);

  // CSV column detection preview.
  const csvColumns = useMemo(() => {
    if (detectedFormat !== "csv" || !input) return [];
    const rows = parseCsv(input);
    if (rows.length === 0) return [];
    return detectColumnPii(rows);
  }, [input, detectedFormat]);

  const result = useMemo(() => {
    if (!input || tooLarge) return null;
    return anonymize({ input, config, seed, autoDetect });
  }, [input, config, seed, autoDetect, tooLarge]);

  const handleRandomSeed = useCallback(() => {
    const s = Math.random().toString(36).slice(2, 10);
    setSeed(s);
    toast.success(`New seed: ${s}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (!result || !input) return;
    saveHistory({
      ts: Date.now(),
      seed,
      format: detectedFormat,
      inputBytes,
      outputBytes: new Blob([result.output]).size,
      totalPii: result.stats.total,
      defaultStrategy,
    });
    setHistory(loadHistory());
  }, [result, input, seed, detectedFormat, inputBytes, defaultStrategy]);

  const handleClear = useCallback(() => {
    setInput("");
    setSeed("anon-seed");
    setDefaultStrategy("pseudonymize");
    setPerType({ "credit-card": "preserve-format", "dob": "generalize", "zipcode": "generalize" });
    setAutoDetect(true);
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareUrl = useMemo(
    () => buildShareUrl(seed, defaultStrategy, perType),
    [seed, defaultStrategy, perType],
  );

  const setStrategyForType = (type: PiiType, strategy: Strategy | "default") => {
    setPerType((prev) => {
      const next = { ...prev };
      if (strategy === "default") delete next[type];
      else next[type] = strategy;
      return next;
    });
  };

  const formatIcon = detectedFormat === "json" ? <Braces className="h-3.5 w-3.5" />
    : detectedFormat === "csv" ? <Table className="h-3.5 w-3.5" />
    : <FileText className="h-3.5 w-3.5" />;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Honesty banner */}
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-200"
      >
        <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span className="text-xs">{HONESTY_BANNER}</span>
      </div>

      {/* Input */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="tda-input" className="text-sm font-semibold flex items-center gap-1.5">
              <Database className="h-4 w-4" /> Input data
            </Label>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="gap-1">
                {formatIcon}
                Detected: {detectedFormat.toUpperCase()}
              </Badge>
              <Badge variant={tooLarge ? "destructive" : "outline"}>
                {inputBytes.toLocaleString()} / {MAX_INPUT_BYTES.toLocaleString()} bytes
              </Badge>
              {previewMatches.length > 0 && (
                <Badge variant="secondary">
                  <Eye className="h-3 w-3 mr-1" />
                  {previewMatches.length} PII found (preview)
                </Badge>
              )}
            </div>
          </div>
          <Textarea
            id="tda-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"Paste CSV, JSON, or free text here.\n\nExamples:\nname,email,phone\nJane,jane@example.com,555-123-4567\n\n{\"user\":{\"email\":\"jane@example.com\"}}\n\nEmail: jane@example.com, SSN: 123-45-6789"}
            className="min-h-[180px] resize-y font-mono text-xs"
          />
          {tooLarge && (
            <ErrorBanner message={`Input exceeds ${MAX_INPUT_BYTES.toLocaleString()} byte limit. Please reduce the dataset size.`} />
          )}
        </CardContent>
      </Card>

      {/* CSV column detection preview */}
      {detectedFormat === "csv" && csvColumns.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Table className="h-4 w-4" /> Detected PII columns ({csvColumns.filter((c) => c.detectedType).length}/{csvColumns.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {csvColumns.map((col) => (
                <div
                  key={col.index}
                  className={`rounded border px-2 py-1.5 text-xs ${col.detectedType ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" : "bg-background"}`}
                >
                  <div className="font-mono font-medium text-foreground truncate">
                    col {col.index}: {col.header || "(empty)"}
                  </div>
                  {col.detectedType ? (
                    <Badge variant="secondary" className="text-[10px] mt-1">
                      {PII_TYPE_LABELS[col.detectedType]}
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">no PII detected</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategy configuration */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tda-seed" className="text-xs">Seed (deterministic pseudonymization)</Label>
              <div className="flex gap-1">
                <Input
                  id="tda-seed"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="font-mono text-xs"
                  placeholder="my-seed"
                />
                <Button variant="outline" size="sm" onClick={handleRandomSeed} title="Random seed">
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tda-default" className="text-xs">Default strategy (for types without override)</Label>
              <select
                id="tda-default"
                value={defaultStrategy}
                onChange={(e) => setDefaultStrategy(e.target.value as Strategy)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {STRATEGY_LIST.map((s) => (
                  <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Per-type strategy overrides</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {PII_TYPE_LIST.map((t) => {
                const current = perType[t];
                return (
                  <div key={t} className="rounded border px-2 py-1.5 text-xs">
                    <div className="font-medium text-foreground">{PII_TYPE_LABELS[t]}</div>
                    <select
                      value={current ?? "default"}
                      onChange={(e) => setStrategyForType(t, e.target.value as Strategy | "default")}
                      className="h-7 w-full text-[11px] rounded border bg-background px-1 mt-1"
                    >
                      <option value="default">default ({STRATEGY_LABELS[resolveStrategy(config, t)]})</option>
                      {STRATEGY_LIST.map((s) => (
                        <option key={s} value={s}>{STRATEGY_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
          {detectedFormat === "csv" && (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={autoDetect}
                onChange={(e) => setAutoDetect(e.target.checked)}
              />
              Auto-detect PII columns (samples up to 50 rows per column)
            </label>
          )}
        </CardContent>
      </Card>

      {/* Output */}
      {result ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Eye className="h-4 w-4" /> Anonymized output
                </h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">
                    {result.stats.total} PII masked
                  </Badge>
                  <Badge variant="outline">
                    {new Blob([result.output]).size.toLocaleString()} bytes
                  </Badge>
                </div>
              </div>
              <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
                {result.output || "(empty output)"}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return result.output; }}
                  label="Copy output"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return result.output; }}
                  filename={`anonymized-${detectedFormat === "csv" ? "data.csv" : detectedFormat === "json" ? "data.json" : "data.txt"}`}
                  mime={detectedFormat === "csv" ? "text/csv" : detectedFormat === "json" ? "application/json" : "text/plain"}
                  label="Download"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return shareUrl; }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Database className="h-4 w-4" /> Masking statistics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total PII" value={result.stats.total} />
                <Stat label="Emails" value={result.stats.byType.email} />
                <Stat label="Phones" value={result.stats.byType.phone} />
                <Stat label="SSNs" value={result.stats.byType.ssn} />
                <Stat label="Credit cards" value={result.stats.byType["credit-card"]} />
                <Stat label="IPs" value={result.stats.byType.ip} />
                <Stat label="ZIPs" value={result.stats.byType.zipcode} />
                <Stat label="DOBs" value={result.stats.byType.dob} />
                <Stat label="Names" value={result.stats.byType.name} />
                <Stat label="Mask" value={result.stats.byStrategy.mask} />
                <Stat label="Pseudonymize" value={result.stats.byStrategy.pseudonymize} />
                <Stat label="Generalize" value={result.stats.byStrategy.generalize} />
                <Stat label="Fake" value={result.stats.byStrategy.fake} />
                <Stat label="Preserve-format" value={result.stats.byStrategy["preserve-format"]} />
                <Stat label="Redact" value={result.stats.byStrategy.redact} />
              </div>
            </CardContent>
          </Card>

          {/* Masked preview (first 20 replacements) */}
          {result.masked.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Before / After (first 20)
                </h3>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {result.masked.slice(0, 20).map((m, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="outline" className="text-[9px] mr-2">{PII_TYPE_LABELS[m.type]}</Badge>
                      <span className="font-mono text-red-600 dark:text-red-400 line-through">{m.original}</span>
                      <span className="text-muted-foreground mx-2">→</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400">{m.replacement}</span>
                    </div>
                  ))}
                  {result.masked.length > 20 && (
                    <div className="text-[11px] text-muted-foreground text-center pt-1">
                      Showing first 20 of {result.masked.length.toLocaleString()} replacements.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Paste data above to anonymize"
          hint="Auto-detects CSV, JSON, or free text. Choose strategies per PII type. 100% client-side — your data never leaves the browser."
          icon={<EyeOff className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.format.toUpperCase()}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{h.totalPii} PII</Badge>
                  <span className="font-mono text-muted-foreground">seed: {h.seed}</span>
                  <span className="text-muted-foreground">{h.inputBytes.toLocaleString()}→{h.outputBytes.toLocaleString()} bytes</span>
                  <Badge variant="outline" className="text-[10px]">{h.defaultStrategy}</Badge>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> 100% client-side — no upload, no server, no telemetry. All masking runs locally via a seeded mulberry32 PRNG. History stores metadata only (timestamp, byte counts, strategies), never the actual data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value.toLocaleString()}</div>
    </div>
  );
}
