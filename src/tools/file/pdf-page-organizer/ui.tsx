"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DownloadButton, ErrorBanner } from "../../_shared";
import { parsePageRanges, applyOperations, summarizePlan, pageMappingToCsv, formatResultSummary, type Operation } from "./logic";

export default function PdfPageOrganizer() {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [deleteRanges, setDeleteRanges] = useState("");
  const [rotateRanges, setRotateRanges] = useState("");
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [extractRanges, setExtractRanges] = useState("");
  const [duplicateRanges, setDuplicateRanges] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [finalOrder, setFinalOrder] = useState<number[]>([]);

  const handleFile = useCallback(async (f: File | null) => {
    if (!f) return;
    setFile(f);
    setError(null);
    setOutputBlob(null);
    setOperations([]);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const bytes = await f.arrayBuffer();
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      setTotalPages(pdf.getPageCount());
    } catch (e) {
      setError(`Failed to load PDF: ${(e as Error).message}`);
    }
  }, []);

  const addOp = useCallback((op: Operation) => {
    setOperations((prev) => [...prev, op]);
  }, []);

  const applyDelete = useCallback(() => {
    const pages = parsePageRanges(deleteRanges, totalPages);
    if (pages.length === 0) { setError("No valid pages to delete."); return; }
    addOp({ kind: "delete", pages });
    setDeleteRanges("");
    setError(null);
  }, [deleteRanges, totalPages, addOp]);

  const applyRotate = useCallback(() => {
    const pages = parsePageRanges(rotateRanges, totalPages);
    if (pages.length === 0) { setError("No valid pages to rotate."); return; }
    addOp({ kind: "rotate", pages, angle: rotateAngle });
    setRotateRanges("");
    setError(null);
  }, [rotateRanges, totalPages, rotateAngle, addOp]);

  const applyExtract = useCallback(() => {
    const pages = parsePageRanges(extractRanges, totalPages);
    if (pages.length === 0) { setError("No valid pages to extract."); return; }
    addOp({ kind: "extract", pages });
    setExtractRanges("");
    setError(null);
  }, [extractRanges, totalPages, addOp]);

  const applyDuplicate = useCallback(() => {
    const pages = parsePageRanges(duplicateRanges, totalPages);
    if (pages.length === 0) { setError("No valid pages to duplicate."); return; }
    addOp({ kind: "duplicate", pages });
    setDuplicateRanges("");
    setError(null);
  }, [duplicateRanges, totalPages, addOp]);

  const applyReverse = useCallback(() => {
    addOp({ kind: "reverse" });
  }, [addOp]);

  const process = useCallback(async () => {
    if (!file) { setError("Pick a PDF first."); return; }
    setBusy(true);
    setError(null);
    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const originalPageCount = pdf.getPageCount();
      const newOrder = applyOperations(originalPageCount, operations);
      setFinalOrder(newOrder);

      // Build new PDF in the new order
      const newPdf = await PDFDocument.create();
      const pagesToAdd = newOrder.length > 0 ? newOrder : Array.from({ length: originalPageCount }, (_, i) => i);
      const copied = await newPdf.copyPages(pdf, pagesToAdd);
      for (const p of copied) newPdf.addPage(p);

      // Apply rotations
      for (const op of operations) {
        if (op.kind === "rotate") {
          for (const pageNum of op.pages) {
            const idx = pagesToAdd.indexOf(pageNum);
            if (idx >= 0 && idx < newPdf.getPageCount()) {
              const page = newPdf.getPage(idx);
              const current = page.getRotation().angle;
              page.setRotation(degrees((current + op.angle) % 360));
            }
          }
        }
      }

      const outputBytes = await newPdf.save();
      const blob = new Blob([outputBytes as BlobPart], { type: "application/pdf" });
      setOutputBlob(blob);
    } catch (e) {
      setError(`Process failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [file, operations]);

  const downloadUrl = outputBlob ? URL.createObjectURL(outputBlob) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input type="file" accept=".pdf" id="file-input" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} className="hidden" />
            <Button size="sm" onClick={() => document.getElementById("file-input")?.click()}>Pick PDF</Button>
            <Button size="sm" variant="ghost" onClick={() => { setFile(null); setOperations([]); setOutputBlob(null); setError(null); setTotalPages(0); setFinalOrder([]); }}>Clear</Button>
            {file && <Badge variant="outline">{file.name} ({totalPages} pages)</Badge>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Delete pages (e.g. "1-3,5")</Label>
                <Input value={deleteRanges} onChange={(e) => setDeleteRanges(e.target.value)} placeholder="1-3,5,8" />
              </div>
              <Button size="sm" onClick={applyDelete} disabled={!file}>+ Delete</Button>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Rotate pages</Label>
                <Input value={rotateRanges} onChange={(e) => setRotateRanges(e.target.value)} placeholder="1,3-5" />
              </div>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={rotateAngle} onChange={(e) => setRotateAngle(Number(e.target.value) as 90 | 180 | 270)}>
                <option value={90}>90°</option>
                <option value={180}>180°</option>
                <option value={270}>270°</option>
              </select>
              <Button size="sm" onClick={applyRotate} disabled={!file}>+ Rotate</Button>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Extract pages (keep only)</Label>
                <Input value={extractRanges} onChange={(e) => setExtractRanges(e.target.value)} placeholder="1-5,8" />
              </div>
              <Button size="sm" onClick={applyExtract} disabled={!file}>+ Extract</Button>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Duplicate pages</Label>
                <Input value={duplicateRanges} onChange={(e) => setDuplicateRanges(e.target.value)} placeholder="3,7" />
              </div>
              <Button size="sm" onClick={applyDuplicate} disabled={!file}>+ Duplicate</Button>
            </div>
          </div>

          <Button size="sm" variant="outline" onClick={applyReverse} disabled={!file}>+ Reverse order</Button>

          {operations.length > 0 && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium">Operations queue ({operations.length}):</p>
                  <Button size="sm" variant="ghost" onClick={() => setOperations([])}>Clear all</Button>
                </div>
                <pre className="text-xs overflow-x-auto"><code>{summarizePlan(operations, totalPages)}</code></pre>
              </CardContent>
            </Card>
          )}

          <Button size="sm" onClick={process} disabled={!file || busy}>{busy ? "Working..." : "Process PDF"}</Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {outputBlob && finalOrder.length > 0 && (
        <>
          <Card>
            <CardContent className="p-4">
              <pre className="text-xs"><code>{formatResultSummary(totalPages, finalOrder.length, operations)}</code></pre>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm">Processed PDF ready ({finalOrder.length} pages)</p>
              <div className="flex gap-2">
                <DownloadButton getText={() => pageMappingToCsv(finalOrder)} filename="page-mapping.csv" mime="text/csv" />
                <a href={downloadUrl ?? "#"} download={file?.name.replace(".pdf", "-organized.pdf") ?? "organized.pdf"}>
                  <Button size="sm">Download organized PDF</Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> PDF is processed locally using pdf-lib. No file leaves your browser.</p></CardContent></Card>
    </div>
  );
}
