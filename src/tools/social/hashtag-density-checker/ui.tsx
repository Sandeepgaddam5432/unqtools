"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  analyze, suggestTags, analyzeBatch, batchToCsv, formatSummary,
  remainingBudget, PLATFORM_LIMITS, ALL_PLATFORMS, type Platform,
} from "./logic";

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}

export default function HashtagDensityChecker() {
  const [text, setText] = useState("Check out our #summer sale! #discount #like4like #summer");
  const [limit, setLimit] = useState(10);
  const [batchText, setBatchText] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");

  const result = useMemo(() => analyze(text, limit), [text, limit]);
  const suggestions = useMemo(() => suggestTags(text), [text]);
  const budget = useMemo(() => remainingBudget(text, platform), [text, platform]);
  const summary = useMemo(() => formatSummary(result), [result]);

  const batchLines = useMemo(() => batchText.split(/\r?\n/).filter((l) => l.length > 0), [batchText]);
  const batchResults = useMemo(() => analyzeBatch(batchLines, limit), [batchLines, limit]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="hd-input" className="text-xs text-muted-foreground">Paste your caption with hashtags</Label>
          <textarea id="hd-input" value={text} onChange={(e) => setText(e.target.value)} className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono" />
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
              <CopyButton getText={() => summary} label="Copy report" />
              <DownloadButton getText={() => summary} filename="hashtag-report.txt" label="Download" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Cell label="Total" value={String(result.totalHashtags)} />
            <Cell label="Unique" value={String(result.uniqueHashtags)} />
            <Cell label="Density" value={`${result.densityPct}%`} />
            <Cell label="Over limit" value={result.overLimit ? "Yes" : "No"} />
            <Cell label="Inline" value={String(result.inlineCount)} />
            <Cell label="Trailing block" value={String(result.trailingBlockCount)} />
            <Cell label="Duplicates" value={String(result.duplicateHashtags.length)} />
            <Cell label="Chars/tag" value={String(result.charsPerTag)} />
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
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Suggested tags (from caption words)</p>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((t) => <Badge key={t} variant="outline" className="text-[10px] font-mono text-emerald-600">{t}</Badge>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Badge variant="secondary">Platform compatibility</Badge>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {result.platformStatus.map((p) => (
              <div key={p.platform} className="flex items-center gap-2 rounded border border-border/50 px-2 py-1.5">
                <Badge variant={p.accepted ? "outline" : "destructive"}>{p.accepted ? "OK" : "REJECT"}</Badge>
                <span className="font-medium">{p.label}</span>
                <span className="text-muted-foreground ml-auto">{p.reason}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Badge variant="secondary">Budget calculator</Badge>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="h-9 rounded-md border bg-background px-3 text-sm">
              {ALL_PLATFORMS.map((p) => {
                const info = PLATFORM_LIMITS.find((pl) => pl.platform === p)!;
                return <option key={p} value={p}>{info.label} (max {info.maxHashtags})</option>;
              })}
            </select>
            <Badge variant="outline">{budget} more tag{budget === 1 ? "" : "s"} can fit</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Batch mode (one caption per line)</Label>
          <textarea className="rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] font-mono" placeholder={"hello #foo #bar\nanother #baz"} value={batchText} onChange={(e) => setBatchText(e.target.value)} />
          {batchResults.length > 0 && (
            <div className="flex items-center justify-between">
              <Badge variant="outline">{batchResults.length} rows · {batchResults.reduce((a, r) => a + r.totalHashtags, 0)} total tags</Badge>
              <DownloadButton getText={() => batchToCsv(batchResults, batchLines)} filename="hashtag-batch.csv" mime="text/csv" />
            </div>
          )}
          {batchResults.length > 0 && (
            <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono max-h-[200px] overflow-y-auto">
              {batchResults.map((r, i) => `${i + 1}\t${r.totalHashtags} tags\t${r.uniqueHashtags} unique\t${r.densityPct}%\t${r.bannedTags.length} banned`).join("\n")}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Badge variant="secondary">Platform limits reference</Badge>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {PLATFORM_LIMITS.map((p) => (
              <div key={p.platform} className="rounded-md border border-border/50 p-2">
                <p className="font-medium">{p.label}</p>
                <p className="text-muted-foreground font-mono">max {p.maxHashtags} tags · {p.maxChars} chars · recommended {p.recommended}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all parsing runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
