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
} from "../../_shared";
import { toast } from "sonner";
import {
  PRACTICE_MODES,
  PRACTICE_MODE_LABELS,
  TEXT_TYPES,
  TEXT_TYPE_LABELS,
  TIMED_MODE_DURATIONS_MS,
  DEFAULT_SETTINGS,
  generateText,
  normalizeTarget,
  normalizeInput,
  computeDiff,
  calculateWpm,
  calculateNetWpm,
  calculateAccuracy,
  countErrors,
  formatTime,
  getCursorIndex,
  initTestState,
  startTest,
  finishTest,
  resetTest,
  isFinished,
  isRunning,
  computeDuration,
  renderTextReport,
  renderCsv,
  renderSummaryText,
  computeSummaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PracticeMode,
  type TextType,
  type TestStateMachine,
  type TypingResult,
  type HistoryEntry,
} from "./logic";
import {
  Keyboard, History, Play, Square, RotateCcw, Clock, Target, Zap, AlertCircle,
} from "lucide-react";

export default function TypingPractice() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [targetText, setTargetText] = useState("");
  const [userInput, setUserInput] = useState("");
  const [testState, setTestState] = useState<TestStateMachine>(initTestState());
  const [now, setNow] = useState(Date.now());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lastResult, setLastResult] = useState<TypingResult | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setSettings(p.settings);
      toast.info("Loaded from share link");
    }
  }, []);

  // Real-time ticking clock for timed modes
  useEffect(() => {
    if (!isRunning(testState)) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [testState.state]);

  // Auto-finish timed tests when time runs out
  useEffect(() => {
    if (!isRunning(testState)) return;
    if (settings.practiceMode === "timed-1min" || settings.practiceMode === "timed-3min" || settings.practiceMode === "timed-5min") {
      const dur = TIMED_MODE_DURATIONS_MS[settings.practiceMode];
      const elapsed = computeDuration(testState, now);
      if (elapsed >= dur) {
        finishCurrentTest();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, testState.state, settings.practiceMode]);

  // Auto-finish word-count/custom-text modes when user types the full target
  useEffect(() => {
    if (!isRunning(testState)) return;
    if (settings.practiceMode === "word-count" || settings.practiceMode === "custom-text") {
      if (userInput.length >= targetText.length && targetText.length > 0) {
        finishCurrentTest();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInput, testState.state]);

  const targetNormalized = useMemo(
    () => normalizeTarget(targetText, settings.caseSensitive),
    [targetText, settings.caseSensitive],
  );

  const diff = useMemo(
    () => computeDiff(targetNormalized, normalizeInput(userInput, settings.caseSensitive)),
    [targetNormalized, userInput, settings.caseSensitive],
  );

  const durationMs = useMemo(
    () => (testState.state === "idle" ? 0 : computeDuration(testState, now)),
    [testState, now],
  );

  const liveWpm = useMemo(
    () => calculateWpm(diff.correctCount, durationMs),
    [diff.correctCount, durationMs],
  );
  const liveAccuracy = useMemo(
    () => calculateAccuracy(diff.correctCount, userInput.length),
    [diff.correctCount, userInput.length],
  );
  const liveErrors = useMemo(() => countErrors(diff), [diff]);
  const liveNetWpm = useMemo(
    () => calculateNetWpm(diff.correctCount, liveErrors, durationMs),
    [diff.correctCount, liveErrors, durationMs],
  );
  const cursorIndex = useMemo(
    () => getCursorIndex(userInput.length, targetText.length),
    [userInput.length, targetText.length],
  );

  const summary = useMemo(() => {
    const allResults: TypingResult[] = history.map((h, i) => ({
      id: `hist-${i}`,
      ts: h.ts,
      mode: h.mode,
      textType: h.textType,
      wpm: h.wpm,
      netWpm: h.wpm, // not stored, use wpm
      accuracy: h.accuracy,
      errors: h.errors,
      durationMs: h.durationMs,
      correctChars: Math.round(h.wpm * 5 * (h.durationMs / 60_000)),
      totalTyped: Math.round(h.wpm * 5 * (h.durationMs / 60_000) / Math.max(0.5, h.accuracy / 100)),
      targetTextLength: 0,
      caseSensitive: false,
    }));
    if (lastResult) allResults.unshift(lastResult);
    return computeSummaryStats(allResults);
  }, [history, lastResult]);

  const startNewTest = useCallback(() => {
    const text = generateText(
      settings.textType,
      settings.practiceMode,
      settings.customText,
      settings.wordCount,
    );
    if (!text && settings.textType !== "custom") {
      toast.error("Could not generate text");
      return;
    }
    if (settings.textType === "custom" && !settings.customText.trim()) {
      toast.error("Enter custom text first");
      return;
    }
    setTargetText(text);
    setUserInput("");
    setLastResult(null);
    setTestState(resetTest());
    setNow(Date.now());
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [settings]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (testState.state === "finished") return;
      if (testState.state === "idle" && value.length > 0) {
        setTestState(startTest(initTestState(), Date.now()));
        setNow(Date.now());
      }
      setUserInput(value);
    },
    [testState.state],
  );

  const finishCurrentTest = useCallback(() => {
    if (!isRunning(testState)) return;
    const end = Date.now();
    const finished = finishTest(testState, end);
    setTestState(finished);
    const dur = computeDuration(finished, end);
    const finalDiff = computeDiff(targetNormalized, normalizeInput(userInput, settings.caseSensitive));
    const errs = countErrors(finalDiff);
    const wpm = calculateWpm(finalDiff.correctCount, dur);
    const net = calculateNetWpm(finalDiff.correctCount, errs, dur);
    const acc = calculateAccuracy(finalDiff.correctCount, userInput.length);
    const result: TypingResult = {
      id: `r-${Date.now()}`,
      ts: end,
      mode: settings.practiceMode,
      textType: settings.textType,
      wpm,
      netWpm: net,
      accuracy: acc,
      errors: errs,
      durationMs: dur,
      correctChars: finalDiff.correctCount,
      totalTyped: userInput.length,
      targetTextLength: targetText.length,
      caseSensitive: settings.caseSensitive,
    };
    setLastResult(result);
    saveHistory({
      ts: end,
      mode: settings.practiceMode,
      textType: settings.textType,
      wpm,
      accuracy: acc,
      errors: errs,
      durationMs: dur,
    });
    setHistory(loadHistory());
    toast.success(`Test complete — ${wpm} WPM, ${acc}% accuracy`);
  }, [testState, targetNormalized, userInput, settings, targetText.length]);

  const handleReset = useCallback(() => {
    setTestState(resetTest());
    setUserInput("");
    setLastResult(null);
    setNow(Date.now());
  }, []);

  const handleClear = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setTargetText("");
    setUserInput("");
    setTestState(resetTest());
    setLastResult(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const updateSettings = useCallback(<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);

  const isTimedMode = settings.practiceMode === "timed-1min" || settings.practiceMode === "timed-3min" || settings.practiceMode === "timed-5min";
  const timedDurationMs = isTimedMode ? TIMED_MODE_DURATIONS_MS[settings.practiceMode as "timed-1min" | "timed-3min" | "timed-5min"] : 0;
  const timeRemainingMs = isTimedMode ? Math.max(0, timedDurationMs - durationMs) : 0;
  const isCustomType = settings.textType === "custom";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Settings */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tp-mode">Practice mode</Label>
              <select
                id="tp-mode"
                value={settings.practiceMode}
                onChange={(e) => updateSettings("practiceMode", e.target.value as PracticeMode)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {PRACTICE_MODES.map((m) => (
                  <option key={m} value={m}>{PRACTICE_MODE_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tp-type">Text type</Label>
              <select
                id="tp-type"
                value={settings.textType}
                onChange={(e) => updateSettings("textType", e.target.value as TextType)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {TEXT_TYPES.map((t) => (
                  <option key={t} value={t}>{TEXT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
          </div>

          {isCustomType && (
            <div className="space-y-1.5">
              <Label htmlFor="tp-custom">Custom text</Label>
              <Textarea
                id="tp-custom"
                value={settings.customText}
                onChange={(e) => updateSettings("customText", e.target.value)}
                placeholder="Type or paste any text to practice with…"
                className="min-h-[80px] resize-y font-mono text-xs"
              />
            </div>
          )}

          {settings.practiceMode === "word-count" && (
            <div className="space-y-1.5">
              <Label htmlFor="tp-count">Word count: {settings.wordCount}</Label>
              <Input
                id="tp-count"
                type="number"
                min={1}
                max={500}
                value={settings.wordCount}
                onChange={(e) => updateSettings("wordCount", Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)))}
                className="h-9"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={settings.caseSensitive}
              onChange={(e) => updateSettings("caseSensitive", e.target.checked)}
            />
            Case-sensitive (don't auto-lowercase)
          </label>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={startNewTest} className="gap-1.5">
              <Play className="h-3.5 w-3.5" />
              {testState.state === "running" ? "Restart" : targetText ? "New text" : "Start test"}
            </Button>
            {testState.state === "running" && (
              <Button size="sm" variant="outline" onClick={finishCurrentTest} className="gap-1.5">
                <Square className="h-3.5 w-3.5" /> Finish now
              </Button>
            )}
            {testState.state === "finished" && (
              <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            )}
            <ShareButton getUrl={() => buildShareUrl({ settings })} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {/* Test area */}
      {targetText ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Live stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat icon={<Zap className="h-3 w-3" />} label="WPM" value={liveWpm} highlight="good" />
              <Stat icon={<Target className="h-3 w-3" />} label="Accuracy" value={`${liveAccuracy}%`} highlight={liveAccuracy >= 90 ? "good" : liveAccuracy >= 70 ? undefined : "bad"} />
              <Stat icon={<AlertCircle className="h-3 w-3" />} label="Errors" value={liveErrors} highlight={liveErrors === 0 ? "good" : "bad"} />
              <Stat
                icon={<Clock className="h-3 w-3" />}
                label={isTimedMode ? "Time left" : "Elapsed"}
                value={isTimedMode ? formatTime(timeRemainingMs) : formatTime(durationMs)}
              />
            </div>

            {/* Text display with cursor highlighting */}
            <div className="rounded border bg-background p-3 font-mono text-sm leading-relaxed min-h-[120px] max-h-[280px] overflow-auto whitespace-pre-wrap break-words">
              {targetText.split("").map((ch, i) => {
                const d = diff.chars[i];
                let cls = "text-muted-foreground";
                if (d) {
                  if (d.status === "correct") cls = "text-emerald-600 dark:text-emerald-400";
                  else if (d.status === "incorrect") cls = "text-red-600 dark:text-red-400 bg-red-500/10 rounded";
                  else if (d.status === "extra") cls = "text-red-600 dark:text-red-400 bg-red-500/20 rounded";
                  else if (d.status === "missed") cls = "text-muted-foreground/50";
                }
                const isCursor = i === cursorIndex && testState.state !== "finished";
                const isSpace = ch === " ";
                return (
                  <span key={i} className={`${cls} ${isCursor ? "border-b-2 border-primary" : ""} ${isSpace ? "whitespace-pre" : ""}`}>
                    {ch}
                  </span>
                );
              })}
            </div>

            {/* Input area */}
            <div className="space-y-1.5">
              <Label htmlFor="tp-input">Type here</Label>
              <Textarea
                ref={inputRef}
                id="tp-input"
                value={userInput}
                onChange={handleInputChange}
                disabled={testState.state === "finished"}
                placeholder="Start typing to begin the test…"
                className="min-h-[80px] resize-y font-mono text-sm"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <div className="text-[10px] text-muted-foreground">
                {userInput.length} / {targetText.length} chars · cursor at {cursorIndex}
              </div>
            </div>

            {/* Final results */}
            {testState.state === "finished" && lastResult && (
              <div className="rounded border bg-emerald-500/5 p-3 space-y-2">
                <div className="text-sm font-semibold text-foreground">Test complete!</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat icon={<Zap className="h-3 w-3" />} label="Gross WPM" value={lastResult.wpm} highlight="good" />
                  <Stat icon={<Zap className="h-3 w-3" />} label="Net WPM" value={lastResult.netWpm} />
                  <Stat icon={<Target className="h-3 w-3" />} label="Accuracy" value={`${lastResult.accuracy}%`} highlight={lastResult.accuracy >= 90 ? "good" : "bad"} />
                  <Stat icon={<AlertCircle className="h-3 w-3" />} label="Errors" value={lastResult.errors} />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton getText={() => renderTextReport(lastResult)} label="Copy report" />
                  <DownloadButton getText={() => renderTextReport(lastResult)} filename="typing-result.txt" mime="text/plain" label="Download .txt" />
                  <DownloadButton getText={() => renderCsv([lastResult])} filename="typing-result.csv" mime="text/csv" label="Download CSV" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Pick your settings and click Start test"
          hint="Choose a practice mode (timed 1/3/5 min, custom text, or word count) and a text type (common words, quotes, code snippets, numbers, or custom). Then click Start test to begin typing."
          icon={<Keyboard className="h-8 w-8" />}
        />
      )}

      {/* Summary stats */}
      {(history.length > 0 || lastResult) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Zap className="h-4 w-4" /> Summary stats
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total tests" value={summary.totalTests} />
              <Stat label="Best WPM" value={summary.bestWpm} highlight="good" />
              <Stat label="Avg WPM" value={summary.avgWpm} />
              <Stat label="Avg accuracy" value={`${summary.avgAccuracy}%`} />
            </div>
            {summary.recentTrend.length > 0 && (
              <div className="pt-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Recent WPM trend (oldest→newest)</div>
                <div className="flex flex-wrap gap-1">
                  {summary.recentTrend.map((wpm, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{wpm}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <CopyButton getText={() => renderSummaryText(summary)} label="Copy summary" />
              <DownloadButton getText={() => renderSummaryText(summary)} filename="typing-summary.txt" mime="text/plain" label="Download .txt" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <div className="flex gap-2">
                <DownloadButton getText={() => renderCsv(history.map((h, i) => ({
                  id: `h-${i}`, ts: h.ts, mode: h.mode, textType: h.textType,
                  wpm: h.wpm, netWpm: h.wpm, accuracy: h.accuracy, errors: h.errors,
                  durationMs: h.durationMs, correctChars: 0, totalTyped: 0,
                  targetTextLength: 0, caseSensitive: false,
                })))} filename="typing-history.csv" mime="text/csv" label="CSV" />
                <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
              </div>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {history.slice(0, 10).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{PRACTICE_MODE_LABELS[h.mode]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{TEXT_TYPE_LABELS[h.textType]}</Badge>
                  <span className="font-mono font-semibold">{h.wpm} WPM</span>
                  <span className="text-muted-foreground">{h.accuracy}%</span>
                  <span className="text-muted-foreground">{h.errors} err</span>
                  <span className="text-muted-foreground">{formatTime(h.durationMs)}</span>
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
            <strong className="text-foreground">Privacy:</strong> All typing, scoring, and stat computation run locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
