"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner } from "../../_shared";
import { detectFileType, detectionToCsv, type DetectionResult } from "./logic";

export default function FileTypeDetector() {
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0]!;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buf = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(buf.slice(0, 4096)); // first 4KB is plenty
        const ext = file.name.includes(".") ? file.name.split(".").pop()! : undefined;
        const r = detectFileType(bytes, ext);
        setResult(r);
        setError(null);
      } catch (e) {
        setError(`Detection failed: ${(e as Error).message}`);
      }
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsArrayBuffer(file);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input type="file" id="file-input" onChange={(e) => handleFiles(e.target.files)} className="hidden" />
            <Button size="sm" onClick={() => document.getElementById("file-input")?.click()}>Pick file</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResult(null); setError(null); setFileName(""); }}>Clear</Button>
            {fileName && <Badge variant="outline">{fileName}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">Only the first 4KB is read locally. Extension is compared against actual content.</p>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Detected type</p>
              <p className="text-lg font-bold text-primary">{result.name}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">MIME type</p>
              <p className="text-sm font-mono font-bold">{result.mimeType}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="text-lg font-bold">{(result.confidence * 100).toFixed(0)}%</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Text / Binary</p>
              <p className="text-lg font-bold">{result.isText ? "Text" : "Binary"}</p>
            </CardContent></Card>
          </div>

          {result.mismatch && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => <p key={i} className="text-xs text-red-700 dark:text-red-400">⚠️ {w}</p>)}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Suggested extensions</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex flex-wrap gap-2">
                {result.extensions.map((ext) => (
                  <Badge key={ext} variant="outline">.{ext}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {result.allMatches.length > 1 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">All matching signatures ({result.allMatches.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ul className="text-xs divide-y divide-border/50">
                  {result.allMatches.map((m, i) => (
                    <li key={i} className="p-2 flex items-center justify-between gap-2">
                      <span>{m.name}</span>
                      <span className="text-muted-foreground font-mono">{m.mimeType}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">File size (analyzed)</p>
              <p className="text-sm font-bold">{result.fileSize} B</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Declared extension</p>
              <p className="text-sm font-bold">{result.declaredExtension ? `.${result.declaredExtension}` : "(none)"}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">First 64 bytes (hex dump)</CardTitle>
                <CopyButton getText={() => result.firstBytesHex} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs overflow-x-auto p-4 bg-muted/40 rounded-b-lg"><code>{result.firstBytesHex}</code></pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> only the first 4KB is read locally. No file leaves your browser.</p></CardContent></Card>
    </div>
  );
}
