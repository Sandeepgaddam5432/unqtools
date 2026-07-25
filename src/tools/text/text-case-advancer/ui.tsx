"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { convertCase, availableModes, type CaseMode } from "./logic";

export default function TextCaseAdvancer() {
  const [input, setInput] = useState("Hello World Foo Bar");
  const [mode, setMode] = useState<CaseMode>("camelCase");
  const [preserveLines, setPreserveLines] = useState(true);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const convert = useCallback(() => {
    try {
      setError(null);
      setOutput(convertCase(input, { mode, preserveLines }));
    } catch (e) {
      setError((e as Error).message);
      setOutput(null);
    }
  }, [input, mode, preserveLines]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {availableModes().map((m) => (
              <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>
                {m}
              </Button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={preserveLines} onChange={(e) => setPreserveLines(e.target.checked)} />
            <span>Preserve line breaks</span>
          </label>

          <div className="flex gap-2">
            <Button size="sm" onClick={convert}>Convert</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput("Hello World Foo Bar"); setOutput(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setOutput(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {output !== null && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Output ({mode})</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => output} />
                <DownloadButton getText={() => output} filename={`text-${mode}.txt`} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-sm overflow-x-auto p-4 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-all">{output}</pre>
            <p className="text-xs text-muted-foreground p-2">Output: {output.length} chars</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> conversion runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
