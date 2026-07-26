"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  translate, translateBatch, renderBatchCsv, renderReport, brailleToAsciiArt,
  type BrailleGrade,
} from "./logic";

export default function BrailleTranslator() {
  const [text, setText] = useState("Hello World");
  const [grade, setGrade] = useState<BrailleGrade>("grade1");
  const [showAsciiArt, setShowAsciiArt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => translate({ text, grade }), [text, grade]);
  const asciiArt = useMemo(() => (showAsciiArt ? brailleToAsciiArt(result.braille) : ""), [showAsciiArt, result.braille]);

  const exportBatch = () => {
    setError(null);
    try { translateBatch([{ text, grade: "grade1" }, { text, grade: "grade2" }]); } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Text to translate"><textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono min-h-[80px]" /></Field>
            <Field label="Braille grade"><select value={grade} onChange={(e) => setGrade(e.target.value as BrailleGrade)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm cursor-pointer"><option value="grade1">Grade 1 (letter-by-letter)</option><option value="grade2">Grade 2 (with contractions)</option></select></Field>
            <Field label="Options"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={showAsciiArt} onChange={(e) => setShowAsciiArt(e.target.checked)} /> Show ASCII art</label></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => result.braille} label="Copy Braille" />
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="braille-report.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(translateBatch([{ text, grade }]))} filename="braille-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (Grade 1 + Grade 2)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Braille output</Label>
            <Badge variant="outline" className="text-xs">{grade}</Badge>
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-2xl font-mono break-all leading-relaxed">{result.braille || "—"}</div>
          {result.warnings.length > 0 && (
            <div className="space-y-1">{result.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">! {w}</div>)}</div>
          )}
          {result.notes.length > 0 && (
            <div className="space-y-1">{result.notes.map((n, i) => <div key={i} className="text-xs text-blue-700 dark:text-blue-400">• {n}</div>)}</div>
          )}
          <div className="pt-1">
            <Label className="text-xs text-muted-foreground">Reverse translation (sanity check)</Label>
            <div className="rounded-md border bg-muted/40 p-2 text-sm font-mono">{result.reverseTranslation || "—"}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Dot patterns (per character)</Label>
          <div className="flex flex-wrap gap-1">
            {result.dotPatterns.map((p, i) => (
              <div key={i} className="rounded border bg-muted/40 px-2 py-1 text-xs font-mono">
                <span className="text-muted-foreground">{i + 1}.</span> {p || "blank"}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showAsciiArt && asciiArt && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">ASCII art rendering</Label>
            <pre className="rounded-md border bg-muted/40 p-3 text-sm font-mono overflow-x-auto">{asciiArt}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>);
}
