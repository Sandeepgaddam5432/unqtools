"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { textToHex, validateOptions, type TextToHexResult } from "./logic";

export default function TextTextToHex() {
  const [input, setInput] = useState("Hello");
  const [encoding, setEncoding] = useState<"utf-8" | "utf-16le" | "utf-16be" | "ascii">("utf-8");
  const [separator, setSeparator] = useState(" ");
  const [uppercase, setUppercase] = useState(false);
  const [result, setResult] = useState<TextToHexResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const convert = useCallback(() => {
    const opts = { encoding, separator, uppercase };
    const v = validateOptions(opts);
    if ("error" in v) { setError(v.error); setResult(null); return; }
    setError(null);
    setResult(textToHex(input, opts));
  }, [input, encoding, separator, uppercase]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Text input</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Encoding</Label>
              <select value={encoding} onChange={(e) => setEncoding(e.target.value as "utf-8" | "utf-16le" | "utf-16be" | "ascii")} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="utf-8">UTF-8</option>
                <option value="ascii">ASCII</option>
                <option value="utf-16le">UTF-16 LE</option>
                <option value="utf-16be">UTF-16 BE</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Separator</Label>
              <input value={separator} onChange={(e) => setSeparator(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} /><span>Uppercase hex</span></label>
          <div className="flex gap-2">
            <Button size="sm" onClick={convert}>Convert</Button>
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
              <CardTitle className="text-sm">Hex output ({result.byteCount} bytes)</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => result.output} />
                <DownloadButton getText={() => result.output} filename="hex.txt" />
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
