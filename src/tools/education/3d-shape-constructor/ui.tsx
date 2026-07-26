"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  calculateShape,
  resultToText,
  resultToCsv,
  netBuildPlan,
  type ShapeType,
  type ShapeResult,
} from "./logic";

const SHAPES: { id: ShapeType; label: string; needs: ("side" | "radius" | "height")[] }[] = [
  { id: "cube", label: "Cube", needs: ["side"] },
  { id: "sphere", label: "Sphere", needs: ["radius"] },
  { id: "cylinder", label: "Cylinder", needs: ["radius", "height"] },
  { id: "cone", label: "Cone", needs: ["radius", "height"] },
  { id: "pyramid", label: "Square Pyramid", needs: ["side", "height"] },
];

export default function Shape3DConstructor() {
  const [shape, setShape] = useState<ShapeType>("cube");
  const [side, setSide] = useState("3");
  const [radius, setRadius] = useState("2");
  const [height, setHeight] = useState("5");
  const [result, setResult] = useState<ShapeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = SHAPES.find((s) => s.id === shape)!;

  const run = useCallback(() => {
    const r = calculateShape({
      shape,
      side: side ? Number(side) : undefined,
      radius: radius ? Number(radius) : undefined,
      height: height ? Number(height) : undefined,
    });
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [shape, side, radius, height]);

  const sample = useCallback(() => {
    if (shape === "cube") { setSide("3"); }
    else if (shape === "sphere") { setRadius("2"); }
    else if (shape === "cylinder") { setRadius("2"); setHeight("5"); }
    else if (shape === "cone") { setRadius("3"); setHeight("4"); }
    else if (shape === "pyramid") { setSide("4"); setHeight("3"); }
  }, [shape]);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {SHAPES.map((s) => (
              <Button key={s.id} size="sm" variant={shape === s.id ? "default" : "outline"} onClick={() => setShape(s.id)}>{s.label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`flex flex-col gap-1.5 ${meta.needs.includes("side") ? "" : "opacity-40 pointer-events-none"}`}>
              <Label className="text-xs text-muted-foreground">Side / base (units)</Label>
              <Input type="number" value={side} onChange={(e) => setSide(e.target.value)} aria-label="Side length" disabled={!meta.needs.includes("side")} />
            </div>
            <div className={`flex flex-col gap-1.5 ${meta.needs.includes("radius") ? "" : "opacity-40 pointer-events-none"}`}>
              <Label className="text-xs text-muted-foreground">Radius (units)</Label>
              <Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} aria-label="Radius" disabled={!meta.needs.includes("radius")} />
            </div>
            <div className={`flex flex-col gap-1.5 ${meta.needs.includes("height") ? "" : "opacity-40 pointer-events-none"}`}>
              <Label className="text-xs text-muted-foreground">Height (units)</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} aria-label="Height" disabled={!meta.needs.includes("height")} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Calculate</Button>
            <Button size="sm" variant="ghost" onClick={sample}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Surface area</p>
              <p className="text-2xl font-bold text-primary">{result.surfaceArea} <span className="text-sm">u²</span></p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{result.formulas.surface}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Volume</p>
              <p className="text-2xl font-bold text-primary">{result.volume} <span className="text-sm">u³</span></p>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{result.formulas.volume}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Properties</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {result.properties.map((p) => (
                <div key={p.name}>
                  <p className="text-xs text-muted-foreground">{p.name}</p>
                  <p className="text-base font-bold">{p.value} {p.unit}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Net layout</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {result.net.map((n, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="w-20 justify-center">{n.face}</Badge>
                  <span className="flex-1">{n.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {n.face === "circle" || n.face === "sector"
                      ? `r=${n.dimensions.r}${n.dimensions.angle ? `, ${n.dimensions.angle}°` : ""}`
                      : `${n.dimensions.a} × ${n.dimensions.b}`}
                  </span>
                  <Badge variant="secondary">×{n.count}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Net build plan</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 rounded p-3">{netBuildPlan(result)}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export shape data</p>
              <div className="flex gap-2">
                <CopyButton getText={() => resultToText(result)} label="Copy text" />
                <CopyButton getText={() => resultToCsv(result)} label="Copy CSV" />
                <DownloadButton getText={() => resultToCsv(result)} filename={`${result.shape}-shape.csv`} mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
