"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { scrambleText } from "./logic";

export default function TextScrambler() {
  const [input, setInput] = useState("");
  const [seed, setSeed] = useState(42);

  const output = useMemo(() => scrambleText(input, seed), [input, seed]);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="ts-input">Input text</Label>
          <Textarea
            id="ts-input"
            placeholder="Type text to scramble middle letters…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[120px] resize-y"
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Random seed: {seed}</Label>
            <input
              type="range"
              min={1}
              max={9999}
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setInput("the quick brown fox jumps over the lazy dog")}>Load sample</Button>
            <Button size="sm" variant="ghost" onClick={() => setSeed(Math.floor(Math.random() * 9999) + 1)}>Randomize seed</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {output && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Scrambled output</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => output} />
                <DownloadButton getText={() => output} filename="scrambled.txt" />
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
            <strong className="text-foreground">Privacy:</strong> all scrambling runs locally in your browser.
            First and last letters are preserved; middle letters are shuffled deterministically by your seed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
