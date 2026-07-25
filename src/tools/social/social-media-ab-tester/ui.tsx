"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { computeAB, CONFIDENCE_LABELS, type ABInput, type ABResult } from "./logic";

const CONFIDENCE_LEVELS: ABInput["confidenceLevel"][] = [0.9, 0.95, 0.99];

export default function SocialMediaABTester() {
  const [aVisitors, setAVisitors] = useState(5000);
  const [aConversions, setAConversions] = useState(250);
  const [bVisitors, setBVisitors] = useState(5000);
  const [bConversions, setBConversions] = useState(310);
  const [confidenceLevel, setConfidenceLevel] = useState<ABInput["confidenceLevel"]>(0.95);

  const result = useMemo<ABResult>(() => computeAB({ aVisitors, aConversions, bVisitors, bConversions, confidenceLevel }), [aVisitors, aConversions, bVisitors, bConversions, confidenceLevel]);

  const report = useMemo(() => {
    const lines = [
      `A: ${aConversions}/${aVisitors} = ${(result.aRate * 100).toFixed(2)}%`,
      `B: ${bConversions}/${bVisitors} = ${(result.bRate * 100).toFixed(2)}%`,
      `Diff: ${(result.absoluteDifference * 100).toFixed(2)}% (relative lift ${(result.relativeLift * 100).toFixed(2)}%)`,
      `Z-score: ${result.zScore}`,
      `p-value: ${result.pValue}`,
      `Significant at ${CONFIDENCE_LABELS[confidenceLevel]}: ${result.isSignificant ? "yes" : "no"}`,
      `Winner: ${result.winner}`,
      result.sampleSizeWarning ? `Warning: ${result.sampleSizeWarning}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }, [result, aVisitors, aConversions, bVisitors, bConversions, confidenceLevel]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><Label className="text-[10px] uppercase text-muted-foreground">A: visitors</Label><Input type="number" value={aVisitors} onChange={(e) => setAVisitors(Number(e.target.value))} className="mt-1 h-8 text-xs" /></div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">A: conversions</Label><Input type="number" value={aConversions} onChange={(e) => setAConversions(Number(e.target.value))} className="mt-1 h-8 text-xs" /></div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">B: visitors</Label><Input type="number" value={bVisitors} onChange={(e) => setBVisitors(Number(e.target.value))} className="mt-1 h-8 text-xs" /></div>
            <div><Label className="text-[10px] uppercase text-muted-foreground">B: conversions</Label><Input type="number" value={bConversions} onChange={(e) => setBConversions(Number(e.target.value))} className="mt-1 h-8 text-xs" /></div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Label>Confidence level</Label>
            <select value={confidenceLevel} onChange={(e) => setConfidenceLevel(Number(e.target.value) as ABInput["confidenceLevel"])} className="h-7 rounded border bg-background px-2 text-xs">
              {CONFIDENCE_LEVELS.map((c) => <option key={c} value={c}>{CONFIDENCE_LABELS[c]}</option>)}
            </select>
          </div>
          {result.sampleSizeWarning && <ErrorBanner message={result.sampleSizeWarning} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Result</p>
            <div className="flex gap-2">
              <CopyButton getText={() => report} label="Copy" />
              <DownloadButton getText={() => report} filename="ab-test.txt" label="Download" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Cell label="A rate" value={`${(result.aRate * 100).toFixed(2)}%`} />
            <Cell label="B rate" value={`${(result.bRate * 100).toFixed(2)}%`} />
            <Cell label="Abs. diff" value={`${(result.absoluteDifference * 100).toFixed(2)}%`} />
            <Cell label="Relative lift" value={`${(result.relativeLift * 100).toFixed(2)}%`} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Cell label="Z-score" value={String(result.zScore)} />
            <Cell label="p-value" value={String(result.pValue)} />
            <Cell label={`Critical Z (${CONFIDENCE_LABELS[confidenceLevel]})`} value={String(result.criticalZ)} />
            <Cell label="Significant?" value={result.isSignificant ? "Yes" : "No"} />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={result.winner === "none" ? "text-muted-foreground" : "text-emerald-600"}>
              Winner: {result.winner === "none" ? "No significant winner" : `Variant ${result.winner}`}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all statistics run locally in your browser.</p></CardContent></Card>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
