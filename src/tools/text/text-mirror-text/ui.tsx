"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton } from "../../_shared";
import { mirrorHorizontal, mirrorVertical, mirrorBoth, type MirrorMode } from "./logic";

const MODES: { value: MirrorMode; label: string }[] = [
  { value: "horizontal", label: "Horizontal (backwards)" },
  { value: "vertical", label: "Vertical (upside-down)" },
  { value: "both", label: "Both" },
];

export default function TextMirrorText() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<MirrorMode>("horizontal");

  const output = useMemo(() => {
    if (mode === "horizontal") return mirrorHorizontal(input);
    if (mode === "vertical") return mirrorVertical(input);
    return mirrorBoth(input);
  }, [input, mode]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="tm-input">Input text</Label>
          <Textarea
            id="tm-input"
            placeholder="Type text to mirror…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[120px] resize-y"
          />
          <Label className="text-sm font-medium">Mirror mode</Label>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <Button
                key={m.value}
                variant={mode === m.value ? "default" : "outline"}
                size="sm"
                onClick={() => setMode(m.value)}
              >
                {m.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setInput("hello world\nmirror me")}>Load sample</Button>
            <Button size="sm" variant="ghost" onClick={() => setInput("")}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {output && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Mirrored output</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => output} />
                <DownloadButton getText={() => output} filename="mirrored.txt" />
              </div>
            </div>
            <Textarea readOnly value={output} className="min-h-[120px] resize-y" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all mirroring runs locally in your browser.
            Vertical mirror uses Unicode lookalikes; rendering varies by font.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
