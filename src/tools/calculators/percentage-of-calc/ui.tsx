"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  percentOf,
  whatPercent,
  percentChange,
  reversePercent,
  addPercent,
  subtractPercent,
  compoundGrowth,
  tipCalc,
  discountCalc,
  batchPercent,
  validateNumber,
  gradeCalc,
  percentToAngle,
  type PctResult,
} from "./logic";

function ResultCard({ title, r }: { title: string; r: PctResult }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground mb-1">{title}</p>
      <p className="text-xl font-bold tabular-nums">{r.formatted}</p>
      <p className="text-[11px] text-muted-foreground mt-1 font-mono">{r.formula}</p>
    </div>
  );
}

export default function PercentageOfCalcUI() {
  const [x, setX] = useState("10");
  const [y, setY] = useState("200");
  const [oldV, setOldV] = useState("100");
  const [newV, setNewV] = useState("125");
  const [batch, setBatch] = useState("100\n200\n500");
  const [batchPct, setBatchPct] = useState("10");
  const [batchMode, setBatchMode] = useState<"of" | "add" | "sub" | "reverse">("of");
  const [tip, setTip] = useState("18");
  const [bill, setBill] = useState("100");
  const [people, setPeople] = useState("4");
  const [discount, setDiscount] = useState("25");
  const [orig, setOrig] = useState("200");
  const [score, setScore] = useState("85");
  const [max, setMax] = useState("100");

  const xv = validateNumber(x);
  const yv = validateNumber(y);
  const ov = validateNumber(oldV);
  const nv = validateNumber(newV);
  const bpct = validateNumber(batchPct);
  const tipv = validateNumber(tip);
  const billv = validateNumber(bill);
  const peov = validateNumber(people);
  const discv = validateNumber(discount);
  const origv = validateNumber(orig);
  const scorev = validateNumber(score);
  const maxv = validateNumber(max);

  const results = useMemo(() => {
    const errs: string[] = [];
    if (xv.error) errs.push(`X: ${xv.error}`);
    if (yv.error) errs.push(`Y: ${yv.error}`);
    return {
      error: errs.join("; "),
      of: !xv.error && !yv.error ? percentOf(xv.value, yv.value) : null,
      whatPct: !xv.error && !yv.error ? whatPercent(xv.value, yv.value) : null,
      change: !ov.error && !nv.error ? percentChange(ov.value, nv.value) : null,
      add: !xv.error && !yv.error ? addPercent(yv.value, xv.value) : null,
      sub: !xv.error && !yv.error ? subtractPercent(yv.value, xv.value) : null,
      reverse: !xv.error && !yv.error ? reversePercent(yv.value, xv.value) : null,
      compound: !xv.error && !yv.error ? compoundGrowth(yv.value, xv.value, 5) : null,
    };
  }, [xv, yv, ov, nv]);

  const tipR = useMemo(() => {
    if (tipv.error || billv.error || peov.error) return null;
    return tipCalc(billv.value, tipv.value, peov.value);
  }, [tipv, billv, peov]);

  const discR = useMemo(() => {
    if (origv.error || discv.error) return null;
    return discountCalc(origv.value, discv.value);
  }, [origv, discv]);

  const batchOut = useMemo(() => {
    if (bpct.error) return "Invalid percentage";
    return batchPercent(batch, bpct.value, batchMode);
  }, [batch, bpct, batchMode]);

  const grade = useMemo(() => {
    if (scorev.error || maxv.error) return null;
    return gradeCalc(scorev.value, maxv.value);
  }, [scorev, maxv]);

  const summaryText = useMemo(() => {
    const lines: string[] = [];
    if (results.of) lines.push(`X% of Y = ${results.of.formatted}`);
    if (results.whatPct) lines.push(`X is ${results.whatPct.formatted} of Y`);
    if (results.change) lines.push(`% change = ${results.change.formatted}`);
    if (tipR) lines.push(`Tip total = ${tipR.formatted.total} (${tipR.formatted.perPerson}/person)`);
    if (discR) lines.push(`Final price = ${discR.formatted.final}`);
    if (grade) lines.push(`Grade = ${grade.letter} (${grade.pct}%)`);
    return lines.join("\n");
  }, [results, tipR, discR, grade]);

  return (
    <div className="space-y-4">
      {results.error && <ErrorBanner message={results.error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Core inputs</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">X (percentage or value)</Label>
              <Input value={x} onChange={(e) => setX(e.target.value)} aria-label="X input" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Y (base value)</Label>
              <Input value={y} onChange={(e) => setY(e.target.value)} aria-label="Y input" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {results.of && <ResultCard title="X% of Y" r={results.of} />}
            {results.whatPct && <ResultCard title="X is what % of Y" r={results.whatPct} />}
            {results.add && <ResultCard title="Y + X%" r={results.add} />}
            {results.sub && <ResultCard title="Y − X%" r={results.sub} />}
            {results.reverse && <ResultCard title="Original (Y inc. X%)" r={results.reverse} />}
            {results.compound && <ResultCard title="Y grown by X% × 5" r={results.compound} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">% Change (old → new)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Old value</Label>
              <Input value={oldV} onChange={(e) => setOldV(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">New value</Label>
              <Input value={newV} onChange={(e) => setNewV(e.target.value)} />
            </div>
          </div>
          {results.change && <ResultCard title="Percent change" r={results.change} />}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Tip calculator</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Bill</Label>
                <Input value={bill} onChange={(e) => setBill(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tip %</Label>
                <Input value={tip} onChange={(e) => setTip(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">People</Label>
                <Input value={people} onChange={(e) => setPeople(e.target.value)} />
              </div>
            </div>
            {tipR && (
              <div className="text-sm space-y-1">
                <p>Tip: <span className="font-bold">{tipR.formatted.tip}</span></p>
                <p>Total: <span className="font-bold">{tipR.formatted.total}</span></p>
                <p>Per person: <span className="font-bold">{tipR.formatted.perPerson}</span></p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Discount calculator</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Original</Label>
                <Input value={orig} onChange={(e) => setOrig(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Discount %</Label>
                <Input value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
            </div>
            {discR && (
              <div className="text-sm space-y-1">
                <p>You save: <span className="font-bold">{discR.formatted.saved}</span></p>
                <p>Final price: <span className="font-bold">{discR.formatted.final}</span></p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Batch percentage</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Values (one per line)</Label>
              <textarea
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                className="w-full min-h-[80px] rounded-md border bg-background p-2 font-mono text-xs"
                aria-label="Batch values"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Percentage</Label>
              <Input value={batchPct} onChange={(e) => setBatchPct(e.target.value)} />
              <Label className="text-xs text-muted-foreground mt-2 block">Mode</Label>
              <select
                value={batchMode}
                onChange={(e) => setBatchMode(e.target.value as typeof batchMode)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="of">X% of each</option>
                <option value="add">add X%</option>
                <option value="sub">subtract X%</option>
                <option value="reverse">reverse X%</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Output</Label>
              <pre className="w-full min-h-[80px] rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap overflow-x-auto">{batchOut}</pre>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Grade calculator</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Score</Label>
              <Input value={score} onChange={(e) => setScore(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max</Label>
              <Input value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          </div>
          {grade && (
            <div className="text-sm">
              Grade: <span className="font-bold text-lg">{grade.letter}</span> · {grade.pct}% · GPA {grade.gpa.toFixed(1)} · Pie angle {percentToAngle(grade.pct).toFixed(0)}°
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center">
          <CopyButton getText={() => summaryText} label="Copy summary" />
          <DownloadButton getText={() => summaryText} filename="percentage-results.txt" />
          <p className="text-xs text-muted-foreground ml-auto">
            100% private — all math runs in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
