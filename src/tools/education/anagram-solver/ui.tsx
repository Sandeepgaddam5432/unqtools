"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  findAnagrams, findAnagramsBatch, renderBatchCsv, renderReport, type AnagramJob,
} from "./logic";

export default function AnagramSolver() {
  const [letters, setLetters] = useState("stone");
  const [wildcard, setWildcard] = useState("?");
  const [minLength, setMinLength] = useState(2);
  const [maxLength, setMaxLength] = useState(0);
  const [multiWord, setMultiWord] = useState(false);
  const [maxResults, setMaxResults] = useState(50);
  const [error, setError] = useState<string | null>(null);

  const job: AnagramJob = useMemo(() => ({
    letters, wildcard, minLength, maxLength, multiWord, maxResults,
  }), [letters, wildcard, minLength, maxLength, multiWord, maxResults]);

  const result = useMemo(() => findAnagrams(job), [job]);

  const exportBatch = () => {
    setError(null);
    try { findAnagramsBatch([job, { ...job, letters: letters + wildcard }, { ...job, multiWord: true }]); } catch (e) { setError(String(e)); }
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Letters"><input value={letters} onChange={(e) => setLetters(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono uppercase" placeholder="e.g. STONE" /></Field>
            <Field label="Wildcard char"><input value={wildcard} onChange={(e) => setWildcard(e.target.value)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm font-mono" /></Field>
            <Field label={`Min length: ${minLength}`}><input type="range" min={2} max={10} value={minLength} onChange={(e) => setMinLength(parseInt(e.target.value, 10))} className="w-full cursor-pointer" /></Field>
            <Field label={`Max length (0 = none): ${maxLength}`}><input type="range" min={0} max={15} value={maxLength} onChange={(e) => setMaxLength(parseInt(e.target.value, 10))} className="w-full cursor-pointer" /></Field>
            <Field label={`Max results: ${maxResults}`}><input type="range" min={10} max={200} step={10} value={maxResults} onChange={(e) => setMaxResults(parseInt(e.target.value, 10))} className="w-full cursor-pointer" /></Field>
            <Field label="Options"><label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={multiWord} onChange={(e) => setMultiWord(e.target.checked)} /> Multi-word anagrams</label></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => renderReport(result)} label="Copy report" />
            <DownloadButton getText={() => renderReport(result)} filename="anagram-report.txt" label="Download report" />
            <DownloadButton getText={() => renderBatchCsv(findAnagramsBatch([job]))} filename="anagram-batch.csv" mime="text/csv" label="Download CSV" />
            <button onClick={exportBatch} className="text-xs text-primary hover:underline cursor-pointer">Plan batch (3 inputs)</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Results ({result.results.length})</Label>
            <Badge variant="outline" className="text-xs">Input: {letters.toUpperCase()}</Badge>
          </div>
          {result.warnings.length > 0 && (
            <div className="space-y-1">{result.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 dark:text-amber-400">! {w}</div>)}</div>
          )}
          {result.notes.length > 0 && (
            <div className="space-y-1">{result.notes.map((n, i) => <div key={i} className="text-xs text-blue-700 dark:text-blue-400">• {n}</div>)}</div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
            {result.results.map((r, i) => (
              <div key={i} className="flex items-center justify-between rounded border bg-muted/40 px-2 py-1 text-xs">
                <span className="font-mono uppercase">{r.word}</span>
                <Badge variant="outline" className="text-[10px]">{r.score}{r.isComplete ? "★" : ""}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {result.multiWordResults.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Multi-word anagrams ({result.multiWordResults.length})</Label>
            <div className="space-y-1">
              {result.multiWordResults.slice(0, 30).map((m, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                  <span className="font-mono uppercase">{m.words.join(" + ")}</span>
                  <Badge variant="outline" className="text-[10px]">{m.score}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>);
}
