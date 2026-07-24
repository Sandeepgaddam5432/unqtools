"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { convertEncoding, generateCharsetDeclaration, type TargetEncoding } from "./logic";

export default function TextEncodingConverter() {
  const [sourceBytes, setSourceBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("");
  const [target, setTarget] = useState<TargetEncoding>("utf-8");
  const [bomMode, setBomMode] = useState<"add" | "strip" | "preserve">("strip");
  const [lossy, setLossy] = useState(true);
  const [result, setResult] = useState<ReturnType<typeof convertEncoding> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCharsetDecl, setShowCharsetDecl] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0]!;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setSourceBytes(new Uint8Array(reader.result as ArrayBuffer));
      setError(null);
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsArrayBuffer(file);
  }, []);

  const convert = useCallback(() => {
    if (!sourceBytes) {
      setError("Pick a file first.");
      return;
    }
    const r = convertEncoding(sourceBytes, { target, bom: bomMode, lossy });
    if ("error" in r) {
      setError(r.error);
      setResult(null);
    } else {
      setResult(r);
      setError(null);
    }
  }, [sourceBytes, target, bomMode, lossy]);

  const getDownloadText = useCallback((): string => {
    if (!result || "error" in result) return "";
    return new TextDecoder("utf-8", { fatal: false }).decode(result.output);
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input type="file" id="file-input" onChange={(e) => handleFiles(e.target.files)} className="hidden" />
            <Button size="sm" onClick={() => document.getElementById("file-input")?.click()}>Pick file</Button>
            <Button size="sm" variant="ghost" onClick={() => { setSourceBytes(null); setResult(null); setError(null); setFileName(""); }}>Clear</Button>
            {fileName && <Badge variant="outline">{fileName}</Badge>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Target encoding</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={target} onChange={(e) => setTarget(e.target.value as TargetEncoding)}>
                <option value="utf-8">UTF-8 (recommended)</option>
                <option value="utf-16le">UTF-16 LE</option>
                <option value="utf-16be">UTF-16 BE</option>
                <option value="ascii">ASCII (7-bit)</option>
                <option value="latin-1">Latin-1 (ISO-8859-1)</option>
                <option value="windows-1252">Windows-1252</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">BOM</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={bomMode} onChange={(e) => setBomMode(e.target.value as "add" | "strip" | "preserve")}>
                <option value="strip">Strip BOM</option>
                <option value="add">Add BOM</option>
                <option value="preserve">Preserve (keep source BOM state)</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={lossy} onChange={(e) => setLossy(e.target.checked)} />
                <span>Lossy (replace invalid chars with '?')</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={convert} disabled={!sourceBytes}>Convert</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCharsetDecl(!showCharsetDecl)}>Toggle HTML charset declaration</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && !("error" in result) && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Source</p>
              <p className="text-lg font-bold uppercase">{result.sourceEncoding}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Target</p>
              <p className="text-lg font-bold uppercase text-primary">{result.targetEncoding}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Size</p>
              <p className="text-sm font-bold">{result.sizeBefore} → {result.sizeAfter} B</p>
              <p className="text-xs text-muted-foreground">{result.sizeDelta > 0 ? "+" : ""}{result.sizeDelta} bytes</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">BOM</p>
              <p className="text-lg font-bold">{result.hasBom ? "Present" : "Absent"}</p>
            </CardContent></Card>
          </div>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Output preview (hex, first 80 bytes)</CardTitle>
                <CopyButton getText={() => result.hexPreview} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs overflow-x-auto p-4 bg-muted/40 rounded-b-lg"><code>{result.hexPreview}</code></pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Output text preview (UTF-8 decoded, first 200 chars)</CardTitle>
                <div className="flex gap-2">
                  <CopyButton getText={getDownloadText} />
                  <DownloadButton getText={getDownloadText} filename={`converted.${target === "utf-8" ? "txt" : target}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs overflow-x-auto p-4 bg-muted/40 rounded-b-lg"><code>{result.textPreview}</code></pre>
            </CardContent>
          </Card>

          {showCharsetDecl && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">HTML charset declaration for {result.targetEncoding}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <pre className="text-xs overflow-x-auto p-4 bg-muted/40 rounded-b-lg"><code>{generateCharsetDeclaration(target)}</code></pre>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all conversion runs locally. No file leaves your browser.</p></CardContent></Card>
    </div>
  );
}
