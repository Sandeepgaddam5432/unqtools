"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  analyzeText, rewriteSentence, matchesToCsv,
} from "./logic";

const SAMPLE = `The cake was eaten by John. The report was completed yesterday. Mistakes were made.
The team will be informed about the changes. A new policy was implemented last quarter.`;

export default function TextActiveVoiceSuggesterUI() {
  const [text, setText] = useState(SAMPLE);
  const [error, setError] = useState("");

  const analysis = useMemo(() => analyzeText(text), [text]);

  const rewrittenAll = useMemo(() => {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => rewriteSentence(s))
      .join(" ");
  }, [text]);

  const csv = useMemo(() => matchesToCsv(analysis.matches), [analysis.matches]);

  const summary = useMemo(() => {
    return [
      `Total sentences: ${analysis.totalSentences}`,
      `Passive constructions: ${analysis.passiveCount}`,
      `Passive percentage: ${analysis.passivePercentage}%`,
      ...(analysis.warnings.length ? ["", "Warnings:", ...analysis.warnings.map((w) => `- ${w}`)] : []),
      "",
      "Rewritten text:",
      rewrittenAll,
    ].join("\n");
  }, [analysis, rewrittenAll]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Paste your text</Label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[180px]"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => rewrittenAll} label="Copy rewritten" />
            <CopyButton getText={() => csv} label="Copy CSV" disabled={analysis.matches.length === 0} />
            <DownloadButton getText={() => csv} filename="passive-voice.csv" mime="text/csv" disabled={analysis.matches.length === 0} />
            <DownloadButton getText={() => summary} filename="active-voice-report.txt" />
            <button type="button" onClick={() => setText("")} className="text-xs px-3 py-1.5 rounded-md border border-border">Clear</button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Sentences" value={String(analysis.totalSentences)} />
        <Stat label="Passive" value={String(analysis.passiveCount)} />
        <Stat label="Passive %" value={`${analysis.passivePercentage}%`} />
      </div>

      {analysis.warnings.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-sm font-medium text-amber-600">Warnings</p>
            {analysis.warnings.map((w, i) => (
              <p key={i} className="text-xs text-muted-foreground">• {w}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">Detected passive constructions ({analysis.matches.length})</p>
          {analysis.matches.length === 0 ? (
            <p className="text-xs text-muted-foreground">No passive constructions found. Great job!</p>
          ) : (
            <div className="space-y-3">
              {analysis.matches.map((m, i) => (
                <div key={i} className="rounded-md border border-border p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">{m.sentence}</p>
                  <p className="text-xs">
                    <span className="text-muted-foreground">Passive: </span>
                    <code className="font-mono bg-muted/30 px-1 rounded">{m.passivePhrase}</code>
                    {m.byAgent && <span className="text-muted-foreground"> · by <strong>{m.byAgent}</strong></span>}
                  </p>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Suggestions</p>
                    {m.suggestions.map((s, j) => (
                      <p key={j} className="text-xs">{j + 1}. {s}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {analysis.matches.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Fully rewritten text</p>
              <CopyButton getText={() => rewrittenAll} label="Copy" />
            </div>
            <p className="text-xs whitespace-pre-wrap bg-muted/30 p-2 rounded-md">{rewrittenAll}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all analysis runs locally. Passive detection looks for be-verb + past participle patterns. Suggestions are heuristic — verify before publishing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
