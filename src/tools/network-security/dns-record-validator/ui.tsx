"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { validateRecord, type DnsRecordType, type DnsRecord } from "./logic";

const TYPES: DnsRecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "CAA"];

export default function DnsRecordValidator() {
  const [type, setType] = useState<DnsRecordType>("A");
  const [value, setValue] = useState("192.168.1.1");
  const [priority, setPriority] = useState(10);
  const [weight, setWeight] = useState(20);
  const [port, setPort] = useState(443);
  const [target, setTarget] = useState("sip.example.com");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const rec: DnsRecord = { type, value };
    if (type === "MX") rec.priority = priority;
    if (type === "SRV") { rec.priority = priority; rec.weight = weight; rec.port = port; rec.target = target; }
    const v = validateRecord(rec);
    if ("error" in v) { setError(v.error); return null; }
    setError(null);
    return { ok: true, record: rec };
  }, [type, value, priority, weight, port, target]);

  const report = result ? `${result.record.type}: ${result.record.value || JSON.stringify({ target: result.record.target, port: result.record.port, priority: result.record.priority, weight: result.record.weight })}\n✅ Valid` : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Record type</Label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <Button key={t} size="sm" variant={type === t ? "default" : "outline"} onClick={() => setType(t)}>{t}</Button>
            ))}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Value</Label>
            <input type="text" className="w-full rounded-md border px-2 py-1 text-sm font-mono" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          {type === "MX" && (
            <div><Label className="text-xs text-muted-foreground">Priority</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={priority} onChange={(e) => setPriority(Number(e.target.value))} /></div>
          )}
          {type === "SRV" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><Label className="text-xs text-muted-foreground">Priority</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={priority} onChange={(e) => setPriority(Number(e.target.value))} /></div>
              <div><Label className="text-xs text-muted-foreground">Weight</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={weight} onChange={(e) => setWeight(Number(e.target.value))} /></div>
              <div><Label className="text-xs text-muted-foreground">Port</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={port} onChange={(e) => setPort(Number(e.target.value))} /></div>
              <div><Label className="text-xs text-muted-foreground">Target</Label><input type="text" className="w-full rounded-md border px-2 py-1 text-sm" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Result</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => report} />
                <DownloadButton getText={() => report} filename="dns-record.txt" />
              </div>
            </div>
            <p className="text-sm font-mono text-green-600">✅ Valid {type} record</p>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all validation runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
