"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { validateScale, scaleFactor, formatScale, realToModel, modelToReal, fmtNum, convert, UNIT_FACTORS_TO_M } from "./logic";

const UNITS = Object.keys(UNIT_FACTORS_TO_M);

export default function ScaleCalculator() {
  const [real, setReal] = useState("100");
  const [model, setModel] = useState("1");
  const [realUnit, setRealUnit] = useState("m");
  const [modelUnit, setModelUnit] = useState("cm");
  const [realDim, setRealDim] = useState("50");
  const [modelDim, setModelDim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    setError(null);
    const r = Number(real); const m = Number(model);
    const v = validateScale({ real: r, model: m });
    if ("error" in v) { setError(v.error); return null; }
    const factor = scaleFactor(r, m);
    const scaleStr = formatScale(factor);
    let realDimOut: number | null = null;
    let modelDimOut: number | null = null;
    if (realDim !== "") {
      const rd = Number(realDim);
      if (Number.isFinite(rd) && rd >= 0) modelDimOut = realToModel(rd, factor);
    }
    if (modelDim !== "") {
      const md = Number(modelDim);
      if (Number.isFinite(md) && md >= 0) realDimOut = modelToReal(md, factor);
    }
    // Unit-aware: convert factor to same-unit ratio if units differ
    const uc = convert(1, modelUnit, realUnit);
    const factorSameUnit = typeof uc === "number" ? factor * uc : factor;
    return { factor, scaleStr, realDimOut, modelDimOut, factorSameUnit };
  }, [real, model, realUnit, modelUnit, realDim, modelDim]);

  const csv = useMemo(() => {
    if (!result) return "";
    const lines = ["Metric,Value", `Scale,${result.scaleStr}`, `Scale factor,${fmtNum(result.factor)}`];
    if (result.modelDimOut !== null) lines.push(`Model dim (from real),${fmtNum(result.modelDimOut)}`);
    if (result.realDimOut !== null) lines.push(`Real dim (from model),${fmtNum(result.realDimOut)}`);
    return lines.join("\n");
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="text-sm font-medium">Scale reference (real : model)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Real length</Label>
              <Input value={real} onChange={(e) => setReal(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Real unit</Label>
              <select value={realUnit} onChange={(e) => setRealUnit(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Model length</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Model unit</Label>
              <select value={modelUnit} onChange={(e) => setModelUnit(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <Label className="text-sm font-medium">Convert dimensions (fill one)</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Real dimension ({realUnit})</Label>
              <Input value={realDim} onChange={(e) => setRealDim(e.target.value)} placeholder="e.g. 50" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Model dimension ({modelUnit})</Label>
              <Input value={modelDim} onChange={(e) => setModelDim(e.target.value)} placeholder="auto" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setReal("1000"); setModel("1"); setRealUnit("m"); setModelUnit("cm"); setRealDim("250"); setModelDim(""); }}>Load sample (1:100 map)</Button>
            <CopyButton getText={() => csv} disabled={!result} />
            <DownloadButton getText={() => csv} filename="scale.csv" mime="text/csv" disabled={!result} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {!error && result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Scale</p><p className="text-xl font-bold">{result.scaleStr}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Factor (real/model)</p><p className="text-xl font-bold">{fmtNum(result.factor)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Model dim</p><p className="text-xl font-bold">{result.modelDimOut !== null ? `${fmtNum(result.modelDimOut)} ${modelUnit}` : "—"}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Real dim</p><p className="text-xl font-bold">{result.realDimOut !== null ? `${fmtNum(result.realDimOut)} ${realUnit}` : "—"}</p></CardContent></Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
