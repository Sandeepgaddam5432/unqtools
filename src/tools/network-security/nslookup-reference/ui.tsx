"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  QUERY_TYPES, lookupQueryType, buildDigCommand, buildNslookupCommand,
  classifyTtl, TTL_REFERENCE, DNSSEC_REFERENCE, EDNS_REFERENCE,
  renderQueryTypesCsv, renderCheatSheet, renderQueryTypeReport,
  planBatch, getQueryTypes, type QueryType, type BatchLookup,
} from "./logic";

export default function NslookupReference() {
  const [domain, setDomain] = useState("example.com");
  const [type, setType] = useState<QueryType>("A");
  const [server, setServer] = useState("");
  const [port, setPort] = useState(53);
  const [tcp, setTcp] = useState(false);
  const [ttl, setTtl] = useState(3600);
  const [batchInput, setBatchInput] = useState("example.com A\nexample.com MX\ngoogle.com AAAA");
  const [error, setError] = useState("");

  const info = useMemo(() => lookupQueryType(type), [type]);
  const digCmd = useMemo(() => buildDigCommand({ domain, type, server: server || undefined, port, tcp }), [domain, type, server, port, tcp]);
  const nsCmd = useMemo(() => buildNslookupCommand({ domain, type, server: server || undefined, port }), [domain, type, server, port]);
  const ttlBucket = useMemo(() => classifyTtl(ttl), [ttl]);
  const cheatSheet = useMemo(() => renderCheatSheet(), []);
  const csv = useMemo(() => renderQueryTypesCsv(), []);

  const batch = useMemo(() => {
    queueMicrotask(() => setError(""));
    const lookups: BatchLookup[] = [];
    for (const line of batchInput.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [d, t] = trimmed.split(/\s+/);
      if (!d || !t) continue;
      if (!lookupQueryType(t as QueryType)) {
        queueMicrotask(() => setError(`Unknown query type '${t}' in batch input.`));
        return null;
      }
      lookups.push({ domain: d, type: t as QueryType });
    }
    return planBatch(lookups);
  }, [batchInput]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Domain</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} className="text-xs h-8 font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <select value={type} onChange={(e) => setType(e.target.value as QueryType)}
                className="h-8 w-full text-xs rounded border bg-background px-2 cursor-pointer">
                {getQueryTypes().map((q) => <option key={q.type} value={q.type}>{q.type}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Server (optional)</Label>
              <Input value={server} onChange={(e) => setServer(e.target.value)} placeholder="8.8.8.8" className="text-xs h-8 font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Port</Label>
              <Input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className="text-xs h-8" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={tcp} onChange={(e) => setTcp(e.target.checked)} />
            Use TCP
          </label>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[11px]">{type}</Badge>
            {info && <Badge variant="outline" className="text-[11px]">{info.name}</Badge>}
            {info?.common ? <Badge variant="outline" className="text-[11px]">common</Badge> : null}
            <div className="ml-auto flex gap-2">
              <CopyButton getText={() => digCmd} label="Copy dig" />
              <CopyButton getText={() => nsCmd} label="Copy nslookup" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">dig command</Label>
            <pre className="text-[11px] font-mono bg-muted/30 p-2 rounded mt-1 overflow-x-auto">{digCmd}</pre>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">nslookup command</Label>
            <pre className="text-[11px] font-mono bg-muted/30 p-2 rounded mt-1 overflow-x-auto">{nsCmd}</pre>
          </div>
          {info && (
            <div className="pt-2 border-t border-border/40 space-y-1.5">
              <p className="text-xs"><strong>{info.description}</strong></p>
              <p className="text-[11px] text-muted-foreground">Use case: {info.useCase}</p>
              <p className="text-[11px] text-muted-foreground">Response: <code className="font-mono">{info.responseFormat}</code></p>
              <div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Example</span>
                <pre className="text-[10px] font-mono bg-muted/30 p-2 rounded mt-0.5 overflow-x-auto">{info.example}</pre>
              </div>
              <CopyButton getText={() => renderQueryTypeReport(info)} label="Copy type report" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">TTL classifier</Label>
          <div className="flex items-center gap-2">
            <Input type="number" value={ttl} onChange={(e) => setTtl(Number(e.target.value))} className="text-xs h-8 w-32" />
            <span className="text-xs text-muted-foreground">seconds</span>
            {ttlBucket && <Badge variant="outline" className="text-[10px]">{ttlBucket.range}</Badge>}
          </div>
          {ttlBucket && <p className="text-[11px] text-muted-foreground">{ttlBucket.description}</p>}
          <div className="space-y-1 pt-1">
            {TTL_REFERENCE.map((t) => (
              <div key={t.range} className="grid grid-cols-3 gap-2 text-[11px] border-b last:border-0 py-1">
                <span className="font-mono">{t.range}</span>
                <span className="col-span-2 text-muted-foreground">{t.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Batch query builder</Label>
          <textarea value={batchInput} onChange={(e) => setBatchInput(e.target.value)}
            className="w-full text-[11px] font-mono rounded border bg-background p-2 min-h-[80px]"
            placeholder="example.com A&#10;example.com MX" />
          {batch && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2 text-[11px]">
                <Badge variant="outline">{batch.stats.count} lookups</Badge>
                <Badge variant="outline">{batch.stats.uniqueDomains} domains</Badge>
                <DownloadButton getText={() => batch.digCommands.join("\n")} filename="dig-commands.txt" label="dig cmds" />
                <DownloadButton getText={() => batch.nslookupCommands.join("\n")} filename="nslookup-commands.txt" label="ns cmds" />
              </div>
              <pre className="text-[10px] font-mono bg-muted/30 p-2 rounded overflow-x-auto">{batch.digCommands.join("\n")}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">DNSSEC reference</Label>
          <p className="text-xs">{DNSSEC_REFERENCE.description}</p>
          <p className="text-[11px] text-muted-foreground">Record types: {DNSSEC_REFERENCE.recordTypes.join(", ")}</p>
          <ul className="text-[11px] text-muted-foreground list-disc ml-4">
            {DNSSEC_REFERENCE.benefits.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">EDNS reference</Label>
          <p className="text-xs">{EDNS_REFERENCE.description}</p>
          <p className="text-[11px] text-muted-foreground">
            Default UDP size: {EDNS_REFERENCE.defaultUdpSize}. Flags: {EDNS_REFERENCE.flags.join(", ")}.
          </p>
          <p className="text-[11px] text-muted-foreground">Extensions: {EDNS_REFERENCE.extensions.join(", ")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">All query types ({QUERY_TYPES.length})</Label>
            <div className="flex gap-2">
              <CopyButton getText={() => csv} label="Copy CSV" />
              <DownloadButton getText={() => csv} filename="dns-query-types.csv" mime="text/csv" />
              <DownloadButton getText={() => cheatSheet} filename="dns-cheatsheet.md" mime="text/markdown" label="Cheatsheet" />
            </div>
          </div>
          <div className="space-y-1">
            {QUERY_TYPES.map((q) => (
              <button key={q.type} type="button"
                onClick={() => setType(q.type)}
                className={`w-full text-left rounded border px-2 py-1.5 text-xs hover:bg-muted/40 cursor-pointer ${q.type === type ? "border-primary" : "bg-background"}`}>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold w-12">{q.type}</span>
                  <span>{q.name}</span>
                  {q.common && <Badge variant="outline" className="text-[9px] ml-auto">common</Badge>}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{q.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> this is a static reference.
            No DNS queries are sent.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
