"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  analyzeAudiobook,
  formatDuration,
  bookmarksToCsv,
  sampleAudiobook,
  type Audiobook,
  type AudiobookResult,
  type Speed,
} from "./logic";

const SPEED_OPTIONS: Speed[] = [0.75, 1, 1.25, 1.5, 1.75, 2];

export default function AudiobookPlayerRef() {
  const [book, setBook] = useState<Audiobook>(sampleAudiobook());
  const [sessionMinutes, setSessionMinutes] = useState("30");
  const [resumeAtSec, setResumeAtSec] = useState("0");
  const [recommendedSpeed, setRecommendedSpeed] = useState<Speed | "auto">("auto");
  const [result, setResult] = useState<AudiobookResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = analyzeAudiobook(book, {
      sessionMinutes: Number(sessionMinutes) || 30,
      resumeAtSec: Number(resumeAtSec) || 0,
      recommendedSpeed: recommendedSpeed === "auto" ? undefined : recommendedSpeed,
    });
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [book, sessionMinutes, resumeAtSec, recommendedSpeed]);

  const sample = useCallback(() => { setBook(sampleAudiobook()); setSessionMinutes("30"); setResumeAtSec("0"); setRecommendedSpeed("auto"); }, []);
  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  const totalDuration = book.chapters.reduce((s, c) => s + c.durationSec, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Session length (min)</Label>
              <Input type="number" value={sessionMinutes} onChange={(e) => setSessionMinutes(e.target.value)} aria-label="Session minutes" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Resume at (sec)</Label>
              <Input type="number" value={resumeAtSec} onChange={(e) => setResumeAtSec(e.target.value)} aria-label="Resume at seconds" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Recommended speed</Label>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant={recommendedSpeed === "auto" ? "default" : "outline"} onClick={() => setRecommendedSpeed("auto")}>auto</Button>
                {SPEED_OPTIONS.map((s) => (
                  <Button key={s} size="sm" variant={recommendedSpeed === s ? "default" : "outline"} onClick={() => setRecommendedSpeed(s)}>{s}×</Button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Analyse</Button>
            <Button size="sm" variant="ghost" onClick={sample}>Load sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Loaded audiobook</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 text-sm space-y-1">
          <p><strong>{book.title}</strong> — {book.author}</p>
          <p className="text-muted-foreground">{book.chapters.length} chapters · total {formatDuration(totalDuration)}</p>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total duration</p>
              <p className="text-lg font-bold">{formatDuration(result.totalDurationSec)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total listening min (1×)</p>
              <p className="text-lg font-bold">{result.totalListeningMin}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Recommended speed</p>
              <p className="text-lg font-bold text-primary">{result.recommendedSpeed}×</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Session reaches</p>
              <p className="text-lg font-bold">Ch {result.sessionPlan.reachableChapter}</p>
              <p className="text-xs text-muted-foreground">+{formatDuration(result.sessionPlan.offsetInChapterSec)} into chapter</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Speed comparison</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {result.speeds.map((s) => (
                <div key={s.speed} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="w-12 justify-center">{s.speed}×</Badge>
                  <span className="flex-1">Listening: <strong>{s.totalListeningMin} min</strong></span>
                  <Badge variant="secondary">−{s.timeSavedMin} min ({s.percentSaved}%)</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Bookmarks</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-1">
              {result.bookmarks.map((b) => (
                <div key={b.id} className="flex items-center gap-2 text-sm font-mono text-xs">
                  <Badge variant="outline">{b.id}</Badge>
                  <span className="flex-1 truncate">{b.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Resume point</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 text-sm space-y-1">
              <p>Chapter: <strong>{result.resumePoint.chapter}</strong></p>
              <p>Offset: <strong>{formatDuration(result.resumePoint.offsetSec)}</strong></p>
              <p className="font-mono text-xs break-all bg-muted/30 rounded p-2">{result.resumePoint.serialised}</p>
            </CardContent>
          </Card>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export bookmarks CSV</p>
              <div className="flex gap-2">
                <CopyButton getText={() => bookmarksToCsv(book)} />
                <DownloadButton getText={() => bookmarksToCsv(book)} filename="audiobook-bookmarks.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
