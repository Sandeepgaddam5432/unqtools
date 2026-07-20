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
  WEEKDAY_NAMES,
  MONTH_NAMES,
  ORDINAL_WORDS,
  parseDate,
  formatDateISO,
  makeDate,
  findDayOfWeek,
  findNextWeekday,
  findPreviousWeekday,
  findNthWeekdayOfMonth,
  recurringWeekdayAcrossYears,
  doomsdayRuleSteps,
  renderResultText,
  renderRecurringText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type WeekdayNum,
  type HistoryEntry,
} from "./logic";
import {
  History, Calendar, CalendarDays, Repeat, BookOpen,
  ArrowLeft, ArrowRight, Sparkles, Info,
} from "lucide-react";

type Tab = "single" | "next-prev" | "nth" | "recurring" | "doomsday";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "single", label: "Single date", icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { id: "next-prev", label: "Next / previous weekday", icon: <ArrowRight className="h-3.5 w-3.5" /> },
  { id: "nth", label: "Nth weekday of month", icon: <Repeat className="h-3.5 w-3.5" /> },
  { id: "recurring", label: "Recurring across years", icon: <Calendar className="h-3.5 w-3.5" /> },
  { id: "doomsday", label: "Doomsday teaching mode", icon: <BookOpen className="h-3.5 w-3.5" /> },
];

function todayIso(): string {
  const d = new Date();
  return formatDateISO(makeDate(d.getFullYear(), d.getMonth(), d.getDate()));
}

