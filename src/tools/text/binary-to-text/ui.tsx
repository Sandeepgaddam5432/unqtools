"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  binaryToText, validateOptions, autoDetectBits, textToBinary,
  normalizeBinary, batchConvert, batchToCsv,
  codePointsToHex, codePointsToDec, isValidBinary,
} from "./logic";

const SAMPLES: { label: string; value: string; bits: 7 | 8 | 16 }[] = [
  { label: "Hi (8-bit)", value: "01001000 01101001", bits: 8 },
  { label: "Hello (8-bit)", value: "01001000 01100101 01101100 01101100 01101111", bits: 8 },
  { label: "A (7-bit)", value: "1000001", bits: 7 },
  { label: "U+0041 (16-bit)", value: "0000000001000001", bits: 16 },
];

export default function BinaryToText() {
  const [input, setInput] = useState("01001000 01101001");
  const [bits, setBits] = useState<7 | 8 | 16>(8);
  const [utf8, setUtf8] = useState(true);
  const [strict, setStrict] = useState(false);
  const [batch, setBatch] = useState("01000001\n01101001\n01001000 01101001");
  const [reverseText, setReverseText] = useState("Hi");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    queueMicrotask(() => setError(null));
    const opts = { bits, utf8, strict };
    const v = validateOptions(opts);
    if ("error" in v) { queueMicrotask(() => setError(v.error)); return null; }
    return binaryToText(input, opts);
  }, [input, bits, utf8, strict]);

  const detectedBits = useMemo(() => autoDetectBits(normalizeBinary(input)), [input]);

  const reverse = useMemo(() => textToBinary(reverseText, bits, " "), [reverseText, bits]);

  const batchResult = useMemo(() => batchConvert(batch.split("\n").filter(Boolean), { bits, utf8 }), [batch, bits, utf8]);

  const csv = useMemo(() => {
    if (!result) return "";
    return [
      "Field,Value",
      `Input length,${result.inputLength}`,
      `Output length,${result.outputLength}`,
      `Group count,${result.groupCount}`,
      `Invalid groups,${result.invalidGroups}`,
      `Output,"${result.output.replace(/"/g, '""')}"`,
      `Hex code points,${codePointsToHex(result.codePoints)}`,
      `Dec code points,${codePointsToDec(result.codePoints)}`,
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
              <Badge variant={isValidBinary(normalizeBinary(input)) ? "outline" : "destructive"}>{isValidBinary(normalizeBinary(input)) ? "Valid" : "Invalid"}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Bits per group</Label>
              <select value={bits} onChange={(e) => setBits(Number(e.target.value) as 7 | 8 | 16)} className="h-9 rounded-md border bg-background px-3 text-sm w-40">
                <option value={7}>7 (ASCII)</option>
                <option value={8}>8 (UTF-8 / byte)</option>
                <option value={16}>16 (UCS-2)</option>
              </select>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setBits(detectedBits)}>Use detected</Button>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={utf8} onChange={(e) => setUtf8(e.target.checked)} disabled={bits !== 8} /> UTF-8 decode</label>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} /> Strict</label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLES.map((s) => (
              <Button key={s.label} size="sm" variant="outline" onClick={() => { setInput(s.value); setBits(s.bits); }}>
                {s.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => result?.output ?? ""} disabled={!result} />
            <DownloadButton getText={() => csv} filename="binary-decoded.csv" mime="text/csv" disabled={!result} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Text output ({result.groupCount} groups · {result.invalidGroups} invalid)</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-sm overflow-x-auto p-4 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-all">{result.output}</pre>
            <p className="text-xs text-muted-foreground p-2">Input: {result.inputLength} chars · Output: {result.outputLength} chars</p>
            {result.errors.length > 0 && (
              <div className="text-xs text-destructive p-2 border-t">
                {result.errors.slice(0, 5).map((e, i) => (
                  <p key={i}>Group {e.index} ({e.group}): {e.reason}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4 space-y-2">
        <Label className="text-sm font-medium">Reverse: text → binary</Label>
        <input value={reverseText} onChange={(e) => setReverseText(e.target.value)} className="w-full rounded-md border px-2 py-1 text-sm" />
        <pre className="text-xs font-mono bg-muted/40 p-2 rounded-md">{reverse}</pre>
        <CopyButton getText={() => reverse} label="Copy binary" />
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
