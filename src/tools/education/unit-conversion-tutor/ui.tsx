"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  CATEGORIES,
  solveConversion,
  solveTemperature,
  generatePractice,
  checkAnswer,
  solutionToText,
  type Category,
  type WorkedSolution,
  type PracticeProblem,
} from "./logic";

const TEMP_UNITS: ("C" | "F" | "K")[] = ["C", "F", "K"];

export default function UnitConversionTutor() {
  const [cat, setCat] = useState<Category>("length");
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit, setToUnit] = useState("cm");
  const [value, setValue] = useState("1");
  const [solution, setSolution] = useState<WorkedSolution | null>(null);
  const [practice, setPractice] = useState<PracticeProblem | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const def = CATEGORIES.find((c) => c.category === cat)!;

  const solve = useCallback(() => {
    const v = Number(value);
    if (cat === "temperature") {
      const r = solveTemperature(v, fromUnit as "C", toUnit as "C");
      if ("error" in r) { setError(r.error); setSolution(null); }
      else { setSolution(r); setError(null); }
    } else {
      const r = solveConversion(v, fromUnit, toUnit, cat);
      if ("error" in r) { setError(r.error); setSolution(null); }
      else { setSolution(r); setError(null); }
    }
  }, [cat, fromUnit, toUnit, value]);

  const switchCategory = useCallback((c: Category) => {
    setCat(c);
    const next = CATEGORIES.find((x) => x.category === c)!;
    setFromUnit(next.units[0]!.symbol);
    setToUnit(next.units[1]!.symbol);
    setSolution(null); setError(null);
  }, []);

  const newPractice = useCallback(() => {
    const p = generatePractice(cat);
    if ("error" in p) { setError(p.error); return; }
    setPractice(p);
    setUserAnswer("");
    setFeedback(null);
    setShowSolution(false);
    setError(null);
  }, [cat]);

  const check = useCallback(() => {
    if (!practice) return;
    const ok = checkAnswer(practice, Number(userAnswer));
    setFeedback(ok ? "correct" : "incorrect");
    if (ok) setShowSolution(true);
  }, [practice, userAnswer]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Label className="text-xs text-muted-foreground self-center mr-2">Category:</Label>
            {CATEGORIES.map((c) => (
              <Button key={c.category} size="sm" variant={cat === c.category ? "default" : "outline"} onClick={() => switchCategory(c.category)}>{c.label}</Button>
            ))}
            <Button size="sm" variant="outline" onClick={() => switchCategory("temperature" as Category)}>Temperature</Button>
          </div>
          {cat !== "temperature" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Value</Label>
                <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Value" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">From unit</Label>
                <div className="flex flex-wrap gap-1">
                  {def.units.map((u) => (
                    <Button key={u.symbol} size="sm" variant={fromUnit === u.symbol ? "default" : "outline"} onClick={() => setFromUnit(u.symbol)}>{u.symbol}</Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">To unit</Label>
                <div className="flex flex-wrap gap-1">
                  {def.units.map((u) => (
                    <Button key={u.symbol} size="sm" variant={toUnit === u.symbol ? "default" : "outline"} onClick={() => setToUnit(u.symbol)}>{u.symbol}</Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Value</Label>
                <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Value" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <div className="flex gap-1">
                  {TEMP_UNITS.map((u) => (
                    <Button key={u} size="sm" variant={fromUnit === u ? "default" : "outline"} onClick={() => setFromUnit(u)}>°{u}</Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <div className="flex gap-1">
                  {TEMP_UNITS.map((u) => (
                    <Button key={u} size="sm" variant={toUnit === u ? "default" : "outline"} onClick={() => setToUnit(u)}>°{u}</Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={solve}>Show solution</Button>
            <Button size="sm" variant="ghost" onClick={newPractice}>New practice problem</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {solution && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Worked solution</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 space-y-2 text-sm">
            <p className="text-lg font-bold">{solution.input.value} {solution.input.unit} = {solution.output.value} {solution.output.unit}</p>
            <p className="text-xs text-muted-foreground">Canonical intermediate: {solution.canonical.value} {solution.canonical.unit}</p>
            <div className="space-y-1">
              {solution.steps.map((s, i) => (
                <div key={i} className="border-l-2 border-border pl-3">
                  <p className="text-xs text-muted-foreground">{i + 1}. {s.description}</p>
                  <p className="font-mono text-xs">{s.expression} = {s.result}</p>
                </div>
              ))}
            </div>
            <p className="font-mono text-xs bg-muted/30 rounded p-2">{solution.formula}</p>
            <div className="flex gap-2 pt-2">
              <CopyButton getText={() => solutionToText(solution)} label="Copy solution" />
              <DownloadButton getText={() => solutionToText(solution)} filename="conversion-solution.txt" />
            </div>
          </CardContent>
        </Card>
      )}

      {practice && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Practice problem</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <p className="text-base font-semibold">{practice.prompt}</p>
            <div className="flex gap-2">
              <Input type="number" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} placeholder={`Answer in ${practice.toUnit}`} aria-label="Your answer" />
              <Button size="sm" onClick={check} disabled={!userAnswer}>Check</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSolution((v) => !v)}>{showSolution ? "Hide solution" : "Show solution"}</Button>
            </div>
            {feedback === "correct" && <p className="text-sm text-emerald-600 dark:text-emerald-400">✓ Correct!</p>}
            {feedback === "incorrect" && <p className="text-sm text-red-600 dark:text-red-400">✗ Not quite — try again or reveal the solution.</p>}
            {showSolution && (
              <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/30 rounded p-3">{solutionToText(practice.solution)}</pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
