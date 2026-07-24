"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner } from "../../_shared";
import { process, type AlignOptions, type Alignment } from "./logic";

export default function TextAligner() {
  const [input, setInput] = useState("The quick brown fox jumps over the lazy dog\nCoding is fun\nAlign me");
  const [width, setWidth] = useState(30);
  const [alignment, setAlignment] = useState<Alignment>("justify");
  const [fillChar, setFillChar] = useState(" ");
  const [justifyLastLine, setJustifyLastLine] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof process> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    setError(null);
    const opts: AlignOptions = { width, alignment, fillChar, justifyLastLine };
    const r = process(input, opts);
    if ("error" in r) { setError(r.error); setResult(null); }
    else setResult(r);
  }, [input, width, alignment, fillChar, justifyLastLine]);

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
              <Input type="number" min={1} value={width} onChange={(e) => setWidth(parseInt(e.target.value) || 1)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Alignment</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={alignment} onChange={(e) => setAlignment(e.target.value as Alignment)}>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="center">Center</option>
                <option value="justify">Justify</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Fill char</Label>
              <Input value={fillChar} maxLength={1} onChange={(e) => setFillChar(e.target.value)} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={justifyLastLine} onChange={(e) => setJustifyLastLine(e.target.checked)} disabled={alignment !== "justify"} /><span>Justify last line</span></label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Align</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{result.linesProcessed} lines</Badge>
              {result.truncatedLines > 0 && <Badge variant="destructive">{result.truncatedLines} truncated</Badge>}
              <div className="ml-auto"><CopyButton getText={() => result.output} /></div>
            </div>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
            <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre">{result.output}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
