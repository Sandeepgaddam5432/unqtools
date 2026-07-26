"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  convert, convertAll, referenceTable, renderReport, asciiForByte,
  getConversionPresets, type Base,
} from "./logic";

const BASES: Base[] = ["binary", "decimal", "hex", "octal"];

export default function BinaryDecimalHexConverter() {
  const [value, setValue] = useState("255");
  const [from, setFrom] = useState<Base>("decimal");
  const [to, setTo] = useState<Base>("hex");
  const [signed, setSigned] = useState(false);
  const [bitWidth, setBitWidth] = useState<8 | 16 | 32 | 64>(8);

  const result = useMemo(() => convert({ value, from, to, signed, bitWidth }), [value, from, to, signed, bitWidth]);
  const allBases = useMemo(() => (result.isValid ? convertAll(value, from) : null), [value, from, result.isValid]);
  const refTable = useMemo(() => referenceTable(), []);
  const report = useMemo(() => renderReport(result), [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Value</Label>
              <Input value={value} onChange={(e) => setValue(e.target.value)}
                className="font-mono text-sm" aria-label="Input value" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <select value={from} onChange={(e) => setFrom(e.target.value as Base)}
                className="h-9 w-full text-sm rounded border bg-background px-2 cursor-pointer">
                {BASES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <select value={to} onChange={(e) => setTo(e.target.value as Base)}
                className="h-9 w-full text-sm rounded border bg-background px-2 cursor-pointer">
                {BASES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} />
              Signed
            </label>
            {signed && (
              <select value={bitWidth} onChange={(e) => setBitWidth(Number(e.target.value) as 8 | 16 | 32 | 64)}
                className="h-7 text-xs rounded border bg-background px-2 cursor-pointer">
                {[8, 16, 32, 64].map((w) => <option key={w} value={w}>{w}-bit</option>)}
              </select>
            )}
            <div className="ml-auto flex gap-2">
              <CopyButton getText={() => result.output} label="Copy result" />
              <DownloadButton getText={() => report} filename="base-conversion-report.txt" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
            <span className="text-xs text-muted-foreground">Presets:</span>
            {getConversionPresets().map((p) => (
              <button key={p.id} type="button"
                onClick={() => { setValue(p.input.value); setFrom(p.input.from); setTo(p.input.to); }}
                className="px-2 py-0.5 rounded-md text-[11px] border bg-background hover:bg-muted cursor-pointer">
                {p.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {!result.isValid && result.error && <ErrorBanner message={result.error} />}

      {result.isValid && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[11px]">{from} → {to}</Badge>
              <Badge variant="outline" className="text-[11px]">decimal: {result.decimalValue}</Badge>
              {result.warnings.length > 0 && (
                <Badge variant="outline" className="text-[11px] text-yellow-700 dark:text-yellow-300">{result.warnings.length} warnings</Badge>
              )}
            </div>
            <div className="rounded border bg-muted/30 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Result</div>
              <code className="font-mono text-lg break-all">{result.output}</code>
            </div>
            {allBases && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {BASES.map((b) => (
                  <div key={b} className="rounded border bg-background px-2 py-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{b}</div>
                    <code className="font-mono text-sm break-all">{allBases[b]}</code>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-2 border-t border-border/40">
              <Label className="text-xs text-muted-foreground">Steps</Label>
              <ol className="mt-1 space-y-1.5">
                {result.steps.map((s, i) => (
                  <li key={i} className="text-xs">
                    <div className="text-muted-foreground">{i + 1}. {s.description}</div>
                    <code className="font-mono text-foreground">→ {s.result}</code>
                  </li>
                ))}
              </ol>
            </div>
            {result.warnings.length > 0 && (
              <div className="text-[11px] text-yellow-700 dark:text-yellow-300">
                {result.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Reference table (base 2..16)</Label>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1 pr-2">Base</th>
                  <th className="py-1 pr-2">Name</th>
                  <th className="py-1 pr-2">Digits</th>
                  <th className="py-1">255 in base</th>
                </tr>
              </thead>
              <tbody>
                {refTable.map((r) => (
                  <tr key={r.base} className="border-b last:border-0">
                    <td className="py-1 pr-2 font-mono">{r.base}</td>
                    <td className="py-1 pr-2">{r.name}</td>
                    <td className="py-1 pr-2 font-mono break-all">{r.digits}</td>
                    <td className="py-1 font-mono">{r.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">ASCII map (0..127)</Label>
          <div className="grid grid-cols-8 sm:grid-cols-16 gap-1 text-[10px] font-mono">
            {Array.from({ length: 128 }, (_, i) => (
              <div key={i} className="rounded border bg-background px-1 py-0.5 text-center">
                <div className="text-muted-foreground">{i}</div>
                <div>{asciiForByte(i)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> conversions happen
            entirely in your browser. Nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
