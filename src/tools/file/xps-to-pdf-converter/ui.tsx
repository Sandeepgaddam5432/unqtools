"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import { generateXpsXml, summarizeResult, type ConvertResult, SOURCE_FORMAT, TARGET_FORMAT, SOURCE_EXT, TARGET_EXT } from "./logic";

export default function XpsToPdfConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const convert = useCallback(async () => {
    if (!file) { setError("Pick a file first."); return; }
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const xml = generateXpsXml(text.slice(0, 50000), file.name, "Unknown");
      const blob = new Blob([xml], { type: "application/vnd.ms-xpsdocument" });
      setOutputBlob(blob);
      setResult({
        success: true,
        inputSize: file.size,
        outputSize: blob.size,
        warnings: ["Simplified XPS to PDF conversion (true binary conversion requires WASM library)"],
        log: [`Read ${file.size} bytes from PDF`, `Generated XPS wrapper`],
        pageCount: 1,
      });
    } catch (e) {
      setError(`Conversion failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [file]);

  const downloadUrl = outputBlob ? URL.createObjectURL(outputBlob) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input type="file" accept={SOURCE_EXT} id="file-input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
            <Button size="sm" onClick={() => document.getElementById("file-input")?.click()}>Pick {SOURCE_FORMAT} file</Button>
            <Button size="sm" variant="ghost" onClick={() => { setFile(null); setResult(null); setOutputBlob(null); setError(null); }}>Clear</Button>
            {file && <Badge variant="outline">{file.name} ({file.size} B)</Badge>}
          </div>
          <Button size="sm" onClick={convert} disabled={!file || busy}>{busy ? "Converting..." : `Convert ${SOURCE_FORMAT} to ${TARGET_FORMAT}`}</Button>
        </CardContent>
      </Card>
      {error && <ErrorBanner message={error} />}
      {result && !error && (
        <>
          <Card><CardContent className="p-4"><pre className="text-xs"><code>{summarizeResult(result)}</code></pre></CardContent></Card>
          {downloadUrl && (
            <Card><CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm">{TARGET_FORMAT} ready ({result.outputSize} B)</p>
              <a href={downloadUrl} download={(file?.name ?? `converted${TARGET_EXT}`).replace(new RegExp(`${SOURCE_EXT}$`), TARGET_EXT)}>
                <Button size="sm">Download {TARGET_FORMAT}</Button>
              </a>
            </CardContent></Card>
          )}
        </>
      )}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all conversion runs locally. No file leaves your browser. Note: true binary XPS to PDF conversion requires a WASM library — this tool provides a simplified text-based wrapper.</p></CardContent></Card>
    </div>
  );
}
