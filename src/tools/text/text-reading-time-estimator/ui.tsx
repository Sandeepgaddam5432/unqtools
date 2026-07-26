"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  estimateReadingTime,
  estimateReadingTimeBatch,
  toCsv,
  toJson,
  sampleText,
  type ReadingTimeResult,
} from "./logic";

type Mode = "single" | "batch";

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

export default function TextReadingTimeEstimator() {
  const [mode, setMode] = useState<Mode>("single");
  const [input, setInput] = useState(sampleText());
  const [batchInput, setBatchInput] = useState(
    [sampleText(), "Short doc. Two sentences only. Done."].join("\n---\n"),
  );
  const [readingWpm, setReadingWpm] = useState("200");
  const [speakingWpm, setSpeakingWpm] = useState("130");
  const [scanningWpm, setScanningWpm] = useState("700");
  const [wordsPerSlide, setWordsPerSlide] = useState("60");
  const [wordsPerPage, setWordsPerPage] = useState("300");
  const [hourlyRate, setHourlyRate] = useState("");

  const [result, setResult] = useState<ReadingTimeResult | null>(null);
  const [batchResults, setBatchResults] = useState<{ results: ReadingTimeResult[]; totals: ReadingTimeResult; warnings: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const buildOptions = useCallback(() => ({
    readingWpm: Number(readingWpm) || undefined,
    speakingWpm: Number(speakingWpm) || undefined,
    scanningWpm: Number(scanningWpm) || undefined,
    wordsPerSlide: Number(wordsPerSlide) || undefined,
    wordsPerPage: Number(wordsPerPage) || undefined,
    hourlyRate: hourlyRate.trim() ? Number(hourlyRate) : undefined,
  }), [readingWpm, speakingWpm, scanningWpm, wordsPerSlide, wordsPerPage, hourlyRate]);

  const run = useCallback(() => {
    setError(null);
    setWarnings([]);
    if (mode === "single") {
      const r = estimateReadingTime(input, buildOptions());
      if ("error" in r) {
        setError(r.error);
        setResult(null);
        return;
      }
      setResult(r);
      setBatchResults(null);
      setWarnings(r.warnings);
    } else {
      const docs = batchInput.split(/\n---\n/).map((d) => d.trim()).filter(Boolean);
      if (docs.length === 0) {
        setError("No documents found. Separate documents with a line containing only ---.");
        return;
      }
      const r = estimateReadingTimeBatch(docs, buildOptions());
      setBatchResults(r);
      setResult(null);
      setWarnings(r.warnings);
    }
  }, [mode, input, batchInput, buildOptions]);

  const loadSample = () => {
    setInput(sampleText());
    setBatchInput([sampleText(), "Short doc. Two sentences only. Done."].join("\n---\n"));
    setError(null);
    setWarnings([]);
  };

  const clearAll = () => {
    setInput("");
    setResult(null);
    setBatchResults(null);
    setError(null);
    setWarnings([]);
  };

  const activeResult = result ?? batchResults?.totals ?? null;
  const reportText = useMemo(() => activeResult ? toCsv(activeResult) : "", [activeResult]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Mode</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {(["single", "batch"] as Mode[]).map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={mode === m ? "default" : "outline"}
                  onClick={() => { setMode(m); setResult(null); setBatchResults(null); setError(null); setWarnings([]); }}
                >
                  {m === "single" ? "Single document" : "Batch (split by ---)"}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">
              {mode === "single" ? "Input text" : "Batch input (separate documents with a line containing only ---)"}
            </Label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[160px] font-mono"
              value={mode === "single" ? input : batchInput}
              onChange={(e) => mode === "single" ? setInput(e.target.value) : setBatchInput(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Reading WPM</Label>
              <Input type="number" min="50" max="1000" value={readingWpm} onChange={(e) => setReadingWpm(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Speaking WPM</Label>
              <Input type="number" min="50" max="500" value={speakingWpm} onChange={(e) => setSpeakingWpm(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Scanning WPM</Label>
              <Input type="number" min="100" max="2000" value={scanningWpm} onChange={(e) => setScanningWpm(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Words / slide</Label>
              <Input type="number" min="10" value={wordsPerSlide} onChange={(e) => setWordsPerSlide(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Words / page</Label>
              <Input type="number" min="50" value={wordsPerPage} onChange={(e) => setWordsPerPage(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Hourly rate (optional)</Label>
              <Input type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="e.g. 60" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={run}>Estimate</Button>
            <Button size="sm" variant="ghost" onClick={loadSample}>Load sample</Button>
            <Button size="sm" variant="ghost" onClick={clearAll}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {warnings.length > 0 && !error && (
        <div className="rounded-lg border border-yellow-300/40 bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-800 dark:text-yellow-300 space-y-0.5">
          {warnings.map((w, i) => (<p key={i}>⚠️ {w}</p>))}
        </div>
      )}

      {activeResult && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                {mode === "batch" ? "Aggregate totals" : "Reading time estimate"}
              </CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => reportText} label="Copy CSV" />
                <DownloadButton getText={() => reportText} filename="reading-time.csv" mime="text/csv" />
                <DownloadButton getText={() => activeResult ? toJson(activeResult) : ""} filename="reading-time.json" mime="application/json" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 pt-0 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                <StatTile label="Reading time" value={activeResult.readingTimeFormatted} hint={`${activeResult.readingTimeSeconds.toFixed(0)}s`} />
                <StatTile label="Speaking time" value={activeResult.speakingTimeFormatted} hint={`${activeResult.speakingTimeSeconds.toFixed(0)}s`} />
                <StatTile label="Scanning time" value={activeResult.scanningTimeFormatted} hint={`${activeResult.scanningTimeSeconds.toFixed(0)}s`} />
                <StatTile label="Words" value={String(activeResult.words)} />
                <StatTile label="Characters" value={String(activeResult.characters)} hint={`${activeResult.charactersNoSpaces} without spaces`} />
                <StatTile label="Sentences" value={String(activeResult.sentences)} />
                <StatTile label="Paragraphs" value={String(activeResult.paragraphs)} />
                <StatTile label="Slides" value={String(activeResult.slides)} hint={`${wordsPerSlide} words each`} />
                <StatTile label="Pages" value={String(activeResult.pages)} hint={`${wordsPerPage} words each`} />
                <StatTile label="Reading ease" value={activeResult.readingEase.toFixed(0)} hint={activeResult.readingEaseLabel} />
                <StatTile label="Grade level" value={activeResult.gradeLevel.toFixed(1)} hint="Flesch-Kincaid" />
                {activeResult.costToRead !== undefined && (
                  <StatTile label="Cost to read" value={`$${activeResult.costToRead.toFixed(2)}`} hint={`@ $${hourlyRate}/hr`} />
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Avg words/sentence: {activeResult.sentences > 0 ? (activeResult.words / activeResult.sentences).toFixed(1) : "0"}</Badge>
                <Badge variant="outline">Avg words/paragraph: {activeResult.paragraphs > 0 ? (activeResult.words / activeResult.paragraphs).toFixed(1) : "0"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {batchResults && !error && mode === "batch" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Per-document results ({batchResults.results.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 pt-0 space-y-2">
              {batchResults.results.map((r, i) => (
                <div key={i} className="rounded-md border border-border/50 bg-muted/20 p-3 text-sm">
                  <div className="flex flex-wrap gap-2 items-center mb-1">
                    <Badge variant="outline">Document {i + 1}</Badge>
                    <Badge variant="outline">{r.words} words</Badge>
                    <Badge variant="outline">Read: {r.readingTimeFormatted}</Badge>
                    <Badge variant="outline">Speak: {r.speakingTimeFormatted}</Badge>
                    <Badge variant="outline">{r.slides} slides</Badge>
                    <Badge variant="outline">{r.pages} pages</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Reading ease: {r.readingEase.toFixed(0)} — {r.readingEaseLabel}. Grade level: {r.gradeLevel.toFixed(1)}.</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all estimation runs locally in your browser. No data is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
