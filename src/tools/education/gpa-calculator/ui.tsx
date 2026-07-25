"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState } from "../../_shared";
import { computeGpa, classifyGpa, makeEmptyCourse, type Course } from "./logic";

const LETTERS = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"];
const LETTER_TO_GP: Record<string, number> = {
  "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7,
  "C+": 2.3, "C": 2.0, "C-": 1.7, "D+": 1.3, "D": 1.0, "D-": 0.7, "F": 0.0,
};

const TONE_COLOR: Record<string, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  red: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
};

export default function GpaCalculator() {
  const [courses, setCourses] = useState<Course[]>([
    { name: "Calculus", credits: 4, gradePoint: 4.0, term: "Fall 2024" },
    { name: "English", credits: 3, gradePoint: 3.3, term: "Fall 2024" },
    { name: "History", credits: 3, gradePoint: 3.0, term: "Fall 2024" },
  ]);

  const result = useMemo(() => computeGpa(courses), [courses]);
  const classification = useMemo(() => classifyGpa(result.cumulativeGpa), [result]);

  const update = (i: number, patch: Partial<Course>) => {
    setCourses((arr) => arr.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };
  const add = () => setCourses((arr) => [...arr, makeEmptyCourse(arr[arr.length - 1]?.term ?? "Fall 2024")]);
  const remove = (i: number) => setCourses((arr) => arr.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Courses</Label>
            <button type="button" onClick={add} className="px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground cursor-pointer">
              + Add course
            </button>
          </div>
          <div className="space-y-2 max-h-[400px] overflow-auto">
            {courses.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_100px_100px_40px] gap-2 items-center">
                <Input value={c.name} onChange={(e) => update(i, { name: e.target.value })} className="text-sm h-8" placeholder="Course" />
                <Input type="number" value={c.credits} onChange={(e) => update(i, { credits: parseFloat(e.target.value) || 0 })} className="text-sm h-8 font-mono" />
                <select
                  value={Object.entries(LETTER_TO_GP).find(([, gp]) => gp === c.gradePoint)?.[0] ?? ""}
                  onChange={(e) => update(i, { gradePoint: LETTER_TO_GP[e.target.value] ?? 0 })}
                  className="h-8 rounded-md border bg-background px-1 text-xs"
                >
                  {LETTERS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                <Input value={c.term} onChange={(e) => update(i, { term: e.target.value })} className="text-sm h-8" placeholder="Term" />
                <button type="button" onClick={() => remove(i)} className="text-xs text-red-600 hover:underline cursor-pointer" aria-label="Remove">✕</button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {result.error && <ErrorBanner message={result.error} />}

      {result.isValid && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">Cumulative GPA: {result.cumulativeGpa.toFixed(2)}</Badge>
                <Badge variant="outline" className="text-xs">Credits: {result.cumulativeCredits}</Badge>
                <Badge variant="outline" className={`text-xs ${TONE_COLOR[classification.tone]}`}>{classification.label}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">By semester</Label>
              <div className="space-y-1">
                {result.semesters.map((s) => (
                  <div key={s.term} className="grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                    <span className="font-medium">{s.term}</span>
                    <code className="font-mono text-muted-foreground">{s.credits} cr</code>
                    <code className="font-mono text-muted-foreground">{s.qualityPoints.toFixed(1)} qp</code>
                    <code className="font-mono font-semibold">{s.gpa.toFixed(2)}</code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result.isValid && !result.error && (
        <EmptyState title="Add courses to compute GPA" hint="Each course needs a name, credits > 0, grade, and term." />
      )}
    </div>
  );
}
