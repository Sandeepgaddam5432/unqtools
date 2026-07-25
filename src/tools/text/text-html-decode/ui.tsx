"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { htmlDecode, validateInput, type HtmlDecodeResult } from "./logic";

export default function TextHtmlDecode() {
  const [input, setInput] = useState("&lt;b&gt;Hello&lt;/b&gt; &amp; welcome &copy;");
  const [result, setResult] = useState<HtmlDecodeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const convert = useCallback(() => {
    const v = validateInput(input);
    if ("error" in v) { setError(v.error); setResult(null); return; }
    setError(null);
    setResult(htmlDecode(input));
  }, [input]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">HTML-encoded input</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={convert}>Decode</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput("&lt;b&gt;Hello&lt;/b&gt; &amp; welcome &copy;"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Decoded output ({result.entitiesDecoded} entities)</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => result.output} />
                <DownloadButton getText={() => result.output} filename="html-decoded.txt" />
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
