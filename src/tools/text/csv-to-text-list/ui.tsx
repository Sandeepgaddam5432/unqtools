"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CopyButton } from "../../_shared";
import { toast } from "sonner";
import { csvToList, DEFAULT_OPTIONS, type CsvToListOptions } from "./logic";

export default function CsvToTextList() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<CsvToListOptions>(DEFAULT_OPTIONS);
  const output = useMemo(() => (input ? csvToList(input, opts) : ""), [input, opts]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ctl-delimiter" className="text-xs text-muted-foreground">Delimiter</Label>
              <Input id="ctl-delimiter" aria-label="CSV delimiter" value={opts.delimiter} onChange={(e) => setOpts({ ...opts, delimiter: e.target.value })} className="w-20" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ctl-separator" className="text-xs text-muted-foreground">Output separator</Label>
              <Input id="ctl-separator" aria-label="Output separator" value={opts.separator} onChange={(e) => setOpts({ ...opts, separator: e.target.value })} className="w-24" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Column</Label>
              <Input type="number" min={1} aria-label="Column number" value={opts.column ?? 1} onChange={(e) => setOpts({ ...opts, column: Number(e.target.value) })} className="w-20" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!opts.dedupe} onCheckedChange={(c) => setOpts({ ...opts, dedupe: c })} id="ctl-dedupe" />
              <Label htmlFor="ctl-dedupe" className="text-sm cursor-pointer">Dedupe</Label>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setInput("name,city\nAlice,NYC\nBob,SF\nAlice,NYC"); toast.info("Sample loaded"); }}>
              Sample
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ctl-input">CSV input</Label>
          <Textarea id="ctl-input" placeholder="Paste CSV here…" value={input} onChange={(e) => setInput(e.target.value)} className="min-h-[180px] resize-y font-mono text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Text list output</Label>
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
