"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, Flag, Plus, Timer, Bell, Volume2,
  History, Coffee, Dumbbell, Keyboard, X, Clock,
} from "lucide-react";
import {
  COLORS,
  ALARM_BEEP,
  POMODORO_PRESETS,
  TABATA_PRESETS,
  COUNTDOWN_PRESETS,
  KBD_SHORTCUTS,
  createStopwatch,
  createCountdown,
  createTabata,
  createTimer,
  startTimer,
  pauseTimer,
  resetTimer,
  addLap,
  toggleTimer,
  getSnapshot,
  advanceIfDone,
  markAlarmFired,
  computeLapStats,
  renderLapsText,
  renderLapsCsv,
  formatStopwatch,
  formatCountdown,
  parseDuration,
  serializeDuration,
  playBeep,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TimerState,
  type TimerKind,
  type TimerInit,
  type HistoryEntry,
} from "./logic";

let _colorIdx = 0;
function nextColor(): string {
  const c = COLORS[_colorIdx % COLORS.length];
  _colorIdx += 1;
  return c;
}

interface NewTimerDraft {
  kind: TimerKind;
  name: string;
  durationStr: string;
  workStr: string;
  restStr: string;
  rounds: number;
}

const DEFAULT_DRAFT: NewTimerDraft = {
  kind: "stopwatch",
  name: "",
  durationStr: "25m",
  workStr: "20s",
  restStr: "10s",
  rounds: 8,
};

