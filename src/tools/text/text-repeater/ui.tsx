"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { repeatText, generateLoremIpsum, generateBarcodePattern, type NumberingMode, type RepeatOptions } from "./logic";

export default function TextRepeater() {
  const [text, setText] = useState("Hello World");
  const [options, setOptions] = useState<RepeatOptions>({
    count: 5,
    separator: "\n",
    numberingMode: "none",
    numberingStart: 1,
    numberingStep: 1,
  });
  const [result, setResult] = useState<ReturnType<typeof repeatText> | null>(null);
  const [loremCount, setLoremCount] = useState("5");
  const [loremResult, setLoremResult] = useState<string | null>(null);
  const [barcodeResult, setBarcodeResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const repeat = useCallback(() => {
    setError(null);
    try {
      const r = repeatText(text, options);
      if ("error" in r) { setError(r.error); setResult(null); }
      else { setResult(r); setLoremResult(null); setBarcodeResult(null); }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [text, options]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Text to repeat</Label>
            <Input value={text} onChange={(e) => setText(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Count</Label>
              <Input type="number" min="1" value={options.count} onChange={(e) => setOptions({ ...options, count: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Separator (use \n for newline)</Label>
              <Input value={(options.separator ?? "").replace(/\n/g, "\\n")} onChange={(e) => setOptions({ ...options, separator: e.target.value.replace(/\\n/g, "\n") })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Prefix</Label>
              <Input value={options.prefix ?? ""} onChange={(e) => setOptions({ ...options, prefix: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Suffix</Label>
              <Input value={options.suffix ?? ""} onChange={(e) => setOptions({ ...options, suffix: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Numbering</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.numberingMode} onChange={(e) => setOptions({ ...options, numberingMode: e.target.value as NumberingMode })}>
                <option value="none">None</option>
                <option value="numeric">Numeric (1, 2, 3)</option>
                <option value="zero-padded">Zero-padded (001, 002)</option>
                <option value="alpha-lower">Lower alpha (a, b, c)</option>
                <option value="alpha-upper">Upper alpha (A, B, C)</option>
                <option value="roman">Roman (I, II, III)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Numbering start</Label>
              <Input type="number" value={options.numberingStart ?? 1} onChange={(e) => setOptions({ ...options, numberingStart: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Numbering step</Label>
              <Input type="number" value={options.numberingStep ?? 1} onChange={(e) => setOptions({ ...options, numberingStep: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Max chars (optional)</Label>
              <Input type="number" value={options.maxChars ?? ""} onChange={(e) => setOptions({ ...options, maxChars: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Pattern (placeholders: {`{n}`} {`{i}`} {`{text}`})</Label>
            <Input value={options.pattern ?? ""} onChange={(e) => setOptions({ ...options, pattern: e.target.value || undefined })} placeholder="e.g. [{n}] {text}!" />
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.reverseEach ?? false} onChange={(e) => setOptions({ ...options, reverseEach: e.target.checked })} /><span>Reverse each iteration</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.mirror ?? false} onChange={(e) => setOptions({ ...options, mirror: e.target.checked })} /><span>Mirror output (append reversed)</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.shuffle ?? false} onChange={(e) => setOptions({ ...options, shuffle: e.target.checked })} /><span>Shuffle each iteration</span></label>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={repeat}>Repeat</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText("Hello World"); setOptions({ count: 5, separator: "\n", numberingMode: "none", numberingStart: 1, numberingStep: 1 }); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="outline" onClick={() => { setLoremResult(generateLoremIpsum(Number(loremCount) || 5)); setResult(null); setBarcodeResult(null); }}>Generate Lorem Ipsum</Button>
            <Button size="sm" variant="outline" onClick={() => { setBarcodeResult(generateBarcodePattern(text || "ABC")); setResult(null); setLoremResult(null); }}>Generate barcode pattern</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Iterations</p><p className="text-sm font-bold">{result.actualCount}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Output length</p><p className="text-sm font-bold">{result.output.length} chars</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Truncated</p><p className="text-sm font-bold">{result.truncated ? "Yes" : "No"}</p></CardContent></Card>
          </div>
          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
            </CardContent></Card>
          )}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Output</CardTitle>
                <div className="flex gap-2">
                  <CopyButton getText={() => result.output} />
                  <DownloadButton getText={() => result.output} filename="repeated.txt" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-sm overflow-auto p-4 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-all max-h-[400px]">{result.output}</pre>
            </CardContent>
          </Card>
        </>
      )}

      {loremResult && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Lorem Ipsum ({loremCount} sentences)</CardTitle>
              <CopyButton getText={() => loremResult} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-sm p-4 bg-muted/40 rounded-b-lg whitespace-pre-wrap break-words">{loremResult}</pre>
          </CardContent>
        </Card>
      )}

      {barcodeResult && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Barcode pattern</CardTitle>
              <CopyButton getText={() => barcodeResult} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-sm p-4 bg-muted/40 rounded-b-lg font-mono overflow-x-auto">{barcodeResult}</pre>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all repetition runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
