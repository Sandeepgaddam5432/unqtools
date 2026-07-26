"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  fixStyle,
  stats,
  countOxfordCommas,
  STYLE_INFO,
  explainChange,
  type Style,
} from "./logic";

export default function OxfordCommaFixerUI() {
  const [text, setText] = useState(
    "I bought apples, oranges and bananas. She likes tea, coffee, or milk. We had pizza, pasta as well as salad.",
  );
  const [style, setStyle] = useState<Style>("apa");

  const fixed = useMemo(() => fixStyle(text, { style }), [text, style]);
  const sBefore = useMemo(() => stats(text, { style }), [text, style]);
  const sAfter = useMemo(() => stats(fixed, { style }), [fixed, style]);
  const explanation = useMemo(() => explainChange(text, fixed, { style }), [text, fixed, style]);
  const added = useMemo(() => countOxfordCommas(fixed, { style }) - countOxfordCommas(text, { style }), [text, fixed, style]);

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
          <div className="flex flex-wrap gap-3 items-center">
            <div>
              <Label className="text-xs text-muted-foreground">Style guide</Label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as Style)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                {Object.entries(STYLE_INFO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground max-w-md">{STYLE_INFO[style].description}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-sm font-medium">Fixed output</Label>
            <CopyButton getText={() => fixed} />
            <DownloadButton getText={() => fixed} filename="oxford-fixed.txt" />
            <span className="text-xs text-muted-foreground ml-auto">{explanation}</span>
          </div>
          <pre className="w-full min-h-[100px] rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{fixed}</pre>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Lists detected</p>
          <p className="text-2xl font-bold">{sBefore.listCount}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Oxford commas (before)</p>
          <p className="text-2xl font-bold">{sBefore.oxfordCommas}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Oxford commas (after)</p>
          <p className="text-2xl font-bold">{sAfter.oxfordCommas}</p>
        </div>
        <div className="rounded-md border p-3 bg-primary/5">
          <p className="text-xs text-muted-foreground">Change</p>
          <p className="text-2xl font-bold">{added > 0 ? `+${added}` : added}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all parsing runs locally. AP style omits the Oxford comma unless an item contains a conjunction (ambiguity check).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
