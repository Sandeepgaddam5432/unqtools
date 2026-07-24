"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, EmptyState } from "../../_shared";
import { generate, generateBatch, validate, toCsv, type MacOptions, type MacFormat, type MacCase, type MacResult } from "./logic";

export default function MacAddressGenerator() {
  const [count, setCount] = useState(5);
  const [format, setFormat] = useState<MacFormat>("colon");
  const [case_, setCase_] = useState<MacCase>("upper");
  const [oui, setOui] = useState("");
  const [locallyAdministered, setLocallyAdministered] = useState(false);
  const [multicast, setMulticast] = useState(false);
  const [results, setResults] = useState<MacResult[]>([]);
  const [validateInput, setValidateInput] = useState("01:23:45:67:89:AB");
  const [validateResult, setValidateResult] = useState<ReturnType<typeof validate> | null>(null);

  const run = useCallback(() => {
    const opts: MacOptions = { format, case: case_, oui: oui || undefined, locallyAdministered, multicast };
    setResults(generateBatch(count, opts));
  }, [count, format, case_, oui, locallyAdministered, multicast]);

  const runValidate = useCallback(() => {
    setValidateResult(validate(validateInput));
  }, [validateInput]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Count</Label>
              <Input type="number" min={1} max={10000} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Format</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={format} onChange={(e) => setFormat(e.target.value as MacFormat)}>
                <option value="colon">Colon (AA:BB:CC:DD:EE:FF)</option>
                <option value="hyphen">Hyphen (AA-BB-CC-DD-EE-FF)</option>
                <option value="none">None (AABBCCDDEEFF)</option>
                <option value="dots">Dots (AABB.CCDD.EEFF)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Case</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={case_} onChange={(e) => setCase_(e.target.value as MacCase)}>
                <option value="upper">Uppercase</option>
                <option value="lower">Lowercase</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">OUI prefix (optional)</Label>
              <Input value={oui} onChange={(e) => setOui(e.target.value)} placeholder="AABBCC" maxLength={6} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={locallyAdministered} onChange={(e) => setLocallyAdministered(e.target.checked)} /><span>Locally administered (bit 0x02)</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={multicast} onChange={(e) => setMulticast(e.target.checked)} /><span>Multicast (bit 0x01)</span></label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Generate</Button>
            <Button size="sm" variant="ghost" onClick={() => setResults([])}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{results.length} addresses</Badge>
              <div className="flex gap-2">
                <CopyButton getText={() => results.map((r) => r.mac).join("\n")} />
                <DownloadButton getText={() => toCsv(results)} filename="mac-addresses.csv" mime="text/csv" />
              </div>
            </div>
            <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap">{results.map((r) => r.mac).join("\n")}</pre>
          </CardContent>
        </Card>
      ) : <EmptyState title="No MACs generated" hint="Click Generate to create addresses." />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Validate a MAC</Label>
          <div className="flex gap-2">
            <Input value={validateInput} onChange={(e) => setValidateInput(e.target.value)} className="font-mono" />
            <Button size="sm" onClick={runValidate}>Check</Button>
          </div>
          {validateResult && (
            <div className="space-y-2">
              <Badge variant={validateResult.valid ? "default" : "destructive"}>{validateResult.valid ? "Valid" : "Invalid"}</Badge>
              {validateResult.valid && <p className="text-sm font-mono">Normalized: {validateResult.normalized} — OUI: {validateResult.oui}</p>}
              {validateResult.errors.length > 0 && <ul className="text-xs text-destructive list-disc pl-4">{validateResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
