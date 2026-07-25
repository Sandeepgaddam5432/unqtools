"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { reverseWords, validateOptions } from "./logic";

export default function TextReverseWords() {
  const [input, setInput] = useState("");
  const [preserveEdges, setPreserveEdges] = useState(true);
  const [keepPunctuation, setKeepPunctuation] = useState(true);

  const opts = useMemo(() => validateOptions({ preserveEdges, keepPunctuation }), [preserveEdges, keepPunctuation]);
  const output = useMemo(() => reverseWords(input, opts), [input, opts]);
  const [error, setError] = useState<string | null>(null);

  const lineCount = useMemo(() => input.split("\n").length, [input]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="rw-input">Input text</Label>
          <Textarea
            id="rw-input"
            placeholder="Type text to reverse word order…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[120px] resize-y"
          />
          <p className="text-xs text-muted-foreground">{lineCount} line{lineCount === 1 ? "" : "s"}</p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={preserveEdges} onChange={(e) => setPreserveEdges(e.target.checked)} />
              Preserve leading/trailing whitespace
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={keepPunctuation} onChange={(e) => setKeepPunctuation(e.target.checked)} />
              Keep punctuation with adjacent word
            </label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setInput("hello world\nthe quick brown fox")}>Load sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {output && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Reversed output</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => output} />
                <DownloadButton getText={() => output} filename="reversed-words.txt" />
              </div>
            </div>
            <Textarea readOnly value={output} className="min-h-[120px] resize-y" />
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all text processing runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
