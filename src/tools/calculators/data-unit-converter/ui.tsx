"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  UNITS,
  UNIT_LIST,
  convert,
  convertAll,
  formatNumber,
  validateInput,
  parseDataString,
  autoFormat,
  transferTime,
  humanizeDuration,
  binaryVsDecimal,
  batchConvert,
  mediaEstimate,
  usableCapacity,
  type DataUnitId,
} from "./logic";

export default function DataUnitConverterUI() {
  const [value, setValue] = useState("1");
  const [unit, setUnit] = useState<DataUnitId>("gib");
  const [target, setTarget] = useState<DataUnitId>("byte");
  const [bandwidth, setBandwidth] = useState("100");
  const [bwUnit, setBwUnit] = useState<DataUnitId>("mb");
  const [batch, setBatch] = useState("1 GiB\n500 MB");
  const [mediaSize, setMediaSize] = useState("5");
  const [overhead, setOverhead] = useState("7");

  const validated = useMemo(() => validateInput(value), [value]);
  const bwValid = useMemo(() => validateInput(bandwidth), [bandwidth]);
  const mediaValid = useMemo(() => validateInput(mediaSize), [mediaSize]);
  const overheadValid = useMemo(() => validateInput(overhead), [overhead]);

  const table = useMemo(
    () => (validated.error ? [] : convertAll(validated.value, unit)),
    [validated, unit],
  );
  const direct = useMemo(
    () => (validated.error || !bwValid.error ? null : convert(validated.value, unit, target)),
    [validated, unit, target, bwValid],
  );
  const transfer = useMemo(() => {
    if (validated.error || bwValid.error) return null;
    return transferTime(validated.value, unit, bwValid.value, bwUnit);
  }, [validated, bwValid, bwUnit, unit]);

  const batchOut = useMemo(() => batchConvert(batch, target), [batch, target]);
  const media = useMemo(() => {
    if (validated.error || mediaValid.error) return null;
    return mediaEstimate(validated.value, unit, mediaValid.value);
  }, [validated, mediaValid, unit]);

  const usable = useMemo(() => {
    if (validated.error || overheadValid.error) return null;
    return usableCapacity(validated.value, unit, overheadValid.value);
  }, [validated, overheadValid, unit]);

  const auto = useMemo(
    () => (validated.error ? "" : autoFormat(validated.value, unit)),
    [validated, unit],
  );

  const bvd = useMemo(() => binaryVsDecimal("g"), []);

  const copyAll = useCallback(() => {
    if (!table.length) return "";
    return table.map((r) => `${r.unit.symbol}\t${r.formatted}`).join("\n");
  }, [table]);

  return (
    <div className="space-y-4">
      {validated.error && <ErrorBanner message={`Input error: ${validated.error}`} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Value</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} aria-label="Value to convert" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">From unit</Label>
              <select
                aria-label="From unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as DataUnitId)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                {UNIT_LIST.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">To unit</Label>
              <select
                aria-label="To unit"
                value={target}
                onChange={(e) => setTarget(e.target.value as DataUnitId)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                {UNIT_LIST.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {direct !== null && !validated.error && (
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold tabular-nums">
                {formatNumber(direct)} <span className="text-base font-normal">{UNITS[target].symbol}</span>
              </div>
              <CopyButton getText={() => `${formatNumber(direct)} ${UNITS[target].symbol}`} />
              <span className="text-xs text-muted-foreground ml-2">Auto: {auto}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-3">All-units table</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {table.map((r) => (
              <div key={r.unit.id} className="rounded-md border p-2 text-xs">
                <p className="text-muted-foreground">{r.unit.name}</p>
                <p className="font-mono font-medium tabular-nums">
                  {r.formatted} {r.unit.symbol}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <CopyButton getText={copyAll} label="Copy table (TSV)" />
            <DownloadButton getText={copyAll} filename="data-conversion.txt" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Transfer time estimator</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Bandwidth</Label>
                <Input value={bandwidth} onChange={(e) => setBandwidth(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Unit</Label>
                <select
                  value={bwUnit}
                  onChange={(e) => setBwUnit(e.target.value as DataUnitId)}
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                >
                  {UNIT_LIST.filter((u) => u.kind === "bit" || u.id === "bit").map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.symbol}/s
                    </option>
                  ))}
                  {UNIT_LIST.filter((u) => u.kind === "byte").map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.symbol}/s
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {transfer && (
              <p className="text-sm">
                ≈ <span className="font-bold">{transfer.human}</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Binary vs decimal confusion</p>
            <p className="text-xs text-muted-foreground">
              1 GiB is <span className="font-bold text-foreground">{bvd.pct.toFixed(2)}%</span> bigger than 1 GB. Drive
              manufacturers use GB; OSes often use GiB.
            </p>
            <div className="text-xs space-y-1">
              {(["k", "m", "g", "t", "p"] as const).map((p) => {
                const r = binaryVsDecimal(p);
                return (
                  <div key={p} className="flex justify-between border-b border-border/40 py-1">
                    <span>{r.binary.toUpperCase()} vs {r.decimal.toUpperCase()}</span>
                    <span className="font-mono">{r.pct.toFixed(2)}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Batch converter (TSV)</p>
            <textarea
              aria-label="Batch input"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="w-full min-h-[80px] rounded-md border bg-background p-2 font-mono text-xs"
            />
            <pre className="text-xs bg-muted/40 rounded-md p-2 overflow-x-auto whitespace-pre-wrap">{batchOut}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Media estimate & usable capacity</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Avg item size (MB)</Label>
                <Input value={mediaSize} onChange={(e) => setMediaSize(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">FS overhead (%)</Label>
                <Input value={overhead} onChange={(e) => setOverhead(e.target.value)} />
              </div>
            </div>
            {media && (
              <p className="text-sm">
                Fits ≈ <span className="font-bold">{media.human}</span> items
              </p>
            )}
            {usable && (
              <p className="text-sm">
                Usable capacity ≈ <span className="font-bold">{usable.human}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> every conversion runs in your browser. Binary (KiB/MiB) uses 1024; decimal (KB/MB) uses 1000 — never mixed up again.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
