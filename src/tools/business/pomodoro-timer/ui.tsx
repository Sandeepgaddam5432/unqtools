"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  PHASE_LABELS,
  PHASE_COLORS,
  BEEP_LABELS,
  SESSION_PRESETS,
  PRESET_LABELS,
  DEFAULT_SETTINGS,
  normalizeSettings,
  formatTime,
  parseTime,
  phaseAtStep,
  durationForPhase,
  generatePhaseSequence,
  estimateTotalTime,
  computeProgress,
  beepParamsForPhase,
  summaryStats,
  formatMinutes,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Phase,
  type BeepFrequency,
  type PomodoroSettings,
  type PresetKey,
  type HistoryEntry,
} from "./logic";
import {
  Timer, Play, Pause, SkipForward, RotateCcw, History,
  Volume2, VolumeX, Coffee, Brain, CheckCircle2,
} from "lucide-react";

export default function PomodoroTimer() {
  // Settings state
  const [workDurationMin, setWorkDurationMin] = useState(DEFAULT_SETTINGS.workDurationMin);
  const [shortBreakMin, setShortBreakMin] = useState(DEFAULT_SETTINGS.shortBreakMin);
  const [longBreakMin, setLongBreakMin] = useState(DEFAULT_SETTINGS.longBreakMin);
  const [longBreakEvery, setLongBreakEvery] = useState(DEFAULT_SETTINGS.longBreakEvery);
  const [totalSessions, setTotalSessions] = useState(DEFAULT_SETTINGS.totalSessions);
  const [soundEnabled, setSoundEnabled] = useState(DEFAULT_SETTINGS.soundEnabled);
  const [autoStartNext, setAutoStartNext] = useState(DEFAULT_SETTINGS.autoStartNext);
  const [beepFrequency, setBeepFrequency] = useState<BeepFrequency>(DEFAULT_SETTINGS.beepFrequency);

  // Timer state
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Normalize settings from state
  const settings: PomodoroSettings = useMemo(() => normalizeSettings({
    workDurationMin,
    shortBreakMin,
    longBreakMin,
    longBreakEvery,
    totalSessions,
    soundEnabled,
    autoStartNext,
    beepFrequency,
  }), [workDurationMin, shortBreakMin, longBreakMin, longBreakEvery, totalSessions, soundEnabled, autoStartNext, beepFrequency]);

  // Phase sequence (cached)
  const sequence = useMemo(() => generatePhaseSequence(settings), [settings]);
  const estimate = useMemo(() => estimateTotalTime(settings), [settings]);
  const stats = useMemo(() => summaryStats(sessionsCompleted, settings), [sessionsCompleted, settings]);

  // Current phase info
  const currentStepInfo = sequence[Math.min(currentStep, sequence.length - 1)];
  const currentPhase: Phase = currentStepInfo?.phase ?? "work";
  const currentDurationSec = currentStepInfo?.durationSec ?? settings.workDurationMin * 60;
  const remainingSec = Math.max(0, currentDurationSec - elapsedSec);
  const progress = computeProgress(elapsedSec, currentDurationSec);
  const isLastStep = currentStep >= sequence.length - 1;

  // Load history + share URL on mount
  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      const merged = { ...DEFAULT_SETTINGS, ...parsed };
      if (typeof parsed.workDurationMin === "number") setWorkDurationMin(merged.workDurationMin);
      if (typeof parsed.shortBreakMin === "number") setShortBreakMin(merged.shortBreakMin);
      if (typeof parsed.longBreakMin === "number") setLongBreakMin(merged.longBreakMin);
      if (typeof parsed.longBreakEvery === "number") setLongBreakEvery(merged.longBreakEvery);
      if (typeof parsed.totalSessions === "number") setTotalSessions(merged.totalSessions);
      if (typeof parsed.soundEnabled === "boolean") setSoundEnabled(merged.soundEnabled);
      if (typeof parsed.autoStartNext === "boolean") setAutoStartNext(merged.autoStartNext);
      if (parsed.beepFrequency) setBeepFrequency(merged.beepFrequency);
      if (Object.keys(parsed).length > 0) toast.info("Loaded from share link");
    }
  }, []);

  // Tick loop
  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isRunning]);

  // Handle phase completion
  useEffect(() => {
    if (elapsedSec >= currentDurationSec && isRunning) {
      // Phase complete
      playBeepForPhase(currentPhase);

      if (currentPhase === "work") {
        const newCompleted = sessionsCompleted + 1;
        setSessionsCompleted(newCompleted);
        // Save to history when work session completes
        const newStats = summaryStats(newCompleted, settings);
        saveHistory({
          ts: Date.now(),
          completedSessions: newCompleted,
          totalWorkMin: newStats.totalWorkMin,
          totalBreakMin: newStats.totalBreakMin,
          settings: { ...settings },
        });
        setHistory(loadHistory());
        toast.success(`Work session ${newCompleted} complete!`);
      } else {
        toast.info(`${PHASE_LABELS[currentPhase]} ended`);
      }

      if (isLastStep) {
        // All done
        setIsRunning(false);
        setElapsedSec(currentDurationSec);
        toast.success("All sessions complete! Great work.");
        return;
      }

      // Move to next step
      setCurrentStep((s) => Math.min(s + 1, sequence.length - 1));
      setElapsedSec(0);

      // Auto-start next phase if enabled
      if (!settings.autoStartNext) {
        setIsRunning(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSec, currentDurationSec, isRunning]);

  // Beep via Web Audio API
  const playBeepForPhase = useCallback((phase: Phase) => {
    if (!settings.soundEnabled) return;
    if (typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const params = beepParamsForPhase(phase, settings.beepFrequency);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = params.type;
      osc.frequency.value = params.frequency;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(params.volume, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + params.durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + params.durationMs / 1000);
    } catch {
      // Audio may fail (autoplay policy); silently ignore.
    }
  }, [settings.soundEnabled, settings.beepFrequency]);

  // Manual beep test
  const handleTestBeep = useCallback(() => {
    playBeepForPhase("work");
    toast.info(`Test beep: ${BEEP_LABELS[settings.beepFrequency]}`);
  }, [playBeepForPhase, settings.beepFrequency]);

  // Controls
  const handleStartPause = useCallback(() => {
    if (isLastStep && elapsedSec >= currentDurationSec) {
      // Reset for a fresh run
      setCurrentStep(0);
      setElapsedSec(0);
      setSessionsCompleted(0);
    }
    setIsRunning((r) => !r);
  }, [isLastStep, elapsedSec, currentDurationSec]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setCurrentStep(0);
    setElapsedSec(0);
    setSessionsCompleted(0);
    toast.info("Timer reset");
  }, []);

  const handleSkip = useCallback(() => {
    if (isLastStep) {
      setIsRunning(false);
      toast.info("Already at last step");
      return;
    }
    setCurrentStep((s) => Math.min(s + 1, sequence.length - 1));
    setElapsedSec(0);
    toast.info("Skipped to next phase");
  }, [isLastStep, sequence.length]);

  const applyPreset = useCallback((key: PresetKey) => {
    const p = SESSION_PRESETS[key];
    setWorkDurationMin(p.workDurationMin);
    setShortBreakMin(p.shortBreakMin);
    setLongBreakMin(p.longBreakMin);
    setLongBreakEvery(p.longBreakEvery);
    setTotalSessions(p.totalSessions);
    setSoundEnabled(p.soundEnabled);
    setAutoStartNext(p.autoStartNext);
    setBeepFrequency(p.beepFrequency);
    setCurrentStep(0);
    setElapsedSec(0);
    setSessionsCompleted(0);
    setIsRunning(false);
    toast.info(`Applied preset: ${PRESET_LABELS[key]}`);
  }, []);

  const handleClear = useCallback(() => {
    setIsRunning(false);
    setCurrentStep(0);
    setElapsedSec(0);
    setSessionsCompleted(0);
    setWorkDurationMin(DEFAULT_SETTINGS.workDurationMin);
    setShortBreakMin(DEFAULT_SETTINGS.shortBreakMin);
    setLongBreakMin(DEFAULT_SETTINGS.longBreakMin);
    setLongBreakEvery(DEFAULT_SETTINGS.longBreakEvery);
    setTotalSessions(DEFAULT_SETTINGS.totalSessions);
    setSoundEnabled(DEFAULT_SETTINGS.soundEnabled);
    setAutoStartNext(DEFAULT_SETTINGS.autoStartNext);
    setBeepFrequency(DEFAULT_SETTINGS.beepFrequency);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  // Manual elapsed adjustment (for testing / scrubbing)
  const handleElapsedChange = useCallback((val: string) => {
    const sec = parseTime(val);
    setElapsedSec(sec);
  }, []);

  const text = useMemo(() => renderText(settings), [settings]);
  const csv = useMemo(() => renderCsv(settings), [settings]);

  const handleShare = useCallback(() => {
    return buildShareUrl(settings);
  }, [settings]);

  const phaseColor = PHASE_COLORS[currentPhase];
  const phaseIcon = currentPhase === "work" ? <Brain className="h-5 w-5" /> : <Coffee className="h-5 w-5" />;

  // Circular progress SVG
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs">Presets:</Label>
            {(Object.keys(SESSION_PRESETS) as PresetKey[]).map((k) => (
              <Button
                key={k}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => applyPreset(k)}
              >{PRESET_LABELS[k]}</Button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="space-y-1">
              <Label htmlFor="pt-work" className="text-[11px]">Work (min)</Label>
              <Input id="pt-work" type="number" min={1} step={1}
                value={workDurationMin}
                onChange={(e) => setWorkDurationMin(Number(e.target.value))}
                className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pt-short" className="text-[11px]">Short break</Label>
              <Input id="pt-short" type="number" min={0} step={1}
                value={shortBreakMin}
                onChange={(e) => setShortBreakMin(Number(e.target.value))}
                className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pt-long" className="text-[11px]">Long break</Label>
              <Input id="pt-long" type="number" min={0} step={1}
                value={longBreakMin}
                onChange={(e) => setLongBreakMin(Number(e.target.value))}
                className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pt-lbe" className="text-[11px]">Long every N</Label>
              <Input id="pt-lbe" type="number" min={1} step={1}
                value={longBreakEvery}
                onChange={(e) => setLongBreakEvery(Number(e.target.value))}
                className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pt-total" className="text-[11px]">Total sessions</Label>
              <Input id="pt-total" type="number" min={1} step={1}
                value={totalSessions}
                onChange={(e) => setTotalSessions(Number(e.target.value))}
                className="h-8 text-sm" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)} />
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              Sound
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={autoStartNext}
                onChange={(e) => setAutoStartNext(e.target.checked)} />
              Auto-start next phase
            </label>
            <div className="flex items-center gap-2 text-xs">
              <Label htmlFor="pt-freq" className="text-[11px]">Beep:</Label>
              <select id="pt-freq" value={beepFrequency}
                onChange={(e) => setBeepFrequency(e.target.value as BeepFrequency)}
                className="h-7 text-xs rounded border bg-background px-2"
              >
                <option value="low">Low (220 Hz)</option>
                <option value="medium">Medium (440 Hz)</option>
                <option value="high">High (880 Hz)</option>
              </select>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleTestBeep}>Test</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div style={{ color: phaseColor }}>{phaseIcon}</div>
              <Badge variant="outline" style={{ color: phaseColor, borderColor: phaseColor }}>
                {PHASE_LABELS[currentPhase]}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Session {Math.min(sessionsCompleted + (currentPhase === "work" ? 1 : 0), settings.totalSessions)} / {settings.totalSessions}
              </Badge>
            </div>

            {/* Circular progress */}
            <div className="relative">
              <svg width="220" height="220" viewBox="0 0 220 220" className="transform -rotate-90">
                <circle
                  cx="110" cy="110" r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-muted/30"
                />
                <circle
                  cx="110" cy="110" r={radius}
                  fill="none"
                  stroke={phaseColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  style={{ transition: "stroke-dashoffset 0.5s linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-mono text-4xl font-bold tabular-nums" style={{ color: phaseColor }}>
                  {formatTime(remainingSec)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  of {formatTime(currentDurationSec)}
                </div>
                {sessionsCompleted > 0 && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    <CheckCircle2 className="inline h-3 w-3 mr-1" />
                    {sessionsCompleted} done
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={handleStartPause} size="lg" className="gap-1.5">
                {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isRunning ? "Pause" : isLastStep && elapsedSec >= currentDurationSec ? "Restart" : "Start"}
              </Button>
              <Button variant="outline" onClick={handleSkip} className="gap-1.5">
                <SkipForward className="h-4 w-4" /> Skip
              </Button>
              <Button variant="outline" onClick={handleReset} className="gap-1.5">
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </div>

            {/* Manual scrub (for testing) */}
            <div className="flex items-center gap-2 text-xs">
              <Label htmlFor="pt-elapsed" className="text-[11px] text-muted-foreground">Adjust elapsed:</Label>
              <Input
                id="pt-elapsed"
                type="text"
                value={formatTime(elapsedSec)}
                onChange={(e) => handleElapsedChange(e.target.value)}
                className="h-7 w-20 font-mono text-xs"
              />
            </div>
          </div>

          {/* Estimate */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Work time" value={formatMinutes(estimate.workMin)} />
            <Stat label="Break time" value={formatMinutes(estimate.breakMin)} />
            <Stat label="Total time" value={formatMinutes(estimate.totalMin)} highlight="good" />
            <Stat label="Breaks" value={`${estimate.shortBreakCount}s + ${estimate.longBreakCount}l`} />
          </div>
        </CardContent>
      </Card>

      {sessionsCompleted > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Session progress
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Sessions" value={`${stats.sessionsCompleted} / ${settings.totalSessions}`} />
              <Stat label="Work done" value={formatMinutes(stats.totalWorkMin)} />
              <Stat label="Breaks done" value={formatMinutes(stats.totalBreakMin)} />
              <Stat label="Total time" value={formatMinutes(stats.totalMin)} highlight="good" />
            </div>
            <div className="flex flex-wrap gap-1 pt-2">
              {sequence.filter((s) => s.phase === "work").map((s) => (
                <div
                  key={s.stepIndex}
                  className={`h-2 w-8 rounded-full ${s.sessionNum <= sessionsCompleted ? "" : "bg-muted"}`}
                  style={s.sessionNum <= sessionsCompleted ? { backgroundColor: PHASE_COLORS.work } : undefined}
                  title={`Session ${s.sessionNum}: ${s.sessionNum <= sessionsCompleted ? "done" : "pending"}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Timer className="h-4 w-4" /> Plan ({sequence.length} steps)
          </h3>
          <div className="space-y-1 max-h-[300px] overflow-auto">
            {sequence.map((s) => {
              const isCurrent = s.stepIndex === currentStep;
              const isDone = s.phase === "work" && s.sessionNum <= sessionsCompleted;
              return (
                <div
                  key={s.stepIndex}
                  className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs ${
                    isCurrent ? "border-primary bg-primary/5" : "bg-background"
                  }`}
                >
                  <span className="font-mono text-muted-foreground w-8">{s.stepIndex + 1}</span>
                  <div
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PHASE_COLORS[s.phase] }}
                  />
                  <span className="font-medium">
                    {s.phase === "work"
                      ? `Work session ${s.sessionNum}`
                      : PHASE_LABELS[s.phase]}
                  </span>
                  <Badge variant="outline" className="text-[10px] ml-auto font-mono">
                    {formatTime(s.durationSec)}
                  </Badge>
                  {isDone && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <CopyButton getText={() => text} label="Copy plan" />
            <DownloadButton
              getText={() => text}
              filename="pomodoro-plan.txt"
              mime="text/plain"
              label="Download .txt"
            />
            <DownloadButton
              getText={() => csv}
              filename="pomodoro-plan.csv"
              mime="text/csv"
              label="Download CSV"
            />
            <ShareButton getUrl={handleShare} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {history.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent runs ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <span className="font-medium">{h.completedSessions} sessions</span>
                  <Badge variant="secondary" className="text-[10px] ml-2">
                    {formatMinutes(h.totalWorkMin)} work
                  </Badge>
                  <Badge variant="outline" className="text-[10px] ml-2">
                    {formatMinutes(h.totalBreakMin)} break
                  </Badge>
                  <Badge variant="outline" className="text-[10px] ml-2">
                    {formatMinutes(h.totalWorkMin + h.totalBreakMin)} total
                  </Badge>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Start your first Pomodoro session"
          hint="Click Start to begin a 25-minute work session. The timer beeps when each phase ends — pure Web Audio synthesis, no audio downloads."
          icon={<Timer className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> The timer runs entirely in your browser. Beeps are synthesized with the Web Audio API (no audio file downloads). History is stored in localStorage on this device only.
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
