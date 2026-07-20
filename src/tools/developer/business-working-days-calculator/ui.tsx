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
  WEEKEND_PRESETS,
  COUNTRY_HOLIDAY_PRESETS,
  DEFAULT_WEEKEND_DAYS,
  parseHolidaysText,
  countBusinessDays,
  addBusinessDays,
  parseBatchRanges,
  computeBatch,
  renderBatchCsv,
  loadHolidaySets,
  saveHolidaySet,
  deleteHolidaySet,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  renderCountText,
  renderAddText,
  applyHalfDays,
  type CountResult,
  type AddResult,
  type HolidaySet,
  type HistoryEntry,
  type HalfDayType,
} from "./logic";
import {
  History, Briefcase, CalendarDays, Plus, Minus, ListChecks,
  Save, Trash2, Calendar,
} from "lucide-react";

type Tab = "count" | "add" | "batch";
type WeekendPreset = string;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BusinessWorkingDaysCalculator() {
  const today = new Date();
  const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

  const [tab, setTab] = useState<Tab>("count");
  const [start, setStart] = useState<string>(todayStr);
  const [end, setEnd] = useState<string>(todayStr);
  const [days, setDays] = useState<number>(10);
  const [weekendPresetId, setWeekendPresetId] = useState<WeekendPreset>("sat-sun");
  const [customWeekend, setCustomWeekend] = useState<number[]>([...DEFAULT_WEEKEND_DAYS]);
  const [useCustomWeekend, setUseCustomWeekend] = useState<boolean>(false);
  const [holidaysText, setHolidaysText] = useState<string>("");
  const [includeEnd, setIncludeEnd] = useState<boolean>(true);
  const [includeStart, setIncludeStart] = useState<boolean>(true);
  const [startHalf, setStartHalf] = useState<HalfDayType>("none");
  const [endHalf, setEndHalf] = useState<HalfDayType>("none");
  const [batchText, setBatchText] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [holidaySets, setHolidaySets] = useState<HolidaySet[]>([]);
  const [newSetName, setNewSetName] = useState<string>("");

  useEffect(() => {
    setHistory(loadHistory());
    setHolidaySets(loadHolidaySets());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p) {
        if (p.mode) setTab(p.mode);
        if (p.start) setStart(p.start);
        if (p.end) setEnd(p.end);
        if (typeof p.days === "number") setDays(p.days);
        if (p.weekendDays && p.weekendDays.length > 0) {
          setCustomWeekend(p.weekendDays);
          setUseCustomWeekend(true);
          setWeekendPresetId("");
        }
        if (p.holidays && p.holidays.length > 0) {
          setHolidaysText(p.holidays.join("\n"));
        }
        if (typeof p.includeEnd === "boolean") setIncludeEnd(p.includeEnd);
        if (typeof p.includeStart === "boolean") setIncludeStart(p.includeStart);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const holidays = useMemo(() => parseHolidaysText(holidaysText), [holidaysText]);

  const weekendDays = useMemo(() => {
    if (useCustomWeekend) return customWeekend;
    const preset = WEEKEND_PRESETS.find((p) => p.id === weekendPresetId);
    return preset ? [...preset.days] : [...DEFAULT_WEEKEND_DAYS];
  }, [useCustomWeekend, customWeekend, weekendPresetId]);

  const countResult: CountResult | null = useMemo(() => {
    if (tab !== "count" || !start || !end) return null;
    return countBusinessDays({
      start, end, weekendDays, holidays, includeEnd, includeStart,
    });
  }, [tab, start, end, weekendDays, holidays, includeEnd, includeStart]);

  const addResult: AddResult | null = useMemo(() => {
    if (tab !== "add" || !start) return null;
    return addBusinessDays({ start, days, weekendDays, holidays });
  }, [tab, start, days, weekendDays, holidays]);

  const batchResult = useMemo(() => {
    if (tab !== "batch") return null;
    const rows = parseBatchRanges(batchText);
    if (rows.length === 0) return null;
    return computeBatch(rows, { weekendDays, holidays, includeEnd, includeStart });
  }, [tab, batchText, weekendDays, holidays, includeEnd, includeStart]);

  const decimalDays = useMemo(() => {
    if (!countResult) return null;
    return applyHalfDays(countResult, {
      startHalf, endHalf, weekendDays, holidays, start, end,
    });
  }, [countResult, startHalf, endHalf, weekendDays, holidays, start, end]);

  const handleSaveHistory = useCallback(() => {
    if (tab === "count" && countResult) {
      saveHistory({
        ts: Date.now(),
        mode: "count",
        summary: `${start} → ${end}: ${countResult.businessDays} biz days`,
        businessDays: countResult.businessDays,
      });
    } else if (tab === "add" && addResult) {
      saveHistory({
        ts: Date.now(),
        mode: "add",
        summary: `${start} ${days >= 0 ? "+" : ""}${days} biz days → ${addResult.resultDate}`,
        businessDays: Math.abs(days),
      });
    }
    setHistory(loadHistory());
  }, [tab, countResult, addResult, start, end, days]);

  const handleSaveHolidaySet = useCallback(() => {
    if (!newSetName.trim()) {
      toast.error("Enter a name for the holiday set");
      return;
    }
    if (holidays.length === 0) {
      toast.error("Add some holidays first");
      return;
    }
    const next = saveHolidaySet(newSetName, holidays);
    setHolidaySets(next);
    setNewSetName("");
    toast.success(`Saved "${next[0].name}" with ${next[0].holidays.length} holidays`);
  }, [newSetName, holidays]);

  const handleDeleteHolidaySet = useCallback((id: string) => {
    const next = deleteHolidaySet(id);
    setHolidaySets(next);
    toast.info("Holiday set deleted");
  }, []);

  const handleLoadCountryPreset = useCallback((id: string) => {
    const preset = COUNTRY_HOLIDAY_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    const existing = parseHolidaysText(holidaysText);
    const merged = Array.from(new Set([...existing, ...preset.holidays])).sort();
    setHolidaysText(merged.join("\n"));
    toast.success(`Added ${preset.holidays.length} holidays from ${preset.label}`);
  }, [holidaysText]);

  const handleLoadHolidaySet = useCallback((id: string) => {
    const set = holidaySets.find((s) => s.id === id);
    if (!set) return;
    setHolidaysText(set.holidays.join("\n"));
    toast.success(`Loaded "${set.name}"`);
  }, [holidaySets]);

  const handleClear = useCallback(() => {
    setStart(todayStr);
    setEnd(todayStr);
    setDays(10);
    setHolidaysText("");
    setBatchText("");
    setStartHalf("none");
    setEndHalf("none");
    toast.info("Cleared");
  }, [todayStr]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const toggleCustomWeekendDay = (day: number) => {
    setUseCustomWeekend(true);
    setWeekendPresetId("");
    setCustomWeekend((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Tab selector */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={tab === "count" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("count")}
              className="gap-1.5"
            >
              <CalendarDays className="h-3.5 w-3.5" /> Count between dates
            </Button>
            <Button
              variant={tab === "add" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("add")}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add / subtract days
            </Button>
            <Button
              variant={tab === "batch" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("batch")}
              className="gap-1.5"
            >
              <ListChecks className="h-3.5 w-3.5" /> Batch ranges
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration card (shared across tabs) */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bwdc-start">Start date</Label>
              <Input
                id="bwdc-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            {tab !== "add" ? (
              <div className="space-y-1.5">
                <Label htmlFor="bwdc-end">End date</Label>
                <Input
                  id="bwdc-end"
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="bwdc-days">Business days (±)</Label>
                <Input
                  id="bwdc-days"
                  type="number"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="font-mono text-xs"
                />
              </div>
            )}
          </div>

          {tab === "count" && (
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeStart}
                  onChange={(e) => setIncludeStart(e.target.checked)}
                />
                Include start day
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeEnd}
                  onChange={(e) => setIncludeEnd(e.target.checked)}
                />
                Include end day
              </label>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Weekend pattern</Label>
            <select
              value={weekendPresetId}
              onChange={(e) => {
                setUseCustomWeekend(false);
                setWeekendPresetId(e.target.value);
                const preset = WEEKEND_PRESETS.find((p) => p.id === e.target.value);
                if (preset) setCustomWeekend([...preset.days]);
              }}
              className="h-8 text-xs rounded border bg-background px-2 w-full sm:w-auto"
            >
              {WEEKEND_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
              {useCustomWeekend && <option value="">Custom (see below)</option>}
            </select>
            <div className="flex flex-wrap gap-1 pt-1">
              {WEEKDAY_LABELS.map((lbl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleCustomWeekendDay(idx)}
                  className={`h-7 w-12 rounded text-[11px] border ${
                    customWeekend.includes(idx)
                      ? "bg-destructive/20 border-destructive text-destructive font-medium"
                      : "bg-background border-border text-muted-foreground"
                  }`}
                  title={`Mark ${lbl} as weekend`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {useCustomWeekend && (
              <p className="text-[10px] text-muted-foreground">
                Custom weekend: {customWeekend.map((d) => WEEKDAY_LABELS[d]).join(", ") || "(none)"}
              </p>
            )}
          </div>

          {tab === "count" && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <Label className="text-[10px]">Start half-day</Label>
                <select
                  value={startHalf}
                  onChange={(e) => setStartHalf(e.target.value as HalfDayType)}
                  className="h-8 text-xs rounded border bg-background px-2 w-full"
                >
                  <option value="none">None (full day)</option>
                  <option value="start-am">Morning only (PM off)</option>
                  <option value="start-pm">Afternoon only (AM off)</option>
                </select>
              </div>
              <div>
                <Label className="text-[10px]">End half-day</Label>
                <select
                  value={endHalf}
                  onChange={(e) => setEndHalf(e.target.value as HalfDayType)}
                  className="h-8 text-xs rounded border bg-background px-2 w-full"
                >
                  <option value="none">None (full day)</option>
                  <option value="end-am">Morning only (PM off)</option>
                  <option value="end-pm">Afternoon only (AM off)</option>
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="bwdc-holidays">Holidays (one per line — YYYY-MM-DD or M/D/YYYY)</Label>
            <Textarea
              id="bwdc-holidays"
              value={holidaysText}
              onChange={(e) => setHolidaysText(e.target.value)}
              placeholder={"2025-01-01\n2025-12-25\n7/4/2025"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1 items-center">
              <span className="text-[10px] text-muted-foreground mr-1">Country presets:</span>
              {COUNTRY_HOLIDAY_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handleLoadCountryPreset(p.id)}
                >+ {p.label}</Button>
              ))}
            </div>
          </div>

          {tab === "batch" && (
            <div className="space-y-1.5">
              <Label htmlFor="bwdc-batch">Batch ranges (one per line: <code>YYYY-MM-DD YYYY-MM-DD</code>)</Label>
              <Textarea
                id="bwdc-batch"
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={"2025-01-13 2025-01-17\n2025-02-10 to 2025-02-14\n2025-03-03..2025-03-07"}
                className="min-h-[100px] resize-y font-mono text-xs"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results card */}
      {tab === "count" && countResult && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> Count result
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <Stat label="Business days" value={countResult.businessDays} highlight="good" />
              <Stat label="Total calendar days" value={countResult.totalDays} />
              <Stat label="Weekend days" value={countResult.weekendDays} highlight="bad" />
              <Stat label="Holiday days" value={countResult.holidays} highlight="bad" />
              <Stat label="Holidays on weekend" value={countResult.holidaysOnWeekend} />
              <Stat
                label="With half-days"
                value={decimalDays !== null ? decimalDays.toFixed(1) : "-"}
                highlight="good"
              />
            </div>
            {countResult.reversed && (
              <Badge variant="outline" className="text-[10px]">Reversed (end before start)</Badge>
            )}
            <p className="text-xs text-muted-foreground">{countResult.summary}</p>
            {countResult.breakdown.length > 0 && countResult.breakdown.length <= 31 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Day-by-day breakdown ({countResult.breakdown.length} days)
                </summary>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[300px] overflow-auto">
                  {countResult.breakdown.map((d) => (
                    <div key={d.date} className="rounded border bg-background px-2 py-1 flex items-center gap-2">
                      <span className="font-mono text-[10px]">{d.date}</span>
                      <span className="text-[10px] text-muted-foreground">{d.weekday}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ml-auto ${
                          d.type === "business" ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                          : d.type === "weekend" ? "border-red-500 text-red-700 dark:text-red-400"
                          : d.type === "holiday" ? "border-amber-500 text-amber-700 dark:text-amber-400"
                          : "border-orange-500 text-orange-700 dark:text-orange-400"
                        }`}
                      >
                        {d.type === "business" ? "✓ work"
                          : d.type === "weekend" ? "✗ wknd"
                          : d.type === "holiday" ? "H hol"
                          : "H✗ hol/wknd"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </details>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <CopyButton
                getText={() => { handleSaveHistory(); return renderCountText(countResult); }}
                label="Copy result"
              />
              <DownloadButton
                getText={() => renderCountText(countResult)}
                filename="business-days-count.txt"
                mime="text/plain"
                label="Download .txt"
              />
              <ShareButton
                getUrl={() => {
                  handleSaveHistory();
                  return buildShareUrl({
                    mode: "count", start, end, days: 0,
                    weekendDays, holidays, includeEnd, includeStart,
                  });
                }}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "add" && addResult && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              {days >= 0 ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              {days >= 0 ? "Add" : "Subtract"} result
            </h3>
            {addResult.resultDate ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <Stat label="Result date" value={addResult.resultDate} highlight="good" />
                  <Stat label="Weekday" value={addResult.weekday} />
                  <Stat label="Business days moved" value={addResult.businessDaysMoved} />
                  <Stat label="Weekends skipped" value={addResult.weekendDaysSkipped} highlight="bad" />
                  <Stat label="Holidays skipped" value={addResult.holidaysSkipped} highlight="bad" />
                  <Stat label="Calendar day delta" value={addResult.calendarDaysDelta} />
                </div>
                <p className="text-xs text-muted-foreground">{addResult.summary}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return renderAddText(addResult); }}
                    label="Copy result"
                  />
                  <DownloadButton
                    getText={() => renderAddText(addResult)}
                    filename="business-days-add.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <ShareButton
                    getUrl={() => {
                      handleSaveHistory();
                      return buildShareUrl({
                        mode: "add", start, end: "", days,
                        weekendDays, holidays, includeEnd: false, includeStart: true,
                      });
                    }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </>
            ) : (
              <p className="text-xs text-destructive">{addResult.summary}</p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "batch" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ListChecks className="h-4 w-4" /> Batch result
            </h3>
            {batchResult && batchResult.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1.5 px-2">Start</th>
                        <th className="text-left py-1.5 px-2">End</th>
                        <th className="text-right py-1.5 px-2">Business</th>
                        <th className="text-right py-1.5 px-2">Total</th>
                        <th className="text-right py-1.5 px-2">Weekends</th>
                        <th className="text-right py-1.5 px-2">Holidays</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchResult.map((row, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-1 px-2 font-mono text-[11px]">{row.start}</td>
                          <td className="py-1 px-2 font-mono text-[11px]">{row.end}</td>
                          <td className="py-1 px-2 text-right font-medium text-emerald-700 dark:text-emerald-400">
                            {row.businessDays}
                          </td>
                          <td className="py-1 px-2 text-right">{row.totalDays}</td>
                          <td className="py-1 px-2 text-right">{row.weekends}</td>
                          <td className="py-1 px-2 text-right">{row.holidays}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton getText={() => renderBatchCsv(batchResult)} label="Copy CSV" />
                  <DownloadButton
                    getText={() => renderBatchCsv(batchResult)}
                    filename="business-days-batch.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <ShareButton
                    getUrl={() => buildShareUrl({
                      mode: "count", start: batchText.split(/\s+/)[0] || "", end: "",
                      days: 0, weekendDays, holidays, includeEnd, includeStart,
                    })}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </>
            ) : (
              <EmptyState
                title="Add date ranges above"
                hint="One range per line. Format: 'YYYY-MM-DD YYYY-MM-DD' (or use 'to' / '..' as separator)."
                icon={<ListChecks className="h-8 w-8" />}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Saved holiday sets */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Save className="h-4 w-4" /> Saved holiday sets ({holidaySets.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            <Input
              type="text"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              placeholder="Set name (e.g. US Federal 2025)"
              className="h-8 text-xs flex-1 min-w-[180px]"
            />
            <Button size="sm" onClick={handleSaveHolidaySet} disabled={holidays.length === 0} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save current holidays
            </Button>
          </div>
          {holidaySets.length > 0 && (
            <div className="space-y-1">
              {holidaySets.map((set) => (
                <div key={set.id} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                  <span className="font-medium text-foreground">{set.name}</span>
                  <Badge variant="outline" className="text-[10px]">{set.holidays.length} dates</Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(set.createdAt).toLocaleDateString()}</span>
                  <Button
                    variant="ghost" size="sm" className="h-6 text-[11px] ml-auto"
                    onClick={() => handleLoadHolidaySet(set.id)}
                  >Load</Button>
                  <Button
                    variant="ghost" size="sm" className="h-6 text-[11px] text-destructive"
                    onClick={() => handleDeleteHolidaySet(set.id)}
                  ><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
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
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.mode}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.businessDays} days</Badge>
                  <span className="text-muted-foreground">{h.summary}</span>
                  <span className="text-muted-foreground ml-2 text-[10px]">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All date math runs locally in your browser.
            Saved holiday sets and history live in localStorage on this device only.
            The shareable URL uses a fragment (after #) which browsers never send to servers.
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
