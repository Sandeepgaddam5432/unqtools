"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "../../_shared";
import { toast } from "sonner";
import { addLineBreaks, DEFAULT_OPTIONS, type AddLineBreaksOptions, type BreakStrategy } from "./logic";

export default function AddLineBreaks() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<AddLineBreaksOptions>(DEFAULT_OPTIONS);

  const output = useMemo(() => addLineBreaks(input, opts), [input, opts]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Strategy</Label>
              <select aria-label="Line break strategy"
                value={opts.strategy}
                onChange={(e) => setOpts({ ...opts, strategy: e.target.value as BreakStrategy })}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="wrap">Word-wrap at column</option>
                <option value="delimiter">Split on delimiter</option>
                <option value="chars">Break every N chars</option>
                <option value="words">Break every N words</option>
                <option value="sentences">Break every N sentences</option>
              </select>
            </div>
            {(opts.strategy === "wrap" || opts.strategy === "chars" || opts.strategy === "words" || opts.strategy === "sentences") && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  {opts.strategy === "wrap" ? "Column width" : opts.strategy === "chars" ? "Chars per break" : "Items per break"}
                </Label>
                <Input
                  type="number" aria-label="Column width or count"
                  value={opts.strategy === "wrap" ? opts.width ?? 80 : opts.count ?? 1}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (opts.strategy === "wrap") setOpts({ ...opts, width: v });
                    else setOpts({ ...opts, count: v });
                  }}
                  className="w-32"
                />
              </div>
            )}
            {opts.strategy === "delimiter" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Delimiter</Label>
                <Input value={opts.delimiter ?? ","} onChange={(e) => setOpts({ ...opts, delimiter: e.target.value })} className="w-32" />
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setInput("The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs."); toast.info("Sample loaded"); }}>
              Sample
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="alb-input">Input</Label>
          <Textarea id="alb-input" placeholder="Type text…" value={input} onChange={(e) => setInput(e.target.value)} className="min-h-[180px] resize-y" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Output</Label>
            {output && <CopyButton getText={() => output} />}
          </div>
          <pre className="min-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-3 font-mono text-sm">
            {output || <span className="text-muted-foreground">Output will appear here…</span>}
          </pre>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all processing runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
