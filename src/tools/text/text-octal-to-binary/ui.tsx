"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  octalToBinary, binaryToOctal, octalToBinaryBatch, batchToCsv, roundTrip,
  referenceTable, validateOptions, batchStats, PRESETS,
  type OctalToBinaryOptions,
} from "./logic";

type Direction = "oct2bin" | "bin2oct";

export default function TextOctalToBinary() {
  const [input, setInput] = useState("17 24");
  const [digitsPerGroup, setDigitsPerGroup] = useState<1 | 2 | 3 | 4>(1);
  const [separator, setSeparator] = useState(" ");
  const [prefixMode, setPrefixMode] = useState<"none" | "0b" | "0o" | "custom">("none");
  const [customPrefix, setCustomPrefix] = useState("");
  const [direction, setDirection] = useState<Direction>("oct2bin");
  const [batchText, setBatchText] = useState("");

  const opts: OctalToBinaryOptions = { separator, digitsPerGroup, prefix: prefixMode, customPrefix };

  const result = useMemo(() => {
    const v = validateOptions(opts);
    if ("error" in v) return { kind: "error" as const, error: v.error };
    if (direction === "oct2bin") return { kind: "oct2bin" as const, value: octalToBinary(input, opts) };
    const r = binaryToOctal(input);
    if ("error" in r) return { kind: "error" as const, error: r.error };
    return { kind: "bin2oct" as const, value: r };
  }, [input, opts, direction]);

  // Derive error from result (no setState inside useMemo — would cause infinite re-render)
  const error = result?.kind === "error" ? result.error : null;

  const batchLines = useMemo(() => batchText.split(/\r?\n/).filter((l) => l.length > 0), [batchText]);
  const batchResults = useMemo(() => octalToBinaryBatch(batchLines, opts), [batchLines, opts]);
  const stats = useMemo(() => batchStats(batchResults), [batchResults]);
  const rt = useMemo(() => direction === "oct2bin" ? roundTrip(input, opts) : null, [input, opts, direction]);
  const refTable = useMemo(() => referenceTable(), []);

  const outputText = result && (result.kind === "oct2bin" || result.kind === "bin2oct") ? result.value.output : "";
  const groupCount = result?.kind === "oct2bin" ? result.value.groupCount : 0;
  const invalidCount = result?.kind === "oct2bin" ? result.value.invalidGroups : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["oct2bin", "bin2oct"] as Direction[]).map((d) => (
              <Button key={d} size="sm" variant={direction === d ? "default" : "outline"} onClick={() => setDirection(d)}>
                {d === "oct2bin" ? "Octal → Binary" : "Binary → Octal"}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">{direction === "oct2bin" ? "Octal input" : "Binary input"}</Label>
            <textarea className="rounded-md border bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Digits per group</Label>
              <select value={digitsPerGroup} onChange={(e) => setDigitsPerGroup(Number(e.target.value) as 1 | 2 | 3 | 4)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value={1}>1 → 3 bits</option>
                <option value={2}>2 → 6 bits</option>
                <option value={3}>3 → 9 bits</option>
                <option value={4}>4 → 12 bits</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Separator</Label>
              <Input value={separator} onChange={(e) => setSeparator(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Prefix</Label>
              <select value={prefixMode} onChange={(e) => setPrefixMode(e.target.value as "none" | "0b" | "0o" | "custom")} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="none">none</option>
                <option value="0b">0b</option>
                <option value="0o">0o</option>
                <option value="custom">custom…</option>
              </select>
            </div>
            {prefixMode === "custom" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Custom prefix</Label>
                <Input value={customPrefix} onChange={(e) => setCustomPrefix(e.target.value)} maxLength={8} />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setInput(direction === "oct2bin" ? "17 24" : "001111")}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => setInput("")}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && result.kind !== "error" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Output ({groupCount} groups, {invalidCount} invalid)</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => outputText} />
                <DownloadButton getText={() => outputText} filename={direction === "oct2bin" ? "binary.txt" : "octal.txt"} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 space-y-2">
            <pre className="text-sm overflow-x-auto p-4 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-all">{outputText}</pre>
            {result.kind === "oct2bin" && (
              <div className="flex flex-wrap gap-2 p-3 text-xs">
                <Badge variant="outline">decimal: {result.value.decimalValue ?? "—"}</Badge>
                <Badge variant="outline">hex: {result.value.hexValue ?? "—"}</Badge>
                <Badge variant="outline">output {result.value.outputLength} chars</Badge>
                {rt?.ok && <Badge variant="secondary">round-trip OK</Badge>}
                {result.value.warnings.length > 0 && <span className="text-yellow-700 dark:text-yellow-400">{result.value.warnings.join(" ")}</span>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Batch mode (one octal input per line)</Label>
          <textarea className="rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] font-mono" placeholder={"17\n777"} value={batchText} onChange={(e) => setBatchText(e.target.value)} />
          {batchResults.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex gap-2 text-xs">
                <Badge variant="outline">{batchResults.length} rows</Badge>
                <Badge variant="outline">{stats.totalGroups} groups</Badge>
                <Badge variant="secondary">mean {stats.meanGroupsPerRow}</Badge>
              </div>
              <DownloadButton getText={() => batchToCsv(batchResults, batchLines)} filename="octal-batch.csv" mime="text/csv" />
            </div>
          )}
          {batchResults.length > 0 && (
            <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono max-h-[200px] overflow-y-auto">
              {batchResults.map((r, i) => `${i + 1}\t${r.output}`).join("\n")}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Badge variant="secondary">Common presets</Badge>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => { setDirection("oct2bin"); setInput(p.value); }} className="rounded-md border border-border/50 p-2 text-left hover:bg-muted/40">
                <p className="font-medium">{p.label}</p>
                <p className="font-mono text-muted-foreground">0o{p.value}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Reference: octal digit → 3-bit binary</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs font-mono">
            {refTable.map((e) => (
              <div key={e.octal} className="flex items-center gap-2 rounded border border-border/50 px-2 py-1">
                <span className="font-bold w-4">{e.octal}</span>
                <span className="text-muted-foreground">{e.binary}</span>
                <span className="text-muted-foreground ml-auto">{e.decimal}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> conversion runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
