"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, DownloadButton } from "../../_shared";
import {
  pageDimensions, paginateText, validateOptions, summarizeResult,
  buildTitlePage, formatMetadata, compressionRatio, quickStats,
  EXTRACTION_MODES, type ConvertOptions, type ConvertResult, type ExtractionMode,
  SOURCE_FORMAT, TARGET_FORMAT, SOURCE_EXT, TARGET_EXT,
} from "./logic";
import { extractTextFromDjvu } from "../_shared-ebook-converter";

export default function DjvuToPdfConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<ConvertOptions>({
    pageSize: "a4", margin: 50, fontSize: 12, fontFamily: "helvetica",
    includePageNumbers: true, includeTitlePage: true, extractionMode: "plain",
  });
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<{ chars: number; words: number; lines: number; pages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const convert = useCallback(async () => {
    if (!file) { setError("Pick a file first."); return; }
    const v = validateOptions(options);
    if ("error" in v) { setError(v.error); return; }
    setBusy(true); setError(null);
    try {
      const { text, title, author } = await extractTextFromDjvu(file);
      const pages = paginateText(text, options);
      const { PDFDocument, StandardFonts } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      pdf.setTitle(title); pdf.setAuthor(author); pdf.setCreator("UnQTools");
      const fontKey = options.fontFamily === "times-roman" ? StandardFonts.TimesRoman : options.fontFamily === "courier" ? StandardFonts.Courier : StandardFonts.Helvetica;
      const font = await pdf.embedFont(fontKey);
      const dims = pageDimensions(options.pageSize ?? "a4");

      if (options.includeTitlePage) {
        const tp = pdf.addPage([dims.w, dims.h]);
        const titleLines = buildTitlePage(title, author, SOURCE_FORMAT, TARGET_FORMAT).split("\n");
        titleLines.forEach((ln, i) => tp.drawText(ln, { x: options.margin ?? 50, y: dims.h - (options.margin ?? 50) - 20 - i * 18, size: i === 2 ? 24 : 12, font }));
      }
      for (let i = 0; i < pages.length; i++) {
        const pg = pdf.addPage([dims.w, dims.h]);
        pg.drawText(pages[i]!, { x: options.margin ?? 50, y: dims.h - (options.margin ?? 50) - (options.fontSize ?? 12), size: options.fontSize ?? 12, font, lineHeight: (options.fontSize ?? 12) * 1.4 });
        if (options.includePageNumbers) pg.drawText(`${i + 1}`, { x: dims.w / 2 - 5, y: 20, size: 10, font });
      }
      const bytes = await pdf.save();
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      setOutputUrl(URL.createObjectURL(blob));
      setResult({
        success: true, inputSize: file.size, outputSize: blob.size, warnings: [],
        log: [`Extracted ${text.length} chars via ${options.extractionMode} mode`, `Paginated into ${pages.length} pages`, `Generated PDF (${blob.size} bytes)`],
        pageCount: pages.length + (options.includeTitlePage ? 1 : 0),
      });
      setStats(quickStats(text, pages.length));
    } catch (e) {
      setError(`Conversion failed: ${(e as Error).message}`);
    } finally { setBusy(false); }
  }, [file, options, outputUrl]);

  const baseName = (file?.name ?? `converted${TARGET_EXT}`).replace(new RegExp(`${SOURCE_EXT}$`), TARGET_EXT);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input type="file" accept={SOURCE_EXT} id="file-input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
            <Button size="sm" onClick={() => document.getElementById("file-input")?.click()}>Pick {SOURCE_FORMAT} file</Button>
            <Button size="sm" variant="ghost" onClick={() => { setFile(null); setResult(null); setOutputUrl(null); setStats(null); setError(null); }}>Clear</Button>
            {file && <Badge variant="outline">{file.name} ({file.size} B)</Badge>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Page size</Label>
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={options.pageSize} onChange={(e) => setOptions({ ...options, pageSize: e.target.value as "a4" | "letter" | "legal" })}>
                <option value="a4">A4</option><option value="letter">Letter</option><option value="legal">Legal</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Margin (pt)</Label><Input type="number" value={options.margin} onChange={(e) => setOptions({ ...options, margin: Number(e.target.value) })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Font size (pt)</Label><Input type="number" value={options.fontSize} onChange={(e) => setOptions({ ...options, fontSize: Number(e.target.value) })} /></div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Extraction mode</Label>
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={options.extractionMode} onChange={(e) => setOptions({ ...options, extractionMode: e.target.value as ExtractionMode })}>
                {EXTRACTION_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.includePageNumbers} onChange={(e) => setOptions({ ...options, includePageNumbers: e.target.checked })} /><span>Page numbers</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.includeTitlePage} onChange={(e) => setOptions({ ...options, includeTitlePage: e.target.checked })} /><span>Title page</span></label>
          </div>
          <Button size="sm" onClick={convert} disabled={!file || busy}>{busy ? "Converting…" : `Convert ${SOURCE_FORMAT} → ${TARGET_FORMAT}`}</Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <Card>
          <CardHeader className="pb-3"><div className="flex items-center justify-between"><CardTitle className="text-sm">Result</CardTitle>{outputUrl && <a href={outputUrl} download={baseName}><Button size="sm">Download {TARGET_FORMAT}</Button></a>}</div></CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <pre className="text-xs"><code>{summarizeResult(result)}</code></pre>
            {stats && (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{stats.chars} chars</Badge>
                <Badge variant="outline">{stats.words} words</Badge>
                <Badge variant="outline">{stats.lines} lines</Badge>
                <Badge variant="outline">{stats.pages} pages</Badge>
                <Badge variant="secondary">ratio {compressionRatio(result.inputSize, result.outputSize)}</Badge>
              </div>
            )}
            <details className="text-xs"><summary className="cursor-pointer">PDF metadata</summary><pre className="mt-2 p-2 bg-muted/40 rounded">{formatMetadata(options)}</pre></details>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all conversion runs locally. No file leaves your browser. {SOURCE_FORMAT} parsing is best-effort.</p></CardContent></Card>
    </div>
  );
}
