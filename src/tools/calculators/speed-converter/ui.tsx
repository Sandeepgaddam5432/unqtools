"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  buildSpeedTable,
  speedReferenceCsv,
  tableToText,
  SPEED_ABBREVIATIONS,
  SPEED_LABELS,
  type SpeedUnit,
  type SpeedResult,
} from "./logic";

const UNITS: SpeedUnit[] = ["mph", "kmh", "ms", "fps", "knot"];

export default function SpeedConverter() {
  const [value, setValue] = useState("60");
  const [from, setFrom] = useState<SpeedUnit>("mph");
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = buildSpeedTable(Number(value), from);
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [value, from]);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  const sample = useCallback(() => { setValue("100"); setFrom("kmh"); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Value</Label>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Speed value" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">From unit</Label>
              <div className="flex flex-wrap gap-2">
                {UNITS.map((u) => (
                  <Button key={u} size="sm" variant={from === u ? "default" : "outline"} onClick={() => setFrom(u)}>{SPEED_ABBREVIATIONS[u]}</Button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Convert</Button>
            <Button size="sm" variant="ghost" onClick={sample}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {result.table.map((e) => (
              <Card key={e.unit}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{e.label}</p>
                  <p className="text-2xl font-bold">{e.value} <span className="text-sm text-muted-foreground">{SPEED_ABBREVIATIONS[e.unit]}</span></p>
                  {e.unit === from && <Badge variant="secondary" className="mt-1">Input</Badge>}
                </CardContent>
              </Card>
            ))}
          </div>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Reference speeds</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-muted/30 rounded p-3">{speedReferenceCsv()}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export conversion</p>
              <div className="flex gap-2">
                <CopyButton getText={() => tableToText(result)} label="Copy text" />
                <CopyButton getText={() => speedReferenceCsv()} label="Copy reference CSV" />
                <DownloadButton getText={() => speedReferenceCsv()} filename="speed-reference.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
