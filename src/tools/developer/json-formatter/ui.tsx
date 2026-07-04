"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, RunButton, ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import {
  formatJson,
  minifyJson,
  validateJson,
  WORKER_THRESHOLD_BYTES,
  type FormatOptions,
} from "./logic";

const SAMPLE = `{
  "name": "UnQTools",
  "version": "6.0.0",
  "tools": 22,
  "static": true,
  "features": ["offline", "private", "pwa"],
  "author": {
    "name": "Sandeep Gaddam",
    "url": "https://github.com/Sandeepgaddam5432"
  }
}`;

type Op = "format" | "minify" | "validate";

export default function JsonFormatter() {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<number>(2);
  const [sortKeys, setSortKeys] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastOp, setLastOp] = useState<Op | null>(null);

  const inputBytes = useMemo(() => new Blob([input]).size, [input]);
  const outputBytes = useMemo(() => new Blob([output]).size, [output]);
  const willUseWorker = inputBytes >= WORKER_THRESHOLD_BYTES;

  const run = useCallback(
    async (op: Op) => {
      setLastOp(op);
      if (!input.trim()) {
        setError("Input is empty.");
        setOutput("");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        let result;
        const opts: FormatOptions = { indent, sortKeys };
        if (op === "format") result = formatJson(input, opts);
        else if (op === "minify") result = minifyJson(input);
        else result = validateJson(input);

        if (result.ok) {
          setOutput(result.output);
          toast.success(`${op} succeeded`);
        } else {
          setError(result.error);
          setOutput("");
        }
      } catch (e) {
        setError((e as Error).message ?? "Unexpected error");
        setOutput("");
      } finally {
        setBusy(false);
      }
    },
    [input, indent, sortKeys],
  );

  const loadSample = useCallback(() => {
    setInput(SAMPLE);
    setOutput("");
    setError(null);
    toast.info("Sample loaded");
  }, []);

  const clear = useCallback(() => {
    setInput("");
    setOutput("");
    setError(null);
    setLastOp(null);
  }, []);

  const shareLink = useCallback(() => {
    try {
      const encoded = btoa(input);
      const url = `${window.location.origin}${window.location.pathname}?i=${encoded}`;
      navigator.clipboard.writeText(url).then(
        () => toast.success("Share link copied"),
        () => toast.error("Could not copy link"),
      );
    } catch {
      toast.error("Input too large to share via URL");
    }
  }, [input]);

  return (
    <div className="space-y-4">
      {/* Options bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Indent</Label>
              <Select
                value={String(indent)}
                onValueChange={(v) => setIndent(v === "tab" ? -1 : Number(v))}
              >
                <SelectTrigger className="w-32" aria-label="Indent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 spaces</SelectItem>
                  <SelectItem value="4">4 spaces</SelectItem>
                  <SelectItem value="tab">Tab</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={sortKeys} onCheckedChange={setSortKeys} id="sort-keys" />
              <Label htmlFor="sort-keys" className="text-sm cursor-pointer">
                Sort keys
              </Label>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <RunButton onClick={() => run("format")} disabled={busy} loading={busy} label="Format" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => run("minify")}
                disabled={busy}
              >
                Minify
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => run("validate")}
                disabled={busy}
              >
                Validate
              </Button>
              <Button variant="ghost" size="sm" onClick={loadSample}>
                Load sample
              </Button>
              <Button variant="ghost" size="sm" onClick={clear} disabled={!input && !output}>
                Clear
              </Button>
              <Button variant="ghost" size="sm" onClick={shareLink} disabled={!input}>
                Share link
              </Button>
            </div>
          </div>
          {willUseWorker && (
            <p className="mt-3 text-xs text-muted-foreground">
              Input ≥ 100 KB — large inputs are processed synchronously but may take a moment.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Input / Output grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="json-input">Input</Label>
            <Badge variant="outline" className="text-xs">
              {inputBytes.toLocaleString()} bytes
            </Badge>
          </div>
          <Textarea
            id="json-input"
            placeholder="Paste JSON here…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[320px] font-mono text-sm resize-y"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="json-output">Output</Label>
            <div className="flex items-center gap-2">
              {output && (
                <Badge variant="outline" className="text-xs">
                  {outputBytes.toLocaleString()} bytes · {lastOp}
                </Badge>
              )}
              {output && <CopyButton getText={() => output} />}
              {output && (
                <DownloadButton getText={() => output} filename="formatted.json" mime="application/json" />
              )}
            </div>
          </div>
          <pre
            id="json-output"
            className="min-h-[320px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-sm"
          >
            {output || <span className="text-muted-foreground">Output will appear here…</span>}
          </pre>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> your input never leaves
            your browser. Everything runs locally — including large files.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
