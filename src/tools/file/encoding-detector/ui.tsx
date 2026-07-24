"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner } from "../../_shared";
import { detectEncoding, type DetectionResult } from "./logic";

export default function EncodingDetector() {
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0]!;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buf = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(buf.slice(0, 8192)); // first 8KB
        const r = detectEncoding(bytes);
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
          <p className="text-xs text-muted-foreground">Only the first 8KB of the file is read for detection. Nothing is uploaded.</p>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Detected</p>
              <p className="text-lg font-bold uppercase text-primary">{result.detected}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="text-lg font-bold">{(result.confidence * 100).toFixed(0)}%</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">BOM</p>
              <p className="text-lg font-bold">{result.bom.present ? result.bom.type! : "None"}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Line endings</p>
              <p className="text-lg font-bold uppercase">{result.lineEndings}</p>
            </CardContent></Card>
          </div>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">All encoding candidates (ranked by confidence)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead className="bg-muted/80"><tr><th className="p-2 text-left">Encoding</th><th className="p-2 text-right">Confidence</th><th className="p-2 text-left">Reason</th></tr></thead>
                <tbody>
                  {result.candidates.map((c, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="p-2 font-mono uppercase">{c.encoding}</td>
                      <td className="p-2 text-right font-mono">{(c.confidence * 100).toFixed(0)}%</td>
                      <td className="p-2">{c.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">File size (analyzed)</p>
              <p className="text-sm font-bold">{result.fileSize} B</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">First 4 bytes</p>
              <p className="text-sm font-mono font-bold">{result.firstFourBytes}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Printable ratio</p>
              <p className="text-sm font-bold">{(result.printableAsciiRatio * 100).toFixed(1)}%</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Null / Control bytes</p>
              <p className="text-sm font-bold">{result.nullByteCount} / {result.controlCharCount}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Byte histogram (top 20 most common bytes)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="p-3 space-y-1">
                {result.byteHistogram.map((h) => {
                  const char = h.byte >= 0x20 && h.byte < 0x7F ? String.fromCharCode(h.byte) : `0x${h.byte.toString(16).padStart(2, "0")}`;
                  const maxCount = result.byteHistogram[0]!.count;
                  const pct = (h.count / maxCount) * 100;
                  return (
                    <div key={h.byte} className="flex items-center gap-2 text-xs">
                      <span className="font-mono w-12 text-right">{char}</span>
                      <div className="flex-1 bg-muted/60 rounded h-3 overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono w-12 text-right">{h.count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">First 256 bytes (hex dump)</CardTitle>
                <CopyButton getText={() => result.preview.hex} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs overflow-x-auto p-4 bg-muted/40 rounded-b-lg"><code>{result.preview.hex}</code></pre>
              <p className="text-xs text-muted-foreground p-2">Printable preview:</p>
              <pre className="text-xs overflow-x-auto p-4 bg-muted/40"><code>{result.preview.printable}</code></pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> only the first 8KB is read locally. No file leaves your browser.</p></CardContent></Card>
    </div>
  );
}
