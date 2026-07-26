"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  process, statsToCsv, validatePattern, batchProcess, batchToCsv,
  stats, type RedactOptions,
} from "./logic";

const TOGGLES: { key: keyof RedactOptions; label: string }[] = [
  { key: "redactEmails", label: "Emails" },
  { key: "redactPhones", label: "Phones" },
  { key: "redactSsns", label: "SSNs" },
  { key: "redactCreditCards", label: "Credit cards" },
  { key: "redactIps", label: "IPs" },
  { key: "redactUrls", label: "URLs" },
  { key: "redactZipCodes", label: "Zip codes" },
];

export default function TextRedactor() {
  const [input, setInput] = useState("Contact alice@example.com or call (555) 123-4567. SSN: 123-45-6789. Server: 192.168.1.1. URL: https://example.com");
  const [opts, setOpts] = useState<RedactOptions>({
    redactEmails: true, redactPhones: true, redactSsns: true,
    redactCreditCards: true, redactIps: true, redactUrls: true, redactZipCodes: false,
  });
  const [customWords, setCustomWords] = useState("");
  const [customPatterns, setCustomPatterns] = useState("");
  const [replacement, setReplacement] = useState("█".repeat(8));
  const [batch, setBatch] = useState("Email a@b.com\nIP 1.2.3.4\nSSN 123-45-6789");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    queueMicrotask(() => setError(null));
    const useOpts: RedactOptions = {
      ...opts,
      replacement,
      customWords: customWords ? customWords.split(",").map((w) => w.trim()).filter(Boolean) : undefined,
      customPatterns: customPatterns
        ? customPatterns.split("\n").filter(Boolean).map((line) => {
            const [name, pattern, flags] = line.split(",").map((s) => s?.trim() ?? "");
            return { name: name || "custom", pattern: pattern || "", flags: flags || "g" };
          })
        : undefined,
    };
    const r = process(input, useOpts);
    if ("error" in r) { queueMicrotask(() => setError(r.error)); return null; }
    return r;
  }, [input, opts, customWords, replacement, customPatterns]);

  const batchResult = useMemo(() => batchProcess(
    batch.split("\n").filter(Boolean),
    { ...opts, replacement },
  ), [batch, opts, replacement]);

  const csv = useMemo(() => result ? statsToCsv(result) : "", [result]);
  const stat = useMemo(() => result ? stats(result) : null, [result]);

  const patternValidation = useMemo(() => {
    return customPatterns.split("\n").filter(Boolean).map((line) => {
      const [name, pattern, flags] = line.split(",").map((s) => s?.trim() ?? "");
      if (!pattern) return { name, ok: false };
      return { name, ok: validatePattern(pattern, flags || "g").ok === true };
    });
  }, [customPatterns]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {TOGGLES.map((t) => (
              <label key={String(t.key)} className="flex items-center gap-2">
                <input type="checkbox" checked={Boolean(opts[t.key])} onChange={(e) => setOpts({ ...opts, [t.key]: e.target.checked })} />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Custom words (comma)</Label>
              <Input value={customWords} onChange={(e) => setCustomWords(e.target.value)} placeholder="secret,classified" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Replacement token</Label>
              <Input value={replacement} onChange={(e) => setReplacement(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setInput("Email a@b.com IP 10.0.0.1 SSN 123-45-6789"); }}>Load sample</Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Custom patterns (name,pattern,flags per line)</Label>
            <textarea value={customPatterns} onChange={(e) => setCustomPatterns(e.target.value)} rows={2} className="w-full rounded-md border bg-background p-2 text-sm font-mono" />
            {patternValidation.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {patternValidation.map((p, i) => (
                  <Badge key={i} variant={p.ok ? "outline" : "destructive"}>{p.name}: {p.ok ? "OK" : "invalid"}</Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{result.totalRedacted} redacted</Badge>
              {Object.entries(result.redactionCounts).map(([k, v]) => (
                <Badge key={k} variant="outline">{k}: {v}</Badge>
              ))}
              {stat && stat.mostRedacted && <Badge variant="outline">Most: {stat.mostRedacted}</Badge>}
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => result.output} />
                <DownloadButton getText={() => csv} filename="redaction-stats.csv" mime="text/csv" />
              </div>
            </div>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
            <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all">{result.output}</pre>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Batch (one input per line)</Label>
          {batchResult.length > 0 && <CopyButton getText={() => batchToCsv(batchResult)} label="Copy batch" />}
        </div>
        <textarea value={batch} onChange={(e) => setBatch(e.target.value)} rows={3} className="w-full rounded-md border bg-background p-2 text-sm font-mono" />
        {batchResult.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {batchResult.map((r) => (
              <div key={r.i} className="rounded-md border p-2 text-xs">
                <p className="text-muted-foreground">#{r.i + 1}</p>
                <p className="font-mono">{"error" in r.result ? "err" : `${r.result.totalRedacted} redacted`}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all redaction runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
