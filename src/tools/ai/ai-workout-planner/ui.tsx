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
  RunButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  HISTORY_MAX,
  GOAL_LABELS,
  GOAL_DESCRIPTIONS,
  LEVEL_LABELS,
  EQUIPMENT_LABELS,
  SPLIT_LABELS,
  SPLIT_DESCRIPTIONS,
  MUSCLE_LABELS,
  SESSION_LENGTHS,
  DEFAULT_OPTIONS,
  EXERCISE_MAP,
  generatePlan,
  computeStats,
  applyDeload,
  isDeloadWeek,
  findSwap,
  renderMarkdown,
  renderJson,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  saveLog,
  loadLogs,
  clearLogs,
  computeProgressionForExercise,
  type Goal,
  type Level,
  type Equipment,
  type Split,
  type PlanOptions,
  type WorkoutPlan,
  type PlannedExercise,
  type HistoryEntry,
} from "./logic";
import {
  Dumbbell, History, Key, Sparkles, AlertCircle,
  ChevronDown, ChevronRight, Calendar, Activity, RotateCw,
} from "lucide-react";

const GOAL_KEYS = Object.keys(GOAL_LABELS) as Goal[];
const LEVEL_KEYS = Object.keys(LEVEL_LABELS) as Level[];
const EQUIP_KEYS = Object.keys(EQUIPMENT_LABELS) as Equipment[];
const SPLIT_KEYS = Object.keys(SPLIT_LABELS) as Split[];

