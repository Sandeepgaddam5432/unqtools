"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import { extractTextFromEpub, paginateText, summarizeResult, type ConvertOptions, type ConvertResult, SOURCE_FORMAT, TARGET_FORMAT, SOURCE_EXT, TARGET_EXT } from "./logic";

export default function EpubToPdfConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<ConvertOptions>({ pageSize: "a4", margin: 50, fontSize: 12, includePageNumbers: true, includeTitlePage: true });
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const convert = useCallback(async () => {
    if (!file) { setError("Pick a file first."); return; }
    setBusy(true);
    setError(null);
    try {
      const { text, title, author } = await extractTextFromEpub(file);
      const pages = paginateText(text, options);
      const { PDFDocument, StandardFonts } = await import("pdf-lib");
      const pdf = await PDFDocument.create();
      pdf.setTitle(title);
      pdf.setAuthor(author);
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const dims = options.pageSize === "a4" ? { w: 595, h: 842 } : options.pageSize === "letter" ? { w: 612, h: 792 } : { w: 612, h: 1008 };

      if (options.includeTitlePage) {
        const titlePage = pdf.addPage([dims.w, dims.h]);
        titlePage.drawText(title, { x: options.margin ?? 50, y: dims.h - (options.margin ?? 50) - 30, size: 24, font });
        titlePage.drawText(`Author: ${author}`, { x: options.margin ?? 50, y: dims.h - (options.margin ?? 50) - 60, size: 14, font });
        titlePage.drawText(`Source: ${SOURCE_FORMAT} to ${TARGET_FORMAT}`, { x: options.margin ?? 50, y: dims.h - (options.margin ?? 50) - 80, size: 10, font });
      }

      for (let i = 0; i < pages.length; i++) {
        const page = pdf.addPage([dims.w, dims.h]);
        page.drawText(pages[i]!, { x: options.margin ?? 50, y: dims.h - (options.margin ?? 50) - (options.fontSize ?? 12), size: options.fontSize ?? 12, font, lineHeight: (options.fontSize ?? 12) * 1.4 });
        if (options.includePageNumbers) {
          page.drawText(`${i + 1}`, { x: dims.w / 2 - 5, y: 20, size: 10, font });
        }
      }

      const outputBytes = await pdf.save();
      const blob = new Blob([outputBytes as BlobPart], { type: "application/pdf" });
      setOutputBlob(blob);
      setResult({
        success: true,
        inputSize: file.size,
        outputSize: blob.size,
        warnings: [],
        log: [`Extracted ${text.length} chars from ${SOURCE_FORMAT}`, `Paginated into ${pages.length} pages`, `Generated PDF (${blob.size} bytes)`],
        pageCount: pages.length + (options.includeTitlePage ? 1 : 0),
      });
    } catch (e) {
      setError(`Conversion failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [file, options]);

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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Page size</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.pageSize} onChange={(e) => setOptions({ ...options, pageSize: e.target.value as "a4" | "letter" | "legal" })}>
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="legal">Legal</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Margin (pt)</Label><Input type="number" value={options.margin} onChange={(e) => setOptions({ ...options, margin: Number(e.target.value) })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Font size (pt)</Label><Input type="number" value={options.fontSize} onChange={(e) => setOptions({ ...options, fontSize: Number(e.target.value) })} /></div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.includePageNumbers} onChange={(e) => setOptions({ ...options, includePageNumbers: e.target.checked })} /><span>Page numbers</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.includeTitlePage} onChange={(e) => setOptions({ ...options, includeTitlePage: e.target.checked })} /><span>Title page</span></label>
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
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all conversion runs locally. No file leaves your browser. Note: {SOURCE_FORMAT} binary parsing is best-effort.</p></CardContent></Card>
    </div>
  );
}
