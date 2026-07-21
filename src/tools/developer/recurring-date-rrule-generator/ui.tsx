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
  FREQS,
  WEEKDAYS,
  COMMON_PRESETS,
  parseFullRule,
  parseFullRuleSafe,
  serializeFullRule,
  serializeRRule,
  validateRRule,
  generateOccurrences,
  toHumanReadable,
  generateIcs,
  generateCodeSnippet,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  defaultParsedRule,
  type ParsedRule,
  type Freq,
  type Weekday,
  type ByDayEntry,
  type CodeLang,
  type HistoryEntry,
} from "./logic";
import {
  History, Repeat, AlertTriangle, Info, Code2,
  Calendar, ListChecks, Wand2,
} from "lucide-react";

type Tab = "build" | "parse" | "snippets";

export default function RecurringDateRruleGenerator() {
  const [tab, setTab] = useState<Tab>("build");
  const [rawInput, setRawInput] = useState<string>("");
  const [freq, setFreq] = useState<Freq>("WEEKLY");
  const [interval, setInterval] = useState<number>(1);
  const [count, setCount] = useState<number | "">("");
  const [until, setUntil] = useState<string>("");
  const [dtStart, setDtStart] = useState<string>(new Date().toISOString().slice(0, 10));
  const [byDay, setByDay] = useState<Weekday[]>(["MO"]);
  const [byMonth, setByMonth] = useState<string>("");
  const [byMonthDay, setByMonthDay] = useState<string>("");
  const [bySetPos, setBySetPos] = useState<string>("");
  const [byDayOrdinals, setByDayOrdinals] = useState<string>(""); // comma-separated ordinals like "1,-1"
  const [wkst, setWkst] = useState<Weekday>("MO");
  const [exDatesText, setExDatesText] = useState<string>("");
  const [rDatesText, setRDatesText] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [limit, setLimit] = useState<number>(20);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const r = parseShareUrl(window.location.hash);
      if (r.ok && r.value) {
        applyParsed(r.value);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // Build the ParsedRule from the form state.
  const parsed: ParsedRule = useMemo(() => {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dtStart);
    const rrule = {
      freq,
      interval: interval > 1 ? interval : undefined,
      count: count === "" ? undefined : Number(count),
      until: until || undefined,
      byDay: byDay.length > 0
        ? byDay.map((w) => {
            // Parse ordinals from byDayOrdinals (1 per weekday, in order).
            const ordList = byDayOrdinals.split(",").map((s) => s.trim()).filter(Boolean);
            const idx = byDay.indexOf(w);
            const ord = ordList[idx] ? Number(ordList[idx]) : undefined;
            return { weekday: w, ordinal: ord && !isNaN(ord) ? ord : undefined } as ByDayEntry;
          })
        : undefined,
      byMonth: byMonth ? byMonth.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n >= 1 && n <= 12) : undefined,
      byMonthDay: byMonthDay ? byMonthDay.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n !== 0) : undefined,
      bySetPos: bySetPos ? bySetPos.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n !== 0) : undefined,
      wkst: wkst !== "MO" ? wkst : undefined,
    };
    const exDates = exDatesText.split(/\n/).map((s) => s.trim()).filter(Boolean);
    const rDates = rDatesText.split(/\n/).map((s) => s.trim()).filter(Boolean);
    return {
      dtStart: dtStart ? { value: dtStart, isDateOnly } : undefined,
      rrule: rrule as ParsedRule["rrule"],
      exDates: exDates.length > 0 ? exDates : undefined,
      rDates: rDates.length > 0 ? rDates : undefined,
    };
  }, [freq, interval, count, until, dtStart, byDay, byMonth, byMonthDay, bySetPos, byDayOrdinals, wkst, exDatesText, rDatesText]);

  const validation = useMemo(() => validateRRule(parsed), [parsed]);

  const rruleString = useMemo(() => serializeRRule(parsed.rrule), [parsed]);
  const fullString = useMemo(() => serializeFullRule(parsed), [parsed]);

  const occurrences = useMemo(() => {
    if (!validation.valid) return [];
    return generateOccurrences(parsed, { limit: Math.max(limit, 1) });
  }, [parsed, validation, limit]);

  const description = useMemo(() => {
    if (!validation.valid) return "";
    try {
      return toHumanReadable(parsed);
    } catch {
      return "";
    }
  }, [parsed, validation]);

  const icsOut = useMemo(() => {
    if (!validation.valid) return "";
    return generateIcs(parsed, { summary: summary || "Recurring event" });
  }, [parsed, validation, summary]);

  const snippets = useMemo(() => ({
    rrulejs: generateCodeSnippet(parsed, "rrulejs"),
    python: generateCodeSnippet(parsed, "python"),
    javascript: generateCodeSnippet(parsed, "javascript"),
    go: generateCodeSnippet(parsed, "go"),
  }), [parsed]);

  const applyParsed = useCallback((p: ParsedRule) => {
    if (p.dtStart) setDtStart(p.dtStart.value.slice(0, 10));
    setFreq(p.rrule.freq);
    setInterval(p.rrule.interval ?? 1);
    setCount(p.rrule.count ?? "");
    setUntil(p.rrule.until ? p.rrule.until.slice(0, 10) : "");
    setByDay(p.rrule.byDay?.map((e) => e.weekday) ?? []);
    setByDayOrdinals(p.rrule.byDay?.map((e) => e.ordinal?.toString() ?? "").join(",") ?? "");
    setByMonth(p.rrule.byMonth?.join(",") ?? "");
    setByMonthDay(p.rrule.byMonthDay?.join(",") ?? "");
    setBySetPos(p.rrule.bySetPos?.join(",") ?? "");
    setWkst(p.rrule.wkst ?? "MO");
    setExDatesText(p.exDates?.join("\n") ?? "");
    setRDatesText(p.rDates?.join("\n") ?? "");
  }, []);

  const handleParseRaw = useCallback(() => {
    const r = parseFullRuleSafe(rawInput);
    if (!r.ok || !r.value) {
      toast.error(r.error ?? "Parse error");
      return;
    }
    applyParsed(r.value);
    toast.success("RRULE parsed — form populated");
  }, [rawInput, applyParsed]);

  const handleSaveHistory = useCallback(() => {
    if (validation.valid) {
      saveHistory({
        ts: Date.now(),
        freq: parsed.rrule.freq,
        interval: parsed.rrule.interval ?? 1,
        hasCount: parsed.rrule.count !== undefined,
        hasUntil: parsed.rrule.until !== undefined,
        preview: rruleString,
      });
      setHistory(loadHistory());
      toast.success("Saved to history");
    }
  }, [validation, parsed, rruleString]);

  const handleClear = useCallback(() => {
    const d = defaultParsedRule();
    applyParsed(d);
    setRawInput("");
    setSummary("");
    toast.info("Cleared");
  }, [applyParsed]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const applyPreset = (preset: string) => {
    try {
      const p = parseFullRule(preset);
      applyParsed(p);
      toast.success("Preset applied");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid preset");
    }
  };

  const toggleWeekday = (w: Weekday) => {
    setByDay((prev) => prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]);
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-2">
              {(["build", "parse", "snippets"] as Tab[]).map((t) => (
                <Button key={t} size="sm" variant={tab === t ? "default" : "outline"}
                  onClick={() => setTab(t)}>
                  {t === "build" ? "Build" : t === "parse" ? "Parse" : "Code snippets"}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {COMMON_PRESETS.slice(0, 6).map((p) => (
                <Button key={p.label} variant="ghost" size="sm" className="h-6 text-[11px]"
                  onClick={() => applyPreset(p.rrule)} title={p.rrule}>
                  + {p.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {tab === "build" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              <h3 className="text-sm font-semibold text-foreground">RRULE Builder</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Frequency">
                <select className={selectCls} value={freq}
                  onChange={(e) => setFreq(e.target.value as Freq)}>
                  {FREQS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </Field>
              <Field label="Interval">
                <Input type="number" min={1} value={interval}
                  onChange={(e) => setInterval(Number(e.target.value) || 1)} className="h-9" />
              </Field>
              <Field label="Count (optional)">
                <Input type="number" min={1} value={count}
                  onChange={(e) => setCount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g. 10" className="h-9" />
              </Field>
              <Field label="Until (optional)">
                <Input type="date" value={until}
                  onChange={(e) => setUntil(e.target.value)} className="h-9" />
              </Field>
              <Field label="DTSTART">
                <Input type="date" value={dtStart}
                  onChange={(e) => setDtStart(e.target.value)} className="h-9" />
              </Field>
              <Field label="WKST (week start)">
                <select className={selectCls} value={wkst}
                  onChange={(e) => setWkst(e.target.value as Weekday)}>
                  {WEEKDAYS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
              </Field>
              <Field label="BYMONTH (e.g. 1,7)">
                <Input type="text" value={byMonth}
                  onChange={(e) => setByMonth(e.target.value)}
                  placeholder="1,7" className="h-9" />
              </Field>
              <Field label="BYMONTHDAY (e.g. 15,-1)">
                <Input type="text" value={byMonthDay}
                  onChange={(e) => setByMonthDay(e.target.value)}
                  placeholder="15" className="h-9" />
              </Field>
              <Field label="BYSETPOS (e.g. -1)">
                <Input type="text" value={bySetPos}
                  onChange={(e) => setBySetPos(e.target.value)}
                  placeholder="-1" className="h-9" />
              </Field>
              <Field label="BYDAY ordinals (e.g. 1,-1)">
                <Input type="text" value={byDayOrdinals}
                  onChange={(e) => setByDayOrdinals(e.target.value)}
                  placeholder="1 or -1 (one per weekday, comma-sep)" className="h-9" />
              </Field>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">BYDAY (weekdays)</Label>
              <div className="flex flex-wrap gap-1">
                {WEEKDAYS.map((w) => (
                  <Button key={w.value} size="sm"
                    variant={byDay.includes(w.value) ? "default" : "outline"}
                    onClick={() => toggleWeekday(w.value)} className="h-7 text-[11px]">
                    {w.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="EXDATE (one date per line, YYYY-MM-DD)">
                <Textarea value={exDatesText}
                  onChange={(e) => setExDatesText(e.target.value)}
                  placeholder={"2026-01-15\n2026-02-19"}
                  className="min-h-[60px] resize-y font-mono text-xs" />
              </Field>
              <Field label="RDATE (one date per line, YYYY-MM-DD)">
                <Textarea value={rDatesText}
                  onChange={(e) => setRDatesText(e.target.value)}
                  placeholder={"2026-07-04"}
                  className="min-h-[60px] resize-y font-mono text-xs" />
              </Field>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "parse" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              <h3 className="text-sm font-semibold text-foreground">Paste RRULE → populate form</h3>
            </div>
            <Textarea value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={"DTSTART;VALUE=DATE:20260101\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=10\n\nor just:\nFREQ=MONTHLY;BYDAY=-1FR"}
              className="min-h-[120px] resize-y font-mono text-xs" />
            <Button onClick={handleParseRaw} disabled={!rawInput.trim()} size="sm">
              Parse &amp; populate form
            </Button>
            {COMMON_PRESETS.map((p) => (
              <Button key={p.label} variant="ghost" size="sm" className="h-6 text-[11px] mr-1"
                onClick={() => { setRawInput(p.rrule); }}>
                {p.label}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === "snippets" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              <h3 className="text-sm font-semibold text-foreground">Code snippets</h3>
            </div>
            {(["rrulejs", "python", "javascript", "go"] as CodeLang[]).map((lang) => (
              <div key={lang} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase">{lang}</Label>
                  <CopyButton getText={() => snippets[lang]} label="Copy" size="sm" />
                </div>
                <pre className="rounded-md border border-input bg-muted/40 p-3 text-xs font-mono overflow-x-auto">
                  {snippets[lang]}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSaveHistory} disabled={!validation.valid} size="sm" className="gap-1.5">
              <History className="h-3.5 w-3.5" /> Save
            </Button>
            <CopyButton getText={() => rruleString} label="Copy RRULE" disabled={!validation.valid} />
            <CopyButton getText={() => fullString} label="Copy full" disabled={!validation.valid} />
            <CopyButton getText={() => description} label="Copy summary" disabled={!validation.valid} />
            <DownloadButton
              getText={() => icsOut}
              filename="recurring.ics"
              mime="text/calendar"
              disabled={!validation.valid}
              label="Download .ics"
            />
            <ShareButton getUrl={() => buildShareUrl(parsed)} disabled={!validation.valid} />
            <ClearButton onClick={handleClear} />
          </div>

          {!validation.valid && (
            <ErrorBanner message={validation.error ?? "Invalid RRULE"} />
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Generated RRULE</Label>
            <pre className="rounded-md border border-input bg-muted/40 p-3 text-xs font-mono overflow-x-auto">
              {rruleString}
            </pre>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Plain-English summary</Label>
            <p className="text-sm text-foreground min-h-[24px]">
              {description || <span className="text-muted-foreground">—</span>}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Next occurrences</Label>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Limit:</Label>
                <Input type="number" min={1} max={500} value={limit}
                  onChange={(e) => setLimit(Number(e.target.value) || 20)}
                  className="h-7 w-20" />
                <Badge variant="secondary" className="text-[10px]">{occurrences.length} shown</Badge>
              </div>
            </div>
            {occurrences.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1 max-h-[300px] overflow-y-auto">
                {occurrences.map((iso, i) => (
                  <div key={i} className="text-xs font-mono px-2 py-1 rounded border border-input bg-muted/40">
                    {iso}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No occurrences" hint="Adjust the rule or check for errors."
                icon={<AlertTriangle className="h-6 w-6" />} />
            )}
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <h3 className="text-sm font-semibold text-foreground">History (last 20)</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-xs px-2 py-1 rounded hover:bg-muted">
                  <span className="font-mono truncate">
                    {new Date(h.ts).toLocaleString()} — {h.preview}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px]"
                    onClick={() => {
                      try {
                        const p = parseFullRule(h.preview);
                        applyParsed(p);
                        toast.info("Restored from history");
                      } catch {
                        toast.error("Could not restore");
                      }
                    }}>
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const selectCls = "w-full h-9 rounded-md border border-input bg-background px-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
