"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton } from "../../_shared";
import { process, convertAll, toCsv, UNIT_LABELS, type WeightUnit } from "./logic";

const UNITS = Object.keys(UNIT_LABELS) as WeightUnit[];

export default function WeightUnitConverter() {
  const [value, setValue] = useState(1);
  const [from, setFrom] = useState<WeightUnit>("kg");
  const [to, setTo] = useState<WeightUnit>("lb");
  const [result, setResult] = useState<ReturnType<typeof process> | null>(null);

  const run = useCallback(() => {
    setResult(process(value, { from, to }));
  }, [value, from, to]);

  const all = convertAll(value, from);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Value</Label>
              <Input type="number" value={value} onChange={(e) => setValue(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={from} onChange={(e) => setFrom(e.target.value as WeightUnit)}>
                {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={to} onChange={(e) => setTo(e.target.value as WeightUnit)}>
                {UNITS.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Convert</Button>
          </div>
        </CardContent>
      </Card>

      {result && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Result</p>
                <p className="text-2xl font-bold font-mono">{result.output.toLocaleString(undefined, { maximumFractionDigits: 6 })} {result.unit}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{value} {from}</Badge>
                <CopyButton getText={() => String(result.output)} />
              </div>
            </div>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">All conversions ({all.length})</Badge>
            <DownloadButton getText={() => toCsv(all)} filename="weight-conversions.csv" mime="text/csv" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {all.map((r) => (
              <div key={r.unit} className="rounded-md border border-border/50 p-2">
                <p className="text-xs text-muted-foreground">{UNIT_LABELS[r.unit]}</p>
                <p className="text-sm font-mono font-bold">{r.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
