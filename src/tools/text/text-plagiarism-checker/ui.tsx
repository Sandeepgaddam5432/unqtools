"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { checkPlagiarism, highlightHtml, resultToJson, type PlagiarismResult } from "./logic";

export default function TextPlagiarismChecker() {
  const [source, setSource] = useState(
    "The quick brown fox jumps over the lazy dog. The dog barks loudly.",
  );
  const [suspect, setSuspect] = useState(
    "I saw that the quick brown fox jumps over the lazy dog. The dog barks loudly at the mailman.",
  );
  const [ngram, setNgram] = useState("3");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [removeStop, setRemoveStop] = useState(true);
  const [result, setResult] = useState<PlagiarismResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    try {
      const r = checkPlagiarism(source, suspect, {
        ngramSize: Number(ngram) || 3,
        caseSensitive,
        removeStopWords: removeStop,
      });
      setResult(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to compare texts.");
    }
  }, [source, suspect, ngram, caseSensitive, removeStop]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const sample = useCallback(() => {
    setSource(
      "Machine learning is a subfield of artificial intelligence that focuses on building systems that learn from data.",
    );
    setSuspect(
      "Machine learning is a subfield of artificial intelligence that focuses on building systems that learn from data. These systems improve over time.",
    );
  }, []);

  const sourceHtml = useMemo(() => {
    if (!result) return "";
    return highlightHtml(source, result.matches.map((m) => ({ start: m.sourceStart, end: m.sourceEnd })));
  }, [result, source]);

  const suspectHtml = useMemo(() => {
    if (!result) return "";
    return highlightHtml(suspect, result.matches.map((m) => ({ start: m.suspectStart, end: m.suspectEnd })));
  }, [result, suspect]);

  const verdictColor = result
    ? result.similarity > 0.5
      ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30"
      : result.similarity > 0.2
        ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30"
        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
    : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Source (original) text</Label>
              <textarea
                className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[140px] font-mono"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                aria-label="Source text"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Suspect text</Label>
              <textarea
                className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[140px] font-mono"
                value={suspect}
                onChange={(e) => setSuspect(e.target.value)}
                aria-label="Suspect text"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">N-gram size</Label>
              <Input type="number" min={1} max={10} value={ngram} onChange={(e) => setNgram(e.target.value)} aria-label="N-gram size" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Case sensitivity</Label>
              <Button size="sm" variant={caseSensitive ? "default" : "outline"} onClick={() => setCaseSensitive((v) => !v)} aria-pressed={caseSensitive}>
                {caseSensitive ? "Case-sensitive" : "Case-insensitive"}
              </Button>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Stop words</Label>
              <Button size="sm" variant={removeStop ? "default" : "outline"} onClick={() => setRemoveStop((v) => !v)} aria-pressed={removeStop}>
                {removeStop ? "Removing stop words" : "Keeping stop words"}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Check similarity</Button>
            <Button size="sm" variant="ghost" onClick={sample}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Similarity</p>
              <p className="text-2xl font-bold">{result.similarityPercent.toFixed(1)}%</p>
              <Badge className={`mt-1 ${verdictColor}`} variant="outline">
                {result.similarity > 0.5 ? "High" : result.similarity > 0.2 ? "Moderate" : "Low"}
              </Badge>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Jaccard index</p>
              <p className="text-lg font-bold">{result.jaccardIndex.toFixed(3)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Overlap coefficient</p>
              <p className="text-lg font-bold">{result.overlapCoefficient.toFixed(3)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Shared n-grams</p>
              <p className="text-lg font-bold">{result.sharedNgrams} / {result.totalNgrams}</p>
            </CardContent></Card>
          </div>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Source highlights</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0">
                <p
                  className="text-sm whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{ __html: sourceHtml }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Suspect highlights</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0">
                <p
                  className="text-sm whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{ __html: suspectHtml }}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export similarity report (JSON)</p>
              <div className="flex gap-2">
                <CopyButton getText={() => resultToJson(result)} label="Copy JSON" />
                <DownloadButton getText={() => resultToJson(result)} filename="plagiarism-report.json" mime="application/json" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
