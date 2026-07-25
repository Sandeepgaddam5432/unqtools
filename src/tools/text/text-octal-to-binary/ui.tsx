"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { octalToBinary, validateOptions, type OctalToBinaryResult } from "./logic";

export default function TextOctalToBinary() {
  const [input, setInput] = useState("17 24");
  const [digitsPerGroup, setDigitsPerGroup] = useState<1 | 2 | 3 | 4>(1);
  const [separator, setSeparator] = useState(" ");
  const [result, setResult] = useState<OctalToBinaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const convert = useCallback(() => {
    const opts = { separator, digitsPerGroup };
    const v = validateOptions(opts);
    if ("error" in v) { setError(v.error); setResult(null); return; }
    setError(null);
    setResult(octalToBinary(input, opts));
  }, [input, digitsPerGroup, separator]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Octal input</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Digits per group</Label>
              <select value={digitsPerGroup} onChange={(e) => setDigitsPerGroup(Number(e.target.value) as 1 | 2 | 3 | 4)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value={1}>1 digit → 3 bits</option>
                <option value={2}>2 digits → 6 bits</option>
                <option value={3}>3 digits → 9 bits</option>
                <option value={4}>4 digits → 12 bits</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Separator</Label>
              <input value={separator} onChange={(e) => setSeparator(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={convert}>Convert</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput("17 24"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Binary output ({result.groupCount} groups, {result.invalidGroups} invalid)</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => result.output} />
                <DownloadButton getText={() => result.output} filename="binary.txt" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-sm overflow-x-auto p-4 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-all">{result.output}</pre>
            <p className="text-xs text-muted-foreground p-2">Input: {result.inputLength} chars · Output: {result.outputLength} chars</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> conversion runs locally in your browser.</p>
        </CardContent>
      </Card>
    </div>
  );
}
