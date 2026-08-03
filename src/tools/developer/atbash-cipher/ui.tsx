"use client";
import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "../../_shared";
import { toast } from "sonner";
import { atbashEncode, atbashEncodeGrouped, getStats, ALPHABET, ATBASH_MAP } from "./logic";
import { ArrowLeftRight, Group } from "lucide-react";

export default function AtbashCipher() {
  const [input, setInput] = useState("");
  const [grouped, setGrouped] = useState(false);
  const [groupSize, setGroupSize] = useState(5);

  const output = useMemo(() => {
    if (!input) return "";
    return grouped ? atbashEncodeGrouped(input, groupSize) : atbashEncode(input);
  }, [input, grouped, groupSize]);

  const stats = useMemo(() => getStats(input, output), [input, output]);
  const swap = useCallback(() => { setInput(output); }, [output]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={grouped} onCheckedChange={setGrouped} id="grouped" />
              <Label htmlFor="grouped" className="text-sm cursor-pointer">Group output</Label>
            </div>
            {grouped && (
              <div className="flex items-center gap-2">
                <Label className="text-xs">Group size:</Label>
                <input type="range" min={3} max={10} value={groupSize} onChange={e => setGroupSize(Number(e.target.value))} className="w-24" />
                <span className="text-sm font-mono">{groupSize}</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={swap} className="gap-1.5 ml-auto"><ArrowLeftRight className="h-3.5 w-3.5" />Use output as input</Button>
          </div>
          {/* Reference table */}
          <div className="mt-3 overflow-x-auto">
            <div className="flex gap-0 text-[10px] font-mono">
              {ALPHABET.split("").map((c, i) => (
                <div key={c} className="flex flex-col items-center w-6 text-center">
                  <span className="text-primary font-bold">{c}</span>
                  <span className="text-muted-foreground">↕</span>
                  <span className="text-emerald-600 font-bold">{ATBASH_MAP[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Input (plaintext or cipher)</Label>
            <Badge variant="outline" className="text-xs">{stats.alphaChars} alpha chars</Badge>
          </div>
          <Textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Type text to encode/decode…" className="min-h-[240px] font-mono text-sm resize-y" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Output</Label>
            {output && <CopyButton getText={() => output} />}
          </div>
          <pre className="min-h-[240px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-sm break-all">{output || <span className="text-muted-foreground">Output appears here…</span>}</pre>
        </div>
      </div>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> 100% client-side. Atbash is self-inverse — the same operation encodes and decodes.</p></CardContent></Card>
    </div>
  );
}
