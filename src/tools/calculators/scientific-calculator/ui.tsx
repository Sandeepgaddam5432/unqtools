"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner } from "../../_shared";
import { process, type CalcOptions } from "./logic";

const PRESETS = ["2 + 3 * 4", "sqrt(16) + 2!", "sin(90)", "2 ^ 10", "log10(1000)", "pi * 2"];

export default function ScientificCalculator() {
  const [input, setInput] = useState("2 + 3 * 4");
  const [angleMode, setAngleMode] = useState<"deg" | "rad">("rad");
  const [precision, setPrecision] = useState(10);
  const [result, setResult] = useState<ReturnType<typeof process> | null>(null);

  const run = useCallback(() => {
    const opts: CalcOptions = { angleMode, precision };
    setResult(process(input, opts));
  }, [input, angleMode, precision]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Expression</Label>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. sqrt(16) + 2!" className="font-mono" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Angle mode</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={angleMode} onChange={(e) => setAngleMode(e.target.value as "deg" | "rad")}>
                <option value="rad">Radians</option>
                <option value="deg">Degrees</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Precision (decimal places)</Label>
              <Input type="number" min={0} max={15} value={precision} onChange={(e) => setPrecision(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button key={p} size="sm" variant="outline" onClick={() => setInput(p)}>{p}</Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Evaluate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {result && "error" in result && <ErrorBanner message={result.error} />}

      {result && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Result</p>
                <p className="text-2xl font-bold font-mono">{result.result}</p>
              </div>
              <Badge variant="secondary">{angleMode}</Badge>
            </div>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Steps</p>
              {result.steps.map((s, i) => (
                <p key={i} className="text-xs font-mono text-muted-foreground">{s}</p>
              ))}
            </div>
            <div className="flex justify-end"><CopyButton getText={() => String(result.result)} /></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
