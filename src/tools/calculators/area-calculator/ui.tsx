"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { computeArea, validateAreaInput, SHAPE_LABELS, type Shape } from "./logic";

const SHAPES: Shape[] = ["rectangle", "circle", "triangle", "trapezoid", "ellipse", "parallelogram"];
const PARAMS: Record<Shape, string[]> = {
  rectangle: ["length", "width"],
  circle: ["radius"],
  triangle: ["base", "height"],
  trapezoid: ["baseA", "baseB", "height"],
  ellipse: ["semi-major", "semi-minor"],
  parallelogram: ["base", "height"],
};

export default function AreaCalculator() {
  const [shape, setShape] = useState<Shape>("rectangle");
  const [values, setValues] = useState<number[]>([4, 5]);
  const [error, setError] = useState<string | null>(null);

  const params = PARAMS[shape];
  const result = useMemo(() => {
    const v = validateAreaInput({ shape, values });
    if ("error" in v) { setError(v.error); return null; }
    setError(null);
    return computeArea({ shape, values });
  }, [shape, values]);

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
          <Label className="text-xs text-muted-foreground">{SHAPE_LABELS[shape]}</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {params.map((p, i) => (
              <div key={p}>
                <Label className="text-xs text-muted-foreground">{p}</Label>
                <input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={values[i] ?? 0} onChange={(e) => {
                  const next = [...values];
                  next[i] = Number(e.target.value);
                  setValues(next);
                }} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result !== null && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Area</p>
                <p className="text-2xl font-bold">{result.toFixed(4)}</p>
              </div>
              <div className="flex gap-2">
                <CopyButton getText={() => result.toFixed(4)} />
                <DownloadButton getText={() => `${SHAPE_LABELS[shape]}\nArea: ${result.toFixed(4)}`} filename="area.txt" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
