"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton } from "../../_shared";
import { toast } from "sonner";
import { toBubble, decodeBubble, getStyleA11y, STYLE_OPTIONS, type BubbleStyle } from "./logic";

export default function BubbleTextGenerator() {
  const [input, setInput] = useState("");
  const [style, setStyle] = useState<BubbleStyle>("circled");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const output = useMemo(
    () => (mode === "encode" ? toBubble(input, style) : decodeBubble(input)),
    [input, style, mode],
  );
  const a11y = getStyleA11y(style);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="btg-input">Input text</Label>
        <Textarea
          id="btg-input"
          placeholder={mode === "encode" ? "Type text to make bubble…" : "Paste bubble text to decode…"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-h-[100px] resize-y"
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Button variant={mode === "encode" ? "default" : "outline"} size="sm" onClick={() => setMode("encode")}>
              Encode
            </Button>
            <Button variant={mode === "decode" ? "default" : "outline"} size="sm" onClick={() => setMode("decode")}>
              Decode
            </Button>
          </div>
          {mode === "encode" && (
            <>
              <Label className="text-sm font-medium mb-2 block">Style</Label>
              <div className="flex flex-wrap gap-2 mb-3">
                {STYLE_OPTIONS.map((s) => (
                  <Button
                    key={s.value}
                    variant={style === s.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStyle(s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Accessibility:</strong> {a11y}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => { setInput("Hello World"); toast.info("Sample loaded"); }}>
          Load sample
        </Button>
      </div>

      {output && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Output</Label>
              <CopyButton getText={() => output} />
            </div>
            <div className="rounded-md border bg-muted/30 p-4 text-lg leading-relaxed break-all overflow-x-auto">
              {output}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all conversion runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
