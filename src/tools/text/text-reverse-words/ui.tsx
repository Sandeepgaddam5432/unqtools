"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  reverseWords,
  reverseCharsInWords,
  validateOptions,
  findPreset,
  PRESETS,
  textStats,
  type ReverseWordsOptions,
  type ReversalScope,
} from "./logic";

export default function TextReverseWords() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<ReverseWordsOptions>({
    preserveEdges: true, keepPunctuation: true, scope: "line", customDelimiter: "", normalizeWhitespace: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [charMode, setCharMode] = useState(false);

  const validOpts = useMemo(() => validateOptions(opts), [opts]);
  const output = useMemo(() => {
    try {
      return charMode ? reverseCharsInWords(input, validOpts) : reverseWords(input, validOpts);
    } catch (e) {
      setError(String(e));
      return "";
    }
  }, [input, validOpts, charMode]);
  const stats = useMemo(() => textStats(input), [input]);

  const applyPreset = (id: string) => {
    const p = findPreset(id);
    if (p) {
      setOpts((o) => ({ ...o, ...p.options }));
      setError(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <Label htmlFor="rw-input">Input text</Label>
        <Textarea id="rw-input" placeholder="Type text to reverse word order…" value={input} onChange={(e) => setInput(e.target.value)} className="min-h-[120px] resize-y" />
        <p className="text-xs text-muted-foreground">{stats.lines} line{stats.lines === 1 ? "" : "s"} · {stats.words} words · {stats.chars} chars</p>
        <div>
          <Label className="text-xs text-muted-foreground">Presets</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {PRESETS.map((p) => (
              <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>{p.label}</Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={opts.preserveEdges} onChange={(e) => setOpts({ ...opts, preserveEdges: e.target.checked })} />
            Preserve edges
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={opts.keepPunctuation} onChange={(e) => setOpts({ ...opts, keepPunctuation: e.target.checked })} />
            Keep punctuation
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={opts.normalizeWhitespace} onChange={(e) => setOpts({ ...opts, normalizeWhitespace: e.target.checked })} />
            Normalize whitespace
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={charMode} onChange={(e) => setCharMode(e.target.checked)} />
            Reverse chars in words
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Scope</Label>
            <select value={opts.scope} onChange={(e) => setOpts({ ...opts, scope: e.target.value as ReversalScope })} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="line">Per line</option>
              <option value="sentence">Per sentence</option>
              <option value="all">All (flatten)</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Custom delimiter (regex)</Label>
            <input type="text" value={opts.customDelimiter} onChange={(e) => setOpts({ ...opts, customDelimiter: e.target.value })} placeholder="e.g. ,|;|:" className="h-9 w-48 rounded-md border bg-background px-3 text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setInput("hello world\nthe quick brown fox")}>Load sample</Button>
          <Button size="sm" variant="ghost" onClick={() => { setInput(""); setError(null); }}>Clear</Button>
        </div>
      </CardContent></Card>
      {output && (
        <Card><CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm font-medium">Reversed output</Label>
            <div className="flex gap-2">
              <CopyButton getText={() => output} />
              <DownloadButton getText={() => output} filename="reversed-words.txt" />
            </div>
          </div>
          <Textarea readOnly value={output} className="min-h-[120px] resize-y" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> all text processing runs locally in your browser.
        </p>
      </CardContent></Card>
    </div>
  );
}
