"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { process, convertAll, normalize, toCsv, UNIT_LABELS, type AngleUnit } from "./logic";

const UNITS = Object.keys(UNIT_LABELS) as AngleUnit[];

export default function AngleConverter() {
  const [value, setValue] = useState(180);
  const [from, setFrom] = useState<AngleUnit>("deg");
  const [to, setTo] = useState<AngleUnit>("rad");
  const [result, setResult] = useState<ReturnType<typeof process> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = process(value, { from, to });
    if ("error" in r) {
      setError(r.error);
      setResult(null);
    } else {
      setError(null);
      setResult(r);
    }
  }, [value, from, to]);

  const all = convertAll(value, from);
  const normalized = normalize(value * (UNIT_LABELS[from] ? 1 : 1));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Value</Label>
              <Input
                type="number"
                value={value}
                onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value as AngleUnit)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value as AngleUnit)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button size="sm" onClick={run}>
            Convert
          </Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Result</p>
                <p className="text-2xl font-bold font-mono">
                  {result.output.toLocaleString(undefined, {
                    maximumFractionDigits: 8,
                  })}{" "}
                  {result.unit}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Normalized: {normalized.toFixed(4)}°
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">
                  {value} {from}
                </Badge>
                <CopyButton getText={() => String(result.output)} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">All conversions ({all.length})</Badge>
            <DownloadButton
              getText={() => toCsv(all)}
              filename="angle-conversions.csv"
              mime="text/csv"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {all.map((r) => (
              <div key={r.unit} className="rounded-md border border-border/50 p-2">
                <p className="text-xs text-muted-foreground">{UNIT_LABELS[r.unit]}</p>
                <p className="text-sm font-mono font-bold">
                  {r.value.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all conversions run locally
            in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