export default function DayOfTheWeekFinder() {
  const [tab, setTab] = useState<Tab>("single");
  const [dateText, setDateText] = useState<string>(todayIso());

  // Next/previous
  const [targetWeekday, setTargetWeekday] = useState<WeekdayNum>(1); // Monday

  // Nth weekday
  const [nthYear, setNthYear] = useState<number>(new Date().getFullYear());
  const [nthMonth, setNthMonth] = useState<number>(10); // November
  const [nthWeekday, setNthWeekday] = useState<WeekdayNum>(4); // Thursday
  const [nthN, setNthN] = useState<number>(4);

  // Recurring
  const [recStart, setRecStart] = useState<number>(new Date().getFullYear());
  const [recEnd, setRecEnd] = useState<number>(new Date().getFullYear() + 9);
  const [recMonth, setRecMonth] = useState<number>(11); // December
  const [recDay, setRecDay] = useState<number>(25);

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.date) setDateText(p.date);
      if (p.targetWeekday !== undefined) setTargetWeekday(p.targetWeekday);
      if (p.nth !== undefined) setNthN(p.nth);
      if (p.startYear !== undefined) setRecStart(p.startYear);
      if (p.endYear !== undefined) setRecEnd(p.endYear);
      const validTabs: Tab[] = ["single", "next-prev", "nth", "recurring", "doomsday"];
      if (validTabs.includes(p.op as Tab)) setTab(p.op as Tab);
      if (p.date || p.op !== "single") toast.info("Loaded from share link");
    }
  }, []);

  // ---- Single ----
  const parsed = useMemo(() => parseDate(dateText), [dateText]);
  const singleResult = useMemo(() => {
    if (!parsed.ok) return null;
    try { return findDayOfWeek(parsed); } catch { return null; }
  }, [parsed]);

  // ---- Next / Previous ----
  const nextPrev = useMemo(() => {
    if (!parsed.ok) return null;
    try {
      const d = makeDate(parsed.year, parsed.month, parsed.day);
      return {
        next: findNextWeekday(d, targetWeekday),
        prev: findPreviousWeekday(d, targetWeekday),
        source: d,
      };
    } catch { return null; }
  }, [parsed, targetWeekday]);

  // ---- Nth weekday of month ----
  const nthResult = useMemo(() => {
    try {
      return findNthWeekdayOfMonth(nthYear, nthMonth, nthWeekday, nthN);
    } catch { return null; }
  }, [nthYear, nthMonth, nthWeekday, nthN]);

  // ---- Recurring ----
  const recurring = useMemo(() => {
    try {
      return recurringWeekdayAcrossYears(recStart, recEnd, recMonth, recDay);
    } catch { return null; }
  }, [recStart, recEnd, recMonth, recDay]);

  // ---- Doomsday ----
  const doomsday = useMemo(() => {
    if (!parsed.ok) return null;
    try { return doomsdayRuleSteps(parsed.year, parsed.month, parsed.day); } catch { return null; }
  }, [parsed]);

  // ---- History recording ----
  const recordHistory = useCallback((op: string, summary: string) => {
    saveHistory({
      ts: Date.now(),
      date: dateText,
      weekdayName: summary,
      operation: op,
    });
    setHistory(loadHistory());
  }, [dateText]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleClear = useCallback(() => {
    setDateText(todayIso());
    toast.info("Reset to today");
  }, []);

  // ---- Render helpers ----
  const singleText = singleResult ? renderResultText(singleResult) : "";
  const recurringText = recurring && recurring.length > 0
    ? renderRecurringText(recurring, recMonth, recDay)
    : "";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <Button
                key={t.id}
                variant={tab === t.id ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => setTab(t.id)}
              >
                {t.icon}
                {t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dotw-date" className="text-sm font-semibold">Reference date (YYYY-MM-DD)</Label>
              <Input
                id="dotw-date"
                value={dateText}
                onChange={(e) => setDateText(e.target.value)}
                placeholder="2025-06-16"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex items-end">
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setDateText(todayIso())}>Today</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setDateText("2001-09-11")}>Sep 11 2001</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setDateText("2024-02-29")}>Leap day 2024</Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setDateText("1000-06-15")}>Pre-1582</Button>
                <ClearButton onClick={handleClear} />
              </div>
            </div>
          </div>
          {parsed.error && !parsed.ok && (
            <ErrorBanner message={parsed.error} />
          )}
        </CardContent>
      </Card>

      {tab === "single" && singleResult && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" /> Weekday result
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { recordHistory("single", singleResult.weekdayName); return singleText; }}
                  label="Copy summary"
                />
                <DownloadButton
                  getText={() => singleText}
                  filename="weekday-result.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <ShareButton
                  getUrl={() => { recordHistory("single", singleResult.weekdayName); return buildShareUrl("single", { date: dateText }); }}
                />
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {MONTH_NAMES[singleResult.month]} {singleResult.day}, {singleResult.year}
              </div>
              <div className="text-4xl sm:text-5xl font-semibold text-foreground mt-1">
                {singleResult.weekdayName}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {singleResult.daysUntilToday === 0
                  ? "Today"
                  : singleResult.daysUntilToday > 0
                    ? `${singleResult.daysUntilToday} day(s) from today`
                    : `${-singleResult.daysUntilToday} day(s) ago`}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Day of year" value={`${singleResult.dayOfYear} / ${singleResult.isLeapYear ? 366 : 365}`} />
              <Stat label="ISO week" value={`W${singleResult.isoWeek}`} />
              <Stat label="Leap year" value={singleResult.isLeapYear ? "Yes" : "No"} />
              <Stat
                label="Algorithms"
                value={singleResult.allAgree ? "3/3 agree" : "Disagree"}
                highlight={singleResult.allAgree ? "good" : "bad"}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <AlgoBox name="Zeller" value={WEEKDAY_NAMES[singleResult.zeller]} />
              <AlgoBox name="Sakamoto" value={WEEKDAY_NAMES[singleResult.sakamoto]} />
              <AlgoBox name="JavaScript" value={WEEKDAY_NAMES[singleResult.jsDate]} />
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-300">
              <Info className="h-4 w-4 flex-shrink-0" />
              <span>{singleResult.julianGregorianNote}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "next-prev" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <ArrowRight className="h-4 w-4" /> Next / previous weekday
              </h3>
              <ShareButton
                getUrl={() => buildShareUrl("next", { date: dateText, targetWeekday })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Target weekday</Label>
              <div className="flex flex-wrap gap-1">
                {WEEKDAY_NAMES.map((w, i) => (
                  <Button
                    key={w}
                    variant={targetWeekday === i ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setTargetWeekday(i as WeekdayNum)}
                  >{w}</Button>
                ))}
              </div>
            </div>
            {nextPrev ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border bg-emerald-500/5 p-4">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" /> Next {WEEKDAY_NAMES[targetWeekday]}
                  </div>
                  <div className="text-2xl font-semibold text-foreground mt-1">
                    {formatDateISO(nextPrev.next)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {MONTH_NAMES[nextPrev.next.getMonth()]} {nextPrev.next.getDate()}, {nextPrev.next.getFullYear()}
                  </div>
                </div>
                <div className="rounded-lg border bg-orange-500/5 p-4">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" /> Previous {WEEKDAY_NAMES[targetWeekday]}
                  </div>
                  <div className="text-2xl font-semibold text-foreground mt-1">
                    {formatDateISO(nextPrev.prev)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {MONTH_NAMES[nextPrev.prev.getMonth()]} {nextPrev.prev.getDate()}, {nextPrev.prev.getFullYear()}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="Enter a valid reference date" icon={<Calendar className="h-8 w-8" />} />
            )}
          </CardContent>
        </Card>
      )}

      {tab === "nth" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Repeat className="h-4 w-4" /> Nth weekday of month
              </h3>
              <ShareButton
                getUrl={() => buildShareUrl("nth", {
                  date: `${nthYear}-${String(nthMonth + 1).padStart(2, "0")}-${String(nthN).padStart(2, "0")}`,
                  targetWeekday: nthWeekday, nth: nthN,
                })}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Year">
                <Input
                  type="number"
                  value={nthYear}
                  onChange={(e) => setNthYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="Month">
                <select
                  value={nthMonth}
                  onChange={(e) => setNthMonth(parseInt(e.target.value, 10))}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </Field>
              <Field label="Weekday">
                <select
                  value={nthWeekday}
                  onChange={(e) => setNthWeekday(parseInt(e.target.value, 10) as WeekdayNum)}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  {WEEKDAY_NAMES.map((w, i) => <option key={w} value={i}>{w}</option>)}
                </select>
              </Field>
              <Field label="Occurrence">
                <select
                  value={nthN}
                  onChange={(e) => setNthN(parseInt(e.target.value, 10))}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  {ORDINAL_WORDS.map((w, i) => <option key={w} value={i + 1}>{w}</option>)}
                </select>
              </Field>
            </div>
            {nthResult && (
              nthResult.date ? (
                <div className="rounded-lg border bg-emerald-500/5 p-4 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {nthResult.label}
                  </div>
                  <div className="text-3xl font-semibold text-foreground mt-1">
                    {formatDateISO(nthResult.date)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {WEEKDAY_NAMES[nthResult.date.getDay() as WeekdayNum]}
                  </div>
                  <div className="flex justify-center gap-2 mt-3">
                    <CopyButton
                      getText={() => { recordHistory("nth", nthResult.label); return formatDateISO(nthResult.date!); }}
                      label="Copy date"
                    />
                  </div>
                </div>
              ) : (
                <ErrorBanner message={`${nthResult.label} — this occurrence does not exist in the month.`} />
              )
            )}
            <div className="text-[11px] text-muted-foreground">
              <Sparkles className="inline h-3 w-3 mr-1" />
              Try: 4th Thursday of November = US Thanksgiving · 2nd Monday of October = Canadian Thanksgiving · 1st Monday of September = US Labor Day
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "recurring" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Repeat className="h-4 w-4" /> Weekday across a year range
              </h3>
              <div className="flex flex-wrap gap-2">
                {recurring && recurring.length > 0 && (
                  <>
                    <DownloadButton
                      getText={() => recurringText}
                      filename="recurring-weekdays.txt"
                      mime="text/plain"
                      label="Download .txt"
                    />
                    <ShareButton
                      getUrl={() => buildShareUrl("recurring", {
                        date: `${recStart}-${String(recMonth + 1).padStart(2, "0")}-${String(recDay).padStart(2, "0")}`,
                        startYear: recStart, endYear: recEnd,
                      })}
                    />
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Start year">
                <Input type="number" value={recStart} onChange={(e) => setRecStart(parseInt(e.target.value, 10) || new Date().getFullYear())} className="font-mono text-xs" />
              </Field>
              <Field label="End year">
                <Input type="number" value={recEnd} onChange={(e) => setRecEnd(parseInt(e.target.value, 10) || new Date().getFullYear())} className="font-mono text-xs" />
              </Field>
              <Field label="Month">
                <select
                  value={recMonth}
                  onChange={(e) => setRecMonth(parseInt(e.target.value, 10))}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </Field>
              <Field label="Day of month">
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={recDay}
                  onChange={(e) => setRecDay(parseInt(e.target.value, 10) || 1)}
                  className="font-mono text-xs"
                />
              </Field>
            </div>
            {recurring ? (
              recurring.length === 0 ? (
                <ErrorBanner message="No matching dates (e.g. Feb 29 across non-leap years). Adjust the range." />
              ) : (
                <div className="max-h-[400px] overflow-auto rounded border bg-background">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-1.5 text-left">Year</th>
                        <th className="px-3 py-1.5 text-left">Weekday</th>
                        <th className="px-3 py-1.5 text-left">ISO week</th>
                        <th className="px-3 py-1.5 text-left">Date (ISO)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurring.map((r) => (
                        <tr key={r.year} className="border-t">
                          <td className="px-3 py-1.5 font-mono">{r.year}</td>
                          <td className="px-3 py-1.5">
                            <Badge variant="outline" className="text-[10px]">{r.weekdayName}</Badge>
                          </td>
                          <td className="px-3 py-1.5 font-mono">W{r.isoWeek}</td>
                          <td className="px-3 py-1.5 font-mono">{formatDateISO(r.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <ErrorBanner message="End year must be ≥ start year." />
            )}
          </CardContent>
        </Card>
      )}

      {tab === "doomsday" && doomsday && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Doomsday rule, step by step
              </h3>
              <ShareButton getUrl={() => buildShareUrl("doomsday", { date: dateText })} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Stat label="Century anchor" value={`${doomsday.anchorDayName} (${doomsday.anchorDay})`} />
              <Stat label="Year doomsday" value={doomsday.yearDoomsdayName} />
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Nearest anchor date</div>
              <div className="font-medium text-foreground mt-1">
                {doomsday.nearestAnchor.label} — {doomsday.yearDoomsdayName}
              </div>
            </div>
            <div className="space-y-2">
              {doomsday.steps.map((s, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="font-semibold text-foreground">{s.title}</div>
                  <div className="text-muted-foreground mt-0.5">{s.detail}</div>
                  <div className="font-mono text-foreground mt-1">→ {s.value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border bg-emerald-500/10 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Predicted weekday</div>
              <div className="text-3xl font-semibold text-foreground mt-1">
                {WEEKDAY_NAMES[doomsday.targetWeekday]}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!parsed.ok && (tab === "single" || tab === "doomsday") && (
        <EmptyState
          title="Enter a valid date to compute its weekday"
          hint="Format: YYYY-MM-DD. Supports far-past and far-future years. The tool checks Zeller, Sakamoto, and JavaScript Date against each other."
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
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.operation}</Badge>
                    <span className="text-foreground font-medium">{h.weekdayName}</span>
                    <span className="ml-auto text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{h.date}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All weekday math runs locally using three independent algorithms.
            History (last 20) is stored in localStorage on this device only.
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
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "good" | "bad";
}) {
  const color = highlight === "good"
    ? "text-emerald-600 dark:text-emerald-400"
    : highlight === "bad"
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function AlgoBox({ name, value }: { name: string; value: string }) {
  return (
    <div className="rounded border bg-background px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{name}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
