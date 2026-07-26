"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  computePerimeter, validatePerimeterInput, formatResult, perimeterInAllUnits,
  batchToCsv, computeBatch, FORMULAS, SHAPE_LABELS, UNIT_LABELS, PARAMS,
  type Shape, type LengthUnit, type PerimeterInput,
} from "./logic";

const SHAPES: Shape[] = ["rectangle", "circle", "triangle", "polygon", "ellipse"];
const UNITS: LengthUnit[] = ["mm", "cm", "m", "km", "in", "ft", "yd", "mi"];

export default function PerimeterCalculator() {
  const [shape, setShape] = useState<Shape>("rectangle");
  const [unit, setUnit] = useState<LengthUnit>("m");
  const [values, setValues] = useState<number[]>([3, 4]);
  const [batchText, setBatchText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const params = PARAMS[shape];
  const result = useMemo(() => {
    const v = validatePerimeterInput({ shape, values, unit });
    if ("error" in v) { queueMicrotask(() => setError(v.error)); return null; }
    queueMicrotask(() => setError(null));
    return computePerimeter({ shape, values, unit });
  }, [shape, values, unit]);

  const allUnits = useMemo(() => result ? perimeterInAllUnits(result) : [], [result]);

  const batchLines = useMemo(() => batchText.split(/\r?\n/).filter((l) => l.length > 0), [batchText]);
  const batchInputs = useMemo<PerimeterInput[]>(() => {
    return batchLines.map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      const sh = (parts[0] ?? "rectangle") as Shape;
      const vs = parts.slice(1).map((p) => Number(p) || 0);
      return { shape: SHAPES.includes(sh) ? sh : "rectangle", values: vs, unit };
    });
  }, [batchLines, unit]);
  const batchResults = useMemo(() => computeBatch(batchInputs), [batchInputs]);

  const switchShape = (s: Shape) => {
    setShape(s);
    setValues(new Array(PARAMS[s].length).fill(0));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Shape</Label>
          <div className="flex flex-wrap gap-2">
            {SHAPES.map((s) => (
              <Button key={s} size="sm" variant={shape === s ? "default" : "outline"} onClick={() => switchShape(s)}>{s}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{SHAPE_LABELS[shape]}</Label>
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={unit} onChange={(e) => setUnit(e.target.value as LengthUnit)}>
              {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {params.map((p, i) => (
              <div key={p}>
                <Label className="text-xs text-muted-foreground">{p} ({unit})</Label>
                <input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={values[i] ?? 0} onChange={(e) => {
                  const next = [...values];
                  next[i] = Number(e.target.value);
                  setValues(next);
                }} />
              </div>
            ))}
          </div>
          <p className="text-xs font-mono text-muted-foreground">{FORMULAS[shape]}</p>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Perimeter</p>
                <p className="text-2xl font-bold">{result.perimeter} {result.unit}</p>
                <p className="text-xs text-muted-foreground mt-1">Area: {result.area} {result.unit}²</p>
              </div>
              <div className="flex gap-2">
                <CopyButton getText={() => String(result.perimeter)} />
                <DownloadButton getText={() => formatResult(result)} filename="perimeter.txt" />
              </div>
            </div>
            <details className="text-xs"><summary className="cursor-pointer">Step-by-step derivation</summary><pre className="mt-2 p-2 bg-muted/40 rounded whitespace-pre-wrap">{result.derivation.map((d) => `  - ${d}`).join("\n")}</pre></details>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
          </CardContent>
        </Card>
      )}

      {allUnits.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">All units ({allUnits.length})</Badge>
              <DownloadButton getText={() => allUnits.map((r) => `${r.unit},${r.value}`).join("\n")} filename="perimeter-units.csv" mime="text/csv" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {allUnits.map((r) => (
                <div key={r.unit} className="rounded-md border border-border/50 p-2">
                  <p className="text-xs text-muted-foreground">{UNIT_LABELS[r.unit]}</p>
                  <p className="text-sm font-mono font-bold">{r.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Batch mode (one shape per line: shape,val1,val2,…)</Label>
          <textarea className="rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] font-mono" placeholder={"rectangle,3,4\ncircle,1"} value={batchText} onChange={(e) => setBatchText(e.target.value)} />
          {batchResults.length > 0 && (
            <div className="flex items-center justify-between">
              <Badge variant="outline">{batchResults.length} rows</Badge>
              <DownloadButton getText={() => batchToCsv(batchResults, batchInputs)} filename="perimeter-batch.csv" mime="text/csv" />
            </div>
          )}
          {batchResults.length > 0 && (
            <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono max-h-[200px] overflow-y-auto">
              {batchResults.map((r, i) => `${i + 1}\t${batchInputs[i]!.shape}\t${r.perimeter} ${r.unit}\tarea=${r.area}`).join("\n")}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
