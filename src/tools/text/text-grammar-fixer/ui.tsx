"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { fixGrammar, summarizeChanges, type GrammarFixResult } from "./logic";

export default function TextGrammarFixer() {
  const [input, setInput] = useState(
    "i think that its color is blue. their is alot of space here .  we could of done better then that.",
  );
  const [result, setResult] = useState<GrammarFixResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fixCapital, setFixCapital] = useState(true);
  const [fixSpacing, setFixSpacing] = useState(true);
  const [fixConfusables, setFixConfusables] = useState(true);
  const [fixAAn, setFixAAn] = useState(true);

  const run = useCallback(() => {
    try {
      const r = fixGrammar(input, {
        fixCapitalization: fixCapital,
        fixSpacingPunctuation: fixSpacing,
        fixCommonConfusables: fixConfusables,
        fixAAn,
      });
      setResult(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fix grammar.");
    }
  }, [input, fixCapital, fixSpacing, fixConfusables, fixAAn]);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const sample = useCallback(() => {
    setInput(
      "i went to a store with an university friend .  we could of bought alot of stuff but it was to much money then we expected.",
    );
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea
              className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[160px] font-mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Input text"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={fixCapital ? "default" : "outline"} onClick={() => setFixCapital((v) => !v)} aria-pressed={fixCapital}>Capitalisation</Button>
            <Button size="sm" variant={fixSpacing ? "default" : "outline"} onClick={() => setFixSpacing((v) => !v)} aria-pressed={fixSpacing}>Spacing & punctuation</Button>
            <Button size="sm" variant={fixConfusables ? "default" : "outline"} onClick={() => setFixConfusables((v) => !v)} aria-pressed={fixConfusables}>Common confusables</Button>
            <Button size="sm" variant={fixAAn ? "default" : "outline"} onClick={() => setFixAAn((v) => !v)} aria-pressed={fixAAn}>a / an</Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Fix grammar</Button>
            <Button size="sm" variant="ghost" onClick={sample}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Fixed text</span>
                <Badge variant="secondary">{result.totalChanges} change{result.totalChanges === 1 ? "" : "s"}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <pre className="whitespace-pre-wrap break-words text-sm font-mono bg-muted/30 rounded-md p-3">{result.output}</pre>
            </CardContent>
          </Card>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          {result.changes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Changes applied</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {result.changes.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline" className="font-mono">{c.rule}</Badge>
                    <code className="text-xs px-1.5 py-0.5 bg-muted rounded line-through text-muted-foreground">{c.before}</code>
                    <span className="text-muted-foreground">→</span>
                    <code className="text-xs px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded">{c.after}</code>
                    <Badge variant="secondary" className="ml-auto">×{c.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export fixed text &amp; change summary</p>
              <div className="flex gap-2">
                <CopyButton getText={() => result.output} label="Copy text" />
                <CopyButton getText={() => summarizeChanges(result)} label="Copy summary" />
                <DownloadButton getText={() => result.output} filename="grammar-fixed.txt" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
