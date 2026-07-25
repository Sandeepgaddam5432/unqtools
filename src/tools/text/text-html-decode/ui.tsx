"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  htmlDecode, htmlDecodeBatch, batchToCsv, htmlEncode, htmlEncodeAll,
  roundTrip, referenceTable, namedEntityCount, validateInput,
} from "./logic";

type Mode = "decode" | "encode" | "encode-all";

export default function TextHtmlDecode() {
  const [input, setInput] = useState("&lt;b&gt;Hello&lt;/b&gt; &amp; welcome &copy;");
  const [mode, setMode] = useState<Mode>("decode");
  const [batchText, setBatchText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    setError(null);
    const v = validateInput(input);
    if ("error" in v) { setError(v.error); return null; }
    if (mode === "decode") return { kind: "decode" as const, value: htmlDecode(input) };
    if (mode === "encode") return { kind: "encode" as const, value: htmlEncode(input) };
    return { kind: "encode-all" as const, value: htmlEncodeAll(input) };
  }, [input, mode]);

  const batchLines = useMemo(() => batchText.split(/\r?\n/).filter((l) => l.length > 0), [batchText]);
  const batchResults = useMemo(() => htmlDecodeBatch(batchLines), [batchLines]);

  const refTable = useMemo(() => referenceTable().slice(0, 50), []);

  const outputText = result ? (result.kind === "decode" ? result.value.output : result.value) : "";
  const entitiesDecoded = result?.kind === "decode" ? result.value.entitiesDecoded : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["decode", "encode", "encode-all"] as Mode[]).map((m) => (
              <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>
                {m === "decode" ? "Decode entities" : m === "encode" ? "Encode (basic)" : "Encode (all non-ASCII)"}
              </Button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input</Label>
            <textarea className="rounded-md border bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setInput("&lt;b&gt;Hello&lt;/b&gt; &amp; welcome &copy;")}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => setInput("")}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Output {result.kind === "decode" ? `(${entitiesDecoded} entities)` : ""}</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => outputText} />
                <DownloadButton getText={() => outputText} filename="html-output.txt" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 space-y-2">
            <pre className="text-sm overflow-x-auto p-4 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-all">{outputText}</pre>
            {result.kind === "decode" && (
              <div className="flex flex-wrap gap-2 p-3 text-xs">
                <Badge variant="outline">{result.value.namedCount} named</Badge>
                <Badge variant="outline">{result.value.decimalCount} decimal</Badge>
                <Badge variant="outline">{result.value.hexCount} hex</Badge>
                {result.value.unknownCount > 0 && <Badge variant="destructive">{result.value.unknownCount} unknown</Badge>}
              </div>
            )}
            {result.kind === "decode" && result.value.warnings.length > 0 && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400 px-3">{result.value.warnings.join(" ")}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Batch mode (decode one input per line)</Label>
          <textarea className="rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] font-mono" placeholder={"&amp;\n&lt;\n&gt;"} value={batchText} onChange={(e) => setBatchText(e.target.value)} />
          {batchResults.length > 0 && (
            <div className="flex items-center justify-between">
              <Badge variant="outline">{batchResults.length} rows · {batchResults.reduce((a, r) => a + r.entitiesDecoded, 0)} entities</Badge>
              <DownloadButton getText={() => batchToCsv(batchResults, batchLines)} filename="html-decode-batch.csv" mime="text/csv" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">Round-trip check</Badge>
            <Badge variant="outline">{namedEntityCount()} named entities</Badge>
          </div>
          <p className="text-xs">
            {(() => {
              const rt = roundTrip(input);
              return rt.ok
                ? <span className="text-green-700 dark:text-green-400">Round-trip OK (decode → encode matches input)</span>
                : <span className="text-yellow-700 dark:text-yellow-400">Round-trip differs (input contains entities outside the basic 5)</span>;
            })()}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Entity reference (first 50)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs font-mono">
            {refTable.map((e) => (
              <div key={e.name} className="flex items-center gap-2 rounded border border-border/50 px-2 py-1">
                <span className="font-bold w-6 text-center">{e.char}</span>
                <span className="text-muted-foreground">&amp;{e.name};</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> conversion runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
