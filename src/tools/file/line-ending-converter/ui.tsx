"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { detectLineEndings, convertLineEndings, generateGitattributes, generateEditorConfig, previewLines, type LineEnding } from "./logic";

const SAMPLE = "Hello world\nThis is a test\nWith multiple lines\n";

export default function LineEndingConverter() {
  const [text, setText] = useState(SAMPLE);
  const [target, setTarget] = useState<LineEnding>("crlf");
  const [stripBom, setStripBom] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof convertLineEndings> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGitattributes, setShowGitattributes] = useState(false);
  const [showEditorConfig, setShowEditorConfig] = useState(false);

  const convert = useCallback(() => {
    try {
      const r = convertLineEndings(text, { target, stripBom });
      setResult(r);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    }
  }, [text, target, stripBom]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0]!;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result));
    reader.onerror = () => setError("Failed to read file");
    reader.readAsText(file);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Input text</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Target line ending</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={target} onChange={(e) => setTarget(e.target.value as LineEnding)}>
                <option value="lf">LF (Unix \\n) — modern standard</option>
                <option value="crlf">CRLF (Windows \\r\\n)</option>
                <option value="cr">CR (Classic Mac \\r) — rare</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm pb-2">
              <input type="checkbox" checked={stripBom} onChange={(e) => setStripBom(e.target.checked)} />
              <span>Strip BOM</span>
            </label>
            <input type="file" id="file-input" onChange={(e) => handleFiles(e.target.files)} className="hidden" />
            <Button size="sm" variant="outline" onClick={() => document.getElementById("file-input")?.click()}>Load file</Button>
            <Button size="sm" onClick={convert}>Convert</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText(SAMPLE); setResult(null); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setText(""); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Source</p>
              <p className="text-lg font-bold uppercase">{result.source.detected}</p>
              <p className="text-xs text-muted-foreground">CRLF={result.source.crlfCount} LF={result.source.lfCount} CR={result.source.crCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Target</p>
              <p className="text-lg font-bold uppercase">{result.target}</p>
              <p className="text-xs text-muted-foreground">{result.convertedCount} lines converted</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Size</p>
              <p className="text-lg font-bold">{result.sizeBefore} → {result.sizeAfter} B</p>
              <p className="text-xs text-muted-foreground">{result.sizeDelta > 0 ? "+" : ""}{result.sizeDelta} bytes</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-xs text-muted-foreground">BOM</p>
              <p className="text-lg font-bold">{result.source.hasBom ? "Present" : "Absent"}</p>
            </CardContent></Card>
          </div>

          {result.source.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.source.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Converted output</CardTitle>
                <div className="flex gap-2">
                  <CopyButton getText={() => result.output} />
                  <DownloadButton getText={() => result.output} filename="converted.txt" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs overflow-x-auto p-4 bg-muted/40 rounded-b-lg max-h-[300px] overflow-auto"><code>{result.output}</code></pre>
            </CardContent>
          </Card>

          {/* Preview first 5 lines */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Preview (first 5 lines)</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Before</p>
                <pre className="text-xs bg-muted/40 p-2 rounded-md">{previewLines(text, result.output, 5).before.join("\n")}</pre>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">After</p>
                <pre className="text-xs bg-muted/40 p-2 rounded-md">{previewLines(text, result.output, 5).after.join("\n")}</pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowGitattributes(!showGitattributes)}>Toggle .gitattributes</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowEditorConfig(!showEditorConfig)}>Toggle .editorconfig</Button>
              </div>
              {showGitattributes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">.gitattributes (for repo-wide line ending)</p>
                  <pre className="text-xs bg-muted/40 p-2 rounded-md overflow-x-auto"><code>{generateGitattributes(target)}</code></pre>
                </div>
              )}
              {showEditorConfig && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">.editorconfig (for editor-level line ending)</p>
                  <pre className="text-xs bg-muted/40 p-2 rounded-md overflow-x-auto"><code>{generateEditorConfig(target)}</code></pre>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all conversion runs locally. No file leaves your browser.</p></CardContent></Card>
    </div>
  );
}
