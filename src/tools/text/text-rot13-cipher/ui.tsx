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
  rotate,
  encode,
  decode,
  validateRot,
  allRotations,
  computeStats,
  rotationTable,
  historyToCsv,
  formatHistoryEntry,
  ROT_PRESETS,
  type RotationHistoryEntry,
} from "./logic";
import { toast } from "sonner";

export default function Rot13Cipher() {
  const [input, setInput] = useState("");
  const [rot, setRot] = useState(13);
  const [rotateDigits, setRotateDigits] = useState(false);
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [history, setHistory] = useState<RotationHistoryEntry[]>([]);

  useEffect(() => {
    try {
      const s = localStorage.getItem("rot13-history");
      if (s) setHistory(JSON.parse(s));
    } catch {
      /* ignore */
    }
  }, []);

  const validation = useMemo(() => validateRot(rot), [rot]);
  const output = useMemo(() => {
    if (!input) return "";
    if (typeof validation !== "number") return "";
    return mode === "encode"
      ? encode(input, validation, rotateDigits)
      : decode(input, validation, rotateDigits);
  }, [input, validation, mode, rotateDigits]);

  const stats = useMemo(() => (input ? computeStats(input, rot, rotateDigits) : null), [input, rot, rotateDigits]);
  const variants = useMemo(() => (input ? allRotations(input, rotateDigits) : []), [input, rotateDigits]);
  const table = useMemo(() => rotationTable(rot), [rot]);

  const saveHistory = useCallback((next: RotationHistoryEntry[]) => {
    setHistory(next);
    try {
      localStorage.setItem("rot13-history", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const onSave = useCallback(() => {
    if (!input || !output) return;
    saveHistory([{ ts: Date.now(), rot, input, output }, ...history].slice(0, 20));
    toast.success("Saved to history");
  }, [input, output, rot, history, saveHistory]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Rotation (1-25)</Label>
              <Input
                type="number"
                min={1}
                max={25}
                aria-label="Rotation amount"
                value={rot}
                onChange={(e) => setRot(Math.max(1, Math.min(25, Number(e.target.value) || 1)))}
                className="w-28"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant={mode === "encode" ? "default" : "outline"} onClick={() => setMode("encode")}>Encode</Button>
              <Button size="sm" variant={mode === "decode" ? "default" : "outline"} onClick={() => setMode("decode")}>Decode</Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={rotateDigits} onChange={(e) => setRotateDigits(e.target.checked)} />
              Rotate digits
            </label>
            <Button variant="outline" size="sm" onClick={() => { setRot(13); toast.info("ROT13 applied"); }}>ROT13</Button>
            <Button variant="ghost" size="sm" onClick={() => { setInput("Hello, World!"); toast.info("Sample loaded"); }}>Sample</Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROT_PRESETS.map((p) => (
              <Button key={p.name} variant="ghost" size="sm" className="h-7 text-xs" title={p.description} onClick={() => setRot(p.rot)}>
                {p.name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rot-input">Input</Label>
          <Textarea
            id="rot-input"
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
              <DownloadButton getText={() => output} filename="rot13-output.txt" disabled={!output} />
            </div>
          </div>
          <pre className="min-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-3 font-mono text-sm">
            {output || <span className="text-muted-foreground">Output will appear here…</span>}
          </pre>
        </div>
      </div>

      {typeof validation !== "number" && validation && input && (
        <ErrorBanner message={validation.error} />
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total chars</p><p className="text-lg font-bold">{stats.chars}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Letters</p><p className="text-lg font-bold">{stats.lettersRotated}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Digits</p><p className="text-lg font-bold">{stats.digitsRotated}</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Preserved</p><p className="text-lg font-bold">{stats.preserved}</p></CardContent></Card>
        </div>
      )}

      {output && (
        <Button size="sm" variant="ghost" onClick={onSave}>Save to history</Button>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">History ({history.length})</CardTitle>
              <div className="flex gap-2">
                <DownloadButton getText={() => historyToCsv(history)} filename="rot13-history.csv" mime="text/csv" />
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

      {variants.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <Label className="text-sm font-medium mb-3 block">All rotations (ROT1 — ROT25)</Label>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {variants.map((v) => (
                <div
                  key={v.rot}
                  className={`flex items-start gap-2 rounded-md border p-2 text-xs ${v.rot === rot ? "border-primary/50 bg-primary/5" : "border-border/50"}`}
                >
                  <Badge variant="secondary" className="font-mono">ROT{v.rot}</Badge>
                  <span className="font-mono break-all">{v.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-medium mb-3 block">Alphabet map (ROT{rot})</Label>
          <div className="grid grid-cols-6 sm:grid-cols-13 gap-1 text-center text-xs font-mono">
            {table.map((row) => (
              <div key={row.from} className="rounded-md border border-border/50 p-1.5" title={`${row.from} → ${row.to}`}>
                <div className="font-bold">{row.from}</div>
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
            <strong className="text-foreground">Privacy:</strong> all rotation runs locally in your browser. History is stored in localStorage only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
