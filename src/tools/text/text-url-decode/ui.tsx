"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { urlDecode, validateOptions, type UrlDecodeResult } from "./logic";

export default function TextUrlDecode() {
  const [input, setInput] = useState("hello%20world");
  const [component, setComponent] = useState(true);
  const [plusToSpace, setPlusToSpace] = useState(false);
  const [result, setResult] = useState<UrlDecodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const convert = useCallback(() => {
    const opts = { component, plusToSpace };
    const v = validateOptions(opts);
    if ("error" in v) { setError(v.error); setResult(null); return; }
    setError(null);
    setResult(urlDecode(input, opts));
  }, [input, component, plusToSpace]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">URL-encoded input</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={component} onChange={(e) => setComponent(e.target.checked)} /><span>decodeURIComponent (Unicode-safe)</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={plusToSpace} onChange={(e) => setPlusToSpace(e.target.checked)} /><span>Convert + to space</span></label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={convert}>Decode</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput("hello%20world"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Decoded output ({result.invalidSequences} invalid sequences)</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => result.output} />
                <DownloadButton getText={() => result.output} filename="url-decoded.txt" />
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
