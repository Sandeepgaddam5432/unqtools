"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { process, toCsv, type RandomKind, type Charset, type RandomOptions, type RandomResult } from "./logic";

export default function SecureRandomGenerator() {
  const [kind, setKind] = useState<RandomKind>("password");
  const [count, setCount] = useState(16);
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(100);
  const [charsets, setCharsets] = useState<Charset[]>(["lower", "upper", "digits"]);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(false);
  const [result, setResult] = useState<RandomResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    setError(null);
    const opts: RandomOptions = { kind, count, min, max, charsets, avoidAmbiguous };
    const r = process(opts);
    if ("error" in r) { setError(r.error); setResult(null); }
    else setResult(r);
  }, [kind, count, min, max, charsets, avoidAmbiguous]);

  const toggleCharset = (c: Charset) => {
    setCharsets((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value as RandomKind)}>
                <option value="password">Password</option>
                <option value="hex">Hex string</option>
                <option value="bytes">Random bytes</option>
                <option value="int">Integer(s)</option>
                <option value="float">Float(s)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                {kind === "int" ? "How many ints" : kind === "float" ? "How many floats" : "Length / count"}
              </Label>
              <Input type="number" min={1} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)} />
            </div>
            {kind === "int" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Min</Label>
                  <Input type="number" value={min} onChange={(e) => setMin(parseInt(e.target.value) || 0)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Max</Label>
                  <Input type="number" value={max} onChange={(e) => setMax(parseInt(e.target.value) || 100)} />
                </div>
              </>
            )}
          </div>
          {kind === "password" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-4 text-sm">
                {(["lower", "upper", "digits", "symbols"] as Charset[]).map((c) => (
                  <label key={c} className="flex items-center gap-2"><input type="checkbox" checked={charsets.includes(c)} onChange={() => toggleCharset(c)} /><span>{c}</span></label>
                ))}
                <label className="flex items-center gap-2"><input type="checkbox" checked={avoidAmbiguous} onChange={(e) => setAvoidAmbiguous(e.target.checked)} /><span>Avoid ambiguous (Il1O0o)</span></label>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Generate</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary">{kind}</Badge>
              <div className="flex gap-2">
                <CopyButton getText={() => result.output} />
                {result.values && <DownloadButton getText={() => toCsv(result.values)} filename="random.csv" mime="text/csv" />}
              </div>
            </div>
            <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all">{result.output}</pre>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
