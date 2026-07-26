"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  detectFormat, parseSubtitles, serializeSubtitles, convertFormat, shiftTime,
  scaleTime, renumber, searchCues, replaceText, validateCues, formatTimestamp,
  formatDuration, totalDuration, type SubtitleFormat,
} from "./logic";

const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:03,500
Welcome to the show.

2
00:00:04,000 --> 00:00:06,200
Today we are talking about subtitles.

3
00:00:07,000 --> 00:00:09,800
Let's get started!
`;

export default function SubtitleEditorUI() {
  const [content, setContent] = useState(SAMPLE_SRT);
  const [targetFormat, setTargetFormat] = useState<SubtitleFormat>("vtt");
  const [offsetMs, setOffsetMs] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [findText, setFindText] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [error, setError] = useState("");

  const parsed = useMemo(() => {
    try {
      return parseSubtitles(content);
    } catch (e) {
      return null;
    }
  }, [content]);

  const validation = useMemo(() => (parsed ? validateCues(parsed.cues) : null), [parsed]);
  const searchResults = useMemo(() => (parsed && findText ? searchCues(parsed.cues, findText) : []), [parsed, findText]);

  const converted = useMemo(() => {
    if (!parsed) return "";
    return serializeSubtitles(parsed.cues, targetFormat);
  }, [parsed, targetFormat]);

  const shifted = useMemo(() => {
    if (!parsed) return "";
    return serializeSubtitles(shiftTime(parsed.cues, offsetMs), parsed.format);
  }, [parsed, offsetMs]);

  const scaled = useMemo(() => {
    if (!parsed) return "";
    return serializeSubtitles(scaleTime(parsed.cues, scaleFactor), parsed.format);
  }, [parsed, scaleFactor]);

  const replaced = useMemo(() => {
    if (!parsed || !findText) return "";
    return serializeSubtitles(replaceText(parsed.cues, findText, replaceWith), parsed.format);
  }, [parsed, findText, replaceWith]);

  const renumbered = useMemo(() => {
    if (!parsed) return "";
    return serializeSubtitles(renumber(parsed.cues), parsed.format);
  }, [parsed]);

  const stats = useMemo(() => {
    if (!parsed) return null;
    return {
      cueCount: parsed.cues.length,
      format: parsed.format,
      totalDuration: totalDuration(parsed.cues),
      warnings: parsed.warnings.length,
      issues: validation?.issues.length ?? 0,
    };
  }, [parsed, validation]);

  const onFile = useCallback(async (f: File) => {
    setError("");
    const text = await f.text();
    setContent(text);
  }, []);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Subtitle content (SRT or VTT)</Label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[200px] font-mono"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              type="file"
              accept=".srt,.vtt,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
              className="max-w-xs"
            />
            <CopyButton getText={() => converted} label="Copy converted" />
            <DownloadButton getText={() => converted} filename={`subtitles.${targetFormat}`} disabled={!parsed} />
          </div>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Cues" value={String(stats.cueCount)} />
          <Stat label="Format" value={stats.format.toUpperCase()} />
          <Stat label="Total duration" value={formatDuration(stats.totalDuration)} />
          <Stat label="Warnings" value={String(stats.warnings)} />
          <Stat label="Issues" value={String(stats.issues)} />
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Format conversion</p>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="text-xs px-2 py-1.5 rounded-md border border-input bg-background"
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value as SubtitleFormat)}
            >
              <option value="srt">SRT</option>
              <option value="vtt">VTT</option>
            </select>
            <CopyButton getText={() => converted} label={`Copy as ${targetFormat.toUpperCase()}`} />
            <DownloadButton getText={() => converted} filename={`subtitles.${targetFormat}`} />
          </div>
          <pre className="text-xs font-mono bg-muted/30 p-2 rounded-md max-h-48 overflow-auto">{converted.slice(0, 1000)}{converted.length > 1000 ? "…" : ""}</pre>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Time shift</p>
            <div className="flex gap-2 items-center">
              <Input type="number" value={offsetMs} onChange={(e) => setOffsetMs(Number(e.target.value))} className="w-32" />
              <span className="text-xs text-muted-foreground">ms (positive = later)</span>
            </div>
            <CopyButton getText={() => shifted} label="Copy shifted" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Time scale</p>
            <div className="flex gap-2 items-center">
              <Input type="number" step={0.01} value={scaleFactor} onChange={(e) => setScaleFactor(Number(e.target.value))} className="w-32" />
              <span className="text-xs text-muted-foreground">× (e.g. 1.1 = 10% slower)</span>
            </div>
            <CopyButton getText={() => scaled} label="Copy scaled" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Find & replace</p>
          <div className="flex flex-wrap gap-2">
            <Input type="text" placeholder="Find" value={findText} onChange={(e) => setFindText(e.target.value)} className="flex-1 min-w-32" />
            <Input type="text" placeholder="Replace with" value={replaceWith} onChange={(e) => setReplaceWith(e.target.value)} className="flex-1 min-w-32" />
            <CopyButton getText={() => replaced} label="Copy replaced" disabled={!findText} />
          </div>
          {searchResults.length > 0 && (
            <p className="text-xs text-muted-foreground">Found in {searchResults.length} cue(s): {searchResults.join(", ")}</p>
          )}
        </CardContent>
      </Card>

      {validation && validation.issues.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-sm font-medium text-amber-600">Validation issues</p>
            {validation.issues.map((issue, i) => (
              <p key={i} className="text-xs text-muted-foreground">• {issue}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {parsed && parsed.cues.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Cue list ({parsed.cues.length})</p>
              <CopyButton getText={() => renumbered} label="Copy renumbered" />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="p-2">#</th>
                    <th className="p-2">Start</th>
                    <th className="p-2">End</th>
                    <th className="p-2">Text</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.cues.map((c) => (
                    <tr key={c.index} className="border-b border-border/30">
                      <td className="p-2 font-mono">{c.index}</td>
                      <td className="p-2 font-mono">{formatTimestamp(c.startTimeMs, parsed.format)}</td>
                      <td className="p-2 font-mono">{formatTimestamp(c.endTimeMs, parsed.format)}</td>
                      <td className="p-2 truncate max-w-xs">{c.text.replace(/\n/g, " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all parsing and conversion happens locally. SRT uses comma separators; VTT uses periods.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
