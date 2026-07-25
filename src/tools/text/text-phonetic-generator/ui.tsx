"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { toPhonetic, toPhoneticDetailed, type PhoneticScheme } from "./logic";

const SCHEMES: { value: PhoneticScheme; label: string }[] = [
  { value: "nato", label: "NATO" },
  { value: "international", label: "International" },
  { value: "faa", label: "FAA" },
];

export default function TextPhoneticGenerator() {
  const [input, setInput] = useState("SOS");
  const [scheme, setScheme] = useState<PhoneticScheme>("nato");
  const [detailed, setDetailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const output = useMemo(() => {
    try {
      setError(null);
      return detailed ? toPhoneticDetailed(input, scheme) : toPhonetic(input, scheme);
    } catch (e) {
      setError((e as Error).message);
      return "";
    }
  }, [input, scheme, detailed]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Input text</Label>
          <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {SCHEMES.map((s) => (
              <Button key={s.value} size="sm" variant={scheme === s.value ? "default" : "outline"} onClick={() => setScheme(s.value)}>{s.label}</Button>
            ))}
            <Button size="sm" variant={detailed ? "default" : "outline"} onClick={() => setDetailed(!detailed)}>{detailed ? "Detailed" : "Compact"}</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Phonetic output</Label>
            <div className="flex gap-2">
              <CopyButton getText={() => output} disabled={!output} />
              <DownloadButton getText={() => output} filename="phonetic.txt" disabled={!output} />
            </div>
          </div>
          <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all min-h-[80px]">{output || "—"}</pre>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all processing runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
