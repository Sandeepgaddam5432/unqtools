"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "../../_shared";
import { toast } from "sonner";
import { toMarkdown, DEFAULT_OPTIONS, type CsvToMarkdownOptions } from "./logic";

export default function CsvToMarkdown() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<CsvToMarkdownOptions>(DEFAULT_OPTIONS);
  const output = useMemo(() => (input ? toMarkdown(input, opts) : ""), [input, opts]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Delimiter</Label>
              <Input value={opts.delimiter} onChange={(e) => setOpts({ ...opts, delimiter: e.target.value })} className="w-20" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Header alignment</Label>
              <select
                value={opts.alignment}
                onChange={(e) => setOpts({ ...opts, alignment: e.target.value as "left" | "center" | "right" })}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setInput("name,age,city\nAlice,30,NYC\nBob,25,SF"); toast.info("Sample loaded"); }}>
              Sample
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ctm-input">CSV input</Label>
          <Textarea id="ctm-input" placeholder="Paste CSV here…" value={input} onChange={(e) => setInput(e.target.value)} className="min-h-[180px] resize-y font-mono text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Markdown output</Label>
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
            <strong className="text-foreground">Privacy:</strong> all conversion runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
