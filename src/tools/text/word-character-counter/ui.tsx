"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { countText, countSmsSegments, computeReadingTime, computeSpeakingTime } from "./logic";

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function WordCharacterCounter() {
  const [input, setInput] = useState("");
  const stats = useMemo(() => (input ? countText(input) : null), [input]);
  const sms = useMemo(() => (input ? countSmsSegments(input) : null), [input]);
  const readingTime = useMemo(() => (stats ? computeReadingTime(stats.words) : null), [stats]);
  const speakingTime = useMemo(() => (stats ? computeSpeakingTime(stats.words) : null), [stats]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wcc-input">Text</Label>
        <Textarea
          id="wcc-input"
          placeholder="Type or paste text here…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-h-[160px] resize-y"
        />
      </div>

      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <StatCard label="Words" value={stats.words.toLocaleString()} />
            <StatCard label="Characters" value={stats.charactersNoSpaces.toLocaleString()} hint="excl. whitespace" />
            <StatCard label="Characters (all)" value={(stats.charactersNoSpaces + stats.whitespace).toLocaleString()} hint="incl. whitespace" />
            <StatCard label="Sentences" value={stats.sentences.toLocaleString()} />
            <StatCard label="Paragraphs" value={stats.paragraphs.toLocaleString()} />
            <StatCard label="Graphemes" value={stats.graphemes.toLocaleString()} hint="true Unicode" />
            <StatCard label="UTF-8 bytes" value={stats.utf8Bytes.toLocaleString()} />
            <StatCard label="Code points" value={stats.codePoints.toLocaleString()} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground mb-1">Reading time</p>
                <p className="text-sm font-medium">
                  {readingTime?.minutes === 0 && readingTime.seconds === 0
                    ? "<1s"
                    : `${readingTime?.minutes || 0}m ${readingTime?.seconds || 0}s`}
                </p>
                <p className="text-[10px] text-muted-foreground">@ 225 wpm</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground mb-1">Speaking time</p>
                <p className="text-sm font-medium">
                  {speakingTime?.minutes === 0 && speakingTime.seconds === 0
                    ? "<1s"
                    : `${speakingTime?.minutes || 0}m ${speakingTime?.seconds || 0}s`}
                </p>
                <p className="text-[10px] text-muted-foreground">@ 130 wpm</p>
              </CardContent>
            </Card>
          </div>

          {sms && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">SMS segments</p>
                    <p className="text-sm font-medium">{sms.segments} segment{sms.segments === 1 ? "" : "s"}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {sms.encoding} · {sms.charsPerSegment} chars/segment
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {stats.avgSentenceWords !== undefined && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">
                  Avg sentence: <strong className="text-foreground">{stats.avgSentenceWords} words</strong>
                  {stats.longestSentenceWords !== undefined && (
                    <> · Longest: <strong className="text-foreground">{stats.longestSentenceWords} words</strong></>
                  )}
                  {stats.approximate && (
                    <span className="ml-2 text-amber-500">⚠ Intl.Segmenter unavailable — counts approximate</span>
                  )}
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all counting runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
