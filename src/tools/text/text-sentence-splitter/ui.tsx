"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  splitSentences,
  joinSentences,
  sentenceStats,
  formatAsList,
  parseAbbreviations,
  detectIssues,
  readingTime,
  DEFAULT_ABBREVIATIONS,
  type SplitOptions,
} from "./logic";

export default function SentenceSplitterUI() {
  const [text, setText] = useState(
    "Dr. Smith went to the store. He bought apples, oranges, and bananas! Then he said \"Hello. How are you?\" to his neighbor. The total was $3.14.",
  );
  const [keepDelimiter, setKeepDelimiter] = useState(true);
  const [respectQuotes, setRespectQuotes] = useState(true);
  const [customAbbr, setCustomAbbr] = useState("");
  const [listFormat, setListFormat] = useState<"numbered" | "bulleted" | "plain">("numbered");

  const options: SplitOptions = useMemo(
    () => ({
      abbreviations: [...DEFAULT_ABBREVIATIONS, ...parseAbbreviations(customAbbr)],
      keepDelimiter,
      respectQuotes,
    }),
    [customAbbr, keepDelimiter, respectQuotes],
  );

  const sentences = useMemo(() => splitSentences(text, options), [text, options]);
  const stats = useMemo(() => sentenceStats(text, options), [text, options]);
  const issues = useMemo(() => detectIssues(text, options), [text, options]);
  const rt = useMemo(() => readingTime(text), [text]);
  const formatted = useMemo(() => formatAsList(sentences, listFormat), [sentences, listFormat]);
  const rejoined = useMemo(() => joinSentences(sentences), [sentences]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Input text</Label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full min-h-[140px] rounded-md border bg-background p-2 text-sm"
            aria-label="Input text"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Custom abbreviations (comma or newline separated)</Label>
              <textarea
                value={customAbbr}
                onChange={(e) => setCustomAbbr(e.target.value)}
                className="w-full min-h-[60px] rounded-md border bg-background p-2 text-xs font-mono"
                placeholder="e.g. Frobnicate, WidgetCo"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={keepDelimiter} onChange={(e) => setKeepDelimiter(e.target.checked)} />
                Keep delimiter (. ! ?) on each sentence
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={respectQuotes} onChange={(e) => setRespectQuotes(e.target.checked)} />
                Don't split inside quotes
              </label>
              <div>
                <Label className="text-xs text-muted-foreground">List format</Label>
                <select
                  value={listFormat}
                  onChange={(e) => setListFormat(e.target.value as typeof listFormat)}
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="numbered">Numbered (1. 2. 3.)</option>
                  <option value="bulleted">Bulleted (•)</option>
                  <option value="plain">Plain (one per line)</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Sentences</p>
          <p className="text-2xl font-bold">{stats.count}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Avg words</p>
          <p className="text-2xl font-bold">{stats.avgWords}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Avg chars</p>
          <p className="text-2xl font-bold">{stats.avgChars}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Reading time</p>
          <p className="text-2xl font-bold">{rt}s</p>
        </div>
        <div className="rounded-md border p-3 bg-primary/5">
          <p className="text-xs text-muted-foreground">Issues</p>
          <p className="text-2xl font-bold">{issues.length}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-sm font-medium">Split sentences ({sentences.length})</Label>
            <CopyButton getText={() => formatted} />
            <DownloadButton getText={() => formatted} filename="sentences.txt" />
          </div>
          <pre className="w-full min-h-[120px] rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{formatted}</pre>
        </CardContent>
      </Card>

      {issues.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium text-amber-600">Potential issues ({issues.length})</p>
            <ul className="text-xs space-y-1">
              {issues.slice(0, 10).map((i, idx) => (
                <li key={idx} className="font-mono">
                  <span className="text-amber-600">[{i.type}]</span> {i.sample}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">Re-joined (sanity check)</p>
          <pre className="w-full min-h-[60px] rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap">{rejoined}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> 100% local. Handles abbreviations (Dr., Mr., U.S.), decimals (3.14), initials (J.R.R. Tolkien), and quoted text. Add custom abbreviations for domain-specific terms.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
