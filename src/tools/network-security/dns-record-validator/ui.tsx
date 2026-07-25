"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  validateRecord,
  validateBatch,
  batchStats,
  formatZoneLine,
  referenceTable,
  batchToCsv,
  parseBatchInput,
  type DnsRecordType,
  type DnsRecord,
} from "./logic";

const TYPES: DnsRecordType[] = ["A", "AAAA", "CNAME", "NS", "MX", "TXT", "SRV", "CAA"];

export default function DnsRecordValidator() {
  const [type, setType] = useState<DnsRecordType>("A");
  const [value, setValue] = useState("192.168.1.1");
  const [priority, setPriority] = useState(10);
  const [weight, setWeight] = useState(20);
  const [port, setPort] = useState(443);
  const [target, setTarget] = useState("sip.example.com");
  const [name, setName] = useState("@");
  const [ttl, setTtl] = useState(3600);
  const [batchText, setBatchText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const record: DnsRecord = useMemo(() => {
    const rec: DnsRecord = { type, value, name, ttl };
    if (type === "MX") rec.priority = priority;
    if (type === "SRV") { rec.priority = priority; rec.weight = weight; rec.port = port; rec.target = target; }
    return rec;
  }, [type, value, priority, weight, port, target, name, ttl]);

  const validation = useMemo(() => validateRecord(record), [record]);
  const zoneLine = useMemo(() => ("ok" in validation ? formatZoneLine(record) : ""), [validation, record]);

  const error_ = "error" in validation ? validation.error : null;
  React.useEffect(() => {
    if (touched) setError(error_);
  }, [error_, touched]);

  const batchRecords = useMemo(() => parseBatchInput(batchText), [batchText]);
  const batchResults = useMemo(() => validateBatch(batchRecords), [batchRecords]);
  const stats = useMemo(() => batchStats(batchResults), [batchResults]);

  const refTable = useMemo(() => referenceTable(), []);

  const report = zoneLine ? `${zoneLine}\n✅ Valid ${type} record` : (error ?? "");

  const inputCls = "w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Record type</Label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <Button key={t} size="sm" variant={type === t ? "default" : "outline"} onClick={() => { setType(t); setTouched(false); setError(null); }}>{t}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Name (owner)</Label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">TTL (seconds)</Label>
              <input type="number" className={inputCls} value={ttl} onChange={(e) => setTtl(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Value</Label>
            <input className={inputCls} value={value} onChange={(e) => { setValue(e.target.value); setTouched(true); }} />
          </div>
          {type === "MX" && (
            <div>
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <input type="number" className={inputCls} value={priority} onChange={(e) => { setPriority(Number(e.target.value)); setTouched(true); }} />
            </div>
          )}
          {type === "SRV" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><Label className="text-xs text-muted-foreground">Priority</Label><input type="number" className={inputCls} value={priority} onChange={(e) => { setPriority(Number(e.target.value)); setTouched(true); }} /></div>
              <div><Label className="text-xs text-muted-foreground">Weight</Label><input type="number" className={inputCls} value={weight} onChange={(e) => { setWeight(Number(e.target.value)); setTouched(true); }} /></div>
              <div><Label className="text-xs text-muted-foreground">Port</Label><input type="number" className={inputCls} value={port} onChange={(e) => { setPort(Number(e.target.value)); setTouched(true); }} /></div>
              <div><Label className="text-xs text-muted-foreground">Target</Label><input className={inputCls} value={target} onChange={(e) => { setTarget(e.target.value); setTouched(true); }} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      {touched && error && <ErrorBanner message={error} />}

      {zoneLine && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Zone-file line</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => report} />
                <DownloadButton getText={() => report} filename="dns-record.txt" />
              </div>
            </div>
            <pre className="text-sm font-mono p-3 bg-muted/40 rounded-md whitespace-pre-wrap break-all">{zoneLine}</pre>
            <p className="text-sm font-mono text-green-600 dark:text-green-400">✅ Valid {type} record</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch mode (one record per line: &lt;type&gt; &lt;value&gt;)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] font-mono"
            placeholder={"A 1.2.3.4\nAAAA ::1\nMX mail.example.com"}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
          />
          {batchResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline">{stats.total} records</Badge>
                  <Badge variant="secondary">{stats.ok} valid</Badge>
                  {stats.errors > 0 && <Badge variant="destructive">{stats.errors} invalid</Badge>}
                </div>
                <DownloadButton getText={() => batchToCsv(batchResults)} filename="dns-records.csv" mime="text/csv" />
              </div>
              <ul className="text-xs divide-y divide-border/50 rounded-md border border-border/50">
                {batchResults.map((r, i) => (
                  <li key={i} className="p-2 flex items-center justify-between gap-2">
                    <span className="font-mono flex-1 truncate">{r.zoneLine ?? `${r.record.type} ${r.record.value}`}</span>
                    {"ok" in r.result ? (
                      <span className="text-green-600 dark:text-green-400">✅</span>
                    ) : (
                      <span className="text-destructive truncate max-w-[40%]" title={r.result.error}>❌ {r.result.error}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">DNS record reference</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border/50">
                  <th className="py-1.5 pr-2">Type</th>
                  <th className="py-1.5 pr-2">Purpose</th>
                  <th className="py-1.5">Example</th>
                </tr>
              </thead>
              <tbody>
                {refTable.map((row) => (
                  <tr key={row.type} className="border-b border-border/30">
                    <td className="py-1.5 pr-2 font-bold">{row.type}</td>
                    <td className="py-1.5 pr-2">{row.purpose}</td>
                    <td className="py-1.5 font-mono text-muted-foreground">{row.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all validation runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
