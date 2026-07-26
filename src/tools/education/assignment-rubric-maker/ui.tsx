"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  createRubric,
  addCriterion,
  removeCriterion,
  updateCriterion,
  totalWeight,
  computeScore,
  letterGrade,
  gpaFromPercent,
  validateRubric,
  exportRubricCSV,
  exportRubricJSON,
  exportRubricText,
  rubricStats,
  presetRubric,
  type Rubric,
  type StudentScore,
} from "./logic";

export default function AssignmentRubricMaker() {
  const [rubric, setRubric] = useState<Rubric>(() => presetRubric("essay"));
  const [title, setTitle] = useState<string>(rubric.title);
  const [subject, setSubject] = useState<string>(rubric.subject);
  const [totalPoints, setTotalPoints] = useState<string>(String(rubric.totalPoints));
  const [newCritName, setNewCritName] = useState<string>("");
  const [newCritWeight, setNewCritWeight] = useState<string>("1");
  const [selections, setSelections] = useState<StudentScore[]>([]);
  const [error, setError] = useState<string>("");

  const warnings = useMemo(() => validateRubric(rubric), [rubric]);
  const stats = useMemo(() => rubricStats(rubric), [rubric]);
  const score = useMemo(() => computeScore(rubric, selections), [rubric, selections]);
  const grade = letterGrade(score.percent);
  const gpa = gpaFromPercent(score.percent);

  const handlePreset = (kind: "essay" | "presentation" | "lab-report" | "project") => {
    const r = presetRubric(kind);
    setRubric(r);
    setTitle(r.title);
    setSubject(r.subject);
    setTotalPoints(String(r.totalPoints));
    setSelections([]);
  };

  const handleAdd = () => {
    if (!newCritName.trim()) {
      setError("Criterion name required.");
      return;
    }
    setError("");
    setRubric((r) => addCriterion(r, newCritName, "", Number(newCritWeight) || 1));
    setNewCritName("");
    setNewCritWeight("1");
  };

  const handleSelect = (critId: string, points: number) => {
    setSelections((cur) => {
      const exists = cur.find((s) => s.criterionId === critId);
      if (exists) return cur.map((s) => (s.criterionId === critId ? { ...s, selectedPoints: points } : s));
      return [...cur, { criterionId: critId, selectedPoints: points }];
    });
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold">Rubric metadata</h3>
            <div className="flex gap-2 flex-wrap">
              <CopyButton getText={() => exportRubricText(rubric)} label="Copy text" />
              <DownloadButton getText={() => exportRubricCSV(rubric)} filename={`${rubric.title}.csv`} mime="text/csv" label="CSV" />
              <DownloadButton getText={() => exportRubricJSON(rubric)} filename={`${rubric.title}.json`} mime="application/json" label="JSON" />
              <DownloadButton getText={() => exportRubricText(rubric)} filename={`${rubric.title}.txt`} label="TXT" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <input value={title} onChange={(e) => { setTitle(e.target.value); setRubric((r) => ({ ...r, title: e.target.value })); }} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <input value={subject} onChange={(e) => { setSubject(e.target.value); setRubric((r) => ({ ...r, subject: e.target.value })); }} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Total points</Label>
              <input type="number" value={totalPoints} onChange={(e) => { setTotalPoints(e.target.value); setRubric((r) => ({ ...r, totalPoints: Number(e.target.value) || 0 })); }} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {(["essay", "presentation", "lab-report", "project"] as const).map((p) => (
              <button key={p} onClick={() => handlePreset(p)} className="px-2 py-1 text-[10px] rounded border border-border bg-muted/40 hover:bg-muted capitalize">
                {p} preset
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Add criterion</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={newCritName} onChange={(e) => setNewCritName(e.target.value)} placeholder="e.g. Thesis & Argument" className="rounded-md border border-border bg-background px-3 py-1.5 text-xs sm:col-span-2" />
            <div className="flex gap-2">
              <input type="number" step="0.1" value={newCritWeight} onChange={(e) => setNewCritWeight(e.target.value)} placeholder="weight" className="w-20 rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
              <button onClick={handleAdd} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90">+ Add</button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="text-sm font-semibold">Criteria ({stats.criteriaCount}) · Total weight: {totalWeight(rubric)}</Label>
            <span className="text-xs text-muted-foreground">Max possible: {stats.maxPossiblePoints}</span>
          </div>
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          {rubric.criteria.map((c) => {
            const sel = selections.find((s) => s.criterionId === c.id)?.selectedPoints;
            return (
              <div key={c.id} className="rounded-md border border-border p-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-medium">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">weight {c.weight}</span>
                  </div>
                  <button onClick={() => setRubric((r) => removeCriterion(r, c.id))} className="text-red-500 text-[10px] hover:underline">remove</button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {c.levels.map((l) => (
                    <button
                      key={l.name}
                      onClick={() => handleSelect(c.id, l.points)}
                      className={`px-2 py-1 text-[10px] rounded border ${sel === l.points ? "border-primary bg-primary/10 text-foreground" : "border-border bg-muted/40 hover:bg-muted"}`}
                    >
                      {l.name} ({l.points})
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Score preview</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Weighted</div>
              <code className="font-mono">{score.weighted.toFixed(1)} / {score.maxPossible}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Percent</div>
              <code className="font-mono">{score.percent.toFixed(1)}%</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Letter</div>
              <code className="font-mono">{grade}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">GPA (4.0)</div>
              <code className="font-mono">{gpa.toFixed(1)}</code>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground pt-1">Tip: click level buttons above to score the student.</p>
        </CardContent>
      </Card>
    </div>
  );
}