export default function OnlineStopwatchTimer() {
  const [timers, setTimers] = useState<TimerState[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState<NewTimerDraft>(DEFAULT_DRAFT);
  const [alarmBanner, setAlarmBanner] = useState<TimerState | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [muted, setMuted] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const tickRef = useRef<number | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // ---- initial load: restore from URL or seed a default stopwatch ----
  useEffect(() => {
    setHistory(loadHistory());
    let restored = false;
    if (typeof window !== "undefined" && window.location.hash) {
      const init = parseShareUrl(window.location.hash);
      if (init) {
        const t = createTimer(init, nextColor());
        setTimers([t]);
        setFocusedId(t.id);
        toast.info("Loaded timer from share link");
        restored = true;
      }
    }
    if (!restored) {
      const t = createStopwatch("Stopwatch", nextColor());
      setTimers([t]);
      setFocusedId(t.id);
    }
  }, []);

  // ---- animation frame tick to re-render elapsed time ----
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      tickRef.current = requestAnimationFrame(tick);
    };
    tickRef.current = requestAnimationFrame(tick);
    return () => {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
    };
  }, []);

  // ---- advance timers + fire alarm when due ----
  useEffect(() => {
    let changed = false;
    let dueTimer: TimerState | null = null;
    const next = timers.map((t) => {
      const advanced = advanceIfDone(t, now);
      if (advanced !== t) changed = true;
      if (advanced.status === "done" && !advanced.alarmFired) {
        dueTimer = advanced;
        return markAlarmFired(advanced);
      }
      return advanced;
    });
    if (changed) setTimers(next);
    if (dueTimer && !mutedRef.current) {
      playBeep(ALARM_BEEP);
      setAlarmBanner(dueTimer);
    }
  }, [now, timers]);

  // ---- tab title ----
  useEffect(() => {
    if (typeof document === "undefined") return;
    const running = timers.find((t) => t.status === "running");
    if (running) {
      const snap = getSnapshot(running, now);
      const label =
        running.kind === "stopwatch"
          ? formatStopwatch(snap.elapsedMs)
          : formatCountdown(snap.remainingMs);
      document.title = `${label} · ${running.name}`;
    } else {
      document.title = "Online Stopwatch & Timer — UnQTools";
    }
  }, [timers, now]);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (!focusedId) return;
      const focused = timers.find((t) => t.id === focusedId);
      if (!focused) return;
      if (e.code === "Space") {
        e.preventDefault();
        handleToggle(focused);
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        handleLap(focused);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleReset(focused);
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        if (!mutedRef.current) {
          playBeep(ALARM_BEEP);
          toast.info("Beep test");
        }
      } else if (e.key === "Escape") {
        setAlarmBanner(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timers, focusedId]);

  // ---- actions ----
  const handleToggle = useCallback((t: TimerState) => {
    setTimers((prev) => prev.map((x) => (x.id === t.id ? toggleTimer(x, Date.now()) : x)));
  }, []);

  const handleReset = useCallback((t: TimerState) => {
    setTimers((prev) => prev.map((x) => (x.id === t.id ? resetTimer(x) : x)));
    toast.info(`${t.name} reset`);
  }, []);

  const handleLap = useCallback((t: TimerState) => {
    setTimers((prev) => prev.map((x) => (x.id === t.id ? addLap(x, Date.now()) : x)));
  }, []);

  const handleAddTimer = useCallback((init: TimerInit) => {
    const t = createTimer(init, nextColor());
    setTimers((prev) => [...prev, t]);
    setFocusedId(t.id);
  }, []);

  const handleRemoveTimer = useCallback((id: string) => {
    setTimers((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target) {
        const snap = getSnapshot(target, Date.now());
        saveHistory({
          ts: Date.now(),
          kind: target.kind,
          name: target.name,
          durationMs: target.durationMs,
          elapsedMs: snap.elapsedMs,
          lapCount: target.laps.length,
        });
        setHistory(loadHistory());
      }
      const next = prev.filter((x) => x.id !== id);
      if (focusedId === id) setFocusedId(next[0]?.id ?? null);
      return next;
    });
  }, [focusedId]);

  const handleClearAll = useCallback(() => {
    setTimers([]);
    setFocusedId(null);
    toast.info("All timers cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleDraftSubmit = useCallback(() => {
    if (draft.kind === "countdown") {
      const p = parseDuration(draft.durationStr);
      if (!p.ok) {
        toast.error(`Could not parse duration "${draft.durationStr}"`);
        return;
      }
      handleAddTimer({ kind: "countdown", name: draft.name || "Countdown", durationMs: p.ms });
    } else if (draft.kind === "tabata") {
      const w = parseDuration(draft.workStr);
      const r = parseDuration(draft.restStr);
      if (!w.ok || !r.ok) {
        toast.error("Could not parse work/rest durations");
        return;
      }
      handleAddTimer({
        kind: "tabata",
        name: draft.name || "Tabata",
        tabata: { workMs: w.ms, restMs: r.ms, rounds: Math.max(1, draft.rounds) },
      });
    } else {
      handleAddTimer({ kind: "stopwatch", name: draft.name || "Stopwatch" });
    }
  }, [draft, handleAddTimer]);

  const handleShare = useCallback((t: TimerState) => {
    const init: TimerInit = { kind: t.kind, name: t.name, color: t.color };
    if (t.kind === "countdown") init.durationMs = t.durationMs;
    if (t.kind === "tabata" && t.tabata) init.tabata = t.tabata;
    return buildShareUrl(init);
  }, []);

  // ---- derived ----
  const totalRunning = useMemo(
    () => timers.filter((t) => t.status === "running").length,
    [timers],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Add-timer draft */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            {(["stopwatch", "countdown", "tabata"] as TimerKind[]).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={draft.kind === k ? "default" : "outline"}
                onClick={() => setDraft((d) => ({ ...d, kind: k }))}
                className="capitalize gap-1.5"
              >
                {k === "stopwatch" && <Clock className="h-3.5 w-3.5" />}
                {k === "countdown" && <Timer className="h-3.5 w-3.5" />}
                {k === "tabata" && <Dumbbell className="h-3.5 w-3.5" />}
                {k}
              </Button>
            ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <Label htmlFor="ost-name" className="text-xs">Name</Label>
              <Input
                id="ost-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder={draft.kind === "stopwatch" ? "Stopwatch" : draft.kind === "countdown" ? "Countdown" : "Tabata"}
                className="h-8 text-sm"
              />
            </div>
            {draft.kind === "countdown" && (
              <div>
                <Label htmlFor="ost-dur" className="text-xs">Duration (e.g. 25m, 1h30m, 90s)</Label>
                <Input
                  id="ost-dur"
                  value={draft.durationStr}
                  onChange={(e) => setDraft((d) => ({ ...d, durationStr: e.target.value }))}
                  className="h-8 text-sm font-mono"
                />
              </div>
            )}
            {draft.kind === "tabata" && (
              <>
                <div>
                  <Label htmlFor="ost-work" className="text-xs">Work (e.g. 20s)</Label>
                  <Input
                    id="ost-work"
                    value={draft.workStr}
                    onChange={(e) => setDraft((d) => ({ ...d, workStr: e.target.value }))}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="ost-rest" className="text-xs">Rest (e.g. 10s)</Label>
                  <Input
                    id="ost-rest"
                    value={draft.restStr}
                    onChange={(e) => setDraft((d) => ({ ...d, restStr: e.target.value }))}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="ost-rounds" className="text-xs">Rounds</Label>
                  <Input
                    id="ost-rounds"
                    type="number"
                    min={1}
                    value={draft.rounds}
                    onChange={(e) => setDraft((d) => ({ ...d, rounds: Math.max(1, parseInt(e.target.value || "1", 10)) }))}
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </>
            )}
          </div>

          {/* Presets */}
          <div className="space-y-1.5">
            <Label className="text-xs">Presets</Label>
            <div className="flex flex-wrap gap-1">
              {POMODORO_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] gap-1"
                  onClick={() => handleAddTimer({ kind: "countdown", name: p.label, durationMs: p.durationMs! })}
                >
                  <Coffee className="h-3 w-3" /> {p.label}
                </Button>
              ))}
              {TABATA_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] gap-1"
                  onClick={() => handleAddTimer({ kind: "tabata", name: p.label, tabata: p.tabata! })}
                >
                  <Dumbbell className="h-3 w-3" /> {p.label}
                </Button>
              ))}
              {COUNTDOWN_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] gap-1"
                  onClick={() => handleAddTimer({ kind: "countdown", name: p.label, durationMs: p.durationMs! })}
                >
                  <Timer className="h-3 w-3" /> {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={handleDraftSubmit} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add {draft.kind}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMuted((m) => !m)}
              className="gap-1.5"
            >
              <Volume2 className="h-3.5 w-3.5" />
              {muted ? "Unmute" : "Mute"} alarm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowShortcuts((s) => !s)}
              className="gap-1.5"
            >
              <Keyboard className="h-3.5 w-3.5" /> Shortcuts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shortcuts panel */}
      {showShortcuts && (
        <Card>
          <CardContent className="p-3">
            <div className="grid sm:grid-cols-3 gap-2 text-xs">
              {KBD_SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">{s.label}</Badge>
                  <span className="text-muted-foreground">{s.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timers */}
      {timers.length === 0 ? (
        <EmptyState
          title="No timers running"
          hint="Add a stopwatch, countdown or Tabata timer above. Multiple timers can run simultaneously."
          icon={<Timer className="h-8 w-8" />}
        />
      ) : (
        <div className="grid gap-3">
          {timers.map((t) => (
            <TimerCard
              key={t.id}
              state={t}
              now={now}
              focused={focusedId === t.id}
              onFocus={() => setFocusedId(t.id)}
              onToggle={() => handleToggle(t)}
              onReset={() => handleReset(t)}
              onLap={() => handleLap(t)}
              onRemove={() => handleRemoveTimer(t.id)}
              onShare={() => handleShare(t)}
            />
          ))}
        </div>
      )}

      {/* Footer toolbar */}
      {timers.length > 0 && (
        <Card>
          <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {timers.length} timer{timers.length !== 1 ? "s" : ""} · {totalRunning} running
            </span>
            <ClearButton onClick={handleClearAll} label="Clear all timers" />
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
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 10).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="outline" className="mr-2">{h.kind}</Badge>
                  <span className="font-mono font-medium mr-2">{h.name}</span>
                  {h.durationMs > 0 && (
                    <Badge variant="secondary" className="text-[10px] mr-1">{serializeDuration(h.durationMs)}</Badge>
                  )}
                  {h.lapCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] mr-1">{h.lapCount} laps</Badge>
                  )}
                  <span className="text-muted-foreground ml-2">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alarm banner */}
      {alarmBanner && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Bell className="h-5 w-5 text-destructive animate-bounce" />
            <div className="flex-1">
              <div className="text-sm font-semibold">⏰ {alarmBanner.name} finished!</div>
              <div className="text-xs text-muted-foreground">
                {alarmBanner.kind === "countdown"
                  ? `${alarmBanner.name} countdown complete`
                  : alarmBanner.kind === "tabata"
                    ? `${alarmBanner.tabata?.rounds} rounds done`
                    : "Alarm"}
              </div>
            </div>
            {!muted && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => playBeep(ALARM_BEEP)}
                className="gap-1.5"
              >
                <Volume2 className="h-3.5 w-3.5" /> Replay
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => setAlarmBanner(null)}>
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All timing runs locally using the browser clock + Web Audio API.
            Timer state and history are stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface TimerCardProps {
  state: TimerState;
  now: number;
  focused: boolean;
  onFocus: () => void;
  onToggle: () => void;
  onReset: () => void;
  onLap: () => void;
  onRemove: () => void;
  onShare: () => string;
}

function TimerCard({
  state, now, focused, onFocus, onToggle, onReset, onLap, onRemove, onShare,
}: TimerCardProps) {
  const snap = getSnapshot(state, now);
  const stats = computeLapStats(state.laps);
  const isStopwatch = state.kind === "stopwatch";
  const mainLabel = isStopwatch
    ? formatStopwatch(snap.elapsedMs)
    : formatCountdown(snap.remainingMs);

  const phaseLabel = snap.phase === "work"
    ? "WORK"
    : snap.phase === "rest"
      ? "REST"
      : snap.phase === "done"
        ? "DONE"
        : "";

  return (
    <Card
      onClick={onFocus}
      className={`cursor-pointer transition-shadow ${focused ? "ring-2 ring-primary" : ""}`}
      style={{ borderTopColor: state.color, borderTopWidth: 3 }}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: state.color }}
              aria-hidden
            />
            <span className="font-semibold text-sm text-foreground">{state.name}</span>
            <Badge variant="outline" className="text-[10px] capitalize">{state.kind}</Badge>
            {state.status === "running" && (
              <Badge variant="default" className="text-[10px]">Running</Badge>
            )}
            {state.status === "paused" && (
              <Badge variant="secondary" className="text-[10px]">Paused</Badge>
            )}
            {state.status === "done" && (
              <Badge variant="destructive" className="text-[10px]">Done</Badge>
            )}
            {focused && <Badge variant="outline" className="text-[10px]">Focused</Badge>}
          </div>
          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Big display */}
        <div className="flex items-center justify-center py-2">
          <div className="text-center">
            <div className={`font-mono tabular-nums leading-none ${mainLabel.length > 8 ? "text-4xl" : "text-6xl"} font-bold text-foreground`}>
              {mainLabel}
            </div>
            {!isStopwatch && (
              <div className="mt-1 h-2 w-64 max-w-full mx-auto rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{ width: `${Math.round(snap.progress * 100)}%`, background: state.color }}
                />
              </div>
            )}
            {state.kind === "tabata" && (
              <div className="mt-1 text-xs text-muted-foreground">
                {phaseLabel && <span className="font-mono mr-2">{phaseLabel}</span>}
                Round <span className="font-mono">{snap.round}</span> / {snap.totalRounds}
                {snap.remainingInPhaseMs >= 0 && (
                  <span className="ml-2">· {formatCountdown(snap.remainingInPhaseMs)} in phase</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            disabled={state.status === "done"}
            className="gap-1.5"
          >
            {state.status === "running" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {state.status === "running" ? "Pause" : state.status === "paused" ? "Resume" : "Start"}
          </Button>
          {isStopwatch && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => { e.stopPropagation(); onLap(); }}
              disabled={state.status !== "running"}
              className="gap-1.5"
            >
              <Flag className="h-3.5 w-3.5" /> Lap
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => { e.stopPropagation(); onReset(); }}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <ShareButton getUrl={() => onShare()} />
        </div>

        {/* Laps table (stopwatch only) */}
        {isStopwatch && state.laps.length > 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <MiniStat label="Fastest" value={formatStopwatch(stats.fastestMs)} highlight="good" />
              <MiniStat label="Slowest" value={formatStopwatch(stats.slowestMs)} highlight="bad" />
              <MiniStat label="Average" value={formatStopwatch(stats.averageMs)} />
            </div>
            <div className="max-h-[180px] overflow-auto rounded border bg-background">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Lap</th>
                    <th className="px-2 py-1 text-right">Split</th>
                    <th className="px-2 py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...state.laps].reverse().map((l) => {
                    const isFastest = stats.count > 1 && l.lapTimeMs === stats.fastestMs;
                    const isSlowest = stats.count > 1 && l.lapTimeMs === stats.slowestMs;
                    return (
                      <tr key={l.index} className="border-t">
                        <td className="px-2 py-1 font-mono">{l.index}</td>
                        <td className={`px-2 py-1 text-right font-mono ${isFastest ? "text-emerald-600 dark:text-emerald-400" : isSlowest ? "text-red-600 dark:text-red-400" : ""}`}>
                          {formatStopwatch(l.lapTimeMs)}
                        </td>
                        <td className="px-2 py-1 text-right font-mono text-muted-foreground">
                          {formatStopwatch(l.totalTimeMs)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => renderLapsText(state.laps)}
                label="Copy laps"
              />
              <DownloadButton
                getText={() => renderLapsCsv(state.laps)}
                filename={`${state.name.replace(/\s+/g, "-").toLowerCase()}-laps.csv`}
                mime="text/csv"
                label="Download CSV"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label, value, highlight,
}: { label: string; value: string; highlight?: "good" | "bad" }) {
  const color = highlight === "good"
    ? "text-emerald-600 dark:text-emerald-400"
    : highlight === "bad"
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm ${color}`}>{value}</div>
    </div>
  );
}
