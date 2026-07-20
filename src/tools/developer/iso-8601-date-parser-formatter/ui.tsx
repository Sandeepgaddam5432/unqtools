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
  ISO_EXAMPLES,
  KIND_LABELS,
  detectKind,
  parseIso8601,
  validateIso8601,
  formatAll,
  formatDuration,
  formatInterval,
  formatRecurring,
  getComponents,
  explain,
  codeSnippets,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type IsoKind,
  type ParsedDate,
  type HistoryEntry,
} from "./logic";
import {
  History, CalendarClock, AlertTriangle, Info, Clock,
  Repeat, ArrowRight, Code2, ListChecks, Wand2,
} from "lucide-react";

type Tab = "parse" | "format" | "snippets";

export default function Iso8601ParserFormatter() {
  const [tab, setTab] = useState<Tab>("parse");
  const [input, setInput] = useState("2026-01-15T13:45:30+02:00");
  const [strict, setStrict] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // For "format" tab
  const [fmtYear, setFmtYear] = useState(2026);
  const [fmtMonth, setFmtMonth] = useState(1);
  const [fmtDay, setFmtDay] = useState(15);
  const [fmtHour, setFmtHour] = useState(13);
  const [fmtMinute, setFmtMinute] = useState(45);
  const [fmtSecond, setFmtSecond] = useState(30);
  const [fmtOffset, setFmtOffset] = useState(120); // minutes

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) {
        setInput(p.input);
        setStrict(p.strict);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(
    () => validateIso8601(input, { strict }),
    [input, strict],
  );
  const detectedKind = useMemo(() => detectKind(input), [input]);

  const allFormats = useMemo(() => {
    if (!validation.valid || !validation.parsed) return null;
    const p = validation.parsed;
    try {
      if (p.kind === "duration" && p.duration) return null;
      if (p.kind === "interval") return null;
      if (p.kind === "recurring") return null;
      return formatAll(p);
    } catch {
      return null;
    }
  }, [validation]);

  const components = useMemo(() => {
    if (!validation.valid || !validation.parsed) return null;
    if (validation.parsed.kind === "duration" ||
        validation.parsed.kind === "interval" ||
        validation.parsed.kind === "recurring") return null;
    return getComponents(validation.parsed);
  }, [validation]);

  const explanation = useMemo(() => {
    if (!validation.valid || !validation.parsed) return "";
    try { return explain(validation.parsed); } catch { return ""; }
  }, [validation]);

  const snippets = useMemo(() => {
    if (!validation.valid || !validation.parsed) return null;
    try { return codeSnippets(validation.parsed); } catch { return null; }
  }, [validation]);

  // Format tab: build ParsedDate from inputs
  const fmtParsed: ParsedDate = useMemo(() => ({
    kind: "datetime",
    year: fmtYear,
    month: fmtMonth,
    day: fmtDay,
    hour: fmtHour,
    minute: fmtMinute,
    second: fmtSecond,
    nanos: 0,
    offsetMinutes: fmtOffset,
    basic: false,
  }), [fmtYear, fmtMonth, fmtDay, fmtHour, fmtMinute, fmtSecond, fmtOffset]);

  const fmtAll = useMemo(() => {
    try { return formatAll(fmtParsed); } catch { return null; }
  }, [fmtParsed]);

  const handleSaveHistory = useCallback(() => {
    if (validation.valid) {
      saveHistory({
        ts: Date.now(),
        kind: detectedKind,
        strict,
        inputLength: input.length,
        preview: input.slice(0, 60),
      });
      setHistory(loadHistory());
    }
  }, [validation, detectedKind, strict, input]);

  const handleClear = useCallback(() => {
    setInput("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const fmtResultText = useMemo(() => {
    if (!validation.valid || !validation.parsed) return "";
    const p = validation.parsed;
    if (p.kind === "duration" && p.duration) return formatDuration(p.duration);
    if (p.kind === "interval" && p.start && p.end) {
      return formatInterval(p.start, p.end);
    }
    if (p.kind === "recurring" && p.start && p.duration) {
      return formatRecurring(p.count ?? 0, p.start, p.duration);
    }
    return allFormats?.dateTime ?? "";
  }, [validation, allFormats]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              {(["parse", "format", "snippets"] as Tab[]).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={tab === t ? "default" : "outline"}
                  onClick={() => setTab(t)}
                >
                  {t === "parse" ? "Parse" : t === "format" ? "Format" : "Code snippets"}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={strict}
                onChange={(e) => setStrict(e.target.checked)}
              />
              Strict mode
            </label>
          </div>

          {tab === "parse" && (
            <div className="space-y-2">
              <Label htmlFor="iso-input">ISO 8601 input</Label>
              <Textarea
                id="iso-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={"e.g. 2026-01-15T13:45:30+02:00, or P1Y2M10DT2H30M, or R5/2026-01-15/P1W"}
                className="min-h-[60px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-1">
                {ISO_EXAMPLES.slice(0, 12).map((ex) => (
                  <Button
                    key={ex.value}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] font-mono"
                    onClick={() => setInput(ex.value)}
                    title={ex.label}
                  >
                    + {ex.value}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {tab === "parse" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                <h3 className="text-sm font-semibold text-foreground">Result</h3>
                {validation.valid ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {KIND_LABELS[detectedKind as IsoKind]}
                  </Badge>
                ) : null}
              </div>
              {!validation.valid ? (
                <ErrorBanner message={validation.error ?? "Invalid ISO 8601"} />
              ) : (
                <>
                  <div className="rounded border bg-background p-3 text-xs font-mono break-all">
                    {fmtResultText}
                  </div>
                  {explanation && (
                    <div className="rounded border bg-muted/30 p-3 text-xs flex items-start gap-2">
                      <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{explanation}</span>
                    </div>
                  )}
                  {components && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {components.calendar && (
                        <CompCard label="Calendar" value={`${components.calendar.year}-${pad2(components.calendar.month)}-${pad2(components.calendar.day)}`} />
                      )}
                      {components.week && (
                        <CompCard label="Week date" value={`${components.week.weekYear}-W${pad2(components.week.week)}-${components.week.weekDay}`} />
                      )}
                      {components.ordinal && (
                        <CompCard label="Ordinal" value={`${components.ordinal.year}-${pad3(components.ordinal.ordinalDay)}`} />
                      )}
                      {components.time && (
                        <CompCard label="Time" value={`${pad2(components.time.hour)}:${pad2(components.time.minute)}:${pad2(components.time.second)}${components.time.nanos ? `.${String(components.time.nanos).padStart(9, "0").replace(/0+$/, "")}` : ""}`} />
                      )}
                      {components.offset && (
                        <CompCard label="Offset" value={components.offset.label} />
                      )}
                      {components.weekday && (
                        <CompCard label="Weekday" value={components.weekday} />
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {allFormats && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4" /> All ISO 8601 variants
                </h3>
                <div className="space-y-1">
                  <VariantRow label="Calendar (extended)" value={allFormats.calendar} onSave={handleSaveHistory} />
                  <VariantRow label="Calendar (basic)" value={allFormats.calendarBasic} onSave={handleSaveHistory} />
                  <VariantRow label="Week date" value={allFormats.week} onSave={handleSaveHistory} />
                  <VariantRow label="Ordinal date" value={allFormats.ordinal} onSave={handleSaveHistory} />
                  <VariantRow label="Date only" value={allFormats.dateOnly} onSave={handleSaveHistory} />
                  <VariantRow label="Time only" value={allFormats.time} onSave={handleSaveHistory} />
                  <VariantRow label="Datetime (UTC, Z)" value={allFormats.dateTimeUtc} onSave={handleSaveHistory} />
                  <VariantRow label="Datetime (basic)" value={allFormats.dateTimeBasic} onSave={handleSaveHistory} />
                </div>
              </CardContent>
            </Card>
          )}

          {validation.valid && validation.parsed?.kind === "duration" && validation.parsed.duration && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Duration breakdown
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {(["years", "months", "weeks", "days", "hours", "minutes", "seconds"] as const).map((k) => (
                    <CompCard key={k} label={k} value={String(validation.parsed!.duration![k])} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {validation.valid && validation.parsed?.kind === "interval" && validation.parsed.start && validation.parsed.end && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ArrowRight className="h-4 w-4" /> Interval
                </h3>
                <div className="rounded border bg-background p-3 text-xs font-mono break-all">
                  {formatInterval(validation.parsed.start, validation.parsed.end)}
                </div>
              </CardContent>
            </Card>
          )}

          {validation.valid && validation.parsed?.kind === "recurring" && validation.parsed.start && validation.parsed.duration && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Repeat className="h-4 w-4" /> Recurring interval
                </h3>
                <div className="rounded border bg-background p-3 text-xs font-mono break-all">
                  {formatRecurring(validation.parsed.count ?? 0, validation.parsed.start, validation.parsed.duration)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Repeats {validation.parsed.count === Infinity ? "unbounded" : `${validation.parsed.count}×`} every {formatDuration(validation.parsed.duration)}.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton
              getText={() => { handleSaveHistory(); return fmtResultText; }}
              label="Copy result"
              disabled={!validation.valid}
            />
            <DownloadButton
              getText={() => JSON.stringify(allFormats ?? { result: fmtResultText }, null, 2)}
              filename="iso-8601-result.json"
              mime="application/json"
              label="Download JSON"
              disabled={!validation.valid}
            />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input, strict); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      )}

      {tab === "format" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Wand2 className="h-4 w-4" /> Build an instant — format into all variants
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
              <NumField label="Year" value={fmtYear} onChange={setFmtYear} min={-99999} max={99999} />
              <NumField label="Month" value={fmtMonth} onChange={setFmtMonth} min={1} max={12} />
              <NumField label="Day" value={fmtDay} onChange={setFmtDay} min={1} max={31} />
              <NumField label="Hour" value={fmtHour} onChange={setFmtHour} min={0} max={24} />
              <NumField label="Minute" value={fmtMinute} onChange={setFmtMinute} min={0} max={59} />
              <NumField label="Second" value={fmtSecond} onChange={setFmtSecond} min={0} max={60} />
              <NumField label="Offset (min)" value={fmtOffset} onChange={setFmtOffset} min={-840} max={840} />
            </div>
            {fmtAll && (
              <div className="space-y-1 pt-2">
                <VariantRow label="Calendar (extended)" value={fmtAll.calendar} onSave={() => {}} />
                <VariantRow label="Calendar (basic)" value={fmtAll.calendarBasic} onSave={() => {}} />
                <VariantRow label="Week date" value={fmtAll.week} onSave={() => {}} />
                <VariantRow label="Ordinal date" value={fmtAll.ordinal} onSave={() => {}} />
                <VariantRow label="Date only" value={fmtAll.dateOnly} onSave={() => {}} />
                <VariantRow label="Time only" value={fmtAll.time} onSave={() => {}} />
                <VariantRow label="Datetime (UTC, Z)" value={fmtAll.dateTimeUtc} onSave={() => {}} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "snippets" && snippets && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Code2 className="h-4 w-4" /> Code snippets
            </h3>
            {(["js", "python", "java", "go"] as const).map((lang) => (
              <div key={lang} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] uppercase">{lang}</Badge>
                  <CopyButton getText={() => snippets[lang]} label="Copy" />
                </div>
                <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
                  {snippets[lang]}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === "snippets" && !snippets && (
        <EmptyState
          title="Enter a valid ISO 8601 string to generate code snippets"
          hint="Switch to the Parse tab and enter a valid ISO 8601 date, time, duration, interval, or recurring interval."
          icon={<Code2 className="h-8 w-8" />}
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
                <button
                  key={i}
                  onClick={() => { setInput(h.preview); setStrict(h.strict); setTab("parse"); }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{KIND_LABELS[h.kind]}</Badge>
                  {h.strict && <Badge variant="secondary" className="mr-2 text-[10px]">strict</Badge>}
                  <span className="font-mono text-foreground">{h.preview}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All parsing and formatting runs locally. History is stored in localStorage on this device only and contains metadata (kind, strict flag, input length), never your raw input.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function pad2(n: number): string {
  return String(Math.abs(n)).padStart(2, "0");
}
function pad3(n: number): string {
  return String(Math.abs(n)).padStart(3, "0");
}

function CompCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-mono text-foreground break-all">{value}</div>
    </div>
  );
}

function NumField({
  label, value, onChange, min, max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide">{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="h-8 text-xs font-mono"
      />
    </div>
  );
}

function VariantRow({
  label, value, onSave,
}: {
  label: string;
  value: string;
  onSave: () => void;
}) {
  if (!value) {
    return (
      <div className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs opacity-50">
        <span className="text-muted-foreground w-40 truncate">{label}</span>
        <span className="font-mono text-muted-foreground">—</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
      <span className="text-muted-foreground w-40 truncate">{label}</span>
      <span className="flex-1 font-mono text-foreground truncate">{value}</span>
      <CopyButton
        getText={() => { onSave(); return value; }}
        label=""
        size="icon"
      />
    </div>
  );
}
