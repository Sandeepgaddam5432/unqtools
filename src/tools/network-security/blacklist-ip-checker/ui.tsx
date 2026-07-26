"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  checkIpBlacklist,
  resultToText,
  lookupsToCsv,
  BLACKLIST_DBS,
  type IpCheckResult,
} from "./logic";

export default function BlacklistIpChecker() {
  const [ip, setIp] = useState("8.8.8.8");
  const [result, setResult] = useState<IpCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    const r = checkIpBlacklist(ip);
    if ("error" in r) { setError(r.error); setResult(null); }
    else { setResult(r); setError(null); }
  }, [ip]);

  const clear = useCallback(() => { setResult(null); setError(null); }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">IP address (IPv4 or IPv6)</Label>
            <Input value={ip} onChange={(e) => setIp(e.target.value)} aria-label="IP address" placeholder="1.2.3.4 or 2001:db8::1" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={run}>Check</Button>
            <Button size="sm" variant="ghost" onClick={() => setIp("8.8.8.8")}>Sample IPv4</Button>
            <Button size="sm" variant="ghost" onClick={() => setIp("2001:db8::1")}>Sample IPv6</Button>
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">IP</p>
              <p className="text-lg font-bold break-all">{result.ip}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="text-lg font-bold uppercase">{result.ipType}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Lookups</p>
              <p className="text-2xl font-bold text-primary">{result.blacklistChecks.length}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">DNSBL lookups</CardTitle></CardHeader>
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
                    {Object.entries(db.returnCodes).map(([code, desc]) => (
                      <li key={code}><code>{code}</code> — {desc}</li>
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
              <p className="text-xs text-muted-foreground font-semibold">How to run the lookup:</p>
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
                <DownloadButton getText={() => lookupsToCsv(result)} filename="ip-blacklist-lookups.csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
