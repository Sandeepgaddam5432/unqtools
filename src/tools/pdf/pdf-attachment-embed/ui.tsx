"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { embedFilesInPdf, detectMimeType, formatBytes, type EmbeddableFile } from "./logic";
import { Paperclip, Upload, X, Download, FileText, FolderOpen } from "lucide-react";

export default function PdfAttachmentEmbed() {
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [files, setFiles] = useState<EmbeddableFile[]>([]);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const handlePdfLoad = useCallback(async (file: File) => {
    const buf = await file.arrayBuffer();
    setPdfBuffer(buf);
    setPdfName(file.name);
    setOutput(null);
    toast.success(`PDF loaded: ${file.name}`);
  }, []);

  const handleFilesAdd = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: EmbeddableFile[] = [];
    for (const f of Array.from(fileList)) {
      const buf = await f.arrayBuffer();
      newFiles.push({
        name: f.name,
        data: new Uint8Array(buf),
        mimeType: detectMimeType(f.name),
        description: f.name,
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);
    toast.success(`Added ${newFiles.length} file(s)`);
  }, []);

  const removeFile = useCallback((idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const process = useCallback(async () => {
    if (!pdfBuffer || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await embedFilesInPdf(pdfBuffer, files);
      if (result.ok) {
        setOutput(result.pdfBytes);
        toast.success(`Embedded ${result.filesEmbedded} file(s) in ${result.pageCount}-page PDF`);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [pdfBuffer, files]);

  const download = useCallback(() => {
    if (!output) return;
    const blob = new Blob([output], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `embedded-${pdfName}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [output, pdfName]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") handlePdfLoad(f); }}
          className="border-dashed border-2 border-primary/30"
        >
          <CardContent className="p-6 text-center space-y-2">
            <FileText className="h-8 w-8 mx-auto text-primary/60" />
            <p className="text-sm font-medium">Drop PDF here</p>
            <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handlePdfLoad(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => pdfRef.current?.click()}>Browse PDF</Button>
            {pdfName && <Badge variant="secondary" className="text-xs">{pdfName}</Badge>}
          </CardContent>
        </Card>

        <Card
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFilesAdd(e.dataTransfer.files); }}
          className="border-dashed border-2 border-primary/30"
        >
          <CardContent className="p-6 text-center space-y-2">
            <FolderOpen className="h-8 w-8 mx-auto text-primary/60" />
            <p className="text-sm font-medium">Drop files to attach</p>
            <input ref={filesRef} type="file" multiple className="hidden" onChange={(e) => handleFilesAdd(e.target.files)} />
            <Button variant="outline" size="sm" onClick={() => filesRef.current?.click()}>Browse Files</Button>
          </CardContent>
        </Card>
      </div>

      {files.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold">Files to embed ({files.length})</h3>
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate font-mono text-xs">{f.name}</span>
                <Badge variant="outline" className="text-[10px]">{formatBytes(f.data.length)}</Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(i)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      <Button onClick={process} disabled={busy || !pdfBuffer || files.length === 0} className="gap-2">
        {busy ? "Embedding…" : "Embed Files in PDF"}
      </Button>

      {output && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">PDF ready with {files.length} embedded file(s)</p>
              <p className="text-xs text-muted-foreground">{formatBytes(output.length)}</p>
            </div>
            <Button onClick={download} className="gap-1.5">
              <Download className="h-4 w-4" /> Download
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All processing uses pdf-lib and runs 100% locally. No files are uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
