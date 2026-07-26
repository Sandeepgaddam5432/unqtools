"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  parseBatch,
  anonymityChecklist,
  verificationToCsv,
  type ProxyVerification,
} from "./logic";

const ANON_COLOR: Record<string, string> = {
  transparent: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  anonymous: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  elite: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

export default function FreeProxyVerifier() {
  const [input, setInput] = useState("1.2.3.4:8080\nsocks5://user:pass@5.6.7.8:1080\nhttp://proxy.example.com:3128\n[::1]:8888");
  const [results, setResults] = useState<ProxyVerification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    try {
      setResults(parseBatch(input));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to verify proxies.");
    }
  }, [input]);

  const clear = useCallback(() => { setResults(null); setError(null); }, []);

  const checklist = anonymityChecklist();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Proxies (one per line)</Label>
            <textarea
              className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[140px] font-mono"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Proxy list"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Verify format</Button>
            <Button size="sm" variant="ghost" onClick={() => setInput("1.2.3.4:8080\nsocks5://user:pass@5.6.7.8:1080\nhttps://1.2.3.4:443")}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {results && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{results.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Valid</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{results.filter((r) => r.valid).length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Elite</p>
              <p className="text-2xl font-bold">{results.filter((r) => r.anonymity === "elite").length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Transparent</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{results.filter((r) => r.anonymity === "transparent").length}</p>
            </CardContent></Card>
          </div>

          {results.map((r, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <code className="text-sm font-mono break-all">{r.raw}</code>
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant={r.valid ? "default" : "destructive"}>{r.valid ? "Valid" : "Invalid"}</Badge>
                    {r.protocol !== "unknown" && <Badge variant="outline">{r.protocol}</Badge>}
                    {r.hostType !== "invalid" && <Badge variant="outline">{r.hostType}</Badge>}
                    {r.port !== null && <Badge variant="outline">:{r.port}</Badge>}
                    <Badge className={ANON_COLOR[r.anonymity]} variant="outline">{r.anonymity}</Badge>
                  </div>
                </div>
                {r.warnings.length > 0 && (
                  <div className="space-y-1">
                    {r.warnings.map((w, j) => <p key={j} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
                  </div>
                )}
                {r.notes.length > 0 && (
                  <div className="space-y-1">
                    {r.notes.map((n, j) => <p key={j} className="text-xs text-muted-foreground">• {n}</p>)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Runtime anonymity checklist</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2 text-sm">
              <p className="text-xs text-muted-foreground">Format validation is local. To verify actual anonymity, complete these checks through the proxy:</p>
              {checklist.map((c) => (
                <div key={c.label} className="flex gap-2">
                  <Badge variant="outline" className="self-start">{c.label}</Badge>
                  <span className="text-xs text-muted-foreground">{c.description}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export verification CSV</p>
              <div className="flex gap-2">
                <CopyButton getText={() => verificationToCsv(results)} label="Copy CSV" />
                <DownloadButton getText={() => verificationToCsv(results)} filename="proxy-verification.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
