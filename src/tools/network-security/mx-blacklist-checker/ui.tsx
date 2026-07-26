"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  checkMxBlacklist,
  resultToText,
  lookupsToCsv,
  BLACKLIST_DBS,
  type MxCheckResult,
} from "./logic";

export default function MxBlacklistChecker() {
  const [domain, setDomain] = useState("example.com");
  const [mxInput, setMxInput] = useState("10 mail.example.com");
  const [result, setResult] = useState<MxCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = checkMxBlacklist(domain, mxInput);
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [domain, mxInput]);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  const sample = useCallback(() => {
    setDomain("acme.com");
    setMxInput("10 mail1.acme.com\n20 mail2.acme.com");
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Domain</Label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Domain" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">MX records (one per line, format: priority host)</Label>
            <textarea
              className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono"
              value={mxInput}
              onChange={(e) => setMxInput(e.target.value)}
              aria-label="MX records"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Check</Button>
            <Button size="sm" variant="ghost" onClick={sample}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Domain</p>
              <p className="text-lg font-bold break-all">{result.domain}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">MX records</p>
              <p className="text-2xl font-bold">{result.mxRecords.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Lookups to perform</p>
              <p className="text-2xl font-bold text-primary">{result.blacklistChecks.length}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">MX records</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-1">
              {result.mxRecords.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-mono">
                  <Badge variant="outline">P={m.priority}</Badge>
                  <span>{m.host}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Blacklist lookups</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              {result.blacklistChecks.map((c, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center text-xs">
                  <Badge variant="outline" className="col-span-3 justify-center">{c.db.name}</Badge>
                  <code className="col-span-7 font-mono break-all">{c.lookupTarget}</code>
                  <a href={c.db.website} target="_blank" rel="noopener noreferrer" className="col-span-2 text-primary text-right">info ↗</a>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Return-code reference</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-3 text-xs">
              {BLACKLIST_DBS.map((db) => (
                <div key={db.zone}>
                  <p className="font-semibold">{db.name} <span className="text-muted-foreground">({db.zone})</span></p>
                  <ul className="ml-4 text-muted-foreground">
                    {Object.entries(db.returnCodes).map(([ip, desc]) => (
                      <li key={ip}><code>{ip}</code> — {desc}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
              ))}
            </CardContent></Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-muted-foreground font-semibold">How to actually run the lookup:</p>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                {result.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Export lookups &amp; report</p>
              <div className="flex gap-2">
                <CopyButton getText={() => lookupsToCsv(result)} label="Copy CSV" />
                <CopyButton getText={() => resultToText(result)} label="Copy text" />
                <DownloadButton getText={() => lookupsToCsv(result)} filename="mx-blacklist-lookups.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
