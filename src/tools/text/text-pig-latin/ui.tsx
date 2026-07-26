"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { toPigLatin, fromPigLatinText, type PigLatinSuffix } from "./logic";

export default function TextPigLatin() {
  const [input, setInput] = useState("Hello world");
  const [direction, setDirection] = useState<"to" | "from">("to");
  const [suffix, setSuffix] = useState<PigLatinSuffix>("ay");
  const [error, setError] = useState<string | null>(null);

  const output = useMemo(() => {
    try {
      queueMicrotask(() => setError(null));
      return direction === "to" ? toPigLatin(input, suffix) : fromPigLatinText(input);
    } catch (e) {
      queueMicrotask(() => setError((e as Error).message));
      return "";
    }
  }, [input, direction, suffix]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Input text</Label>
          <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={direction === "to" ? "default" : "outline"} onClick={() => setDirection("to")}>English → Pig Latin</Button>
            <Button size="sm" variant={direction === "from" ? "default" : "outline"} onClick={() => setDirection("from")}>Pig Latin → English</Button>
            {direction === "to" && (["ay", "way", "yay"] as PigLatinSuffix[]).map((s) => (
              <Button key={s} size="sm" variant={suffix === s ? "default" : "outline"} onClick={() => setSuffix(s)}>{s}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Output ({output.length} chars)</Label>
            <div className="flex gap-2">
              <CopyButton getText={() => output} disabled={!output} />
              <DownloadButton getText={() => output} filename="pig-latin.txt" disabled={!output} />
            </div>
          </div>
          <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all min-h-[80px]">{output || "—"}</pre>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all processing runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
