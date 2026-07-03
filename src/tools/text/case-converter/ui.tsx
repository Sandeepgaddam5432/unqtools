"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton } from "../../_shared";
import { toast } from "sonner";
import { CASE_OPTIONS, convertCase, type CaseType } from "./logic";

export default function CaseConverter() {
  const [input, setInput] = useState("");
  const results = useMemo(() => {
    const r: Record<string, string> = {};
    for (const opt of CASE_OPTIONS) r[opt.value] = convertCase(input, opt.value);
    return r;
  }, [input]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cc-input">Input text</Label>
        <Textarea
          id="cc-input"
          placeholder="Type or paste text here…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-h-[140px] resize-y"
        />
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => { setInput("The quick brown fox jumps over the lazy dog"); toast.info("Sample loaded"); }}>
          Load sample
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setInput("")} disabled={!input}>
          Clear
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CASE_OPTIONS.map((opt) => (
          <Card key={opt.value}>
            <CardContent className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">e.g. {opt.example}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <CopyButton getText={() => results[opt.value] ?? ""} size="sm" />
                  <DownloadButton getText={() => results[opt.value] ?? ""} filename={`${opt.value}.txt`} size="sm" />
                </div>
              </div>
              <pre className="min-h-[56px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-2 font-mono text-sm">
                {results[opt.value] || ""}
              </pre>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all conversions run locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
