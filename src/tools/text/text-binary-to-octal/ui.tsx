"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  binaryToOctal, validateOptions, octalToBinary, autoDetectBits,
  binaryGroupToDecimal, binaryGroupToHex, batchConvert, batchToCsv,
  normalizeBinary, splitGroups,
} from "./logic";

const SEPARATORS: { label: string; value: string }[] = [
  { label: "Space", value: " " },
  { label: "Dash", value: "-" },
  { label: "Comma", value: "," },
  { label: "None", value: "" },
  { label: "Newline", value: "\n" },
];

const PREFIXES = ["", "0", "0o"];

export default function TextBinaryToOctal() {
  const [input, setInput] = useState("01001000 01101001");
  const [bits, setBits] = useState<3 | 6 | 9 | 12>(3);
  const [separator, setSeparator] = useState(" ");
  const [prefix, setPrefix] = useState("");
  const [strict, setStrict] = useState(false);
  const [batch, setBatch] = useState("111000\n01001000\n01101001");
  const [reverseInput, setReverseInput] = useState("7 0");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    setError(null);
    const opts = { separator, bits, prefix, strict };
    const v = validateOptions(opts);
    if ("error" in v) { setError(v.error); return null; }
    return binaryToOctal(input, opts);
  }, [input, bits, separator, prefix, strict]);

  const detectedBits = useMemo(() => autoDetectBits(normalizeBinary(input)), [input]);

  const reverse = useMemo(() => octalToBinary(reverseInput, bits, separator), [reverseInput, bits, separator]);

  const perGroup = useMemo(() => {
    const clean = normalizeBinary(input);
    if (!clean) return [];
    return splitGroups(clean, bits).map((g) => ({
      binary: g,
      octal: binaryGroupToOctal(g),
      decimal: binaryGroupToDecimal(g),
      hex: binaryGroupToHex(g),
    }));
  }, [input, bits]);

  const batchResult = useMemo(() => batchConvert(
    batch.split("\n").filter(Boolean),
    { separator, bits, prefix },
  ), [batch, bits, separator, prefix]);

  const csv = useMemo(() => {
    if (!result) return "";
    return [
      "Field,Value",
      `Input length,${result.inputLength}`,
      `Output length,${result.outputLength}`,
      `Group count,${result.groupCount}`,
      `Invalid groups,${result.invalidGroups}`,
      `Output,"${result.output.replace(/"/g, '""')}"`,
    ].join("\n");
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Binary input</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Detected: {detectedBits}-bit</Badge>
              <Badge variant={normalizeBinary(input).length > 0 ? "outline" : "destructive"}>{normalizeBinary(input).length > 0 ? "Valid" : "Empty"}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Bits per group</Label>
              <select value={bits} onChange={(e) => setBits(Number(e.target.value) as 3 | 6 | 9 | 12)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value={3}>3 → 1 oct</option>
                <option value={6}>6 → 2 oct</option>
                <option value={9}>9 → 3 oct</option>
                <option value={12}>12 → 4 oct</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Separator</Label>
              <select value={separator} onChange={(e) => setSeparator(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                {SEPARATORS.map((s) => <option key={s.label} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Prefix</Label>
              <select value={prefix} onChange={(e) => setPrefix(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                {PREFIXES.map((p) => <option key={p} value={p}>{p || "none"}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 justify-end">
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} /> Strict</label>
              <Button size="sm" variant="ghost" onClick={() => setBits(detectedBits)}>Use detected</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setInput("01001000 01101001"); setBits(3); setSeparator(" "); }}>Load sample</Button>
            <CopyButton getText={() => result?.output ?? ""} disabled={!result} />
            <DownloadButton getText={() => csv} filename="binary-to-octal.csv" mime="text/csv" disabled={!result} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Octal output ({result.groupCount} groups · {result.invalidGroups} invalid)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-sm overflow-x-auto p-4 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-all">{result.output}</pre>
            <p className="text-xs text-muted-foreground p-2">Input: {result.inputLength} chars · Output: {result.outputLength} chars</p>
          </CardContent>
        </Card>
      )}

      {perGroup.length > 0 && (
        <Card><CardContent className="p-4 space-y-2">
          <Label className="text-sm font-medium">Per-group breakdown</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {perGroup.slice(0, 16).map((g, i) => (
              <div key={i} className="rounded-md border p-2 text-xs font-mono">
                <p className="text-muted-foreground">{g.binary}</p>
                <p>oct: {g.octal}</p>
                <p>dec: {Number.isNaN(g.decimal) ? "—" : g.decimal}</p>
                <p>hex: {g.hex || "—"}</p>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-4 space-y-2">
        <Label className="text-sm font-medium">Reverse: octal → binary</Label>
        <input value={reverseInput} onChange={(e) => setReverseInput(e.target.value)} className="w-full rounded-md border px-2 py-1 text-sm font-mono" />
        <pre className="text-xs font-mono bg-muted/40 p-2 rounded-md">{typeof reverse === "string" ? reverse : `Error: ${reverse.error}`}</pre>
      </CardContent></Card>

      <Card><CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Batch (one binary per line)</Label>
          {batchResult.length > 0 && <CopyButton getText={() => batchToCsv(batchResult)} label="Copy batch" />}
        </div>
        <textarea value={batch} onChange={(e) => setBatch(e.target.value)} rows={3} className="w-full rounded-md border bg-background p-2 text-sm font-mono" />
        {batchResult.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {batchResult.map((r) => (
              <div key={r.i} className="rounded-md border p-2 text-xs">
                <p className="text-muted-foreground">#{r.i + 1}</p>
                <p className="font-mono">{r.result.output || "—"}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> conversion runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
