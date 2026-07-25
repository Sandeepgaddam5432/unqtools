"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton } from "../../_shared";
import { rainbowHtml, PALETTES, type RainbowPalette } from "./logic";

const PALETTE_KEYS = Object.keys(PALETTES) as RainbowPalette[];

export default function TextRainbowText() {
  const [input, setInput] = useState("");
  const [palette, setPalette] = useState<RainbowPalette>("rainbow");
  const [animate, setAnimate] = useState(false);

  const html = useMemo(() => rainbowHtml(input, palette, animate), [input, palette, animate]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="rt-input">Input text</Label>
          <Textarea
            id="rt-input"
            placeholder="Type text to rainbow-color…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[100px] resize-y"
          />
          <Label className="text-sm font-medium">Color palette</Label>
          <div className="flex flex-wrap gap-2">
            {PALETTE_KEYS.map((p) => (
              <Button
                key={p}
                variant={palette === p ? "default" : "outline"}
                size="sm"
                onClick={() => setPalette(p)}
              >
                {p}
              </Button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />
            Animate color fade
          </label>
          <Button size="sm" variant="ghost" onClick={() => setInput("Rainbow Text Generator")}>Load sample</Button>
        </CardContent>
      </Card>

      {html && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Preview</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => html} />
                <DownloadButton getText={() => html} filename="rainbow.html" mime="text/html" />
              </div>
            </div>
            <div
              className="rounded-md border bg-muted/30 p-4 text-xl font-bold break-words"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </CardContent>
        </Card>
      )}

      {html && (
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm font-medium mb-2 block">HTML code</Label>
            <Textarea readOnly value={html} className="min-h-[100px] resize-y font-mono text-xs" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all color generation runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
