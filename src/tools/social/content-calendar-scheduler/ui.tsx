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
  PLATFORMS,
  PLATFORM_LABELS,
  FREQUENCIES,
  FREQUENCY_LABELS,
  BEST_TIME_TO_POST,
  THEME_PRESETS,
  parseThemes,
  parseStartTimes,
  buildCalendar,
  renderText,
  renderCsv,
  renderHtml,
  renderMarkdown,
  renderIcs,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type PostingFrequency,
  type CalendarInput,
  type HistoryEntry,
} from "./logic";
import {
  CalendarClock, History, AlertTriangle, CalendarOff,
  Sparkles, BarChart3,
} from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ContentCalendarScheduler() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["twitter", "instagram"]);
  const [frequency, setFrequency] = useState<PostingFrequency>("3x-week");
  const [themesText, setThemesText] = useState("Education\nBehind the Scenes\nCustomer Story\nProduct Highlight");
  const [includeWeekends, setIncludeWeekends] = useState<boolean>(true);
  const [timesText, setTimesText] = useState("twitter,09:00\ninstagram,12:00\nlinkedin,08:00\nfacebook,13:00\ntiktok,19:00\nyoutube,15:00");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.year) setYear(p.year);
      if (p.month) setMonth(p.month);
      if (p.platforms.length > 0) setSelectedPlatforms(p.platforms);
      if (p.postingFrequency) setFrequency(p.postingFrequency);
      if (p.contentThemes.length > 0) setThemesText(p.contentThemes.join("\n"));
      setIncludeWeekends(p.includeWeekends);
      if (Object.keys(p.startTimes).length > 0) {
        setTimesText(
          Object.entries(p.startTimes)
            .map(([pl, t]) => `${pl},${t}`)
            .join("\n"),
        );
      }
      if (window.location.hash.length > 1) toast.info("Loaded from share link");
    }
  }, []);

  const themes = useMemo(() => parseThemes(themesText), [themesText]);
  const startTimes = useMemo(() => parseStartTimes(timesText), [timesText]);

  const input: CalendarInput = useMemo(
    () => ({
      year,
      month,
      platforms: selectedPlatforms,
      postingFrequency: frequency,
      contentThemes: themes,
      includeWeekends,
      startTimes,
    }),
    [year, month, selectedPlatforms, frequency, themes, includeWeekends, startTimes],
  );

  const result = useMemo(() => buildCalendar(input), [input]);
  const text = useMemo(() => renderText(result), [result]);
  const csv = useMemo(() => renderCsv(result), [result]);
  const html = useMemo(() => renderHtml(result), [result]);
  const md = useMemo(() => renderMarkdown(result), [result]);
  const ics = useMemo(() => renderIcs(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.posts.length > 0) {
      saveHistory({
        ts: Date.now(),
        year,
        month,
        platforms: selectedPlatforms,
        postingFrequency: frequency,
        themeCount: themes.length,
        totalPosts: result.posts.length,
      });
      setHistory(loadHistory());
    }
  }, [result.posts.length, year, month, selectedPlatforms, frequency, themes.length]);

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleClear = useCallback(() => {
    setThemesText("");
    setTimesText("");
    setSelectedPlatforms([]);
    setFrequency("3x-week");
    setIncludeWeekends(true);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const monthName = MONTHS[month - 1] ?? "";
  const monthSlug = `${monthName}-${year}`;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ccs-year" className="text-xs">Year</Label>
              <Input
                id="ccs-year"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || now.getFullYear())}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ccs-month" className="text-xs">Month</Label>
              <select
                id="ccs-month"
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ccs-freq" className="text-xs">Posting frequency (per platform)</Label>
              <select
                id="ccs-freq"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as PostingFrequency)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Platforms ({selectedPlatforms.length} selected)</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {PLATFORMS.map((p) => (
                <label
                  key={p}
                  className={`flex items-center gap-1.5 text-xs cursor-pointer rounded border px-2 py-1 ${selectedPlatforms.includes(p) ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(p)}
                    onChange={() => togglePlatform(p)}
                  />
                  {PLATFORM_LABELS[p]}
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {BEST_TIME_TO_POST[p]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ccs-themes" className="text-xs">
              Content themes (one per line — rotating, 7-day no-repeat)
            </Label>
            <Textarea
              id="ccs-themes"
              value={themesText}
              onChange={(e) => setThemesText(e.target.value)}
              placeholder={"Education\nBehind the Scenes\nCustomer Story"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {THEME_PRESETS.map((t) => (
                <Button
                  key={t}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setThemesText((prev) => (prev ? `${prev}\n${t}` : t))}
                >+ {t}</Button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ccs-times" className="text-xs">
              Per-platform start times (one per line: <code>platform,HH:MM</code>)
            </Label>
            <Textarea
              id="ccs-times"
              value={timesText}
              onChange={(e) => setTimesText(e.target.value)}
              placeholder={"twitter,09:00\ninstagram,12:00"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={includeWeekends}
              onChange={(e) => setIncludeWeekends(e.target.checked)}
            />
            Include weekends (Saturday/Sunday)
          </label>
        </CardContent>
      </Card>

      {result.posts.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> {monthName} {year} — {result.summary.totalPosts} posts
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total posts" value={result.summary.totalPosts} />
                <Stat label="Scheduled days" value={`${result.summary.scheduledDays}/${result.summary.daysInMonth}`} />
                <Stat label="Avg posts/day" value={result.summary.avgPostsPerDay} />
                <Stat
                  label="Gap days"
                  value={result.gaps.length}
                  highlight={result.gaps.length > 0 ? "bad" : "good"}
                />
              </div>

              {result.byPlatform.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Per platform</div>
                  {result.byPlatform.map((s) => (
                    <div key={s.platform} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{PLATFORM_LABELS[s.platform]}</span>
                        <Badge variant="secondary" className="text-[10px]">{s.totalPosts} posts</Badge>
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          best: {BEST_TIME_TO_POST[s.platform]}
                        </span>
                      </div>
                      {Object.keys(s.byTheme).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(s.byTheme).map(([t, c]) => (
                            <Badge key={t} variant="outline" className="text-[10px]">
                              {t}: {c}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {result.conflicts.length > 0 && (
                <div className="rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" /> {result.conflicts.length} time conflict(s)
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {result.conflicts.slice(0, 5).map((c, i) => (
                      <li key={i} className="font-mono text-[10px] text-muted-foreground">
                        {c.date} {c.time} → {c.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}
                      </li>
                    ))}
                    {result.conflicts.length > 5 && (
                      <li className="text-[10px] text-muted-foreground">
                        … and {result.conflicts.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {result.gaps.length > 0 && (
                <div className="rounded border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-blue-700 dark:text-blue-400">
                    <CalendarOff className="h-3.5 w-3.5" /> {result.gaps.length} content-gap day(s)
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                    {result.gaps.slice(0, 8).join(", ")}
                    {result.gaps.length > 8 ? ` … +${result.gaps.length - 8} more` : ""}
                  </div>
                </div>
              )}

              <div className="rounded border bg-background px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="h-3.5 w-3.5" /> Theme balance
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.themeBalance.themes.map((t) => (
                    <Badge
                      key={t.theme}
                      variant="outline"
                      className={`text-[10px] ${t.share === result.themeBalance.maxShare && !result.themeBalance.balanced ? "border-amber-400 text-amber-700 dark:text-amber-400" : ""}`}
                    >
                      {t.theme}: {t.share}%
                    </Badge>
                  ))}
                </div>
                {!result.themeBalance.balanced && (
                  <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">
                    Themes are imbalanced (max-min &gt; 25pp).
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <CalendarClock className="h-4 w-4" /> Schedule ({result.posts.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-auto">
                {groupPostsByDate(result.posts).map(({ date, posts }) => (
                  <div key={date} className="rounded border bg-background">
                    <div className="px-3 py-1 text-[11px] font-semibold text-foreground border-b bg-muted/30">
                      {date}
                    </div>
                    <div className="divide-y">
                      {posts.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                          <span className="font-mono text-muted-foreground text-[10px] w-12">{p.time}</span>
                          <Badge variant="outline" className="text-[10px]">{PLATFORM_LABELS[p.platform]}</Badge>
                          <span className="flex-1 truncate">{p.theme || <span className="text-muted-foreground">(no theme)</span>}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy text"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return text; }}
                  filename={`calendar-${monthSlug}.txt`}
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename={`calendar-${monthSlug}.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
                <DownloadButton
                  getText={() => html}
                  filename={`calendar-${monthSlug}.html`}
                  mime="text/html"
                  label="Download HTML"
                />
                <DownloadButton
                  getText={() => md}
                  filename={`calendar-${monthSlug}.md`}
                  mime="text/markdown"
                  label="Download MD"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return ics; }}
                  filename={`calendar-${monthSlug}.ics`}
                  mime="text/calendar"
                  label="Download ICS"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Pick at least one platform to generate a calendar"
          hint="Select platforms above, choose a posting frequency, and the schedule will appear here. Conflicts, gap days and theme balance are detected automatically."
          icon={<CalendarClock className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.totalPosts} posts</Badge>
                  <Badge variant="outline" className="mr-2">{MONTHS[h.month - 1]} {h.year}</Badge>
                  <span className="text-muted-foreground">
                    {h.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")} · {FREQUENCY_LABELS[h.postingFrequency]}
                  </span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All scheduling runs locally in your browser. History is stored in localStorage on this device only. ICS export is a plain-text file — no calendar data leaves this page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function groupPostsByDate(posts: { date: string; platform: Platform; time: string; theme: string }[]) {
  const map = new Map<string, typeof posts>();
  for (const p of posts) {
    if (!map.has(p.date)) map.set(p.date, []);
    map.get(p.date)!.push(p);
  }
  return Array.from(map.entries()).map(([date, list]) => ({ date, posts: list }));
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
