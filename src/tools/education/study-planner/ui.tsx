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
  BREAK_PRESETS,
  SESSION_PRESETS,
  DAY_OF_WEEK_LABELS,
  DAY_OF_WEEK_SHORT,
  DEFAULTS,
  normalizeSubject,
  parseExcludeDates,
  parseChapterDifficulties,
  getStudyDaysOfWeek,
  calculateDaysUntil,
  computeChaptersPerDay,
  computeAvailableStudyDays,
  allocateRevisionDays,
  generateSchedule,
  computeWeeklySummaries,
  computeSummaryStats,
  renderText,
  renderCsv,
  renderHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  todayUTC,
  type DayPlan,
  type SessionBlock,
  type StudyInput,
  type HistoryEntry,
} from "./logic";
import {
  CalendarClock, Calendar, Clock, BookOpen, History,
  Coffee, CheckCircle2, RotateCcw,
} from "lucide-react";

export default function StudyPlanner() {
  const [subjectName, setSubjectName] = useState(DEFAULTS.subjectName);
  const [examDate, setExamDate] = useState(DEFAULTS.examDate);
  const [totalChapters, setTotalChapters] = useState(DEFAULTS.totalChapters);
  const [chaptersPerDay, setChaptersPerDay] = useState(DEFAULTS.chaptersPerDay);
  const [dailyStudyHours, setDailyStudyHours] = useState(DEFAULTS.dailyStudyHours);
  const [studyDaysPerWeek, setStudyDaysPerWeek] = useState(DEFAULTS.studyDaysPerWeek);
  const [includeRevision, setIncludeRevision] = useState(DEFAULTS.includeRevision);
  const [startTime, setStartTime] = useState(DEFAULTS.startTime);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(DEFAULTS.breakDurationMinutes);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(DEFAULTS.sessionDurationMinutes);
  const [excludeDates, setExcludeDates] = useState(DEFAULTS.excludeDates);
  const [chapterDifficulties, setChapterDifficulties] = useState(DEFAULTS.chapterDifficulties);
  const [fromDate] = useState(todayUTC());
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load share URL on mount
  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setSubjectName(p.subjectName);
      setExamDate(p.examDate);
      setTotalChapters(p.totalChapters);
      setChaptersPerDay(p.chaptersPerDay);
      setDailyStudyHours(p.dailyStudyHours);
      setStudyDaysPerWeek(p.studyDaysPerWeek);
      setIncludeRevision(p.includeRevision);
      setStartTime(p.startTime);
      setBreakDurationMinutes(p.breakDurationMinutes);
      setSessionDurationMinutes(p.sessionDurationMinutes);
      setExcludeDates(p.excludeDates);
      setChapterDifficulties(p.chapterDifficulties);
      if (p.subjectName || p.examDate) toast.info("Loaded from share link");
    }
  }, []);

  const input: StudyInput = useMemo(() => ({
    subjectName,
    examDate,
    totalChapters,
    chaptersPerDay,
    dailyStudyHours,
    studyDaysPerWeek,
    includeRevision,
    startTime,
    breakDurationMinutes,
    sessionDurationMinutes,
    excludeDates,
    chapterDifficulties,
    fromDate,
  }), [
    subjectName, examDate, totalChapters, chaptersPerDay, dailyStudyHours,
    studyDaysPerWeek, includeRevision, startTime, breakDurationMinutes,
    sessionDurationMinutes, excludeDates, chapterDifficulties, fromDate,
  ]);

  const daysUntilExam = useMemo(
    () => examDate ? calculateDaysUntil(examDate, fromDate) : 0,
    [examDate, fromDate],
  );

  const availableStudyDays = useMemo(
    () => examDate
      ? computeAvailableStudyDays(fromDate, examDate, studyDaysPerWeek, parseExcludeDates(excludeDates))
      : [],
    [fromDate, examDate, studyDaysPerWeek, excludeDates],
  );

  const { studyDays: learningDays, revisionDays } = useMemo(
    () => allocateRevisionDays(availableStudyDays, includeRevision),
    [availableStudyDays, includeRevision],
  );

  const effectiveChaptersPerDay = useMemo(
    () => computeChaptersPerDay(totalChapters, learningDays.length, chaptersPerDay),
    [totalChapters, learningDays.length, chaptersPerDay],
  );

  const plans: DayPlan[] = useMemo(() => generateSchedule(input), [input]);
  const weekly = useMemo(() => computeWeeklySummaries(plans), [plans]);
  const stats = useMemo(
    () => computeSummaryStats(plans, totalChapters, daysUntilExam),
    [plans, totalChapters, daysUntilExam],
  );

  const text = useMemo(
    () => renderText(plans, subjectName, examDate, daysUntilExam),
    [plans, subjectName, examDate, daysUntilExam],
  );
  const csv = useMemo(() => renderCsv(plans), [plans]);
  const html = useMemo(
    () => renderHtml(plans, subjectName, examDate, daysUntilExam),
    [plans, subjectName, examDate, daysUntilExam],
  );

  const handleSaveHistory = useCallback(() => {
    if (plans.length > 0) {
      saveHistory({
        ts: Date.now(),
        subjectName: normalizeSubject(subjectName) || "Untitled",
        examDate,
        totalChapters,
        studyDays: stats.studyDays,
        revisionDays: stats.revisionDays,
        totalHours: stats.totalHours,
      });
      setHistory(loadHistory());
    }
  }, [plans.length, subjectName, examDate, totalChapters, stats]);

  const handleClear = useCallback(() => {
    setSubjectName(DEFAULTS.subjectName);
    setExamDate(DEFAULTS.examDate);
    setTotalChapters(DEFAULTS.totalChapters);
    setChaptersPerDay(DEFAULTS.chaptersPerDay);
    setDailyStudyHours(DEFAULTS.dailyStudyHours);
    setStudyDaysPerWeek(DEFAULTS.studyDaysPerWeek);
    setIncludeRevision(DEFAULTS.includeRevision);
    setStartTime(DEFAULTS.startTime);
    setBreakDurationMinutes(DEFAULTS.breakDurationMinutes);
    setSessionDurationMinutes(DEFAULTS.sessionDurationMinutes);
    setExcludeDates(DEFAULTS.excludeDates);
    setChapterDifficulties(DEFAULTS.chapterDifficulties);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const studyDowLabels = useMemo(
    () => getStudyDaysOfWeek(studyDaysPerWeek).map((d) => DAY_OF_WEEK_SHORT[d]),
    [studyDaysPerWeek],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sp-subject">Subject name</Label>
              <Input
                id="sp-subject"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="Mathematics"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-exam">Exam date</Label>
              <Input
                id="sp-exam"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sp-chapters">Total chapters</Label>
              <Input
                id="sp-chapters"
                type="number"
                min={1}
                value={totalChapters}
                onChange={(e) => setTotalChapters(Math.max(1, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-cpd">Chapters / day</Label>
              <Input
                id="sp-cpd"
                type="number"
                min={1}
                value={chaptersPerDay}
                onChange={(e) => setChaptersPerDay(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-hours">Daily study hours</Label>
              <Input
                id="sp-hours"
                type="number"
                min={0.5}
                step={0.5}
                value={dailyStudyHours}
                onChange={(e) => setDailyStudyHours(Math.max(0.5, Number(e.target.value) || 0.5))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-dpw">Study days / week</Label>
              <select
                id="sp-dpw"
                value={studyDaysPerWeek}
                onChange={(e) => setStudyDaysPerWeek(Number(e.target.value))}
                className="w-full h-9 rounded border bg-background px-3 text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>{n} day{n > 1 ? "s" : ""}/week</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sp-start">Start time</Label>
              <Input
                id="sp-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-session">Session (min)</Label>
              <select
                id="sp-session"
                value={SESSION_PRESETS.includes(sessionDurationMinutes as 25 | 50 | 90) ? sessionDurationMinutes : "custom"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v !== "custom") setSessionDurationMinutes(Number(v));
                }}
                className="w-full h-9 rounded border bg-background px-3 text-sm"
              >
                {SESSION_PRESETS.map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-break">Break (min)</Label>
              <select
                id="sp-break"
                value={BREAK_PRESETS.includes(breakDurationMinutes as 5 | 10 | 15 | 30) ? breakDurationMinutes : "custom"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v !== "custom") setBreakDurationMinutes(Number(v));
                }}
                className="w-full h-9 rounded border bg-background px-3 text-sm"
              >
                {BREAK_PRESETS.map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-rev">Include revision</Label>
              <label className="flex items-center gap-2 h-9 text-sm cursor-pointer">
                <input
                  id="sp-rev"
                  type="checkbox"
                  checked={includeRevision}
                  onChange={(e) => setIncludeRevision(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>Reserve last 2 days</span>
              </label>
            </div>
          </div>

          {(sessionDurationMinutes === 0 || !SESSION_PRESETS.includes(sessionDurationMinutes as 25 | 50 | 90)) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sp-session-custom">Custom session (min)</Label>
                <Input
                  id="sp-session-custom"
                  type="number"
                  min={5}
                  value={sessionDurationMinutes}
                  onChange={(e) => setSessionDurationMinutes(Math.max(5, Number(e.target.value) || 50))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-break-custom">Custom break (min)</Label>
                <Input
                  id="sp-break-custom"
                  type="number"
                  min={1}
                  value={breakDurationMinutes}
                  onChange={(e) => setBreakDurationMinutes(Math.max(1, Number(e.target.value) || 15))}
                />
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sp-exclude">Exclude dates (comma-separated YYYY-MM-DD)</Label>
              <Input
                id="sp-exclude"
                value={excludeDates}
                onChange={(e) => setExcludeDates(e.target.value)}
                placeholder="2025-01-22, 2025-01-29"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-diff">Chapter difficulties (comma-separated easy/medium/hard)</Label>
              <Input
                id="sp-diff"
                value={chapterDifficulties}
                onChange={(e) => setChapterDifficulties(e.target.value)}
                placeholder="easy, medium, hard, easy"
                className="font-mono text-xs"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Studying on: {studyDowLabels.join(", ") || "none"} ·
            {" "}Available study days: {availableStudyDays.length} ·
            {" "}Revision days reserved: {revisionDays.length} ·
            {" "}Effective chapters/day: {effectiveChaptersPerDay}
          </p>
        </CardContent>
      </Card>

      {!examDate ? (
        <EmptyState
          title="Enter an exam date to generate your study plan"
          hint="Fill in subject name, exam date, and chapters. We'll calculate days until exam, auto-adjust chapters-per-day, and generate a Pomodoro-style timetable with revision days."
          icon={<CalendarClock className="h-8 w-8" />}
        />
      ) : daysUntilExam <= 0 ? (
        <EmptyState
          title="Exam date must be in the future"
          hint={`Today is ${fromDate}. Pick an exam date after today.`}
          icon={<Calendar className="h-8 w-8" />}
        />
      ) : plans.length === 0 ? (
        <EmptyState
          title="No study days available before exam"
          hint="Try increasing study days per week, or remove excluded dates."
          icon={<CalendarClock className="h-8 w-8" />}
        />
      ) : (
        <>
          {/* Summary stats */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" /> Plan summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Days until exam" value={stats.daysUntilExam} highlight="good" />
                <Stat label="Total planned days" value={stats.totalDays} />
                <Stat label="Study days" value={stats.studyDays} />
                <Stat label="Revision days" value={stats.revisionDays} />
                <Stat label="Total sessions" value={stats.totalSessions} />
                <Stat label="Total hours" value={`${stats.totalHours}h`} />
                <Stat label="Chapters planned" value={`${stats.plannedChapters}/${stats.totalChapters}`} />
                <Stat label="Completion" value={`${stats.completionPercent}%`} highlight={stats.completionPercent === 100 ? "good" : "bad"} />
              </div>
            </CardContent>
          </Card>

          {/* Day plans */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Day-by-day schedule
                </h3>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-400 mr-1" />Study
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-400 mr-1" />Revision
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <span className="inline-block h-2 w-2 rounded-full bg-purple-400 mr-1" />Review
                  </Badge>
                </div>
              </div>
              <div className="space-y-2 max-h-[600px] overflow-auto pr-1">
                {plans.map((plan) => (
                  <DayPlanCard key={plan.date} plan={plan} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Weekly summaries */}
          {weekly.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> Weekly summaries
                </h3>
                <div className="space-y-1">
                  {weekly.map((w) => (
                    <div key={w.weekNumber} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium text-foreground">{w.weekNumber}</span>
                      <Badge variant="secondary" className="text-[10px]">{w.totalHours}h</Badge>
                      <Badge variant="outline" className="text-[10px]">{w.totalChapters} ch</Badge>
                      <Badge variant="outline" className="text-[10px]">{w.studyDays} study</Badge>
                      <Badge variant="outline" className="text-[10px]">{w.revisionDays} revision</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleSaveHistory(); return text; }} label="Copy text" />
                <DownloadButton getText={() => text} filename={`study-plan-${examDate}.txt`} mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csv} filename={`study-plan-${examDate}.csv`} mime="text/csv" label="Download CSV" />
                <DownloadButton getText={() => html} filename={`study-plan-${examDate}.html`} mime="text/html" label="Download HTML" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent plans ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.examDate}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.totalChapters} ch</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.studyDays} study days</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.revisionDays} revision</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.totalHours}h</Badge>
                  <span className="text-muted-foreground">{h.subjectName}</span>
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
            <strong className="text-foreground">Privacy:</strong> All scheduling runs locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DayPlanCard({ plan }: { plan: DayPlan }) {
  const dowName = DAY_OF_WEEK_LABELS[plan.dayOfWeek] ?? "?";
  const typeColor = plan.type === "study"
    ? "border-l-blue-400"
    : plan.type === "revision"
      ? "border-l-amber-400"
      : "border-l-purple-400";
  const typeLabel = plan.type === "study" ? "STUDY" : plan.type === "revision" ? "REVISION" : "REVIEW";
  const typeIcon = plan.type === "study"
    ? <BookOpen className="h-3.5 w-3.5" />
    : plan.type === "revision"
      ? <RotateCcw className="h-3.5 w-3.5" />
      : <CheckCircle2 className="h-3.5 w-3.5" />;

  return (
    <div className={`rounded border border-l-4 ${typeColor} bg-background px-3 py-2 text-xs`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono font-medium text-foreground">{plan.date}</span>
        <span className="text-muted-foreground">{dowName}</span>
        <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
          {typeIcon}
          {typeLabel}
        </Badge>
        {plan.chapters.length > 0 && (
          <Badge variant="outline" className="text-[10px]">Ch. {plan.chapters.join(", ")}</Badge>
        )}
      </div>
      <div className="space-y-0.5">
        {plan.sessions.map((s, i) => (
          <SessionRow key={i} session={s} />
        ))}
      </div>
    </div>
  );
}

function SessionRow({ session }: { session: SessionBlock }) {
  const isStudy = session.type === "study" || session.type === "revision";
  const icon = session.type === "break" || session.type === "long-break"
    ? <Coffee className="h-3 w-3 text-muted-foreground" />
    : <BookOpen className="h-3 w-3 text-foreground" />;
  const label = session.type === "study"
    ? `Study #${session.sessionNumber}`
    : session.type === "revision"
      ? `Revision #${session.sessionNumber}`
      : session.type === "long-break"
        ? "Long break"
        : "Break";
  const chapterStr = session.chapter != null ? ` · Ch.${session.chapter}` : "";
  const opacity = isStudy ? "" : "opacity-60";

  return (
    <div className={`flex items-center gap-2 ${opacity}`}>
      {icon}
      <span className="font-mono text-muted-foreground">{session.startTime}–{session.endTime}</span>
      <span className="text-foreground">{label}{chapterStr}</span>
      <span className="text-muted-foreground ml-auto">{session.durationMin}m</span>
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
