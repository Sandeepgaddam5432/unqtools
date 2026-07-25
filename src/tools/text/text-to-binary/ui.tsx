"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  textToBinary,
  binaryToText,
  validateOptions,
  batchToCsv,
  textToBinaryBatch,
  historyToCsv,
  batchStats,
  asciiReferenceTable,
  type TextToBinaryOptions,
  type BitMode,
  type HistoryEntry,
} from "./logic";

type Direction = "encode" | "decode";

export default function TextToBinary() {
  const [input, setInput] = useState("Hello");
  const [bits, setBits] = useState<BitMode>(8);
  const [separator, setSeparator] = useState(" ");
  const [prefixMode, setPrefixMode] = useState<"none" | "0b" | "custom">("none");
  const [customPrefix, setCustomPrefix] = useState("");
  const [encoding, setEncoding] = useState<"codepoint" | "utf8">("codepoint");
  const [direction, setDirection] = useState<Direction>("encode");
  const [batchText, setBatchText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try { const s = localStorage.getItem("text-to-binary-history"); if (s) setHistory(JSON.parse(s)); } catch { /* ignore */ }
  }, []);

  const opts: TextToBinaryOptions = { bits, separator, uppercase: false, prefixMode, customPrefix, encoding };

  const singleResult = useMemo(() => {
    const v = validateOptions(opts);
    if ("error" in v) return { error: v.error };
    if (direction === "encode") return { value: textToBinary(input, opts) };
    const r = binaryToText(input, opts);
    if ("error" in r) return { error: r.error };
    return { value: r };
  }, [input, bits, separator, prefixMode, customPrefix, encoding, direction]);

  const batchLines = useMemo(() => batchText.split(/\r?\n/).filter((l) => l.length > 0), [batchText]);
  const batchResults = useMemo(() => (batchLines.length ? textToBinaryBatch(batchLines, opts) : []), [batchLines, opts]);
  const stats = useMemo(() => batchStats(batchResults), [batchResults]);

  useEffect(() => {
    setError(singleResult && "error" in singleResult ? singleResult.error : null);
  }, [singleResult]);

  const saveHistory = useCallback((next: HistoryEntry[]) => {
    setHistory(next);
    try { localStorage.setItem("text-to-binary-history", JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const run = useCallback(() => {
    if (!input || "error" in singleResult) return;
    const v = "value" in singleResult ? singleResult.value : null;
    if (!v) return;
    const entry: HistoryEntry = {
      ts: Date.now(),
      input,
      bits,
      groupCount: "groupCount" in v ? v.groupCount : v.groups,
      outputLength: "outputLength" in v ? v.outputLength : v.output.length,
    };
    saveHistory([entry, ...history].slice(0, 10));
  }, [input, singleResult, bits, history, saveHistory]);

  const refTable = useMemo(() => asciiReferenceTable().slice(0, 26), []);

  const output = singleResult && "value" in singleResult ? singleResult.value : null;
  const outputText = output ? ("output" in output ? output.output : output.output) : "";
  const outputGroupCount = output ? ("groupCount" in output ? output.groupCount : output.groups) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["encode", "decode"] as Direction[]).map((d) => (
              <Button key={d} size="sm" variant={direction === d ? "default" : "outline"} onClick={() => setDirection(d)}>
                {d === "encode" ? "Text → Binary" : "Binary → Text"}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">{direction === "encode" ? "Input text" : "Input binary"}</Label>
            <textarea
              className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Bits per group</Label>
              <select value={bits} onChange={(e) => setBits(Number(e.target.value) as BitMode)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value={7}>7 (ASCII)</option>
                <option value={8}>8 (UTF-8)</option>
                <option value={16}>16 (UTF-16)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Separator</Label>
              <Input value={separator} onChange={(e) => setSeparator(e.target.value)} placeholder="space" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Prefix</Label>
              <select value={prefixMode} onChange={(e) => setPrefixMode(e.target.value as "none" | "0b" | "custom")} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="none">none</option>
                <option value="0b">0b</option>
                <option value="custom">custom…</option>
              </select>
            </div>
            {prefixMode === "custom" && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Custom prefix</Label>
                <Input value={customPrefix} onChange={(e) => setCustomPrefix(e.target.value)} maxLength={8} />
              </div>
            )}
            {bits === 8 && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Encoding</Label>
                <select value={encoding} onChange={(e) => setEncoding(e.target.value as "codepoint" | "utf8")} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="codepoint">codepoint (Latin-1)</option>
                  <option value="utf8">UTF-8 bytes</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Convert & Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(direction === "encode" ? "Hello World" : "01001000 01101001"); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {output && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Output ({outputGroupCount} groups)</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => outputText} />
                <DownloadButton getText={() => outputText} filename={direction === "encode" ? "binary.txt" : "decoded.txt"} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 space-y-2">
            <pre className="text-sm overflow-x-auto p-4 bg-muted/40 font-mono whitespace-pre-wrap break-all">{outputText}</pre>
            <div className="flex flex-wrap gap-2 p-3 pt-0 text-xs">
              <Badge variant="outline">{bits}-bit</Badge>
              <Badge variant="secondary">{outputText.length} chars</Badge>
              {"warnings" in output && output.warnings.length > 0 && (
                <span className="text-yellow-700 dark:text-yellow-400">{output.warnings.join(" ")}</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch mode (one input per line)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea
            className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono"
            placeholder={"Hello\nWorld"}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
          />
          {batchResults.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex gap-2 text-xs">
                <Badge variant="outline">{batchResults.length} rows</Badge>
                <Badge variant="outline">{stats.totalGroups} groups</Badge>
                <Badge variant="outline">{stats.totalBits} bits</Badge>
                <Badge variant="secondary">density {stats.meanDensity}</Badge>
              </div>
              <DownloadButton getText={() => batchToCsv(batchResults, batchLines)} filename="binary-batch.csv" mime="text/csv" />
            </div>
          )}
          {batchResults.length > 0 && (
            <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono max-h-[200px] overflow-y-auto">
              {batchResults.map((r, i) => `${i + 1}\t${r.output}`).join("\n")}
            </pre>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History (last 10)</CardTitle>
              <div className="flex gap-2">
                <DownloadButton getText={() => historyToCsv(history)} filename="binary-history.csv" mime="text/csv" />
                <Button size="sm" variant="ghost" onClick={() => saveHistory([])}>Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.map((h, i) => (
                <li key={i} className="p-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  <span className="flex-1 truncate font-mono">{h.input}</span>
                  <Badge variant="outline">{h.bits}-bit · {h.groupCount}g</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">ASCII reference (A–Z)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs font-mono">
            {refTable.map((e) => (
              <div key={e.code} className="flex items-center gap-2 rounded border border-border/50 px-2 py-1">
                <span className="font-bold w-4">{e.char}</span>
                <span className="text-muted-foreground">{e.bits8}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> conversion runs locally in your browser. History stored only in your browser.</p></CardContent></Card>
    </div>
  );
}
