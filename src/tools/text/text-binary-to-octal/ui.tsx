"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { binaryToOctal, validateOptions, type BinaryToOctalResult } from "./logic";

export default function TextBinaryToOctal() {
  const [input, setInput] = useState("01001000 01101001");
  const [bits, setBits] = useState<3 | 6 | 9 | 12>(3);
  const [separator, setSeparator] = useState(" ");
  const [result, setResult] = useState<BinaryToOctalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const convert = useCallback(() => {
    const opts = { separator, bits };
    const v = validateOptions(opts);
    if ("error" in v) { setError(v.error); setResult(null); return; }
    setError(null);
    setResult(binaryToOctal(input, opts));
  }, [input, bits, separator]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Binary input</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Bits per group</Label>
              <select value={bits} onChange={(e) => setBits(Number(e.target.value) as 3 | 6 | 9 | 12)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value={3}>3 bits → 1 octal digit</option>
                <option value={6}>6 bits → 2 octal digits</option>
                <option value={9}>9 bits → 3 octal digits</option>
                <option value={12}>12 bits → 4 octal digits</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Separator</Label>
              <input value={separator} onChange={(e) => setSeparator(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={convert}>Convert</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput("01001000 01101001"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Octal output ({result.groupCount} groups, {result.invalidGroups} invalid)</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => result.output} />
                <DownloadButton getText={() => result.output} filename="octal.txt" />
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
