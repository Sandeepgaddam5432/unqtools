"use client";
import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { addLineNumbers, removeLineNumbers, getStats, type LineNumberOptions } from "./logic";
import { ListOrdered, Hash, RotateCcw } from "lucide-react";

export default function AddLineNumbers() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [start, setStart] = useState(1);
  const [step, setStep] = useState(1);
  const [padding, setPadding] = useState(0);
  const [format, setFormat] = useState<LineNumberOptions["format"]>("plain");
  const [position, setPosition] = useState<"before" | "after">("before");
  const [skipEmpty, setSkipEmpty] = useState(false);
  const [sep, setSep] = useState(" ");
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => getStats(input), [input]);

  const run = useCallback(() => {
    const r = addLineNumbers(input, { start, step, padding, format, position, skipEmpty, separator: sep });
    if (r.ok) { setOutput(r.output); toast.success(`${r.lineCount} lines numbered`); }
    else { setError(r.error); setOutput(""); }
  }, [input, start, step, padding, format, position, skipEmpty, sep]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Start</Label>
              <Input type="number" value={start} onChange={e => setStart(Number(e.target.value))} className="w-20 h-9" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Step</Label>
              <Input type="number" value={step} onChange={e => setStep(Number(e.target.value))} className="w-20 h-9" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Padding</Label>
              <Input type="number" value={padding} onChange={e => setPadding(Number(e.target.value))} className="w-20 h-9" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Format</Label>
              <Select value={format} onValueChange={v => setFormat(v as LineNumberOptions["format"])}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="plain">Plain</SelectItem>
                  <SelectItem value="brackets">[n]</SelectItem>
                  <SelectItem value="parentheses">(n)</SelectItem>
                  <SelectItem value="dot">n.</SelectItem>
                  <SelectItem value="colon">n:</SelectItem>
                  <SelectItem value="pipe">| n |</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Position</Label>
              <Select value={position} onValueChange={v => setPosition(v as "before" | "after")}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Before</SelectItem>
                  <SelectItem value="after">After</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch checked={skipEmpty} onCheckedChange={setSkipEmpty} id="skip" />
              <Label htmlFor="skip" className="text-xs cursor-pointer">Skip empty</Label>
            </div>
            <Button onClick={run} className="gap-1.5"><ListOrdered className="h-3.5 w-3.5" />Add Numbers</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Input</Label>
            <Badge variant="outline" className="text-xs">{stats.lineCount} lines · {stats.charCount} chars</Badge>
          </div>
          <Textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Paste text here…" className="min-h-[300px] font-mono text-sm resize-y" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Output</Label>
            {output && <CopyButton getText={() => output} />}
          </div>
          <pre className="min-h-[300px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-sm">{output || <span className="text-muted-foreground">Output appears here…</span>}</pre>
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> 100% client-side. No data leaves your browser.</p></CardContent></Card>
    </div>
  );
}
