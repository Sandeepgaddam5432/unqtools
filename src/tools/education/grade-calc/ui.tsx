"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, EmptyState } from "../../_shared";
import { calculateGrade, makeEmptyItem, type GradeItem } from "./logic";

export default function GradeCalc() {
  const [items, setItems] = useState<GradeItem[]>([
    { name: "Homework", score: 90, maxScore: 100, weight: 1 },
    { name: "Midterm", score: 85, maxScore: 100, weight: 2 },
  ]);

  const result = useMemo(() => calculateGrade(items), [items]);

  const update = (i: number, patch: Partial<GradeItem>) => {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  };
  const add = () => setItems((arr) => [...arr, makeEmptyItem()]);
  const remove = (i: number) => setItems((arr) => arr.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Grade items</Label>
            <button
              type="button"
              onClick={add}
              className="px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground cursor-pointer"
            >
              + Add item
            </button>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_80px_80px_80px_40px] gap-2 text-[10px] text-muted-foreground px-1">
              <span>Name</span>
              <span>Score</span>
              <span>Max</span>
              <span>Weight</span>
              <span></span>
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_80px_80px_40px] gap-2 items-center">
                <Input value={it.name} onChange={(e) => update(i, { name: e.target.value })} className="text-sm h-8" placeholder="Item name" />
                <Input type="number" value={it.score} onChange={(e) => update(i, { score: parseFloat(e.target.value) || 0 })} className="text-sm h-8 font-mono" />
                <Input type="number" value={it.maxScore} onChange={(e) => update(i, { maxScore: parseFloat(e.target.value) || 0 })} className="text-sm h-8 font-mono" />
                <Input type="number" value={it.weight} onChange={(e) => update(i, { weight: parseFloat(e.target.value) || 0 })} className="text-sm h-8 font-mono" />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-xs text-red-600 hover:underline cursor-pointer"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{result.weightedAverage.toFixed(2)}%</Badge>
              <Badge variant="outline" className={`text-xs ${result.pass ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"}`}>
                Grade: {result.letterGrade}
              </Badge>
              <Badge variant="outline" className="text-xs">GPA: {result.gpa4.toFixed(1)} / 4.0</Badge>
              <Badge variant="outline" className="text-xs">GPA: {result.gpa5.toFixed(1)} / 5.0</Badge>
              <CopyButton getText={() => `${result.letterGrade} (${result.weightedAverage.toFixed(1)}%)`} />
            </div>
            <p className="text-xs text-muted-foreground">{result.message}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border bg-muted/30 p-2">
                <div className="text-muted-foreground text-[10px]">Total weight</div>
                <code className="font-mono">{result.totalWeight}</code>
              </div>
              <div className="rounded-md border bg-muted/30 p-2">
                <div className="text-muted-foreground text-[10px]">Items</div>
                <code className="font-mono">{items.length}</code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!result && (
        <EmptyState title="Add at least one valid item" hint="Each item needs a score, max score > 0, and weight > 0." />
      )}
    </div>
  );
}
