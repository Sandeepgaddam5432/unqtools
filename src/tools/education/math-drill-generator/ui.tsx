"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { generate, checkAnswer, toText, withAnswers, type Operation, type Difficulty, type DrillResult } from "./logic";

export default function MathDrillGenerator() {
  const [operation, setOperation] = useState<Operation>("add");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [count, setCount] = useState(10);
  const [seed, setSeed] = useState(42);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const result = useMemo<DrillResult>(() => generate({ operation, difficulty, count, seed }), [operation, difficulty, count, seed]);

  const regenerate = () => setSeed((s) => s + 1);

  const correctCount = useMemo(() => {
    let n = 0;
    for (const p of result.problems) {
      const a = answers[p.id];
      if (a !== undefined && a !== "" && checkAnswer(p, Number(a))) n += 1;
    }
    return n;
  }, [result, answers]);

  const textExport = useMemo(() => toText(result), [result]);
  const answersExport = useMemo(() => withAnswers(result), [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><Label className="text-[10px] uppercase text-muted-foreground">Operation</Label>
              <select value={operation} onChange={(e) => setOperation(e.target.value as Operation)} className="mt-1 h-8 w-full text-xs rounded border bg-background px-2">
                <option value="add">Addition</option>
                <option value="sub">Subtraction</option>
                <option value="mul">Multiplication</option>
                <option value="div">Division</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">Difficulty</Label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="mt-1 h-8 w-full text-xs rounded border bg-background px-2">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">Count</Label><Input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-1 h-8 text-xs" /></div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">Seed</Label><Input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="mt-1 h-8 text-xs" /></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={regenerate}>Regenerate</Button>
            <CopyButton getText={() => textExport} label="Copy problems" />
            <DownloadButton getText={() => textExport} filename="problems.txt" label="Download" />
            <DownloadButton getText={() => answersExport} filename="answers.txt" label="Answers" />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Problems</p>
            <Badge variant="outline" className="text-emerald-600">{correctCount}/{result.problems.length} correct</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.problems.map((p) => {
              const a = answers[p.id];
              const isCorrect = a !== undefined && a !== "" && checkAnswer(p, Number(a));
              return (
                <div key={p.id} className={`rounded border px-2 py-1.5 text-xs flex items-center gap-2 ${a ? (isCorrect ? "bg-emerald-500/10" : "bg-red-500/10") : "bg-background"}`}>
                  <span className="text-muted-foreground">{p.id}.</span>
                  <span className="font-mono">{p.text}</span>
                  <Input
                    type="number"
                    value={a ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="ml-auto h-7 w-20 text-xs"
                    placeholder="?"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all problem generation runs locally.</p></CardContent></Card>
    </div>
  );
}
