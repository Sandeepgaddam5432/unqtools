"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { generateAcronym, toCsv, toJson, type WordCategory } from "./logic";

const ALL_CATS: WordCategory[] = ["common", "noun", "adjective", "verb", "tech", "positive"];

export default function TextAcronymGenerator() {
  const [keyword, setKeyword] = useState("FIRE");
  const [seed, setSeed] = useState("42");
  const [variants, setVariants] = useState("5");
  const [minLen, setMinLen] = useState("3");
  const [maxLen, setMaxLen] = useState("10");
  const [caseStyle, setCaseStyle] = useState<"title" | "upper" | "lower" | "sentence">("title");
  const [cats, setCats] = useState<WordCategory[]>(["common", "noun", "adjective", "verb", "positive"]);
  const [customDict, setCustomDict] = useState("");
  const [mandatory, setMandatory] = useState("");
  const [positionFilters, setPositionFilters] = useState("");
  const [result, setResult] = useState<ReturnType<typeof generateAcronym> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = generateAcronym({
      keyword,
      seed: Number(seed) || undefined,
      variants: Number(variants) || 5,
      minLength: Number(minLen) || undefined,
      maxLength: Number(maxLen) || undefined,
      caseStyle,
      categories: cats,
      customDictionary: customDict.split(/[\s,;\n]+/).filter(Boolean),
      mandatory: mandatory.split(",").map((s) => s.trim()),
      positionFilters: positionFilters.split("|"),
    });
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
  }, [keyword, seed, variants, minLen, maxLen, caseStyle, cats, customDict, mandatory, positionFilters]);

  const toggleCat = (c: WordCategory) => {
    setCats((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div><Label className="text-xs text-muted-foreground">Keyword (letters only)</Label>
              <Input value={keyword} onChange={(e) => setKeyword(e.target.value.toUpperCase())} className="font-mono" /></div>
            <div><Label className="text-xs text-muted-foreground">Variants (1-50)</Label>
              <Input type="number" min={1} max={50} value={variants} onChange={(e) => setVariants(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Seed (deterministic)</Label>
              <Input type="number" value={seed} onChange={(e) => setSeed(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Case style</Label>
              <select value={caseStyle} onChange={(e) => setCaseStyle(e.target.value as typeof caseStyle)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                <option value="title">Title case</option>
                <option value="upper">UPPER</option>
                <option value="lower">lower</option>
                <option value="sentence">Sentence</option>
              </select></div>
            <div><Label className="text-xs text-muted-foreground">Min word length</Label>
              <Input type="number" value={minLen} onChange={(e) => setMinLen(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Max word length</Label>
              <Input type="number" value={maxLen} onChange={(e) => setMaxLen(e.target.value)} /></div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Word categories</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ALL_CATS.map((c) => (
                <Button key={c} size="sm" variant={cats.includes(c) ? "default" : "outline"} onClick={() => toggleCat(c)}>{c}</Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Custom dictionary (comma/space separated)</Label>
            <Input value={customDict} onChange={(e) => setCustomDict(e.target.value)} placeholder="apple, banana, cherry" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Mandatory words per position (comma-separated)</Label>
              <Input value={mandatory} onChange={(e) => setMandatory(e.target.value)} placeholder="First, , Third" /></div>
            <div><Label className="text-xs text-muted-foreground">Position regex filters (pipe-separated)</Label>
              <Input value={positionFilters} onChange={(e) => setPositionFilters(e.target.value)} placeholder="^a|^b" /></div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Generate</Button>
            <Button size="sm" variant="ghost" onClick={() => setSeed(String(Math.floor(Math.random() * 100000)))}>Random seed</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="outline">{result.keyword}</Badge>
              <Badge variant="outline">{result.variants.length} variants</Badge>
              <CopyButton getText={() => result.variants.map((v) => v.words.join(" ")).join("\n")} label="Copy all" />
              <DownloadButton getText={() => toCsv(result)} filename={`backronym-${result.keyword}.csv`} mime="text/csv" />
              <DownloadButton getText={() => toJson(result)} filename={`backronym-${result.keyword}.json`} mime="application/json" />
            </div>

            {result.warnings.length > 0 && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5">
                {result.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
              </div>
            )}

            <div className="space-y-2">
              {result.variants.map((v, i) => (
                <div key={i} className="rounded-md border border-border/50 bg-muted/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Variant {i + 1}</span>
                    <Badge variant="outline">Score: {v.score}</Badge>
                  </div>
                  <p className="text-sm font-medium">{v.words.join(" ")}</p>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    {v.mapping.map((m, j) => (<span key={j}>{m.letter}={m.word}{j < v.mapping.length - 1 ? ", " : ""}</span>))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Letter availability</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {result.letterAvailability.map((la, i) => (
                  <Badge key={i} variant={la.count === 0 ? "destructive" : "outline"}>{la.letter}: {la.count}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all generation runs locally. No uploads.</p></CardContent></Card>
    </div>
  );
}
