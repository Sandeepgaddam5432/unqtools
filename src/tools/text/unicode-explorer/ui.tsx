"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, EmptyState } from "../../_shared";
import { process, toCsv, type ExploreResult } from "./logic";

export default function UnicodeExplorer() {
  const [input, setInput] = useState("Hello, 世界! 😀");
  const [result, setResult] = useState<ExploreResult | null>(null);

  const run = useCallback(() => {
    setResult(process(input));
  }, [input]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Explore</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {!result && <EmptyState title="No exploration yet" hint="Type text above to inspect each Unicode character." />}

      {result && (
        <>
          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3">{result.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}</CardContent></Card>
          )}
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{result.total} characters</Badge>
            <DownloadButton getText={() => toCsv(result)} filename="unicode.csv" mime="text/csv" />
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/80">
                    <tr>
                      <th className="p-2 text-left">Char</th>
                      <th className="p-2 text-left">Code Point</th>
                      <th className="p-2 text-left">Hex</th>
                      <th className="p-2 text-left">UTF-8</th>
                      <th className="p-2 text-left">UTF-16</th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Block</th>
                      <th className="p-2 text-left">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.chars.map((c, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2 text-lg font-mono">{c.char === " " ? "␣" : c.char}</td>
                        <td className="p-2 font-mono">{c.codePoint}</td>
                        <td className="p-2 font-mono">{c.hex}</td>
                        <td className="p-2 font-mono">{c.utf8}</td>
                        <td className="p-2 font-mono">{c.utf16}</td>
                        <td className="p-2">{c.name}</td>
                        <td className="p-2">{c.block}</td>
                        <td className="p-2">{c.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
