"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { analyze, suggestTags, type HashtagAnalysis } from "./logic";

export default function HashtagDensityChecker() {
  const [text, setText] = useState("Check out our #summer sale! #discount #like4like #summer");
  const [limit, setLimit] = useState(10);

  const result = useMemo<HashtagAnalysis>(() => analyze(text, limit), [text, limit]);
  const suggestions = useMemo(() => suggestTags(text), [text]);

  const report = useMemo(() => {
    const lines = [
      `Total hashtags: ${result.totalHashtags}`,
      `Unique: ${result.uniqueHashtags}`,
      `Density: ${result.densityPct}%`,
      `Over limit: ${result.overLimit}`,
      `Banned: ${result.bannedTags.join(", ") || "none"}`,
      "",
      ...result.warnings.map((w) => `! ${w}`),
    ];
    return lines.join("\n");
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="hd-input" className="text-xs text-muted-foreground">Paste your caption with hashtags</Label>
          <textarea
            id="hd-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
          <div className="flex items-center gap-2 text-xs">
            <Label htmlFor="hd-limit">Recommended max hashtags</Label>
            <input id="hd-limit" type="number" min={1} max={30} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="h-7 w-16 rounded border bg-background px-2 text-xs" />
          </div>
          {result.warnings.length > 0 && <ErrorBanner message={result.warnings.join("; ")} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Analysis</p>
            <div className="flex gap-2">
              <CopyButton getText={() => report} label="Copy report" />
              <DownloadButton getText={() => report} filename="hashtag-report.txt" label="Download" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Cell label="Total" value={String(result.totalHashtags)} />
            <Cell label="Unique" value={String(result.uniqueHashtags)} />
            <Cell label="Density" value={`${result.densityPct}%`} />
            <Cell label="Over limit" value={result.overLimit ? "Yes" : "No"} />
          </div>
          {result.bannedTags.length > 0 && (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Banned / flagged tags</p>
              <div className="flex flex-wrap gap-1">
                {result.bannedTags.map((t) => <Badge key={t} variant="destructive" className="text-[10px] font-mono">{t}</Badge>)}
              </div>
            </div>
          )}
          {result.duplicateHashtags.length > 0 && (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Duplicates</p>
              <div className="flex flex-wrap gap-1">
                {result.duplicateHashtags.map((d) => <Badge key={d.tag} variant="outline" className="text-[10px] font-mono">{d.tag} ×{d.count}</Badge>)}
              </div>
            </div>
          )}
          {suggestions.length > 0 && (
            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Suggested tags</p>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((t) => <Badge key={t} variant="outline" className="text-[10px] font-mono text-emerald-600">{t}</Badge>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all parsing runs locally.</p></CardContent></Card>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
