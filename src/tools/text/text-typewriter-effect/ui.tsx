"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton } from "../../_shared";
import { validateOptions, typewriterHtml, typewriterCss, totalDuration } from "./logic";

export default function TextTypewriterEffect() {
  const [input, setInput] = useState("");
  const [cps, setCps] = useState(12);
  const [sentencePause, setSentencePause] = useState(4);
  const [commaPause, setCommaPause] = useState(2);

  const opts = useMemo(
    () => validateOptions({ cps, sentencePause, commaPause, loop: true }),
    [cps, sentencePause, commaPause],
  );

  const html = useMemo(() => typewriterHtml(input, opts), [input, opts]);
  const css = useMemo(() => typewriterCss(), []);
  const duration = useMemo(() => totalDuration(input, opts), [input, opts]);

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="tw-input">Input text</Label>
          <Textarea
            id="tw-input"
            placeholder="Type text to animate as typewriter…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[100px] resize-y"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Speed: {cps} cps</Label>
              <input type="range" min={1} max={60} value={cps} onChange={(e) => setCps(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Sentence pause: {sentencePause}×</Label>
              <input type="range" min={0} max={10} value={sentencePause} onChange={(e) => setSentencePause(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Comma pause: {commaPause}×</Label>
              <input type="range" min={0} max={10} value={commaPause} onChange={(e) => setCommaPause(Number(e.target.value))} className="w-full" />
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setInput("Hello, world. This is a typewriter effect.")}>Load sample</Button>
        </CardContent>
      </Card>

      {html && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Preview ({duration}ms)</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => html} />
                <DownloadButton getText={() => html} filename="typewriter.html" mime="text/html" />
              </div>
            </div>
            <div
              className="rounded-md border bg-muted/30 p-4 text-lg font-mono break-words"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all animation timing computed locally.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
