"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { removeAccents, countAccentsRemoved, hasAccents } from "./logic";

export default function TextAccentRemover() {
  const [input, setInput] = useState("Café résumé über niño");
  const [error, setError] = useState<string | null>(null);

  const output = useMemo(() => {
    try { setError(null); return removeAccents(input); }
    catch (e) { setError((e as Error).message); return ""; }
  }, [input]);

  const removed = useMemo(() => countAccentsRemoved(input), [input]);
  const hadAccents = useMemo(() => hasAccents(input), [input]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Input text</Label>
          <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setInput("Café résumé über niño")}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => setInput("")}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Output ({output.length} chars · {removed} accents removed)</Label>
            <div className="flex gap-2">
              <CopyButton getText={() => output} disabled={!output} />
              <DownloadButton getText={() => output} filename="accents-removed.txt" disabled={!output} />
            </div>
          </div>
          <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all min-h-[80px]">{output || "—"}</pre>
          {!hadAccents && input.length > 0 && (
            <p className="text-xs text-muted-foreground">No accents detected in input.</p>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all processing runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
