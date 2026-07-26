"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  generateAbstract,
  generateAbstractBatch,
  toCsv,
  toJson,
  sampleText,
  type AbstractResult,
} from "./logic";

type Mode = "single" | "batch";

export default function TextAbstractGenerator() {
  const [mode, setMode] = useState<Mode>("single");
  const [input, setInput] = useState(sampleText());
  const [batchInput, setBatchInput] = useState(
    [sampleText(), "This is a second document. It has only two sentences. The end."].join("\n---\n"),
  );
  const [title, setTitle] = useState("Privacy preserving summarization");
  const [keywords, setKeywords] = useState("privacy, summarization, local, browser");
  const [useRatio, setUseRatio] = useState(true);
  const [ratio, setRatio] = useState("0.3");
  const [sentenceCount, setSentenceCount] = useState("5");
  const [minLen, setMinLen] = useState("4");
  const [maxLen, setMaxLen] = useState("60");
  const [extraStop, setExtraStop] = useState("");
  const [cueBoost, setCueBoost] = useState(true);
  const [imradAware, setImradAware] = useState(true);
  const [result, setResult] = useState<AbstractResult | null>(null);
  const [batchResults, setBatchResults] = useState<AbstractResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const buildOptions = useCallback(() => {
    return {
      title: title.trim() || undefined,
      keywords: keywords.split(/[,\n]+/).map((k) => k.trim()).filter(Boolean),
      ratio: useRatio ? Number(ratio) || undefined : undefined,
      sentenceCount: useRatio ? undefined : Number(sentenceCount) || 5,
      minSentenceLength: Number(minLen) || undefined,
      maxSentenceLength: Number(maxLen) || undefined,
      extraStopWords: extraStop.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean),
      cueBoost,
      imradAware,
    };
  }, [title, keywords, useRatio, ratio, sentenceCount, minLen, maxLen, extraStop, cueBoost, imradAware]);

  const run = useCallback(() => {
    setError(null);
    setWarnings([]);
    if (mode === "single") {
      const r = generateAbstract(input, buildOptions());
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
      const r = generateAbstractBatch(docs, buildOptions());
      setBatchResults(r.results);
      setResult(null);
      setWarnings(r.warnings);
    }
  }, [mode, input, batchInput, buildOptions]);

  const loadSample = () => {
    setInput(sampleText());
    setTitle("Privacy preserving summarization");
    setKeywords("privacy, summarization, local, browser");
    setError(null);
    setWarnings([]);
  };

  const clearAll = () => {
    setInput("");
    setBatchResults(null);
    setResult(null);
    setError(null);
    setWarnings([]);
  };

  const activeResult = result ?? batchResults?.[0] ?? null;
  const abstractText = activeResult?.abstract ?? "";
  const allAbstractsText = useMemo(
    () => batchResults?.map((r, i) => `=== Document ${i + 1} ===\n${r.abstract}`).join("\n\n") ?? "",
    [batchResults],
  );

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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Title (optional — boosts echo sentences)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Focus keywords (comma-separated)</Label>
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Extra stop words (comma-separated)</Label>
              <Input value={extraStop} onChange={(e) => setExtraStop(e.target.value)} placeholder="e.g. very, also" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Compression ratio (0.1 - 1.0)</Label>
              <Input
                type="number"
                step="0.05"
                min="0.05"
                max="1"
                value={ratio}
                onChange={(e) => setRatio(e.target.value)}
                disabled={!useRatio}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sentence count</Label>
              <Input
                type="number"
                min="1"
                value={sentenceCount}
                onChange={(e) => setSentenceCount(e.target.value)}
                disabled={useRatio}
              />
            </div>
            <div className="flex gap-2 items-end">
              <Button size="sm" variant={useRatio ? "default" : "outline"} onClick={() => setUseRatio(true)}>Use ratio</Button>
              <Button size="sm" variant={!useRatio ? "default" : "outline"} onClick={() => setUseRatio(false)}>Use count</Button>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Min sentence length (words)</Label>
              <Input type="number" min="1" value={minLen} onChange={(e) => setMinLen(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max sentence length (words)</Label>
              <Input type="number" min="1" value={maxLen} onChange={(e) => setMaxLen(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2 justify-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cueBoost} onChange={(e) => setCueBoost(e.target.checked)} />
                <span>Cue-word boost</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={imradAware} onChange={(e) => setImradAware(e.target.checked)} />
                <span>IMRaD section weighting</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={run}>Generate abstract</Button>
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

      {activeResult && !error && mode === "single" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Abstract</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => abstractText} />
                <DownloadButton getText={() => abstractText} filename="abstract.txt" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-3 p-4 pt-0">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{abstractText}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{activeResult.selected.length} / {activeResult.totalSentences} sentences</Badge>
                <Badge variant="outline">{activeResult.totalWords} words (source)</Badge>
                <Badge variant="outline">Ratio: {(activeResult.achievedRatio * 100).toFixed(0)}%</Badge>
                <Badge variant="outline">Avg sent len: {activeResult.avgSentenceLength.toFixed(1)}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeResult && !error && mode === "single" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Ranked sentences ({activeResult.ranked.length})</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => toCsv(activeResult)} label="Copy CSV" />
                <DownloadButton getText={() => toCsv(activeResult)} filename="ranked-sentences.csv" mime="text/csv" />
                <DownloadButton getText={() => toJson(activeResult)} filename="ranked-sentences.json" mime="application/json" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 pt-0 space-y-1.5">
              {activeResult.ranked.map((s, i) => (
                <div
                  key={s.index}
                  className={`rounded-md border p-2 text-xs ${s.selected ? "border-primary/40 bg-primary/5" : "border-border/40 bg-muted/20"}`}
                >
                  <div className="flex flex-wrap gap-1.5 items-center mb-1">
                    <Badge variant="outline">#{i + 1}</Badge>
                    <Badge variant="outline">sent {s.index + 1}</Badge>
                    <Badge variant="outline">{s.section}</Badge>
                    <Badge variant="outline">{s.wordCount}w</Badge>
                    <Badge variant="outline">score {s.score.toFixed(2)}</Badge>
                    {s.selected && <Badge variant="default">selected</Badge>}
                  </div>
                  <p className="text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {batchResults && !error && mode === "batch" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Batch results ({batchResults.length})</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => allAbstractsText} />
                <DownloadButton getText={() => allAbstractsText} filename="abstracts.txt" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4 pt-0 space-y-3">
              {batchResults.map((r, i) => (
                <div key={i} className="rounded-md border border-border/50 bg-muted/20 p-3">
                  <div className="flex flex-wrap gap-2 items-center mb-2">
                    <Badge variant="outline">Document {i + 1}</Badge>
                    <Badge variant="outline">{r.selected.length} / {r.totalSentences} sentences</Badge>
                    <Badge variant="outline">{r.totalWords} words</Badge>
                    <Badge variant="outline">Ratio: {(r.achievedRatio * 100).toFixed(0)}%</Badge>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.abstract}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all summarization runs locally in your browser. No data is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
