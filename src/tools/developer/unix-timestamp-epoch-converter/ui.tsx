"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  UNITS,
  EPOCH_KINDS,
  UNIT_LABELS,
  UNIT_BADGE_COLOR,
  CODE_SNIPPETS,
  detectUnit,
  convert,
  dateToUnixNs,
  startOfDayMs,
  endOfDayMs,
  startOfMonthMs,
  endOfMonthMs,
  startOfYearMs,
  endOfYearMs,
  parseBatchInput,
  batchConvert,
  renderBatchCsv,
  renderBatchJson,
  check2038Overflow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Unit,
  type EpochKind,
  type HistoryEntry,
} from "./logic";
import { History, Clock, AlertTriangle, Calendar, Layers, Copy, Pause, Play } from "lucide-react";

type Mode = "single" | "batch" | "date";

export default function UnixTimestampEpochConverter() {
  const [mode, setMode] = useState<Mode>("single");
  const [input, setInput] = useState("");
  const [unit, setUnit] = useState<Unit | "auto">("auto");
  const [epoch, setEpoch] = useState<EpochKind>("unix");
  const [batchText, setBatchText] = useState("");
  const [dateYear, setDateYear] = useState(new Date().getUTCFullYear());
  const [dateMonth, setDateMonth] = useState(new Date().getUTCMonth() + 1);
  const [dateDay, setDateDay] = useState(new Date().getUTCDate());
  const [dateHour, setDateHour] = useState(0);
  const [dateMinute, setDateMinute] = useState(0);
  const [dateSecond, setDateSecond] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Live ticking current-epoch clock
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (paused) return;
    intervalRef.current = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) {
        setInput(p.input);
        setMode("single");
      }
      if (p.unit !== "auto") setUnit(p.unit);
      if (p.epoch !== "unix") setEpoch(p.epoch);
      if (p.input || p.unit !== "auto" || p.epoch !== "unix") toast.info("Loaded from share link");
    }
  }, []);

  // Single conversion
  const result = useMemo(() => {
    if (mode !== "single") return null;
    if (!input.trim()) return null;
    return convert(input, unit, epoch);
  }, [mode, input, unit, epoch]);

  // Batch conversion
  const batchInputs = useMemo(() => parseBatchInput(batchText), [batchText]);
  const batchResult = useMemo(
    () => (mode === "batch" && batchInputs.length > 0 ? batchConvert(batchInputs, unit, epoch) : null),
    [mode, batchInputs, unit, epoch],
  );

  // Date → timestamp
  const dateResult = useMemo(() => {
    if (mode !== "date") return null;
    try {
      const ns = dateToUnixNs({
        year: dateYear,
        month: dateMonth,
        day: dateDay,
        hour: dateHour,
        minute: dateMinute,
        second: dateSecond,
      });
      return ns;
    } catch {
      return null;
    }
  }, [mode, dateYear, dateMonth, dateDay, dateHour, dateMinute, dateSecond]);

  const handleSaveHistory = useCallback(() => {
    if (mode === "single" && result && result.ok) {
      saveHistory({
        ts: Date.now(),
        unit: result.unit,
        epoch: result.epoch,
        inputPreview: input.slice(0, 32),
        iso: result.iso,
      });
      setHistory(loadHistory());
    } else if (mode === "date" && dateResult !== null) {
      saveHistory({
        ts: Date.now(),
        unit: "ns",
        epoch: "unix",
        inputPreview: `${dateYear}-${String(dateMonth).padStart(2, "0")}-${String(dateDay).padStart(2, "0")} ${String(dateHour).padStart(2, "0")}:${String(dateMinute).padStart(2, "0")}:${String(dateSecond).padStart(2, "0")} UTC`,
        iso: new Date(Number(dateResult / BigInt(1_000_000))).toISOString(),
      });
      setHistory(loadHistory());
    } else if (mode === "batch" && batchResult && batchResult.valid > 0) {
      saveHistory({
        ts: Date.now(),
        unit: unit === "auto" ? "s" : unit,
        epoch,
        inputPreview: `${batchResult.valid}/${batchResult.total} rows`,
        iso: new Date().toISOString(),
      });
      setHistory(loadHistory());
    }
  }, [mode, result, input, dateResult, dateYear, dateMonth, dateDay, dateHour, dateMinute, dateSecond, batchResult, unit, epoch]);

  const handleClear = useCallback(() => {
    setInput("");
    setBatchText("");
    setUnit("auto");
    setEpoch("unix");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const detectedUnitForBadge = input && unit === "auto" ? detectUnit(input) : unit;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Live current-epoch clock */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Current Unix epoch
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setPaused((p) => !p)} className="gap-1.5">
              {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {paused ? "Resume" : "Pause"}
            </Button>
          </div>
          <div className="font-mono text-2xl sm:text-3xl text-foreground break-all">
            {Math.floor(nowMs / 1000)}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="text-[10px] font-mono">
              ms: {nowMs}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              μs: {nowMs * 1000}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              ns: {nowMs * 1_000_000}
            </Badge>
            <CopyButton
              getText={() => String(Math.floor(nowMs / 1000))}
              label="Copy seconds"
              size="sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Mode selector */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            {(["single", "batch", "date"] as Mode[]).map((m) => (
              <Button
                key={m}
                variant={mode === m ? "default" : "outline"}
                size="sm"
                onClick={() => setMode(m)}
              >
                {m === "single" && "Timestamp → date"}
                {m === "batch" && "Batch convert"}
                {m === "date" && "Date → timestamp"}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {mode === "single" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ts-input">Timestamp input</Label>
              <Input
                id="ts-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. 1736943900, 1736943900000, 5f5e8c2a..."
                className="font-mono text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Unit (auto-detect)</Label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Unit | "auto")}
                  className="mt-1 h-9 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="auto">Auto-detect</option>
                  {UNITS.map((u) => (
                    <option key={u.unit} value={u.unit}>{u.label}</option>
                  ))}
                </select>
                {detectedUnitForBadge !== "auto" && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Detected: <span className="font-mono">{UNIT_LABELS[detectedUnitForBadge]}</span>
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs">Epoch system</Label>
                <select
                  value={epoch}
                  onChange={(e) => setEpoch(e.target.value as EpochKind)}
                  className="mt-1 h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {EPOCH_KINDS.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {result && !result.ok && <ErrorBanner message={result.error} />}

            {result && result.ok && (
              <ConversionGrid
                r={result}
                input={input}
                onSaveHistory={handleSaveHistory}
                onClear={handleClear}
              />
            )}
          </CardContent>
        </Card>
      )}

      {mode === "batch" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="batch-input">Paste timestamps (one per line, comma/tab/semicolon-separated)</Label>
              <Textarea
                id="batch-input"
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={"1736943900\n1736943900000\n5f5e8c2a0000000000000000"}
                className="min-h-[120px] resize-y font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Unit (auto-detect)</Label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Unit | "auto")}
                  className="mt-1 h-9 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="auto">Auto-detect</option>
                  {UNITS.map((u) => (
                    <option key={u.unit} value={u.unit}>{u.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Epoch system</Label>
                <select
                  value={epoch}
                  onChange={(e) => setEpoch(e.target.value as EpochKind)}
                  className="mt-1 h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {EPOCH_KINDS.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {batchResult && (
              <BatchView
                result={batchResult}
                onSaveHistory={handleSaveHistory}
                onClear={handleClear}
              />
            )}
          </CardContent>
        </Card>
      )}

      {mode === "date" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <NumField label="Year" value={dateYear} onChange={setDateYear} />
              <NumField label="Month" value={dateMonth} onChange={setDateMonth} min={1} max={12} />
              <NumField label="Day" value={dateDay} onChange={setDateDay} min={1} max={31} />
              <NumField label="Hour" value={dateHour} onChange={setDateHour} min={0} max={23} />
              <NumField label="Min" value={dateMinute} onChange={setDateMinute} min={0} max={59} />
              <NumField label="Sec" value={dateSecond} onChange={setDateSecond} min={0} max={59} />
            </div>
            <p className="text-xs text-muted-foreground">
              All values are interpreted as UTC. Local timezone conversion is shown in the output.
            </p>
            {dateResult !== null && (
              <DateResultView
                ns={dateResult}
                onSaveHistory={handleSaveHistory}
                onClear={handleClear}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Period helpers */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Calendar className="h-4 w-4" /> Start / end-of-period helpers (UTC, ms)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <HelperCard label="start of today (UTC)" value={startOfDayMs(nowMs)} />
            <HelperCard label="end of today (UTC)" value={endOfDayMs(nowMs)} />
            <HelperCard label="start of this month" value={startOfMonthMs(nowMs)} />
            <HelperCard label="end of this month" value={endOfMonthMs(nowMs)} />
            <HelperCard label="start of this year" value={startOfYearMs(nowMs)} />
            <HelperCard label="end of this year" value={endOfYearMs(nowMs)} />
          </div>
        </CardContent>
      </Card>

      {/* Code snippets */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="h-4 w-4" /> Code snippets ({CODE_SNIPPETS.length} languages)
          </h3>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show snippets</summary>
            <div className="mt-2 space-y-2 max-h-[400px] overflow-auto">
              {CODE_SNIPPETS.map((s) => (
                <div key={s.language} className="rounded border bg-background p-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-[10px]">{s.language}</Badge>
                    <CopyButton getText={() => s.code} label="Copy" size="icon-sm" />
                  </div>
                  <pre className="mt-1 font-mono text-[11px] whitespace-pre-wrap text-foreground">{s.code}</pre>
                </div>
              ))}
            </div>
          </details>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{UNIT_LABELS[h.unit]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.epoch}</Badge>
                    <span className="font-mono text-foreground truncate max-w-[180px]">{h.inputPreview}</span>
                    <span className="text-muted-foreground ml-auto">{h.iso}</span>
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
            <strong className="text-foreground">Privacy:</strong> All conversions run locally with BigInt and Intl.DateTimeFormat. History is stored in localStorage on this device only and contains metadata (never your raw input beyond a 32-char preview).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ConversionGrid({
  r,
  input,
  onSaveHistory,
  onClear,
}: {
  r: Extract<ReturnType<typeof convert>, { ok: true }>;
  input: string;
  onSaveHistory: () => void;
  onClear: () => void;
}) {
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Unix seconds", value: r.seconds.toString(), mono: true },
    { label: "Unix milliseconds", value: r.millis.toString(), mono: true },
    { label: "Unix microseconds", value: r.micros.toString(), mono: true },
    { label: "Unix nanoseconds", value: r.nanos.toString(), mono: true },
    { label: "ISO 8601 (UTC)", value: r.iso, mono: true },
    { label: "RFC 2822", value: r.rfc2822, mono: true },
    { label: "UTC string", value: r.utc },
    { label: "Local (your timezone)", value: r.local },
    { label: "Local date", value: r.localeDate },
    { label: "Local time", value: r.localeTime },
    { label: "Weekday (UTC)", value: r.weekday },
    { label: "Weekday (local)", value: r.weekdayLocal },
    { label: "Relative", value: r.relative },
  ];
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">Unit: {UNIT_LABELS[r.unit]}</Badge>
        <Badge variant="outline" className="text-[10px]">Epoch: {r.epoch}</Badge>
        {r.overflow2038 && (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <AlertTriangle className="h-3 w-3" /> 2038 overflow
          </Badge>
        )}
      </div>
      {r.overflow2038 && (
        <ErrorBanner message={check2038Overflow(r.seconds).message ?? "Overflow warning"} />
      )}
      <div className="space-y-1 max-h-[400px] overflow-auto">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
            <span className="text-muted-foreground w-32 flex-shrink-0">{row.label}</span>
            <span className={`flex-1 text-foreground truncate ${row.mono ? "font-mono" : ""}`}>{row.value}</span>
            <CopyButton getText={() => row.value} label="" size="icon-sm" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pt-2">
        <CopyButton
          getText={() => {
            onSaveHistory();
            return r.iso;
          }}
          label="Copy ISO"
        />
        <DownloadButton
          getText={() => JSON.stringify({
            input,
            unit: r.unit,
            epoch: r.epoch,
            seconds: r.seconds.toString(),
            millis: r.millis.toString(),
            micros: r.micros.toString(),
            nanos: r.nanos.toString(),
            iso: r.iso,
            rfc2822: r.rfc2822,
            utc: r.utc,
            local: r.local,
            relative: r.relative,
          }, null, 2)}
          filename="timestamp-conversion.json"
          mime="application/json"
          label="Download JSON"
        />
        <ShareButton getUrl={() => { onSaveHistory(); return buildShareUrl(input, r.unit, r.epoch); }} />
        <ClearButton onClick={onClear} />
      </div>
    </div>
  );
}

function BatchView({
  result,
  onSaveHistory,
  onClear,
}: {
  result: ReturnType<typeof batchConvert>;
  onSaveHistory: () => void;
  onClear: () => void;
}) {
  const csv = useMemo(() => renderBatchCsv(result), [result]);
  const json = useMemo(() => renderBatchJson(result), [result]);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Total" value={result.total} />
        <Stat label="Valid" value={result.valid} highlight="good" />
        <Stat label="Invalid" value={result.invalid} highlight={result.invalid > 0 ? "bad" : undefined} />
      </div>
      <div className="space-y-1 max-h-[400px] overflow-auto rounded border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/50 backdrop-blur">
            <tr className="text-left">
              <th className="p-2">Input</th>
              <th className="p-2">Unit</th>
              <th className="p-2">ISO 8601</th>
              <th className="p-2">Relative</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.slice(0, 500).map((row, i) => (
              <tr key={i} className="border-t">
                <td className="p-2 font-mono text-foreground truncate max-w-[160px]">{row.input}</td>
                <td className="p-2">{row.ok ? <Badge variant="outline" className="text-[10px]">{row.unit}</Badge> : "—"}</td>
                <td className={`p-2 font-mono ${row.ok ? "text-foreground" : "text-destructive"} truncate max-w-[200px]`}>
                  {row.ok ? row.iso : row.error}
                </td>
                <td className="p-2 text-muted-foreground">{row.ok ? row.relative : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.rows.length > 500 && (
        <p className="text-[10px] text-muted-foreground">
          Showing first 500 of {result.rows.length} rows. Export for full data.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <CopyButton getText={() => { onSaveHistory(); return csv; }} label="Copy CSV" />
        <DownloadButton
          getText={() => csv}
          filename="timestamps-converted.csv"
          mime="text/csv"
          label="Download CSV"
        />
        <DownloadButton
          getText={() => json}
          filename="timestamps-converted.json"
          mime="application/json"
          label="Download JSON"
        />
        <ClearButton onClick={onClear} />
      </div>
    </div>
  );
}

function DateResultView({
  ns,
  onSaveHistory,
  onClear,
}: {
  ns: bigint;
  onSaveHistory: () => void;
  onClear: () => void;
}) {
  const ms = Number(ns / BigInt(1_000_000));
  const date = new Date(ms);
  const iso = date.toISOString();
  const seconds = (ns / BigInt(1_000_000_000)).toString();
  const millis = (ns / BigInt(1_000_000)).toString();
  const micros = (ns / BigInt(1_000)).toString();
  const nanos = ns.toString();
  return (
    <div className="space-y-2">
      <div className="rounded border bg-background p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">ISO 8601</div>
        <div className="font-mono text-sm text-foreground break-all">{iso}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <CopyRow label="Seconds" value={seconds} />
        <CopyRow label="Milliseconds" value={millis} />
        <CopyRow label="Microseconds" value={micros} />
        <CopyRow label="Nanoseconds" value={nanos} />
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton getText={() => { onSaveHistory(); return seconds; }} label="Copy seconds" />
        <CopyButton getText={() => millis} label="Copy ms" />
        <ShareButton getUrl={() => { onSaveHistory(); return buildShareUrl(seconds, "s", "unix"); }} />
        <ClearButton onClick={onClear} />
      </div>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded border bg-background px-3 py-1.5">
      <span className="text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <span className="flex-1 font-mono text-foreground truncate">{value}</span>
      <CopyButton getText={() => value} label="" size="icon-sm" />
    </div>
  );
}

function HelperCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-foreground break-all">{value}</div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <Label className="text-[10px]">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 h-9 font-mono text-xs"
      />
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
