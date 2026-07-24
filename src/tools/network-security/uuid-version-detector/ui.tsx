"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton } from "../../_shared";
import { parse, generateV4, toCsv, type UuidParseResult } from "./logic";

export default function UuidVersionDetector() {
  const [input, setInput] = useState("f47ac10b-58cc-4372-a567-0e02b2c3d479");
  const [results, setResults] = useState<UuidParseResult[]>([]);
  const [generated, setGenerated] = useState<string[]>([]);

  const run = useCallback(() => {
    const lines = input.split("\n").map((l) => l.trim()).filter(Boolean);
    setResults(lines.map(parse));
  }, [input]);

  const generate = useCallback((n: number) => {
    setGenerated(Array.from({ length: n }, () => generateV4()));
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">UUIDs (one per line)</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Detect</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResults([]); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{results.length} parsed</Badge>
              <DownloadButton getText={() => toCsv(results)} filename="uuids.csv" mime="text/csv" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/80"><tr><th className="p-2 text-left">UUID</th><th className="p-2 text-left">Valid</th><th className="p-2 text-left">Version</th><th className="p-2 text-left">Variant</th><th className="p-2 text-left">Timestamp</th></tr></thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-2 font-mono">{r.uuid}</td>
                      <td className="p-2"><Badge variant={r.valid ? "default" : "destructive"}>{r.valid ? "Yes" : "No"}</Badge></td>
                      <td className="p-2"><Badge variant="outline">v{r.version}</Badge></td>
                      <td className="p-2">{r.variant}</td>
                      <td className="p-2 font-mono text-xs">{r.timestamp ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Generate v4 UUIDs</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => generate(1)}>1</Button>
              <Button size="sm" variant="outline" onClick={() => generate(5)}>5</Button>
              <Button size="sm" variant="outline" onClick={() => generate(10)}>10</Button>
            </div>
          </div>
          {generated.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-end gap-2">
                <CopyButton getText={() => generated.join("\n")} />
              </div>
              <pre className="text-sm overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap">{generated.join("\n")}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
