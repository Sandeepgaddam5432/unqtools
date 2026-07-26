"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  generatePuzzle,
  puzzleAsText,
  puzzleAsHTML,
  solutionKey,
  exportPuzzleCSV,
  letterFrequency,
  rateDifficulty,
  validateSize,
  buildAnswerMask,
  wordListString,
  type WordSearchPuzzle,
} from "./logic";

export default function WordSearchMaker() {
  const [words, setWords] = useState<string>("CAT, DOG, FISH, BIRD, TREE");
  const [size, setSize] = useState<string>("12");
  const [allowReverse, setAllowReverse] = useState<boolean>(true);
  const [fillBlanks, setFillBlanks] = useState<boolean>(true);
  const [showSolution, setShowSolution] = useState<boolean>(false);
  const [seed, setSeed] = useState<number>(1);
  const [error, setError] = useState<string>("");

  const sizeN = Number(size);
  const sizeWarnings = validateSize(sizeN);

  // Deterministic RNG seeded by `seed` so user can regenerate deterministically.
  const rng = useMemo(() => {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }, [seed]);

  const puzzle: WordSearchPuzzle | null = useMemo(() => {
    if (sizeN < 5 || sizeN > 30) return null;
    const list = words.split(",").map((w) => w.trim()).filter(Boolean);
    if (list.length === 0) return null;
    return generatePuzzle(list, sizeN, allowReverse, fillBlanks, rng);
  }, [words, sizeN, allowReverse, fillBlanks, rng]);

  const freq = puzzle ? letterFrequency(puzzle) : {};
  const difficulty = puzzle ? rateDifficulty(puzzle, allowReverse) : "";
  const mask = puzzle ? buildAnswerMask(puzzle) : [];

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      {sizeWarnings.length > 0 && (
        <div className="text-xs text-amber-700 dark:text-amber-400">{sizeWarnings[0]}</div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Words (comma-separated)</Label>
              <textarea
                value={words}
                onChange={(e) => setWords(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs font-mono"
              />
            </div>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Grid size</Label>
                <input type="number" min={5} max={30} value={size} onChange={(e) => setSize(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={allowReverse} onChange={(e) => setAllowReverse(e.target.checked)} /> Reverse allowed
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={fillBlanks} onChange={(e) => setFillBlanks(e.target.checked)} /> Fill blanks
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={showSolution} onChange={(e) => setShowSolution(e.target.checked)} /> Show solution
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSeed((s) => s + 1)} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90">
                  Regenerate
                </button>
                <button onClick={() => setSeed(1)} className="px-3 py-1.5 text-xs rounded-md border border-border bg-muted/40 hover:bg-muted">
                  Reset seed
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {puzzle && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-base font-semibold">Puzzle ({difficulty})</h3>
                <p className="text-xs text-muted-foreground">{puzzle.placed.length} placed · {puzzle.unplaced.length} unplaced · {fillBlanks ? "blanks filled" : "blanks empty"}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <CopyButton getText={() => puzzleAsText(puzzle)} label="Copy text" />
                <CopyButton getText={() => solutionKey(puzzle)} label="Copy key" />
                <DownloadButton getText={() => puzzleAsHTML(puzzle)} filename="word-search.html" mime="text/html" label="HTML" />
                <DownloadButton getText={() => exportPuzzleCSV(puzzle)} filename="word-search.csv" mime="text/csv" label="CSV" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="border-collapse">
                <tbody>
                  {puzzle.grid.map((row, r) => (
                    <tr key={r}>
                      {row.map((ch, c) => {
                        const isWordCell = showSolution && mask[r][c] !== "_";
                        return (
                          <td
                            key={c}
                            className={`w-7 h-7 text-center font-mono text-xs border border-border/50 ${isWordCell ? "bg-primary/20 font-bold" : ""}`}
                          >
                            {ch}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Word list &amp; positions</Label>
          {puzzle && puzzle.placed.length === 0 ? (
            <p className="text-xs text-muted-foreground">No words were placed — try a larger grid or shorter words.</p>
          ) : (
            <div className="text-xs space-y-0.5 font-mono">
              {puzzle?.placed.map((p, i) => (
                <div key={i}>
                  {p.word} → row {p.row + 1}, col {p.col + 1}, {p.direction}
                </div>
              ))}
              {puzzle?.unplaced.map((w, i) => (
                <div key={`u${i}`} className="text-red-500">
                  {w} → could not place
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Letter frequency</Label>
          <div className="flex flex-wrap gap-1">
            {Object.entries(freq)
              .sort((a, b) => b[1] - a[1])
              .map(([ch, n]) => (
                <Badge key={ch} variant="outline" className="text-[10px] font-mono">
                  {ch}: {n}
                </Badge>
              ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Normalized list: {wordListString(words.split(","))}</p>
        </CardContent>
      </Card>
    </div>
  );
}
