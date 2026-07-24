"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { process, statsToCsv, type RedactOptions } from "./logic";

export default function TextRedactor() {
  const [input, setInput] = useState("Contact alice@example.com or call (555) 123-4567. SSN: 123-45-6789. Server: 192.168.1.1");
  const [opts, setOpts] = useState<RedactOptions>({
    redactEmails: true, redactPhones: true, redactSsns: true,
    redactCreditCards: true, redactIps: true,
  });
  const [customWords, setCustomWords] = useState("");
  const [replacement, setReplacement] = useState("█".repeat(8));
  const [result, setResult] = useState<ReturnType<typeof process> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    setError(null);
    const useOpts: RedactOptions = {
      ...opts,
      replacement,
      customWords: customWords ? customWords.split(",").map((w) => w.trim()).filter(Boolean) : undefined,
    };
    const r = process(input, useOpts);
    if ("error" in r) { setError(r.error); setResult(null); }
    else setResult(r);
  }, [input, opts, customWords, replacement]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={opts.redactEmails ?? false} onChange={(e) => setOpts({ ...opts, redactEmails: e.target.checked })} /><span>Emails</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={opts.redactPhones ?? false} onChange={(e) => setOpts({ ...opts, redactPhones: e.target.checked })} /><span>Phones</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={opts.redactSsns ?? false} onChange={(e) => setOpts({ ...opts, redactSsns: e.target.checked })} /><span>SSNs</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={opts.redactCreditCards ?? false} onChange={(e) => setOpts({ ...opts, redactCreditCards: e.target.checked })} /><span>Credit cards</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={opts.redactIps ?? false} onChange={(e) => setOpts({ ...opts, redactIps: e.target.checked })} /><span>IPs</span></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Custom words (comma-separated)</Label>
              <Input value={customWords} onChange={(e) => setCustomWords(e.target.value)} placeholder="secret,classified" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Replacement</Label>
              <Input value={replacement} onChange={(e) => setReplacement(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Redact</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{result.totalRedacted} redacted</Badge>
              {Object.entries(result.redactionCounts).map(([k, v]) => (
                <Badge key={k} variant="outline">{k}: {v}</Badge>
              ))}
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => result.output} />
                <DownloadButton getText={() => statsToCsv(result)} filename="redaction-stats.csv" mime="text/csv" />
              </div>
            </div>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
            <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all">{result.output}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
