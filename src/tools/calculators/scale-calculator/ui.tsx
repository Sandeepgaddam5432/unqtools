"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  validateScale, scaleFactor, formatScale, realToModel, modelToReal,
  mapToReal, realToMap, areaScale, volumeScale, fmtNum, convert,
  ALL_UNITS, UNITS_BY_SYSTEM, COMMON_SCALES, formula,
  batchRealToModel, batchToCsv, systemOf, defaultUnits,
} from "./logic";

export default function ScaleCalculator() {
  const [real, setReal] = useState("100");
  const [model, setModel] = useState("1");
  const [realUnit, setRealUnit] = useState("m");
  const [modelUnit, setModelUnit] = useState("cm");
  const [realDim, setRealDim] = useState("50");
  const [modelDim, setModelDim] = useState("");
  const [batch, setBatch] = useState("100\n200\n300");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    setError(null);
    const r = Number(real);
    const m = Number(model);
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
    return {
      factor, scaleStr, realDimOut, modelDimOut,
      formula: formula(r, m, factor),
      area: areaScale(factor), volume: volumeScale(factor),
    };
  }, [real, model, realDim, modelDim]);

  const batchResult = useMemo(() => {
    if (!result) return null;
    const dims = batch.split(/\n|,/).map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
    return batchRealToModel(dims, result.factor);
  }, [batch, result]);

  const csv = useMemo(() => {
    if (!result) return "";
    const lines = [
      "Metric,Value",
      `Scale,${result.scaleStr}`,
      `Scale factor,${fmtNum(result.factor)}`,
      `Area scale,${fmtNum(result.area)}`,
      `Volume scale,${fmtNum(result.volume)}`,
    ];
    if (result.modelDimOut !== null) lines.push(`Model dim (from real),${fmtNum(result.modelDimOut)}`);
    if (result.realDimOut !== null) lines.push(`Real dim (from model),${fmtNum(result.realDimOut)}`);
    return lines.join("\n");
  }, [result]);

  const loadPreset = (factor: number) => {
    setReal(String(factor));
    setModel("1");
    const sys = systemOf(realUnit) ?? "metric";
    const d = defaultUnits(sys);
    setRealUnit(d.real);
    setModelUnit(d.model);
  };

  const setSystem = (sys: "metric" | "imperial") => {
    const d = defaultUnits(sys);
    setRealUnit(d.real);
    setModelUnit(d.model);
  };

  const fullCsv = useMemo(() => {
    if (!batchResult || batchResult.length === 0) return csv;
    return csv + "\n\n" + batchToCsv(batchResult);
  }, [csv, batchResult]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Scale reference (real : model)</Label>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setSystem("metric")}>Metric</Button>
              <Button size="sm" variant="ghost" onClick={() => setSystem("imperial")}>Imperial</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Real length</Label>
              <Input value={real} onChange={(e) => setReal(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Real unit</Label>
              <select value={realUnit} onChange={(e) => setRealUnit(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                {ALL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Model length</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Model unit</Label>
              <select value={modelUnit} onChange={(e) => setModelUnit(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                {ALL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {COMMON_SCALES.map((s) => (
              <Button key={s.factor} size="sm" variant="outline" onClick={() => loadPreset(s.factor)}>
                {s.label}
              </Button>
            ))}
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

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setReal("1000"); setModel("1"); setRealUnit("m"); setModelUnit("cm"); setRealDim("250"); setModelDim(""); }}>Load sample (1:1000)</Button>
            <CopyButton getText={() => csv} disabled={!result} />
            <DownloadButton getText={() => fullCsv} filename="scale.csv" mime="text/csv" disabled={!result} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {!error && result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Scale</p><p className="text-xl font-bold">{result.scaleStr}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Factor (real/model)</p><p className="text-xl font-bold">{fmtNum(result.factor)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Model dim</p><p className="text-xl font-bold">{result.modelDimOut !== null ? `${fmtNum(result.modelDimOut)} ${modelUnit}` : "—"}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">Real dim</p><p className="text-xl font-bold">{result.realDimOut !== null ? `${fmtNum(result.realDimOut)} ${realUnit}` : "—"}</p></CardContent></Card>
          </div>
          <Card><CardContent className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Formula</p>
            <code className="text-sm">{result.formula}</code>
            <div className="flex gap-2 pt-1">
              <Badge variant="outline">Area ×{fmtNum(result.area)}</Badge>
              <Badge variant="outline">Volume ×{fmtNum(result.volume)}</Badge>
            </div>
          </CardContent></Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Batch (real dims, one per line)</Label>
                {batchResult && batchResult.length > 0 && (
                  <CopyButton getText={() => batchToCsv(batchResult)} label="Copy batch" />
                )}
              </div>
              <textarea value={batch} onChange={(e) => setBatch(e.target.value)} rows={4} className="w-full rounded-md border bg-background p-2 text-sm font-mono" />
              {batchResult && batchResult.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {batchResult.map((r, i) => (
                    <div key={i} className="rounded-md border p-2 text-xs">
                      <p className="text-muted-foreground">{fmtNum(r.dim)}</p>
                      <p className="font-mono">{typeof r.model === "number" ? fmtNum(r.model) : "err"}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
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
