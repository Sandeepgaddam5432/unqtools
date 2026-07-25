"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { identify, type IdentificationResult } from "./logic";

export default function HashIdentifier() {
  const [input, setInput] = useState("");
  const result = useMemo<IdentificationResult | null>(() => (input.trim() ? identify(input) : null), [input]);

  const summary = useMemo(() => {
    if (!result) return "";
    const lines = [
      `Input: ${result.input}`,
      `Length: ${result.length}`,
      `Charset: ${result.charset}`,
      `Possible types: ${result.possibleTypes.map((t) => t.name).join(", ") || "none"}`,
      "",
      ...result.warnings.map((w) => `! ${w}`),
    ];
    return lines.join("\n");
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="hi-input" className="text-xs text-muted-foreground">Paste a hash string</Label>
            <Input
              id="hi-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. d41d8cd98f00b204e9800998ecf8427e"
              className="font-mono"
            />
          </div>
          {result && result.warnings.length > 0 && result.possibleTypes.length === 0 && (
            <ErrorBanner message={result.warnings.join("; ")} />
          )}
        </CardContent>
      </Card>

      {result && result.possibleTypes.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-emerald-600">{result.possibleTypes.length} match(es)</Badge>
              <span className="text-xs text-muted-foreground">{result.charset} · {result.length} chars · {result.length * 4} bits (approx)</span>
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => summary} label="Copy" />
                <DownloadButton getText={() => summary} filename="hash-id.txt" />
              </div>
            </div>
            <div className="space-y-1.5">
              {result.possibleTypes.map((t) => (
                <div key={t.name} className="rounded border bg-background p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{t.name}</span>
                    <Badge variant="outline" className="text-[10px]">{t.bitLength} bits</Badge>
                    <Badge variant="outline" className="text-[10px]">{t.hexLength} hex chars</Badge>
                  </div>
                  <p className="text-muted-foreground mt-1">{t.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result && result.warnings.length > 0 && result.possibleTypes.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-1">
            {result.warnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-700 dark:text-yellow-300">! {w}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all identification runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
