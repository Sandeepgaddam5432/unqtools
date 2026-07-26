"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { findCliches, toCsv, type ClicheResult, type ClicheCategory } from "./logic";

const CATS: ClicheCategory[] = ["overused", "mixed-metaphor", "business", "sports", "weather", "body", "animal", "time", "emotion"];

export default function TextClicheFinder() {
  const [text, setText] = useState("At the end of the day, we need to think outside the box. The ball is in your court now.");
  const [result, setResult] = useState<ClicheResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = findCliches({ text });
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
  }, [text]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Text to analyze</Label>
            <textarea
              className="w-full min-h-[120px] rounded-md border bg-background p-2 text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Find clichés</Button>
            <Button size="sm" variant="ghost" onClick={() => setText("At the end of the day, we need to think outside the box. The ball is in your court now.")}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant={result.total > 0 ? "destructive" : "default"}>{result.total} cliché(s)</Badge>
              <Badge variant="outline">{result.uniquePhrases.length} unique</Badge>
              <Badge variant="outline">Density: {result.densityPer100Words}/100 words</Badge>
              <Badge variant={result.freshnessScore > 70 ? "default" : result.freshnessScore > 40 ? "secondary" : "destructive"}>
                Freshness: {result.freshnessScore}/100
              </Badge>
              <CopyButton getText={() => result.cleaned} label="Copy cleaned" />
              <DownloadButton getText={() => toCsv(result)} filename="cliches.csv" mime="text/csv" />
            </div>

            {result.warnings.length > 0 && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5">
                {result.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
              </div>
            )}

            <Card><CardContent className="p-3">
              <Label className="text-xs text-muted-foreground">By category</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {CATS.filter((c) => result.countsByCategory[c] > 0).length === 0
                  ? <span className="text-xs text-muted-foreground">None</span>
                  : CATS.filter((c) => result.countsByCategory[c] > 0).map((c) => (
                    <Badge key={c} variant="secondary">{c}: {result.countsByCategory[c]}</Badge>
                  ))}
              </div>
            </CardContent></Card>

            {result.matches.length > 0 && (
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Matches (with alternatives)</Label>
                <div className="mt-1 space-y-2">
                  {result.matches.map((m, i) => (
                    <div key={i} className="p-2 rounded border border-border/50 bg-muted/30 text-xs">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant={m.severity === "high" ? "destructive" : m.severity === "medium" ? "secondary" : "outline"}>
                          {m.severity}
                        </Badge>
                        <Badge variant="outline">{m.category}</Badge>
                        <span className="text-muted-foreground">line {m.position.line}, col {m.position.column}</span>
                      </div>
                      <p className="font-mono text-sm text-foreground mb-1">"{m.phrase}"</p>
                      <p className="text-muted-foreground text-[11px] mb-1">Context: {m.context}</p>
                      <div className="flex items-start gap-1">
                        <span className="text-muted-foreground">→ Try:</span>
                        <div className="flex flex-wrap gap-1">
                          {m.alternatives.map((alt, j) => (
                            <Badge key={j} variant="secondary" className="font-mono">{alt}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
            )}

            {result.matches.length > 0 && (
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Cleaned text (clichés replaced with first alternative)</Label>
                <p className="mt-1 text-sm">{result.cleaned}</p>
              </CardContent></Card>
            )}
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all detection runs locally. No uploads.</p></CardContent></Card>
    </div>
  );
}
