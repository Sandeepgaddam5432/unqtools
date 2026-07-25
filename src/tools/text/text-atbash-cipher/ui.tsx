"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  atbash,
  atbashTable,
  atbashBatch,
  computeStats,
  validateAlphabet,
  hasMirrors,
  historyToCsv,
  formatHistoryEntry,
  type AtbashHistoryEntry,
} from "./logic";
import { toast } from "sonner";

export default function AtbashCipher() {
  const [input, setInput] = useState("");
  const [alphabet, setAlphabet] = useState("");
  const [preserveNonAlpha, setPreserveNonAlpha] = useState(true);
  const [history, setHistory] = useState<AtbashHistoryEntry[]>([]);

  useEffect(() => {
    try {
      const s = localStorage.getItem("atbash-history");
      if (s) setHistory(JSON.parse(s));
    } catch {
      /* ignore */
    }
  }, []);

  const alphabetValidation = useMemo(() => validateAlphabet(alphabet || undefined), [alphabet]);

  const output = useMemo(() => {
    if (!input) return "";
    if ("error" in alphabetValidation) return "";
    return atbash(input, { alphabet: alphabet || undefined, preserveNonAlpha });
  }, [input, alphabet, preserveNonAlpha, alphabetValidation]);

  const stats = useMemo(() => (input ? computeStats(input) : null), [input]);
  const table = useMemo(() => {
    if ("error" in alphabetValidation) return [];
    return atbashTable(alphabet || undefined);
  }, [alphabet, alphabetValidation]);

  const batchOut = useMemo(() => {
    if (!input) return "";
    const lines = input.split(/\r?\n/);
    if (lines.length < 2) return "";
    return atbashBatch(lines, { alphabet: alphabet || undefined, preserveNonAlpha }).join("\n");
  }, [input, alphabet, preserveNonAlpha]);

  const saveHistory = useCallback((next: AtbashHistoryEntry[]) => {
    setHistory(next);
    try { localStorage.setItem("atbash-history", JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const onSave = useCallback(() => {
    if (!input || !output) return;
    saveHistory([{ ts: Date.now(), input, output }, ...history].slice(0, 20));
    toast.success("Saved to history");
  }, [input, output, history, saveHistory]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Custom alphabet (optional, 26 unique A-Z)</Label>
            <Input
              value={alphabet}
              onChange={(e) => setAlphabet(e.target.value.toUpperCase())}
              placeholder="Leave blank for ABCDEFGHIJKLMNOPQRSTUVWXYZ"
              className="font-mono"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={preserveNonAlpha} onChange={(e) => setPreserveNonAlpha(e.target.checked)} />
            Preserve non-letters
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setInput("Hello, World!"); toast.info("Sample loaded"); }}>Sample</Button>
            <Button variant="ghost" size="sm" onClick={() => { setInput(atbash(input, { alphabet: alphabet || undefined })); toast.info("Applied again (self-inverse)"); }} disabled={!input}>Apply again</Button>
          </div>
        </CardContent>
      </Card>

      {typeof alphabetValidation === "object" && "error" in alphabetValidation && (
        <ErrorBanner message={alphabetValidation.error} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="atbash-input">Input</Label>
          <Textarea
            id="atbash-input"
            placeholder="Type text…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[180px] resize-y font-mono text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Output</Label>
            <div className="flex gap-2">
              <CopyButton getText={() => output} disabled={!output} />
              <DownloadButton getText={() => output} filename="atbash-output.txt" disabled={!output} />
            </div>
          </div>
          <pre className="min-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-3 font-mono text-sm">
            {output || <span className="text-muted-foreground">Output will appear here…</span>}
          </pre>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total chars</p><p className="text-lg font-bold">{stats.chars}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Letters mirrored</p><p className="text-lg font-bold">{stats.lettersMirrored}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Preserved</p><p className="text-lg font-bold">{stats.preserved}</p></CardContent></Card>
        </div>
      )}

      {input && !hasMirrors(input) && (
        <p className="text-xs text-muted-foreground">No mirrorable letters detected in input.</p>
      )}

      {output && (
        <Button size="sm" variant="ghost" onClick={onSave}>Save to history</Button>
      )}

      {batchOut && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Batch output (one line per input line)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <pre className="text-xs overflow-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all">{batchOut}</pre>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History ({history.length})</CardTitle>
              <div className="flex gap-2">
                <DownloadButton getText={() => historyToCsv(history)} filename="atbash-history.csv" mime="text/csv" />
                <Button size="sm" variant="ghost" onClick={() => saveHistory([])}>Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.slice(0, 8).map((h, i) => (
                <li key={i} className="p-2 font-mono">{formatHistoryEntry(h)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-medium mb-3 block">Atbash mapping (A↔Z)</Label>
          <div className="grid grid-cols-7 sm:grid-cols-13 gap-1 text-center text-xs font-mono">
            {table.map((row) => (
              <div key={row.from + row.to} className="rounded-md border border-border/50 p-1.5" title={`${row.from} ↔ ${row.to}`}>
                <div className="font-bold text-foreground">{row.from}</div>
                <div className="text-muted-foreground">↓</div>
                <div className="font-bold text-primary">{row.to}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all ciphering runs locally in your browser. History is stored in localStorage only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
