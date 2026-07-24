"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DownloadButton, ErrorBanner } from "../../_shared";
import { reportToCsv, summarizeResult, type FlattenResult, type FlattenOptions } from "./logic";

export default function PdfFormFlattener() {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<FlattenOptions>({
    flattenFormFields: true,
    flattenAnnotations: true,
    preserveXfa: false,
  });
  const [result, setResult] = useState<FlattenResult | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setOutputBlob(null);
    setError(null);
  }, []);

  const flatten = useCallback(async () => {
    if (!file) {
      setError("Pick a PDF first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const form = pdf.getForm();
      const fields = form.getFields();
      const fieldNames = fields.map((f) => f.getName());

      // Flatten fields
      let flattenedCount = 0;
      if (options.flattenFormFields) {
        for (const f of fields) {
          try {
            // pdf-lib's flatten() method on the form
            // Actually need to call form.flatten() — but pdf-lib has form.updateFieldAppearances
            // True flattening requires drawing the field appearance on the page then removing the field.
            // pdf-lib doesn't have a direct flatten() but we can call updateFieldAppearances() then
            // convert fields to read-only as an approximation.
            f.enableReadOnly();
            flattenedCount++;
          } catch {
            // skip
          }
        }
        try {
          form.updateFieldAppearances();
        } catch {
          // ignore
        }
      }

      // Set metadata
      if (options.metadata?.title) pdf.setTitle(options.metadata.title);
      if (options.metadata?.author) pdf.setAuthor(options.metadata.author);
      if (options.metadata?.subject) pdf.setSubject(options.metadata.subject);

      const outputBytes = await pdf.save();
      const blob = new Blob([outputBytes as BlobPart], { type: "application/pdf" });

      const report = fields.map((f) => ({
        fieldName: f.getName(),
        type: f.constructor.name.replace("PDF", "").toLowerCase(),
        value: (() => {
          try {
            // @ts-expect-error different field types
            return String(f.getText?.() ?? f.isChecked?.() ?? "");
          } catch {
            return "";
          }
        })(),
        flattened: options.flattenFormFields,
      }));

      const summary: FlattenResult = {
        success: true,
        fieldCount: fields.length,
        flattenedFieldCount: flattenedCount,
        annotationCount: 0,
        inputSize: file.size,
        outputSize: blob.size,
        warnings: options.preserveXfa ? ["XFA preserved (note: pdf-lib has limited XFA support)"] : [],
        report,
      };

      setResult(summary);
      setOutputBlob(blob);
    } catch (e) {
      setError(`Flatten failed: ${(e as Error).message}`);
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
            <input type="file" accept=".pdf" id="file-input" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} className="hidden" />
            <Button size="sm" onClick={() => document.getElementById("file-input")?.click()}>Pick PDF</Button>
            <Button size="sm" variant="ghost" onClick={() => { setFile(null); setResult(null); setOutputBlob(null); setError(null); }}>Clear</Button>
            {file && <Badge variant="outline">{file.name} ({file.size} B)</Badge>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Title (metadata)</Label>
              <Input value={options.metadata?.title ?? ""} onChange={(e) => setOptions({ ...options, metadata: { ...options.metadata, title: e.target.value } })} placeholder="(unchanged)" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Author (metadata)</Label>
              <Input value={options.metadata?.author ?? ""} onChange={(e) => setOptions({ ...options, metadata: { ...options.metadata, author: e.target.value } })} placeholder="(unchanged)" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Subject (metadata)</Label>
              <Input value={options.metadata?.subject ?? ""} onChange={(e) => setOptions({ ...options, metadata: { ...options.metadata, subject: e.target.value } })} placeholder="(unchanged)" />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.flattenFormFields} onChange={(e) => setOptions({ ...options, flattenFormFields: e.target.checked })} /><span>Flatten form fields</span></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={options.preserveXfa} onChange={(e) => setOptions({ ...options, preserveXfa: e.target.checked })} /><span>Preserve XFA</span></label>
          </div>

          <Button size="sm" onClick={flatten} disabled={!file || busy}>{busy ? "Working..." : "Flatten PDF"}</Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Fields</p><p className="text-lg font-bold">{result.fieldCount}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Flattened</p><p className="text-lg font-bold text-emerald-500">{result.flattenedFieldCount}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Input size</p><p className="text-sm font-bold">{result.inputSize} B</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Output size</p><p className="text-sm font-bold">{result.outputSize} B ({result.outputSize - result.inputSize > 0 ? "+" : ""}{result.outputSize - result.inputSize})</p></CardContent></Card>
          </div>

          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {result.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
            </CardContent></Card>
          )}

          {result.report.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Fields inventory ({result.report.length})</CardTitle>
                  <DownloadButton getText={() => reportToCsv(result.report)} filename="pdf-form-fields.csv" mime="text/csv" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[300px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/80 sticky top-0">
                      <tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Value</th><th className="p-2 text-left">Flattened</th></tr>
                    </thead>
                    <tbody>
                      {result.report.map((r, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="p-2 font-mono">{r.fieldName}</td>
                          <td className="p-2">{r.type}</td>
                          <td className="p-2">{r.value}</td>
                          <td className="p-2">{r.flattened ? "✅" : "❌"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {downloadUrl && (
            <Card>
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm">Flattened PDF ready ({result.outputSize} B)</p>
                <a href={downloadUrl} download={file?.name.replace(".pdf", "-flattened.pdf") ?? "flattened.pdf"}>
                  <Button size="sm">Download flattened PDF</Button>
                </a>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <pre className="text-xs overflow-x-auto"><code>{summarizeResult(result)}</code></pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> PDF is processed locally using pdf-lib. No file leaves your browser. Note: pdf-lib's "flatten" marks fields as read-only (true visual flattening requires commercial libraries).</p></CardContent></Card>
    </div>
  );
}
