"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { findAntonyms, antonymChain, batchFind, toCsv, type POS, type AntonymResult } from "./logic";

const POS_OPTIONS: (POS | "")[] = ["", "noun", "verb", "adjective", "adverb"];

export default function TextAntonymFinder() {
  const [word, setWord] = useState("hot");
  const [pos, setPos] = useState<POS | "">("");
  const [result, setResult] = useState<AntonymResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chainOut, setChainOut] = useState<string[] | null>(null);
  const [batchText, setBatchText] = useState("hot\ncold\nhappy\nbig");
  const [batchOut, setBatchOut] = useState<ReturnType<typeof batchFind> | null>(null);

  const run = useCallback(() => {
    const r = findAntonyms({ word, pos: pos || undefined });
    if ("error" in r) { setError(r.error); setResult(null); return; }
    setError(null);
    setResult(r);
  }, [word, pos]);

  const runChain = useCallback(() => {
    const c = antonymChain(word, 3);
    if (Array.isArray(c)) setChainOut(c);
    else setError(c.error);
  }, [word]);

  const runBatch = useCallback(() => {
    const words = batchText.split(/\n/).map((w) => w.trim()).filter(Boolean);
    setBatchOut(batchFind(words));
    setError(null);
  }, [batchText]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Word</Label>
              <Input value={word} onChange={(e) => setWord(e.target.value)} className="font-mono" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Part of speech (optional)</Label>
              <select value={pos} onChange={(e) => setPos(e.target.value as POS | "")} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                {POS_OPTIONS.map((p) => <option key={p} value={p}>{p || "any"}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Find antonyms</Button>
            <Button size="sm" variant="outline" onClick={runChain}>Build chain</Button>
            <Button size="sm" variant="ghost" onClick={() => { setWord("hot"); setPos(""); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setWord(""); setResult(null); setError(null); setChainOut(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">{result.word}</h3>
              {result.pos && <Badge variant="outline">{result.pos}</Badge>}
              <Badge variant="outline">{result.antonyms.length} antonyms</Badge>
              <CopyButton getText={() => result.antonyms.map((a) => a.antonym).join(", ")} label="Copy antonyms" />
            </div>

            {result.warnings.length > 0 && (
              <div className="text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5">
                {result.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
              </div>
            )}

            {result.antonyms.length > 0 && (
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Antonyms (sense-aware)</Label>
                <ul className="mt-1 space-y-1">
                  {result.antonyms.map((a, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 text-sm">
                      <div>
                        <span className="font-medium">{a.antonym}</span>
                        <span className="text-xs text-muted-foreground ml-2">({a.pos}) — {a.sense}</span>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-[10px]">str: {a.strength}</Badge>
                        <Badge variant="outline" className="text-[10px]">freq: {a.commonality}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent></Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Synonyms</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.synonyms.length === 0
                    ? <span className="text-xs text-muted-foreground">None</span>
                    : result.synonyms.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                </div>
              </CardContent></Card>
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Reverse lookup (words whose antonym = {result.word})</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.reverseLookup.length === 0
                    ? <span className="text-xs text-muted-foreground">None</span>
                    : result.reverseLookup.map((w) => <Badge key={w} variant="outline">{w}</Badge>)}
                </div>
              </CardContent></Card>
            </div>

            {result.rhymingAntonyms.length > 0 && (
              <Card><CardContent className="p-3">
                <Label className="text-xs text-muted-foreground">Rhyming antonyms (memory hook)</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {result.rhymingAntonyms.map((w) => <Badge key={w} variant="secondary">{w}</Badge>)}
                </div>
              </CardContent></Card>
            )}
          </CardContent>
        </Card>
      )}

      {chainOut && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">Antonym chain</Label>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {chainOut.map((w, i) => (
                <React.Fragment key={i}>
                  <Badge variant={i === 0 ? "default" : "outline"}>{w}</Badge>
                  {i < chainOut.length - 1 && <span className="text-muted-foreground">→</span>}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch lookup (one word per line)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea
            className="w-full min-h-[80px] rounded-md border bg-background p-2 text-xs font-mono"
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
          />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={runBatch}>Run batch</Button>
            {batchOut && batchOut.length > 0 && (
              <DownloadButton getText={() => toCsv(batchOut)} filename="antonyms.csv" mime="text/csv" />
            )}
          </div>
          {batchOut && batchOut.length > 0 && (
            <div className="space-y-1">
              {batchOut.map((r, i) => (
                <div key={i} className="p-2 rounded border border-border/50 bg-muted/30 text-xs">
                  {"error" in r ? (
                    <span className="text-destructive">{r.word}: error</span>
                  ) : (
                    <span><strong>{r.word}</strong>: {r.antonyms.length} antonyms — {r.antonyms.slice(0, 5).map((a) => a.antonym).join(", ")}{r.antonyms.length > 5 ? "…" : ""}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all lookup runs locally from a built-in dictionary. No external API calls.</p></CardContent></Card>
    </div>
  );
}
