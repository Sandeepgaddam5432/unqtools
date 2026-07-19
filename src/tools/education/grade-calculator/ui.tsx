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
  GRADING_SCALE_OPTIONS,
  GRADING_SCALE_LABELS,
  GPA_SCALE_OPTIONS,
  GPA_SCALE_LABELS,
  DEFAULTS,
  SAMPLE_ASSIGNMENTS,
  parseAssignments,
  parseCustomThresholds,
  validateAssignments,
  computeSummaryStats,
  computeWhatIf,
  computeGradeNeeded,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type GradingScale,
  type GpaScale,
  type HistoryEntry,
} from "./logic";
import {
  GraduationCap, History, AlertCircle, AlertTriangle,
  TrendingUp, Target, Award, Calculator,
} from "lucide-react";

export default function GradeCalculator() {
  const [assignmentsText, setAssignmentsText] = useState("");
  const [targetGrade, setTargetGrade] = useState(DEFAULTS.targetGrade);
  const [gradingScale, setGradingScale] = useState<GradingScale>(DEFAULTS.gradingScale);
  const [gpaScale, setGpaScale] = useState<GpaScale>(DEFAULTS.gpaScale);
  const [customThresholdsText, setCustomThresholdsText] = useState("");
  const [whatIfScore, setWhatIfScore] = useState(80);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load share URL on mount
  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.assignmentsText) setAssignmentsText(p.assignmentsText);
      setTargetGrade(p.targetGrade);
      setGradingScale(p.gradingScale);
      setGpaScale(p.gpaScale);
      if (p.assignmentsText) toast.info("Loaded from share link");
    }
  }, []);

  const assignments = useMemo(() => parseAssignments(assignmentsText), [assignmentsText]);
  const customThresholds = useMemo(
    () => parseCustomThresholds(customThresholdsText),
    [customThresholdsText],
  );
  const validation = useMemo(() => validateAssignments(assignments), [assignments]);
  const stats = useMemo(
    () => computeSummaryStats(assignments, targetGrade, gradingScale, gpaScale, customThresholds),
    [assignments, targetGrade, gradingScale, gpaScale, customThresholds],
  );
  const whatIf = useMemo(
    () => computeWhatIf(assignments, whatIfScore, gradingScale, gpaScale, customThresholds),
    [assignments, whatIfScore, gradingScale, gpaScale, customThresholds],
  );

  const text = useMemo(
    () => renderText(assignments, stats, gradingScale, gpaScale),
    [assignments, stats, gradingScale, gpaScale],
  );
  const csv = useMemo(() => renderCsv(assignments), [assignments]);

  const handleSaveHistory = useCallback(() => {
    if (assignments.length > 0) {
      saveHistory({
        ts: Date.now(),
        currentGrade: stats.currentGrade,
        targetGrade,
        gradeNeeded: stats.gradeNeeded,
        currentGpa: stats.currentGpa,
        assignmentCount: assignments.length,
      });
      setHistory(loadHistory());
    }
  }, [assignments.length, stats.currentGrade, stats.gradeNeeded, stats.currentGpa, targetGrade]);

  const handleClear = useCallback(() => {
    setAssignmentsText("");
    setTargetGrade(DEFAULTS.targetGrade);
    setGradingScale(DEFAULTS.gradingScale);
    setGpaScale(DEFAULTS.gpaScale);
    setCustomThresholdsText("");
    setWhatIfScore(80);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback(() => {
    setAssignmentsText(SAMPLE_ASSIGNMENTS);
    toast.success("Loaded sample assignments");
  }, []);

  const gradeNeeded = useMemo(
    () => computeGradeNeeded(assignments, targetGrade),
    [assignments, targetGrade],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gc-assignments">
              Assignments (one per line: name,score,max_score,weight_percent)
            </Label>
            <Textarea
              id="gc-assignments"
              value={assignmentsText}
              onChange={(e) => setAssignmentsText(e.target.value)}
              placeholder={"Midterm,85,100,25\nQuiz 1,18,20,10\nQuiz 2,,20,10\nFinal,,100,40\nProject,45,50,15"}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Leave score empty for unattempted assignments. Lines starting with <code>#</code> are comments. Names with commas should be quoted.
            </p>
            <div className="flex flex-wrap gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={handleLoadSample}
              >+ Load sample</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gc-target">Target grade (%)</Label>
              <Input
                id="gc-target"
                type="number"
                min={0}
                max={100}
                value={targetGrade}
                onChange={(e) => setTargetGrade(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-scale">Grading scale</Label>
              <select
                id="gc-scale"
                value={gradingScale}
                onChange={(e) => setGradingScale(e.target.value as GradingScale)}
                className="w-full h-9 rounded border bg-background px-3 text-sm"
              >
                {GRADING_SCALE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{GRADING_SCALE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-gpa">GPA scale</Label>
              <select
                id="gc-gpa"
                value={gpaScale}
                onChange={(e) => setGpaScale(e.target.value as GpaScale)}
                className="w-full h-9 rounded border bg-background px-3 text-sm"
              >
                {GPA_SCALE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{GPA_SCALE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-whatif">What-if: assume score (%)</Label>
              <Input
                id="gc-whatif"
                type="number"
                min={0}
                max={100}
                value={whatIfScore}
                onChange={(e) => setWhatIfScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              />
            </div>
          </div>

          {gradingScale === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="gc-custom">
                Custom thresholds (one per line: minPercent,letter,gpa)
              </Label>
              <Textarea
                id="gc-custom"
                value={customThresholdsText}
                onChange={(e) => setCustomThresholdsText(e.target.value)}
                placeholder={"85,HD,4.0\n75,D,3.0\n65,C,2.0\n50,P,1.0\n0,F,0.0"}
                className="min-h-[80px] resize-y font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Define your own grade boundaries. Higher minPercent wins. Lines are sorted automatically.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation warnings/errors */}
      {validation.errors.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-1">
            {validation.errors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{e}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {validation.warnings.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-1">
            {validation.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {assignments.length === 0 ? (
        <EmptyState
          title="Enter assignments to calculate your grade"
          hint="Add assignments as CSV-style lines (name,score,max_score,weight_percent). Leave score empty for upcoming work. Click 'Load sample' to see how it works."
          icon={<GraduationCap className="h-8 w-8" />}
        />
      ) : (
        <>
          {/* Summary stats */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Calculator className="h-4 w-4" /> Grade summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                <Stat
                  label="Current grade"
                  value={`${stats.currentGrade}%`}
                  sub={`${stats.currentLetter} · GPA ${stats.currentGpa}`}
                  highlight="good"
                />
                <Stat
                  label="Target grade"
                  value={`${stats.targetGrade}%`}
                  sub={`${stats.targetLetter} · GPA ${stats.targetGpa}`}
                />
                <Stat
                  label="Grade needed"
                  value={stats.gradeNeeded != null ? `${stats.gradeNeeded}%` : "—"}
                  sub={stats.gradeNeeded != null
                    ? `${stats.neededLetter} · GPA ${stats.neededGpa}`
                    : "no remaining work"}
                  highlight={
                    stats.gradeNeeded != null && stats.gradeNeeded > 100 ? "bad" : "good"
                  }
                />
                <Stat
                  label={`What-if @ ${whatIfScore}%`}
                  value={`${whatIf.projectedFinalGrade}%`}
                  sub={`${whatIf.projectedLetter} · GPA ${whatIf.projectedGpa}`}
                />
                <Stat label="Total weight" value={`${stats.totalWeight}%`} />
                <Stat
                  label="Attempted"
                  value={`${stats.attemptedWeight}%`}
                  sub={`${stats.attemptedCount} assignment${stats.attemptedCount === 1 ? "" : "s"}`}
                />
                <Stat
                  label="Remaining"
                  value={`${stats.remainingWeight}%`}
                  sub={`${stats.remainingCount} assignment${stats.remainingCount === 1 ? "" : "s"}`}
                />
                <Stat
                  label="Final projection"
                  value={`${whatIf.projectedFinalGrade}%`}
                  sub={`if you score ${whatIfScore}% on remaining`}
                />
              </div>

              {/* Visual progress bar */}
              <div className="space-y-1 pt-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>0%</span>
                  <span>Progress to target ({stats.targetGrade}%)</span>
                  <span>100%</span>
                </div>
                <div className="h-2 rounded bg-muted overflow-hidden relative">
                  <div
                    className="h-full bg-emerald-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, stats.currentGrade))}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-500"
                    style={{ left: `${stats.targetGrade}%` }}
                    title={`Target: ${stats.targetGrade}%`}
                  />
                </div>
              </div>

              {gradeNeeded != null && gradeNeeded > 100 && (
                <div className="flex items-center gap-2 text-xs text-destructive pt-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>
                    Target {stats.targetGrade}% is unreachable — you&apos;d need {stats.gradeNeeded}% on remaining work.
                  </span>
                </div>
              )}
              {gradeNeeded != null && gradeNeeded <= 100 && gradeNeeded > 0 && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 pt-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>
                    Score {stats.gradeNeeded}% or higher on remaining work to reach {stats.targetGrade}%.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* What-if slider */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" /> What-if scenario
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Drag to see what your final grade would be if you score this percentage on all remaining assignments.
              </p>
              <input
                type="range"
                min={0}
                max={100}
                value={whatIfScore}
                onChange={(e) => setWhatIfScore(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex items-center justify-between text-xs">
                <Badge variant="secondary">Assumed: {whatIfScore}%</Badge>
                <Badge variant="outline">
                  <Target className="h-3 w-3 mr-1" />
                  Projected: {whatIf.projectedFinalGrade}% ({whatIf.projectedLetter}, GPA {whatIf.projectedGpa})
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Assignment breakdown */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Award className="h-4 w-4" /> Assignment breakdown ({assignments.length})
                </h3>
                <Badge variant="outline" className="text-[10px]">
                  Weight sum: {stats.totalWeight}%
                </Badge>
              </div>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {stats.weightedScores.map((a, i) => (
                  <div
                    key={i}
                    className={`rounded border bg-background px-3 py-2 text-xs flex items-center gap-2 ${a.attempted ? "" : "opacity-60"}`}
                  >
                    <span className="font-medium text-foreground flex-1 truncate">{a.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {a.attempted ? `${a.score}/${a.maxScore} (${a.percent}%)` : `—/${a.maxScore}`}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">{a.weightPercent}%</Badge>
                    <span className="font-mono text-muted-foreground text-[10px] w-16 text-right">
                      {a.weightedScore != null
                        ? `${Math.round(a.weightedScore * 100) / 100}/${a.weightPercent}`
                        : `—/${a.weightPercent}`}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return text; }} label="Copy report" />
                <DownloadButton getText={() => text} filename="grade-report.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csv} filename="assignments.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(assignmentsText, targetGrade, gradingScale, gpaScale); }} />
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
                <History className="h-4 w-4" /> Recent calculations ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.assignmentCount} assignments</Badge>
                  <Badge variant="secondary" className="text-[10px]">Current: {h.currentGrade}%</Badge>
                  <Badge variant="outline" className="text-[10px]">Target: {h.targetGrade}%</Badge>
                  {h.gradeNeeded != null && (
                    <Badge variant="outline" className="text-[10px]">Needed: {h.gradeNeeded}%</Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">GPA: {h.currentGpa}</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All calculations run locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
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
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
