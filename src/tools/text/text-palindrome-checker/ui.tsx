"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  checkPalindrome, reverseString, reverseWords, reverseLines, batchCheck, toCsv,
  type PalindromeResult,
} from "./logic";

export default function TextPalindromeChecker() {
  const [text, setText] = useState("A man, a plan, a canal: Panama");
  const [strict, setStrict] = useState(false);
  const [numericOnly, setNumericOnly] = useState(false);
  const [result, setResult] = useState<PalindromeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchText, setBatchText] = useState("");
  const [batchOut, setBatchOut] = useState<ReturnType<typeof batchCheck> | null>(null);
  const [revOut, setRevOut] = useState<{ chars: string; words: string; lines: string } | null>(null);

  const run = useCallback(() => {
    const r = checkPalindrome(text, { strict, numericOnly });
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
    setRevOut({ chars: reverseString(text), words: reverseWords(text), lines: reverseLines(text) });
  }, [text, strict, numericOnly]);

  const runBatch = useCallback(() => {
    const lines = batchText.split(/\n/).map((l) => l.trim()).filter(Boolean);
    setBatchOut(batchCheck(lines));
    setError(null);
  }, [batchText]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Text</Label>
            <textarea
              className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} />
              Strict (case-sensitive, all chars)
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={numericOnly} onChange={(e) => setNumericOnly(e.target.checked)} />
              Numeric only
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Check</Button>
            <Button size="sm" variant="ghost" onClick={() => setText("A man, a plan, a canal: Panama")}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText(""); setResult(null); setError(null); setRevOut(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant={result.isPalindrome ? "default" : "destructive"} className="text-base">
                {result.isPalindrome ? "✓ Palindrome" : "✗ Not a palindrome"}
              </Badge>
              {result.isAlmostPalindrome && <Badge variant="outline">Almost (1 char away)</Badge>}
              <Badge variant="outline">Chars: {result.charCount}</Badge>
              <Badge variant="outline">Pairs: {result.pairCount}</Badge>
              <Badge variant="outline">Sub-palindromes: {result.palindromicSubstringCount}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-2 rounded border border-border/50 bg-muted/30">
                <p className="text-xs text-muted-foreground">Normalized</p>
                <p className="font-mono break-all">{result.normalized || "(empty)"}</p>
              </div>
              <div className="p-2 rounded border border-border/50 bg-muted/30">
                <p className="text-xs text-muted-foreground">Reversed</p>
                <p className="font-mono break-all">{result.reversed || "(empty)"}</p>
              </div>
            </div>

            {result.mismatches.length > 0 && (
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Mismatched pairs ({result.mismatches.length})</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.mismatches.slice(0, 20).map((m, i) => (
                    <Badge key={i} variant="destructive" className="font-mono">[{m.leftIndex}]{m.leftChar} ⇄ {m.rightChar}[{m.rightIndex}]</Badge>
                  ))}
                </div>
              </CardContent></Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><p className="text-xs text-muted-foreground">Longest palindromic substring</p><p className="font-mono break-all">{result.longestPalindromicSubstring || "(none)"}</p></div>
              <div><p className="text-xs text-muted-foreground">Reversed (chars)</p><p className="font-mono break-all">{revOut?.chars}</p></div>
              <div><p className="text-xs text-muted-foreground">Reversed (words)</p><p className="font-mono break-all">{revOut?.words}</p></div>
            </div>

            {result.wordLevel.length > 0 && (
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Word-level check</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.wordLevel.map((w, i) => (
                    <Badge key={i} variant={w.isPalindrome ? "default" : "outline"}>{w.word}</Badge>
                  ))}
                </div>
              </CardContent></Card>
            )}

            {result.warnings.length > 0 && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5">
                {result.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch check (one per line)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea
            className="w-full min-h-[80px] rounded-md border bg-background p-2 text-xs font-mono"
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder={"racecar\nhello\nlevel"}
          />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={runBatch} disabled={!batchText.trim()}>Run batch</Button>
            {batchOut && batchOut.length > 0 && (
              <DownloadButton getText={() => toCsv(batchOut)} filename="palindromes.csv" mime="text/csv" />
            )}
          </div>
          {batchOut && batchOut.length > 0 && (
            <ul className="text-xs divide-y divide-border/50">
              {batchOut.map((r, i) => (
                <li key={i} className="p-2 flex items-center justify-between gap-2">
                  <span className="flex-1 font-mono">{"error" in r ? "(error)" : r.original}</span>
                  <Badge variant={"error" in r ? "outline" : r.isPalindrome ? "default" : "destructive"}>
                    {"error" in r ? "error" : r.isPalindrome ? "yes" : "no"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all checks run locally.</p></CardContent></Card>
    </div>
  );
}
