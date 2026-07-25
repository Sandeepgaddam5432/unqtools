"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { addAccents, addCyclingAccents, type AccentType } from "./logic";

const ACCENTS: { value: AccentType | "cycle"; label: string }[] = [
  { value: "acute", label: "Acute (á)" },
  { value: "grave", label: "Grave (à)" },
  { value: "circumflex", label: "Circumflex (â)" },
  { value: "umlaut", label: "Umlaut (ä)" },
  { value: "tilde", label: "Tilde (ã)" },
  { value: "cycle", label: "Cycle all" },
];

export default function TextAccentAdder() {
  const [input, setInput] = useState("Hello world");
  const [accent, setAccent] = useState<AccentType | "cycle">("acute");
  const [error, setError] = useState<string | null>(null);

  const output = useMemo(() => {
    try {
      setError(null);
      return accent === "cycle" ? addCyclingAccents(input) : addAccents(input, accent);
    } catch (e) {
      setError((e as Error).message);
      return "";
    }
  }, [input, accent]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Input text</Label>
          <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <Button key={a.value} size="sm" variant={accent === a.value ? "default" : "outline"} onClick={() => setAccent(a.value)}>{a.label}</Button>
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
              <DownloadButton getText={() => output} filename="accented.txt" disabled={!output} />
            </div>
          </div>
          <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all min-h-[80px]">{output || "—"}</pre>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all processing runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
