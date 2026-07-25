"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  makeCriterion,
  validateRubric,
  computeTotalPoints,
  rubricToMarkdown,
  rubricToCsv,
  type Rubric,
  type RubricCriterion,
} from "./logic";

export default function RubricMaker() {
  const [title, setTitle] = useState("Essay Rubric");
  const [criteria, setCriteria] = useState<RubricCriterion[]>([
    makeCriterion("Content", 25, 2),
    makeCriterion("Grammar", 25, 1),
  ]);

  const rubric: Rubric = useMemo(() => ({
    title,
    totalPoints: computeTotalPoints(criteria),
    criteria,
  }), [title, criteria]);

  const error = useMemo(() => validateRubric(rubric), [rubric]);
  const markdown = useMemo(() => rubricToMarkdown(rubric), [rubric]);
  const csv = useMemo(() => rubricToCsv(rubric), [rubric]);

  const addCriterion = () => setCriteria((arr) => [...arr, makeCriterion(`Criterion ${arr.length + 1}`, 20, 1)]);
  const removeCriterion = (i: number) => setCriteria((arr) => arr.filter((_, idx) => idx !== i));
  const updateLevel = (ci: number, li: number, patch: Partial<RubricCriterion["levels"][0]>) => {
    setCriteria((arr) => arr.map((c, idx) => idx === ci ? {
      ...c,
      levels: c.levels.map((lv, lidx) => lidx === li ? { ...lv, ...patch } : lv),
    } : c));
  };
  const updateCriterion = (ci: number, patch: Partial<RubricCriterion>) => {
    setCriteria((arr) => arr.map((c, idx) => (idx === ci ? { ...c, ...patch } : c)));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Rubric title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1 flex flex-col justify-end">
              <Badge variant="outline" className="text-xs">{computeTotalPoints(criteria)} pts</Badge>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Criteria ({criteria.length})</Label>
            <button type="button" onClick={addCriterion} className="px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground cursor-pointer">+ Add criterion</button>
          </div>
          <div className="space-y-3">
            {criteria.map((c, ci) => (
              <div key={c.id} className="rounded-md border p-3 space-y-2">
                <div className="grid grid-cols-[1fr_70px_60px_40px] gap-2 items-center">
                  <Input value={c.name} onChange={(e) => updateCriterion(ci, { name: e.target.value })} className="text-sm h-8" placeholder="Criterion name" />
                  <Input type="number" value={c.weight} onChange={(e) => updateCriterion(ci, { weight: parseFloat(e.target.value) || 0 })} className="text-sm h-8 font-mono" />
                  <span className="text-[10px] text-muted-foreground">weight</span>
                  <button type="button" onClick={() => removeCriterion(ci)} className="text-xs text-red-600 hover:underline cursor-pointer" aria-label="Remove">✕</button>
                </div>
                <div className="space-y-1">
                  {c.levels.map((lv, li) => (
                    <div key={li} className="grid grid-cols-[80px_60px_1fr] gap-2 items-center">
                      <Input value={lv.label} onChange={(e) => updateLevel(ci, li, { label: e.target.value })} className="text-xs h-7" />
                      <Input type="number" value={lv.points} onChange={(e) => updateLevel(ci, li, { points: parseFloat(e.target.value) || 0 })} className="text-xs h-7 font-mono" />
                      <Textarea value={lv.description} onChange={(e) => updateLevel(ci, li, { description: e.target.value })} className="text-xs min-h-[28px] py-1" rows={1} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {!error && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Markdown preview</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => markdown} />
                <DownloadButton getText={() => markdown} filename="rubric.md" />
                <DownloadButton getText={() => csv} filename="rubric.csv" label="CSV" />
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 max-h-[300px] overflow-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap">{markdown}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      {criteria.length === 0 && (
        <EmptyState title="Add criteria to build your rubric" hint="Each criterion has 4 default levels (Excellent → Beginning). Adjust points, weights, and descriptions." />
      )}
    </div>
  );
}
