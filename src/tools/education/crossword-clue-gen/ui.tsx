"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  generateClues,
  exportCluesCSV,
  exportCluesText,
  filterByDifficulty,
  sortCluesAlpha,
  sortCluesByLength,
  solveDifficultyScore,
  groupByHintType,
  validateEntry,
  type Clue,
  type WordEntry,
} from "./logic";

interface ParsedEntry extends WordEntry {
  raw: string;
}

export default function CrosswordClueGen() {
  const [input, setInput] = useState<string>("Cat: Animal, feline pet\nDog: Animal, canine pet\nParis: Capital of France\nOcean: Large body of water");
  const [difficulty, setDifficulty] = useState<Clue["difficulty"]>("medium");
  const [sortBy, setSortBy] = useState<"alpha" | "length" | "none">("none");
  const [filterDiff, setFilterDiff] = useState<Clue["difficulty"] | "all">("all");
  const [error, setError] = useState<string>("");

  const entries: ParsedEntry[] = useMemo(() => {
    return input
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const idx = line.indexOf(":");
        if (idx === -1) return { word: line, raw: line };
        const word = line.slice(0, idx).trim();
        const def = line.slice(idx + 1).trim();
        return { word, customDefinition: def, raw: line };
      });
  }, [input]);

  const validation = useMemo(() => entries.map((e) => ({ entry: e, warnings: validateEntry(e) })), [entries]);

  const clues = useMemo(() => {
    const valid = validation.filter((v) => v.warnings.length === 0).map((v) => v.entry);
    let list = generateClues(valid, difficulty);
    if (filterDiff !== "all") list = filterByDifficulty(list, filterDiff);
    if (sortBy === "alpha") list = sortCluesAlpha(list);
    if (sortBy === "length") list = sortCluesByLength(list);
    return list;
  }, [validation, difficulty, sortBy, filterDiff]);

  const score = useMemo(() => solveDifficultyScore(clues), [clues]);
  const grouped = useMemo(() => groupByHintType(clues), [clues]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Word list — one per line, format: Word: definition</Label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Difficulty</Label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Clue["difficulty"])} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sort by</Label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "alpha" | "length" | "none")} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                <option value="none">None</option>
                <option value="alpha">Alphabetical</option>
                <option value="length">Length</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Filter</Label>
              <select value={filterDiff} onChange={(e) => setFilterDiff(e.target.value as Clue["difficulty"] | "all")} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                <option value="all">All difficulties</option>
                <option value="easy">Easy only</option>
                <option value="medium">Medium only</option>
                <option value="hard">Hard only</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-base font-semibold">Generated clues ({clues.length})</h3>
              <p className="text-xs text-muted-foreground">Solve difficulty: {score}/100</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <CopyButton getText={() => exportCluesText(clues)} label="Copy text" />
              <DownloadButton getText={() => exportCluesCSV(clues)} filename="crossword-clues.csv" mime="text/csv" label="CSV" />
              <DownloadButton getText={() => exportCluesText(clues)} filename="crossword-clues.txt" label="TXT" />
            </div>
          </div>
          {clues.length === 0 ? (
            <p className="text-xs text-muted-foreground">No valid clues yet. Add words in the format `Word: definition`.</p>
          ) : (
            <div className="space-y-1.5">
              {clues.map((c, i) => (
                <div key={i} className="rounded-md border border-border p-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-medium">{c.word}</span>
                    <Badge variant="outline" className="text-[10px]">{c.length}L</Badge>
                    <Badge variant="outline" className={`text-[10px] ${c.difficulty === "easy" ? "border-emerald-500/30 text-emerald-700" : c.difficulty === "hard" ? "border-red-500/30 text-red-700" : "border-amber-500/30 text-amber-700"}`}>
                      {c.difficulty}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{c.hintType}</Badge>
                  </div>
                  <p className="mt-1">{c.clue}</p>
                  <p className="text-muted-foreground mt-0.5">Hint: {c.hint}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">By hint type</Label>
          <div className="space-y-1">
            {(["definition", "fill-in-blank", "anagram", "letter-pattern", "category"] as const).map((t) => (
              <div key={t} className="flex items-center gap-2 text-xs">
                <span className="w-28 capitalize">{t.replace("-", " ")}</span>
                <Badge variant="outline" className="text-[10px]">{grouped[t].length}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {validation.some((v) => v.warnings.length > 0) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">Validation warnings</Label>
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4 space-y-0.5">
              {validation
                .filter((v) => v.warnings.length > 0)
                .map((v, i) => (
                  <li key={i}>
                    <span className="font-mono">{v.entry.word || v.entry.raw}</span>: {v.warnings.join("; ")}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
