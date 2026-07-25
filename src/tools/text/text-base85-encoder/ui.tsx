"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { encodeText, decodeText, validateInput, type Base85Result } from "./logic";

export default function TextBase85Encoder() {
  const [input, setInput] = useState("Hello");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [delimiter, setDelimiter] = useState(false);
  const [result, setResult] = useState<Base85Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const convert = useCallback(() => {
    const v = validateInput(input, mode);
    if ("error" in v) { setError(v.error); setResult(null); return; }
    setError(null);
    const r = mode === "encode" ? encodeText(input, { delimiter }) : decodeText(input);
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setResult(r);
  }, [input, mode, delimiter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={mode === "encode" ? "default" : "outline"} onClick={() => setMode("encode")}>Encode</Button>
            <Button size="sm" variant={mode === "decode" ? "default" : "outline"} onClick={() => setMode("decode")}>Decode</Button>
            <label className="flex items-center gap-2 text-sm ml-auto"><input type="checkbox" checked={delimiter} onChange={(e) => setDelimiter(e.target.checked)} /><span>Add &lt;~ ~&gt; delimiters</span></label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={convert}>{mode === "encode" ? "Encode" : "Decode"}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput("Hello"); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Output ({result.outputLength} chars)</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => result.output} />
                <DownloadButton getText={() => result.output} filename="base85.txt" />
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
