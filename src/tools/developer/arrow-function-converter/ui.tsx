"use client";
import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "../../_shared";
import { toast } from "sonner";
import { convert, getStats, type Mode } from "./logic";
import { ArrowRight, ArrowLeft } from "lucide-react";

export default function ArrowFunctionConverter() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("to-arrow");
  const result = useMemo(() => input.trim() ? convert(input, mode) : null, [input, mode]);
  const stats = useMemo(() => getStats(input), [input]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant={mode === "to-arrow" ? "default" : "outline"} size="sm" onClick={() => setMode("to-arrow")} className="gap-1.5">
              <ArrowRight className="h-3.5 w-3.5" /> To Arrow
            </Button>
            <Button variant={mode === "to-function" ? "default" : "outline"} size="sm" onClick={() => setMode("to-function")} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" /> To Function
            </Button>
            <div className="ml-auto flex gap-2">
              <Badge variant="outline">{stats.functionCount} functions</Badge>
              <Badge variant="outline">{stats.arrowCount} arrows</Badge>
              {result && result.ok && <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{result.changes} lines changed</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Input Code</Label>
          <Textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Paste JS/TS code…" className="min-h-[300px] font-mono text-sm resize-y" spellCheck={false} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Output</Label>
            {result?.ok && <CopyButton getText={() => result.output} />}
          </div>
          <pre className="min-h-[300px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-sm">{result?.ok ? result.output : result?.ok === false ? result.error : <span className="text-muted-foreground">Output appears here…</span>}</pre>
        </div>
      </div>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> 100% client-side regex conversion. No code is sent anywhere.</p></CardContent></Card>
    </div>
  );
}
