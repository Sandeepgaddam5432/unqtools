"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner } from "../../_shared";
import { process, detectIndent, type IndentOptions, type IndentStyle, type NormalizeMode } from "./logic";

export default function TextIndentationFixer() {
  const [input, setInput] = useState("function foo() {\n\tif (x) {\n\t\treturn 1;\n\t}\n}");
  const [toStyle, setToStyle] = useState<IndentStyle>("spaces");
  const [tabWidth, setTabWidth] = useState(4);
  const [normalizeDepth, setNormalizeDepth] = useState<NormalizeMode>("none");
  const [result, setResult] = useState<ReturnType<typeof process> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detected = detectIndent(input);

  const run = useCallback(() => {
    setError(null);
    const opts: IndentOptions = { toStyle, tabWidth, normalizeDepth };
    const r = process(input, opts);
    if ("error" in r) { setError(r.error); setResult(null); }
    else setResult(r);
  }, [input, toStyle, tabWidth, normalizeDepth]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline">Detected: {detected.style}</Badge>
            <Badge variant="outline">tab width: {detected.tabWidth}</Badge>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[140px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Convert to</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={toStyle} onChange={(e) => setToStyle(e.target.value as IndentStyle)}>
                <option value="spaces">Spaces</option>
                <option value="tabs">Tabs</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Tab width</Label>
              <Input type="number" min={1} value={tabWidth} onChange={(e) => setTabWidth(parseInt(e.target.value) || 1)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Normalize depth</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={normalizeDepth} onChange={(e) => setNormalizeDepth(e.target.value as NormalizeMode)}>
                <option value="none">None</option>
                <option value="depth">Round to nearest</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Fix Indentation</Button>
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
              <Badge variant="outline">tabs: {result.tabsConverted}</Badge>
              <Badge variant="outline">spaces: {result.spacesConverted}</Badge>
              {result.mixedIndentLines > 0 && <Badge variant="destructive">{result.mixedIndentLines} mixed</Badge>}
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
