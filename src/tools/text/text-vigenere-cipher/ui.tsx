"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  vigenereWithOptions,
  validateOptions,
  textStats,
  findPreset,
  PRESETS,
  type VigenereOptions,
  type VigenereMode,
} from "./logic";
import { toast } from "sonner";

export default function VigenereCipher() {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState<VigenereOptions>({
    keyword: "LEMON", mode: "encrypt", autokey: false, preserveNonLetters: true,
  });
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(() => validateOptions(opts), [opts]);
  const output = useMemo(() => {
    if (!input) return "";
    if ("error" in validation) { queueMicrotask(() => setError(validation.error)); return ""; }
    queueMicrotask(() => setError(null));
    return vigenereWithOptions(input, opts);
  }, [input, opts, validation]);
  const stats = useMemo(() => textStats(input), [input]);

  const applyPreset = (id: string) => {
    const p = findPreset(id);
    if (p) setOpts((o) => ({ ...o, ...p.options }));
  };

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Presets</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {PRESETS.map((p) => (
              <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>{p.label}</Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2">
            <Button variant={opts.mode === "encrypt" ? "default" : "outline"} size="sm" onClick={() => setOpts({ ...opts, mode: "encrypt" })}>Encrypt</Button>
            <Button variant={opts.mode === "decrypt" ? "default" : "outline"} size="sm" onClick={() => setOpts({ ...opts, mode: "decrypt" })}>Decrypt</Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Keyword</Label>
            <Input type="text" aria-label="Keyword" value={opts.keyword} onChange={(e) => setOpts({ ...opts, keyword: e.target.value })} className="w-40 font-mono" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={opts.autokey} onChange={(e) => setOpts({ ...opts, autokey: e.target.checked })} />
            Autokey mode
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={opts.preserveNonLetters} onChange={(e) => setOpts({ ...opts, preserveNonLetters: e.target.checked })} />
            Preserve non-letters
          </label>
          <Button variant="ghost" size="sm" onClick={() => { setInput("ATTACKATDAWN"); setOpts((o) => ({ ...o, keyword: "LEMON" })); toast.info("Sample loaded"); }}>Sample</Button>
        </div>
      </CardContent></Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="vig-input">Input <span className="text-xs text-muted-foreground">({stats.letters} letters · {stats.total} chars)</span></Label>
          <Textarea id="vig-input" placeholder="Type text…" value={input} onChange={(e) => setInput(e.target.value)} className="min-h-[180px] resize-y font-mono text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Output</Label>
            {output && (
              <div className="flex gap-2">
                <CopyButton getText={() => output} />
                <DownloadButton getText={() => output} filename="vigenere-output.txt" />
              </div>
            )}
          </div>
          <pre className="min-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/30 p-3 font-mono text-sm">
            {output || <span className="text-muted-foreground">Output will appear here…</span>}
          </pre>
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> all encryption/decryption runs locally in your browser. The keyword never leaves your machine.
        </p>
      </CardContent></Card>
    </div>
  );
}
