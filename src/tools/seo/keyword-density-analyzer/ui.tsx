"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  analyzeKeywordDensity,
  buildCsv,
  findOccurrences,
  getStopWords,
  type Language,
  type NgramEntry,
} from "./logic";

const DEFAULT_TEXT = `Best Running Shoes 2026 — Reviews & Buying Guide

We tested 47 running shoes for 200+ miles each in 2026. These are the best running shoes for road runners, trail runners, and racers. Our team evaluated each running shoe on cushioning, weight, durability, and price.

The best running shoes balance comfort and performance. For road runners, we recommend the Example Pro. For trail runners, the Example Trail is the best running shoe with grippy outsoles. Racing flats like the Example Race are the best running shoes for race day.

When shopping for running shoes, consider your gait, weekly mileage, and terrain. The best running shoes match your foot shape and running style. Replace your running shoes every 300 to 500 miles.`;

function flagColor(flag: NgramEntry["flag"]): string {
  if (flag === "stuffing") return "#ef4444";
  if (flag === "high") return "#eab308";
  return "#22c55e";
}

function NgramTable({ title, entries, onHover }: { title: string; entries: NgramEntry[]; onHover: (term: string | null) => void }) {
  const [sortBy, setSortBy] = useState<"count" | "density" | "weighted">("count");
  const sorted = [...entries].sort((a, b) => {
    if (sortBy === "count") return b.count - a.count;
    if (sortBy === "density") return b.density - a.density;
    return b.weightedScore - a.weightedScore;
  });
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{title}</CardTitle>
          <select
            className="h-7 text-xs rounded border border-input bg-background px-2"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="count">Sort by count</option>
            <option value="density">Sort by density</option>
            <option value="weighted">Sort by weighted</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left border-b">
              <th className="py-1 px-3">Term</th>
              <th className="py-1 px-2">Count</th>
              <th className="py-1 px-2">Density</th>
              <th className="py-1 px-2">Flag</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={4} className="py-2 px-3 text-muted-foreground">No entries.</td></tr>
            )}
            {sorted.map((e, i) => (
              <tr
                key={i}
                className="border-b hover:bg-muted/50 cursor-pointer"
                onMouseEnter={() => onHover(e.term)}
                onMouseLeave={() => onHover(null)}
              >
                <td className="py-1 px-3 font-mono">{e.term}</td>
                <td className="py-1 px-2">{e.count}</td>
                <td className="py-1 px-2">{e.density.toFixed(2)}%</td>
                <td className="py-1 px-2">
                  <span style={{ color: flagColor(e.flag) }}>●</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

export default function KeywordDensityAnalyzer() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [language, setLanguage] = useState<Language>("en");
  const [useStemming, setUseStemming] = useState(false);
  const [removeStop, setRemoveStop] = useState(true);
  const [customStop, setCustomStop] = useState("");
  const [threshold, setThreshold] = useState(4);
  const [hoverTerm, setHoverTerm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const r = analyzeKeywordDensity(text, {
      language,
      useStemming,
      removeStopWords: removeStop,
      customStopWords: customStop.split(",").map((s) => s.trim()).filter(Boolean),
      stuffingThreshold: threshold,
      topN: 25,
    });
    if ("error" in r) { queueMicrotask(() => setError(r.error)); return null; }
    queueMicrotask(() => setError(null));
    return r;
  }, [text, language, useStemming, removeStop, customStop, threshold]);

  // Build highlighted text when hovering a term.
  const highlighted = useMemo(() => {
    if (!hoverTerm || !result) return null;
    const ranges = findOccurrences(text, hoverTerm);
    if (ranges.length === 0) return null;
    const segs: { text: string; highlight: boolean }[] = [];
    let cursor = 0;
    for (const r of ranges) {
      if (r.start > cursor) segs.push({ text: text.slice(cursor, r.start), highlight: false });
      segs.push({ text: text.slice(r.start, r.end), highlight: true });
      cursor = r.end;
    }
    if (cursor < text.length) segs.push({ text: text.slice(cursor), highlight: false });
    return segs;
  }, [hoverTerm, text, result]);

  const exportCsv = useCallback(() => {
    if (!result) return;
    const csv = buildCsv(result);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "keyword-density.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Paste text or HTML</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Language</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Stuffing threshold (%)</Label>
              <Input type="number" step="0.5" min={1} max={20} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Custom stop words (comma)</Label>
              <Input value={customStop} onChange={(e) => setCustomStop(e.target.value)} placeholder="word1, word2" />
            </div>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={useStemming} onChange={(e) => setUseStemming(e.target.checked)} />
                <span>Stemming</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={removeStop} onChange={(e) => setRemoveStop(e.target.checked)} />
                <span>Stop-words off</span>
              </label>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Built-in stop words for {language}: {Array.from(getStopWords(language)).slice(0, 12).join(", ")}…
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          {result.flags.length > 0 && (
            <Card><CardContent className="p-4 space-y-1">
              {result.flags.map((f, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">{"⚠️"} {f}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Words: {result.wordCount}</Badge>
                <Badge variant="outline">Unique: {result.uniqueWords}</Badge>
                <Badge variant="outline">Chars: {result.charCount}</Badge>
                <Badge variant="outline">Flesch: {result.fleschScore}</Badge>
                <Badge variant="outline">Read time: {result.readingTimeMin} min</Badge>
                {result.elementCounts.title > 0 && <Badge variant="secondary">Title tokens: {result.elementCounts.title}</Badge>}
                {result.elementCounts.h1 > 0 && <Badge variant="secondary">H1: {result.elementCounts.h1}</Badge>}
                {result.elementCounts.h2 > 0 && <Badge variant="secondary">H2: {result.elementCounts.h2}</Badge>}
                {result.elementCounts.anchor > 0 && <Badge variant="secondary">Anchor: {result.elementCounts.anchor}</Badge>}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <NgramTable title="Unigrams (1-word)" entries={result.unigrams} onHover={setHoverTerm} />
            <NgramTable title="Bigrams (2-word)" entries={result.bigrams} onHover={setHoverTerm} />
            <NgramTable title="Trigrams (3-word)" entries={result.trigrams} onHover={setHoverTerm} />
          </div>

          {hoverTerm && highlighted && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Occurrences of "{hoverTerm}" in source</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-sm whitespace-pre-wrap font-mono">
                  {highlighted.map((s, i) => (
                    <span key={i} style={{ background: s.highlight ? "#fde68a" : "transparent", color: s.highlight ? "#7c2d12" : "inherit" }}>
                      {s.text}
                    </span>
                  ))}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 flex flex-wrap gap-2 justify-end">
              <CopyButton getText={() => buildCsv(result)} label="Copy CSV" />
              <Button size="sm" variant="outline" onClick={exportCsv}>Download CSV</Button>
            </CardContent>
          </Card>

          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground"><strong className="text-foreground">Honest note:</strong> there is no ideal keyword density. Google rewards relevance, not ratios. This tool flags stuffing, it doesn't prescribe a magic %. 100% client-side, no URL fetch, no upload.</p>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
