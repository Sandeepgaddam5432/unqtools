"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton } from "../../_shared";
import { toast } from "sonner";
import { removeDuplicateLines, DEFAULT_OPTIONS, type DedupeOptions } from "./logic";

export default function DuplicateLinesRemover() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<DedupeOptions>(DEFAULT_OPTIONS);
  const result = useMemo(() => (input ? removeDuplicateLines(input, opts) : null), [input, opts]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={opts.caseSensitive} onCheckedChange={(c) => setOpts({ ...opts, caseSensitive: c })} id="dlr-cs" />
              <Label htmlFor="dlr-cs" className="text-sm cursor-pointer">Case-sensitive</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={opts.trimWhitespace} onCheckedChange={(c) => setOpts({ ...opts, trimWhitespace: c })} id="dlr-tw" />
              <Label htmlFor="dlr-tw" className="text-sm cursor-pointer">Trim whitespace</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!opts.keepEmpty} onCheckedChange={(c) => setOpts({ ...opts, keepEmpty: c })} id="dlr-ke" />
              <Label htmlFor="dlr-ke" className="text-sm cursor-pointer">Keep empty lines</Label>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setInput("apple\nbanana\napple\ncherry\nbanana"); toast.info("Sample loaded"); }}>
                Sample
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setInput("")} disabled={!input}>Clear</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dlr-input">Input</Label>
          <Textarea id="dlr-input" placeholder="Paste text…" value={input} onChange={(e) => setInput(e.target.value)} className="min-h-[180px] resize-y font-mono text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Output</Label>
            {result && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{result.uniqueCount} unique</Badge>
                <Badge variant="outline" className="text-xs">{result.removedCount} removed</Badge>
                <CopyButton getText={() => result.output} />
                <DownloadButton getText={() => result.output} filename="deduplicated.txt" />
              </div>
            )}
          </div>
          <pre className="min-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-3 font-mono text-sm">
            {result?.output || <span className="text-muted-foreground">Output will appear here…</span>}
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
