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
  LAYOUTS,
  WEEK_STARTS,
  PAPER_SIZES,
  ORIENTATIONS,
  LOCALES,
  HOLIDAY_PRESETS,
  THEMES,
  PRESETS,
  defaultOptions,
  validateOptions,
  generateMonth,
  generateYear,
  generateMultiMonth,
  generateWeek,
  renderMonthHtml,
  renderYearHtml,
  renderWeekHtml,
  renderMultiMonthHtml,
  renderCalendarHtml,
  renderMonthText,
  exportIcs,
  parseIcs,
  computeHolidays,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  getMonthName,
  type CalendarOptions,
  type CalendarLayout,
  type WeekStart,
  type PaperSize,
  type Orientation,
  type LocaleCode,
  type ThemeName,
  type HolidayPreset,
  type CalendarEvent,
  type HistoryEntry,
} from "./logic";
import {
  History, Calendar, Printer, FileDown, AlertTriangle, Info,
  Grid3x3, CalendarDays, CalendarRange, CalendarClock,
} from "lucide-react";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function PrintableCalendarGenerator() {
  const [opts, setOpts] = useState<CalendarOptions>(defaultOptions());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [day, setDay] = useState<number>(1);
  const [eventsText, setEventsText] = useState<string>("");
  const [icsText, setIcsText] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const previewRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.opts) {
        setOpts((prev) => ({ ...prev, ...p.opts }));
      }
      if (p.year) setYear(p.year);
      if (p.opts?.startMonth) setMonth(p.opts.startMonth);
      if (p.opts || p.year) toast.info("Loaded from share link");
    }
  }, []);

  // Parse custom events text: YYYY-MM-DD | Title [#color]
  const parsedEvents: CalendarEvent[] = useMemo(() => {
    const out: CalendarEvent[] = [];
    for (const line of eventsText.split(/\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const m = /^(\d{4}-\d{2}-\d{2})\s*\|\s*(.+?)(?:\s+#([0-9a-fA-F]{6}))?$/.exec(trimmed);
      if (m) {
        out.push({
          date: m[1],
          title: m[2].trim(),
          color: m[3] ? `#${m[3]}` : undefined,
        });
      }
    }
    return out;
  }, [eventsText]);

  // Merge ICS-imported events
  const icsEvents: CalendarEvent[] = useMemo(() => {
    if (!icsText.trim()) return [];
    const r = parseIcs(icsText);
    if (r.warnings.length > 0 && r.events.length === 0) return [];
    return r.events;
  }, [icsText]);

  const allEvents = useMemo(
    () => [...parsedEvents, ...icsEvents],
    [parsedEvents, icsEvents],
  );

  const effectiveOpts = useMemo<CalendarOptions>(
    () => ({ ...opts, events: allEvents }),
    [opts, allEvents],
  );

  const validation = useMemo(() => validateOptions(effectiveOpts), [effectiveOpts]);

  const previewHtml = useMemo(() => {
    if (!validation.valid) return "";
    try {
      if (effectiveOpts.layout === "monthly") {
        const m = generateMonth(year, month, effectiveOpts);
        const colors = THEMES.find((t) => t.value === effectiveOpts.theme);
        const titleHtml = effectiveOpts.title
          ? `<h1 class="cal-title">${escapeHtml(effectiveOpts.title)}</h1>`
          : `<h1 class="cal-title">${getMonthName(month, effectiveOpts.locale)} ${year}</h1>`;
        const subtitleHtml = effectiveOpts.subtitle
          ? `<p class="cal-subtitle">${escapeHtml(effectiveOpts.subtitle)}</p>`
          : "";
        return `<!doctype html><html><head><meta charset="utf-8"><style>${getInlineCss(effectiveOpts)}</style></head>
<body><div class="cal-page">${titleHtml}${subtitleHtml}${renderMonthHtml(m, effectiveOpts)}</div></body></html>`;
      }
      if (effectiveOpts.layout === "yearly") {
        return renderCalendarHtml(year, effectiveOpts);
      }
      if (effectiveOpts.layout === "weekly") {
        const w = generateWeek(year, month, day, effectiveOpts);
        return `<!doctype html><html><head><meta charset="utf-8"><style>${getInlineCss(effectiveOpts)}</style></head>
<body><div class="cal-page"><h1 class="cal-title">Week of ${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}</h1>${renderWeekHtml(w, effectiveOpts)}</div></body></html>`;
      }
      // multi-month
      const s = effectiveOpts.startMonth ?? 1;
      const e = effectiveOpts.endMonth ?? 12;
      const months = generateMultiMonth(year, s, e, effectiveOpts);
      return `<!doctype html><html><head><meta charset="utf-8"><style>${getInlineCss(effectiveOpts)}</style></head>
<body><div class="cal-page"><h1 class="cal-title">${year}</h1>${renderMultiMonthHtml(months, effectiveOpts)}</div></body></html>`;
    } catch {
      return "";
    }
  }, [effectiveOpts, validation, year, month, day]);

  const fullHtml = useMemo(() => {
    if (!validation.valid) return "";
    return renderCalendarHtml(year, effectiveOpts);
  }, [effectiveOpts, validation, year]);

  const textOut = useMemo(() => {
    if (!validation.valid) return "";
    if (effectiveOpts.layout === "monthly") {
      const m = generateMonth(year, month, effectiveOpts);
      return renderMonthText(m, effectiveOpts);
    }
    return "";
  }, [effectiveOpts, validation, year, month]);

  const icsOut = useMemo(() => {
    if (!validation.valid) return "";
    return exportIcs(year, effectiveOpts);
  }, [effectiveOpts, validation, year]);

  const holidayCount = useMemo(
    () => effectiveOpts.showHolidays ? computeHolidays(year, effectiveOpts.holidayPreset).length : 0,
    [year, effectiveOpts.showHolidays, effectiveOpts.holidayPreset],
  );

  const updateOpts = useCallback((patch: Partial<CalendarOptions>) => {
    setOpts((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (validation.valid) {
      saveHistory({
        ts: Date.now(),
        year,
        layout: effectiveOpts.layout,
        paperSize: effectiveOpts.paperSize,
        orientation: effectiveOpts.orientation,
      });
      setHistory(loadHistory());
    }
  }, [validation, year, effectiveOpts]);

  const handleClear = useCallback(() => {
    setOpts(defaultOptions());
    setEventsText("");
    setIcsText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handlePrint = useCallback(() => {
    if (!previewHtml) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) {
      toast.error("Pop-up blocked — allow pop-ups to print");
      return;
    }
    w.document.open();
    w.document.write(previewHtml);
    w.document.close();
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch {
        toast.error("Print failed");
      }
    }, 300);
  }, [previewHtml]);

  const applyPreset = (preset: Partial<CalendarOptions>) => {
    setOpts((prev) => ({ ...prev, ...preset }));
    toast.success("Preset applied");
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <h3 className="text-sm font-semibold text-foreground">Layout & Date</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Layout</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={opts.layout}
                onChange={(e) => updateOpts({ layout: e.target.value as CalendarLayout })}
              >
                {LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || 2026)}
                className="h-9"
              />
            </div>
            {(opts.layout === "monthly" || opts.layout === "weekly") && (
              <div className="space-y-1.5">
                <Label className="text-xs">Month</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m) => <option key={m} value={m}>{getMonthName(m, opts.locale)}</option>)}
                </select>
              </div>
            )}
            {opts.layout === "weekly" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Day</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value) || 1)}
                  className="h-9"
                />
              </div>
            )}
            {opts.layout === "multi-month" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Start month</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={opts.startMonth ?? 1}
                    onChange={(e) => updateOpts({ startMonth: Number(e.target.value) })}
                  >
                    {MONTHS.map((m) => <option key={m} value={m}>{getMonthName(m, opts.locale)}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End month</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={opts.endMonth ?? 12}
                    onChange={(e) => updateOpts({ endMonth: Number(e.target.value) })}
                  >
                    {MONTHS.map((m) => <option key={m} value={m}>{getMonthName(m, opts.locale)}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Grid3x3 className="h-4 w-4" />
            <h3 className="text-sm font-semibold text-foreground">Format & Paper</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Week start">
              <select className={selectCls} value={opts.weekStart}
                onChange={(e) => updateOpts({ weekStart: e.target.value as WeekStart })}>
                {WEEK_STARTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </Field>
            <Field label="Locale">
              <select className={selectCls} value={opts.locale}
                onChange={(e) => updateOpts({ locale: e.target.value as LocaleCode })}>
                {LOCALES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
            <Field label="Paper size">
              <select className={selectCls} value={opts.paperSize}
                onChange={(e) => updateOpts({ paperSize: e.target.value as PaperSize })}>
                {PAPER_SIZES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Orientation">
              <select className={selectCls} value={opts.orientation}
                onChange={(e) => updateOpts({ orientation: e.target.value as Orientation })}>
                {ORIENTATIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            {opts.paperSize === "custom" && (
              <>
                <Field label="Width (mm)">
                  <Input type="number" value={opts.paperWidthMm ?? 210}
                    onChange={(e) => updateOpts({ paperWidthMm: Number(e.target.value) })}
                    className="h-9" />
                </Field>
                <Field label="Height (mm)">
                  <Input type="number" value={opts.paperHeightMm ?? 297}
                    onChange={(e) => updateOpts({ paperHeightMm: Number(e.target.value) })}
                    className="h-9" />
                </Field>
              </>
            )}
            <Field label="Theme">
              <select className={selectCls} value={opts.theme}
                onChange={(e) => updateOpts({ theme: e.target.value as ThemeName })}>
                {THEMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Holidays">
              <select className={selectCls} value={opts.holidayPreset}
                onChange={(e) => updateOpts({ holidayPreset: e.target.value as HolidayPreset })}>
                {HOLIDAY_PRESETS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={opts.showWeekNumbers}
                onChange={(e) => updateOpts({ showWeekNumbers: e.target.checked })} />
              Week numbers
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={opts.showDayOfYear}
                onChange={(e) => updateOpts({ showDayOfYear: e.target.checked })} />
              Day of year
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={opts.showHolidays}
                onChange={(e) => updateOpts({ showHolidays: e.target.checked })} />
              Show holidays
            </label>
            {opts.layout === "weekly" && (
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={opts.showNotes}
                  onChange={(e) => updateOpts({ showNotes: e.target.checked })} />
                Notes column
              </label>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Title (optional)">
              <Input type="text" value={opts.title ?? ""}
                onChange={(e) => updateOpts({ title: e.target.value || undefined })}
                placeholder="Office Calendar 2026"
                className="h-9" />
            </Field>
            <Field label="Subtitle (optional)">
              <Input type="text" value={opts.subtitle ?? ""}
                onChange={(e) => updateOpts({ subtitle: e.target.value || undefined })}
                placeholder="Team A"
                className="h-9" />
            </Field>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Quick presets</Label>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <Button key={p.label} variant="outline" size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => applyPreset(p.opts)}>
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <h3 className="text-sm font-semibold text-foreground">Custom Events & ICS Import</h3>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pcg-events" className="text-xs">
              Custom events (one per line: <code>YYYY-MM-DD | Title [#color]</code>)
            </Label>
            <Textarea
              id="pcg-events"
              value={eventsText}
              onChange={(e) => setEventsText(e.target.value)}
              placeholder={"2026-03-15 | Project kickoff #2563eb\n2026-04-22 | Earth Day #16a34a\n2026-07-04 | BBQ"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pcg-ics" className="text-xs">
              ICS import (paste a .ics file)
            </Label>
            <Textarea
              id="pcg-ics"
              value={icsText}
              onChange={(e) => setIcsText(e.target.value)}
              placeholder={"BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20260615\nSUMMARY:Birthday\nEND:VEVENT\nEND:VCALENDAR"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{parsedEvents.length} custom events</Badge>
            <Badge variant="secondary">{icsEvents.length} ICS events</Badge>
            <Badge variant="secondary">{holidayCount} holidays</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handlePrint} disabled={!validation.valid} size="sm" className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <DownloadButton
              getText={() => fullHtml}
              filename={`calendar-${year}.html`}
              mime="text/html"
              disabled={!validation.valid}
            />
            <DownloadButton
              getText={() => icsOut}
              filename={`calendar-${year}.ics`}
              mime="text/calendar"
              disabled={!validation.valid}
              label="Download .ics"
            />
            <CopyButton
              getText={() => textOut || fullHtml}
              label="Copy HTML"
              disabled={!validation.valid}
            />
            <ShareButton
              getUrl={() => buildShareUrl(effectiveOpts, year)}
              disabled={!validation.valid}
            />
            <Button variant="outline" size="sm" onClick={handleSaveHistory} disabled={!validation.valid}>
              <History className="h-3.5 w-3.5" /> Save
            </Button>
            <ClearButton onClick={handleClear} />
          </div>

          {!validation.valid && (
            <ErrorBanner message={validation.errors.join("; ")} />
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Live preview</Label>
            {previewHtml ? (
              <iframe
                ref={previewRef}
                title="Calendar preview"
                srcDoc={previewHtml}
                className="w-full h-[600px] rounded-md border border-input bg-white"
                sandbox="allow-same-origin"
              />
            ) : (
              <EmptyState
                title="No preview"
                hint="Fix the validation errors above to see a preview."
                icon={<AlertTriangle className="h-6 w-6" />}
              />
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
                  <span className="font-mono">
                    {new Date(h.ts).toLocaleString()} — {h.year} {h.layout} {h.paperSize} {h.orientation}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px]"
                    onClick={() => {
                      setYear(h.year);
                      updateOpts({ layout: h.layout, paperSize: h.paperSize, orientation: h.orientation });
                      toast.info("Restored from history");
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getInlineCss(opts: CalendarOptions): string {
  // Lightweight inline CSS for the live preview iframe. Mirrors the print CSS
  // but without the @page rule (which the iframe cannot use anyway).
  return `
:root {
  --cal-bg: ${themeBg(opts.theme)};
  --cal-fg: ${themeFg(opts.theme)};
  --cal-accent: ${themeAccent(opts.theme)};
  --cal-weekend: ${themeWeekend(opts.theme)};
  --cal-today-bg: ${themeTodayBg(opts.theme)};
  --cal-holiday: ${themeHoliday(opts.theme)};
}
html, body { background: var(--cal-bg); color: var(--cal-fg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 8px; }
.cal-page { max-width: 100%; margin: 0 auto; padding: 8px; background: var(--cal-bg); color: var(--cal-fg); }
.cal-title { font-size: 24px; font-weight: 700; margin: 0 0 4px; color: var(--cal-fg); }
.cal-subtitle { font-size: 13px; color: var(--cal-accent); margin: 0 0 12px; }
.cal-month { width: 100%; border-collapse: collapse; table-layout: fixed; }
.cal-month th, .cal-month td { border: 1px solid rgba(127,127,127,0.3); padding: 4px; vertical-align: top; }
.cal-month th { background: rgba(127,127,127,0.1); font-size: 11px; font-weight: 600; color: var(--cal-accent); }
.cal-wd { text-align: center; }
.cal-wn-h { width: 28px; }
.cal-wn { background: rgba(127,127,127,0.08); text-align: center; font-size: 10px; color: var(--cal-weekend); font-weight: 600; }
.cal-day { height: 56px; }
.cal-num { font-size: 12px; font-weight: 700; color: var(--cal-fg); display: block; }
.cal-doy { font-size: 9px; color: var(--cal-weekend); margin-left: 3px; font-weight: 400; }
.cal-today { background: var(--cal-today-bg) !important; }
.cal-today .cal-num { color: var(--cal-accent); }
.cal-weekend .cal-num { color: var(--cal-weekend); }
.cal-holiday .cal-num { color: var(--cal-holiday); }
.cal-hol-name { display: block; font-size: 9px; color: var(--cal-holiday); margin-top: 2px; }
.cal-evts { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
.cal-evt { display: block; font-size: 9px; line-height: 1.2; padding: 1px 3px; border-left: 2px solid var(--evt, var(--cal-accent)); background: rgba(127,127,127,0.08); border-radius: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cal-empty { background: rgba(127,127,127,0.04); }
.cal-year-grid, .cal-multi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.cal-mini-month h3 { font-size: 12px; margin: 0 0 4px; text-align: center; color: var(--cal-fg); }
.cal-mini { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
.cal-mini th, .cal-mini td { border: 1px solid rgba(127,127,127,0.25); padding: 2px; text-align: center; }
.cal-mini th { background: rgba(127,127,127,0.1); color: var(--cal-accent); font-weight: 600; }
.cal-mini .cal-today { background: var(--cal-today-bg); font-weight: 700; }
.cal-mini .cal-holiday { color: var(--cal-holiday); font-weight: 700; }
.cal-week { width: 100%; border-collapse: collapse; }
.cal-week th, .cal-week td { border: 1px solid rgba(127,127,127,0.3); padding: 6px; }
.cal-week th { background: rgba(127,127,127,0.1); color: var(--cal-accent); font-weight: 600; text-align: left; }
.cal-week .cal-day-cell { width: 70%; vertical-align: top; }
.cal-week .cal-notes { width: 30%; background: rgba(127,127,127,0.04); }
.cal-day-num { font-size: 14px; font-weight: 700; }
`.trim();
}

function themeBg(t: ThemeName): string {
  const m: Record<ThemeName, string> = {
    light: "#ffffff", dark: "#0f172a", sepia: "#f5ecd9", blue: "#eff6ff", green: "#f0fdf4",
  };
  return m[t];
}
function themeFg(t: ThemeName): string {
  const m: Record<ThemeName, string> = {
    light: "#1f2937", dark: "#e2e8f0", sepia: "#5b4636", blue: "#1e3a8a", green: "#14532d",
  };
  return m[t];
}
function themeAccent(t: ThemeName): string {
  const m: Record<ThemeName, string> = {
    light: "#2563eb", dark: "#60a5fa", sepia: "#b8860b", blue: "#2563eb", green: "#16a34a",
  };
  return m[t];
}
function themeWeekend(t: ThemeName): string {
  const m: Record<ThemeName, string> = {
    light: "#94a3b8", dark: "#64748b", sepia: "#a08c75", blue: "#7c9fd6", green: "#86b893",
  };
  return m[t];
}
function themeTodayBg(t: ThemeName): string {
  const m: Record<ThemeName, string> = {
    light: "#dbeafe", dark: "#1e3a8a", sepia: "#ecd9b5", blue: "#bfdbfe", green: "#bbf7d0",
  };
  return m[t];
}
function themeHoliday(t: ThemeName): string {
  const m: Record<ThemeName, string> = {
    light: "#dc2626", dark: "#f87171", sepia: "#a0522d", blue: "#dc2626", green: "#dc2626",
  };
  return m[t];
}
