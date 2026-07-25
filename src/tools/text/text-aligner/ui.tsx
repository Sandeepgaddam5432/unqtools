"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  process, lineLengthStats, autoFitWidth, validateOptions,
  batchProcess, batchToCsv, fmt, type Alignment,
} from "./logic";

const ALIGNMENTS: { value: Alignment; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "center", label: "Center" },
  { value: "justify", label: "Justify" },
];

export default function TextAligner() {
  const [input, setInput] = useState("The quick brown fox jumps over the lazy dog\nCoding is fun\nAlign me");
  const [width, setWidth] = useState("30");
  const [alignment, setAlignment] = useState<Alignment>("justify");
  const [fillChar, setFillChar] = useState(" ");
  const [justifyLastLine, setJustifyLastLine] = useState(false);
  const [batch, setBatch] = useState("hello world\nshort\nthis is a longer line");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    setError(null);
    const opts = { width: Number(width), alignment, fillChar, justifyLastLine };
    const v = validateOptions(opts);
    if ("error" in v) { setError(v.error); return null; }
    const r = process(input, opts);
    if ("error" in r) { setError(r.error); return null; }
    return r;
  }, [input, width, alignment, fillChar, justifyLastLine]);

  const stats = useMemo(() => result ? lineLengthStats(result.lineLengths) : null, [result]);
  const autoW = useMemo(() => autoFitWidth(input), [input]);

  const batchResult = useMemo(() => batchProcess(
    batch.split("\n").filter(Boolean),
    { width: Number(width), alignment, fillChar, justifyLastLine },
  ), [batch, width, alignment, fillChar, justifyLastLine]);

  const csv = useMemo(() => {
    if (!result) return "";
    return [
      "Field,Value",
      `Lines,${result.linesProcessed}`,
      `Truncated,${result.truncatedLines}`,
      `Width,${width}`,
      `Alignment,${alignment}`,
      `Min length,${stats?.min ?? 0}`,
      `Max length,${stats?.max ?? 0}`,
      `Avg length,${fmt(stats?.avg ?? 0, 2)}`,
      `Output,"${result.output.replace(/"/g, '""')}"`,
    ].join("\n");
  }, [result, width, alignment, stats]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Width</Label>
              <Input type="number" min={1} value={width} onChange={(e) => setWidth(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Alignment</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={alignment} onChange={(e) => setAlignment(e.target.value as Alignment)}>
                {ALIGNMENTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Fill char</Label>
              <Input value={fillChar} maxLength={1} onChange={(e) => setFillChar(e.target.value)} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={justifyLastLine} onChange={(e) => setJustifyLastLine(e.target.checked)} disabled={alignment !== "justify"} /><span>Justify last</span></label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => setWidth(String(autoW))}>Auto-fit ({autoW})</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput("The quick brown fox jumps over the lazy dog\nCoding is fun\nAlign me"); setWidth("30"); setAlignment("justify"); }}>Load sample</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{result.linesProcessed} lines</Badge>
              {result.truncatedLines > 0 && <Badge variant="destructive">{result.truncatedLines} truncated</Badge>}
              {stats && <Badge variant="outline">Length: {stats.min}-{stats.max} (avg {fmt(stats.avg, 1)})</Badge>}
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => result.output} />
                <DownloadButton getText={() => csv} filename="alignment.csv" mime="text/csv" />
              </div>
            </div>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
            <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre">{result.output}</pre>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Batch (one input per line)</Label>
          {batchResult.length > 0 && <CopyButton getText={() => batchToCsv(batchResult)} label="Copy batch" />}
        </div>
        <textarea value={batch} onChange={(e) => setBatch(e.target.value)} rows={3} className="w-full rounded-md border bg-background p-2 text-sm font-mono" />
        {batchResult.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {batchResult.map((r) => (
              <div key={r.i} className="rounded-md border p-2 text-xs">
                <p className="text-muted-foreground">#{r.i + 1}</p>
                <p className="font-mono truncate">{"error" in r.result ? "err" : r.result.output}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all alignment runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