export default function AiWorkoutPlanner() {
  const [options, setOptions] = useState<PlanOptions>({ ...DEFAULT_OPTIONS });
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState<string>("");
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [showCues, setShowCues] = useState(true);
  const [deloadWeek, setDeloadWeek] = useState(1);
  const [deloadApplied, setDeloadApplied] = useState(false);
  const [logs, setLogs] = useState(() => loadLogs());

  // LLM
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic" | "openrouter">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmOutput, setLlmOutput] = useState<string>("");

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.options && Object.keys(p.options).length > 0) {
        setOptions((prev) => ({ ...prev, ...p.options }));
        toast.info("Loaded options from share link");
      }
    }
  }, []);

  const updateOption = useCallback(<K extends keyof PlanOptions>(key: K, value: PlanOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleGenerate = useCallback(() => {
    setError("");
    let p = generatePlan(options);
    if (deloadApplied) p = applyDeload(p);
    if (p.sessions.length === 0) {
      setError(p.warnings[0] ?? "Could not generate plan");
      toast.error("Failed to generate plan");
      return;
    }
    setPlan(p);
    setActiveDayIdx(0);
    setHasGenerated(true);
    saveHistory({
      ts: Date.now(),
      goal: options.goal,
      level: options.level,
      equipment: options.equipment,
      daysPerWeek: options.daysPerWeek,
      sessionLengthMin: options.sessionLengthMin,
      split: options.split,
      totalExercises: p.totalExercises,
      totalSets: p.totalSets,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${p.sessions.length}-day plan — ${p.totalExercises} exercises, ${p.totalSets} sets`);
  }, [options, deloadApplied]);

  const handleSwap = useCallback((dayIdx: number, exIdx: number) => {
    if (!plan) return;
    const session = plan.sessions[dayIdx];
    const ex = session.exercises[exIdx];
    const swap = findSwap(ex.exerciseId, options.equipment);
    if (!swap) {
      toast.error("No swap available for this exercise");
      return;
    }
    // Build new planned exercise with same scheme.
    const scheme = ex.sets[0];
    const newSets = ex.sets.map((s) => ({ ...s }));
    const newEx: PlannedExercise = {
      exerciseId: swap.id,
      name: swap.name,
      muscle: swap.muscle,
      category: swap.category,
      sets: newSets,
      formCue: swap.formCue,
      notes: `Swapped from ${ex.name}. Reps/rest unchanged.`,
    };
    void scheme;
    const newSessions = plan.sessions.map((s, i) => {
      if (i !== dayIdx) return s;
      return { ...s, exercises: s.exercises.map((e, j) => j === exIdx ? newEx : e) };
    });
    setPlan({ ...plan, sessions: newSessions });
    toast.success(`Swapped to ${swap.name}`);
  }, [plan, options.equipment]);

  const handleLogSession = useCallback((dayIdx: number) => {
    if (!plan) return;
    const session = plan.sessions[dayIdx];
    // Build a simple log: assume all reps hit at 5 for strength, or top of rep range.
    const exercises = session.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      sets: ex.sets.map((s) => ({
        setNumber: s.setNumber,
        reps: typeof s.reps === "string" && s.reps.includes("-")
          ? parseInt(s.reps.split("-")[1], 10)
          : parseInt(s.reps, 10) || 5,
        weightKg: undefined,
      })),
    }));
    saveLog({
      ts: Date.now(),
      day: session.day,
      exercises,
    });
    setLogs(loadLogs());
    toast.success(`Logged Day ${session.day} — ${exercises.length} exercises`);
  }, [plan]);

  const handleToggleDeload = useCallback(() => {
    setDeloadApplied((prev) => !prev);
  }, []);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste an API key first");
      return;
    }
    setLlmLoading(true);
    try {
      const prompt = buildLlmPrompt(options);
      const text = await callLlm(llmProvider, llmKey, prompt.system, prompt.user);
      setLlmOutput(renderLlmResult(text));
      toast.success("LLM plan generated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`LLM call failed: ${msg}`);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, options]);

  const handleClear = useCallback(() => {
    setOptions({ ...DEFAULT_OPTIONS });
    setPlan(null);
    setHasGenerated(false);
    setError("");
    setLlmOutput("");
    setDeloadApplied(false);
    setDeloadWeek(1);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleClearLogs = useCallback(() => {
    clearLogs();
    setLogs([]);
    toast.success("Workout logs cleared");
  }, []);

  const stats = useMemo(() => plan ? computeStats(plan) : null, [plan]);
  const md = useMemo(() => plan ? renderMarkdown(plan) : "", [plan]);
  const json = useMemo(() => plan ? renderJson(plan) : "", [plan]);
  const csv = useMemo(() => plan ? renderCsv(plan) : "", [plan]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="awp-goal">Goal</Label>
              <select
                id="awp-goal"
                value={options.goal}
                onChange={(e) => updateOption("goal", e.target.value as Goal)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {GOAL_KEYS.map((g) => (
                  <option key={g} value={g}>{GOAL_LABELS[g]}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">{GOAL_DESCRIPTIONS[options.goal]}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="awp-level">Experience level</Label>
              <select
                id="awp-level"
                value={options.level}
                onChange={(e) => updateOption("level", e.target.value as Level)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {LEVEL_KEYS.map((l) => (
                  <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="awp-equip">Equipment</Label>
              <select
                id="awp-equip"
                value={options.equipment}
                onChange={(e) => updateOption("equipment", e.target.value as Equipment)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {EQUIP_KEYS.map((eq) => (
                  <option key={eq} value={eq}>{EQUIPMENT_LABELS[eq]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="awp-split">Split</Label>
              <select
                id="awp-split"
                value={options.split}
                onChange={(e) => updateOption("split", e.target.value as Split)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {SPLIT_KEYS.map((sp) => (
                  <option key={sp} value={sp}>{SPLIT_LABELS[sp]}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">{SPLIT_DESCRIPTIONS[options.split]}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="awp-days">Days per week</Label>
              <Input
                id="awp-days"
                type="number"
                min={1}
                max={7}
                value={options.daysPerWeek}
                onChange={(e) => updateOption("daysPerWeek", Math.max(1, Math.min(7, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="awp-len">Session length (min)</Label>
              <select
                id="awp-len"
                value={options.sessionLengthMin}
                onChange={(e) => updateOption("sessionLengthMin", Number(e.target.value))}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {SESSION_LENGTHS.map((s) => (
                  <option key={s} value={s}>{s} min</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="awp-deload">Deload every N weeks (0 = off)</Label>
              <Input
                id="awp-deload"
                type="number"
                min={0}
                max={12}
                value={options.deloadEveryN}
                onChange={(e) => updateOption("deloadEveryN", Math.max(0, Math.min(12, Number(e.target.value) || 0)))}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Mobility add-on</Label>
            <div className="pt-1">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.includeMobility}
                  onChange={(e) => updateOption("includeMobility", e.target.checked)}
                />
                Include mobility / cool-down stretch in each session
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate plan" />
            <ShareButton getUrl={() => buildShareUrl(options)} />
            <Button
              variant={deloadApplied ? "default" : "outline"}
              size="sm"
              onClick={handleToggleDeload}
              className="gap-1.5"
            >
              <RotateCw className="h-3.5 w-3.5" />
              {deloadApplied ? "Deload applied" : "Apply deload"}
            </Button>
            <ClearButton onClick={handleClear} />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {hasGenerated && plan ? (
        <>
          {plan.warnings.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> Notes ({plan.warnings.length})
                </h3>
                <div className="space-y-1">
                  {plan.warnings.map((w, i) => (
                    <div key={i} className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                      {w}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {stats && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Activity className="h-4 w-4" /> Plan summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Sessions" value={stats.days} />
                  <Stat label="Exercises" value={stats.totalExercises} />
                  <Stat label="Total sets" value={stats.totalSets} />
                  <Stat label="Weekly min" value={stats.estimatedWeeklyMin} />
                </div>
                <div className="space-y-1 pt-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Sets per muscle group</div>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(MUSCLE_LABELS) as (keyof typeof MUSCLE_LABELS)[]).map((m) =>
                      stats.byMuscle[m] > 0 ? (
                        <Badge key={m} variant="outline" className="text-[10px]">
                          {MUSCLE_LABELS[m]}: {stats.byMuscle[m]}
                        </Badge>
                      ) : null,
                    )}
                  </div>
                </div>
                <div className="rounded border bg-background px-3 py-2 mt-2">
                  <div className="text-xs font-semibold text-foreground">{plan.progression.name}</div>
                  <div className="text-[11px] text-muted-foreground">{plan.progression.description}</div>
                  <div className="text-[11px] text-primary mt-1">Weekly: {plan.progression.weeklyIncrement}</div>
                  {plan.deloadWeekEveryN > 0 && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Deload week every {plan.deloadWeekEveryN} weeks (60% volume, ~10% load reduction).
                      Next deload: week {Math.ceil(deloadWeek / plan.deloadWeekEveryN) * plan.deloadWeekEveryN}.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> Sessions ({plan.sessions.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => md} label="Copy MD" />
                  <DownloadButton getText={() => md} filename="workout-plan.md" mime="text/markdown" label="Download MD" />
                  <DownloadButton getText={() => json} filename="workout-plan.json" mime="application/json" label="JSON" />
                  <DownloadButton getText={() => csv} filename="workout-plan.csv" mime="text/csv" label="CSV" />
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {plan.sessions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveDayIdx(i)}
                    className={`px-2 py-1 rounded text-[11px] font-mono ${i === activeDayIdx ? "bg-primary text-primary-foreground" : "bg-background border text-foreground"}`}
                  >
                    Day {s.day}
                  </button>
                ))}
              </div>

              {plan.sessions[activeDayIdx] && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{plan.sessions[activeDayIdx].label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Focus: {plan.sessions[activeDayIdx].focus} · Est {plan.sessions[activeDayIdx].estimatedMin} min
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => handleLogSession(activeDayIdx)}>
                        Log this session
                      </Button>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground rounded border bg-muted/30 px-2 py-1.5">
                    <strong className="text-foreground">Warm-up:</strong> {plan.sessions[activeDayIdx].warmup}
                  </div>
                  <div className="space-y-1">
                    {plan.sessions[activeDayIdx].exercises.map((ex, exIdx) => (
                      <ExerciseRow
                        key={`${activeDayIdx}-${exIdx}`}
                        ex={ex}
                        showCue={showCues}
                        onSwap={() => handleSwap(activeDayIdx, exIdx)}
                        progression={
                          computeProgressionForExercise(ex.exerciseId, logs)
                        }
                      />
                    ))}
                  </div>
                  <div className="text-[11px] text-muted-foreground rounded border bg-muted/30 px-2 py-1.5">
                    <strong className="text-foreground">Cool-down:</strong> {plan.sessions[activeDayIdx].cooldown}
                  </div>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowCues((v) => !v)}
                  className="flex items-center gap-1 text-xs font-semibold text-foreground"
                >
                  {showCues ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {showCues ? "Hide form cues" : "Show form cues"}
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Key className="h-4 w-4" /> Optional: Enhance with BYO-key LLM
              </h3>
              <p className="text-xs text-muted-foreground">
                Paste your own API key (OpenAI / Anthropic / OpenRouter) to ask an LLM for an alternative plan. Key stays in your browser.
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic" | "openrouter")}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
                <Input
                  type="password"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  placeholder="sk-..."
                  className="h-8 text-xs flex-1 min-w-[200px]"
                />
                <Button size="sm" onClick={handleLlmEnhance} disabled={llmLoading} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  {llmLoading ? "Working…" : "Generate with LLM"}
                </Button>
              </div>
              {llmOutput && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">LLM-generated plan</span>
                    <CopyButton getText={() => llmOutput} label="Copy" size="sm" />
                    <DownloadButton getText={() => llmOutput} filename="workout-plan-llm.md" label="Download" size="sm" />
                  </div>
                  <pre className="bg-muted/50 dark:bg-muted/20 rounded p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
                    {llmOutput}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Build a personalized, progressive workout plan"
          hint="Pick your goal, level, equipment, days/week, session length, and split. We'll generate a weekly plan with exercises, sets/reps/RIR, rest, warm-up, cool-down, and a progression scheme — plus deload weeks, equipment-aware swaps, and a local workout logger."
          icon={<Dumbbell className="h-8 w-8" />}
        />
      )}

      {logs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4" /> Workout logs ({logs.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearLogs}>Clear logs</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {logs.slice(-10).reverse().map((l, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="outline" className="mr-2">Day {l.day}</Badge>
                  <Badge variant="outline" className="mr-2">{l.exercises.length} exercises</Badge>
                  <span className="text-muted-foreground">{new Date(l.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent (last {HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{GOAL_LABELS[h.goal]}</Badge>
                  <Badge variant="outline" className="mr-2">{LEVEL_LABELS[h.level]}</Badge>
                  <Badge variant="outline" className="mr-2">{EQUIPMENT_LABELS[h.equipment]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.daysPerWeek}d/{h.sessionLengthMin}m</Badge>
                  <Badge variant="outline" className="mr-2">{SPLIT_LABELS[h.split]}</Badge>
                  <span className="text-muted-foreground">{h.totalExercises} ex · {h.totalSets} sets</span>
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
            <strong className="text-foreground">Privacy & Honesty:</strong> All plan generation, exercise selection, progression math, logging, and deload logic run locally. Workout logs never leave this device. This is general fitness guidance, not medical or certified coaching advice — consult a professional for injuries or medical conditions. On-device models are less nuanced than BYO-key. Nothing uploaded or logged by us.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ExerciseRow({
  ex,
  showCue,
  onSwap,
  progression,
}: {
  ex: PlannedExercise;
  showCue: boolean;
  onSwap: () => void;
  progression: { action: "increase" | "hold" | "deload"; reason: string } | null;
}) {
  const scheme = ex.sets[0];
  const progressBadge = progression
    ? progression.action === "increase"
      ? { label: "↑ Increase", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" }
      : progression.action === "deload"
        ? { label: "↓ Deload", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" }
        : { label: "= Hold", className: "bg-muted/40 text-muted-foreground" }
    : null;
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{ex.name}</span>
            <Badge variant="outline" className="text-[10px]">{MUSCLE_LABELS[ex.muscle]}</Badge>
            <Badge variant="outline" className="text-[10px]">{ex.category}</Badge>
            {progressBadge && (
              <Badge className={`text-[10px] ${progressBadge.className}`} title={progression?.reason}>
                {progressBadge.label}
              </Badge>
            )}
          </div>
          {showCue && <p className="text-[10px] text-muted-foreground mt-0.5">{ex.formCue}</p>}
          {ex.notes && <p className="text-[10px] text-primary mt-0.5">{ex.notes}</p>}
        </div>
        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={onSwap}>Swap</Button>
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1 text-[10px] text-muted-foreground">
        <div><strong className="text-foreground">{ex.sets.length}</strong> sets</div>
        <div><strong className="text-foreground">{scheme?.reps ?? "—"}</strong> reps</div>
        <div>RIR <strong className="text-foreground">{scheme?.rir === -1 ? "n/a" : scheme?.rir ?? "—"}</strong></div>
        <div>rest <strong className="text-foreground">{scheme?.restSec ?? "—"}s</strong></div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

// ---- LLM network call (kept here because it touches the network) ----

async function callLlm(
  provider: "openai" | "anthropic" | "openrouter",
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        system,
        max_tokens: 1800,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json() as { content: { text: string }[] };
    return data.content?.map((c) => c.text).join("") ?? "";
  }
  // openrouter
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

// Suppress unused-import lint (EXERCISE_MAP may be referenced for swap lookups in future)
export type _Unused = typeof EXERCISE_MAP | typeof isDeloadWeek;
