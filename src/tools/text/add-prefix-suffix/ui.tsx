"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "../../_shared";
import { toast } from "sonner";
import { addPrefixSuffix, DEFAULT_OPTIONS, PRESETS, type PrefixSuffixOptions } from "./logic";

export default function AddPrefixSuffix() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<PrefixSuffixOptions>(DEFAULT_OPTIONS);
  const output = useMemo(() => addPrefixSuffix(input, opts), [input, opts]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Prefix</Label>
              <Input value={opts.prefix} onChange={(e) => setOpts({ ...opts, prefix: e.target.value })} className="w-32" placeholder="e.g. '" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Suffix</Label>
              <Input value={opts.suffix} onChange={(e) => setOpts({ ...opts, suffix: e.target.value })} className="w-32" placeholder="e.g. ," />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Counter start</Label>
              <Input type="number" aria-label="Counter start" value={opts.counterStart ?? 1} onChange={(e) => setOpts({ ...opts, counterStart: Number(e.target.value) })} className="w-24" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Counter token</Label>
              <Input value={opts.counterToken ?? ""} onChange={(e) => setOpts({ ...opts, counterToken: e.target.value })} className="w-24" placeholder="{n}" />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={() => { setInput("apple\nbanana\ncherry"); toast.info("Sample loaded"); }}>
                Sample
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setInput("")} disabled={!input}>
                Clear
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.name}
                variant="outline"
                size="sm"
                onClick={() => setOpts({ ...opts, prefix: p.prefix, suffix: p.suffix })}
              >
                {p.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="aps-input">Input (one item per line)</Label>
          <Textarea id="aps-input" placeholder="Type items…" value={input} onChange={(e) => setInput(e.target.value)} className="min-h-[180px] resize-y font-mono text-sm" />
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
