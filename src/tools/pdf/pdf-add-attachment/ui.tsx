"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { toast } from "sonner";
import { addAttachmentToPdf, formatFileSize } from "./logic";
import { Paperclip, FileText, Upload, Plus, X, Download } from "lucide-react";

interface Attachment {
  name: string;
  data: Uint8Array;
  description: string;
}

export default function PdfAddAttachment() {
  const [pdfFile, setPdfFile] = useState<ArrayBuffer | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPdf = useCallback((file: File) => {
    file.arrayBuffer().then((buf) => {
      setPdfFile(buf);
      setPdfName(file.name);
      setOutput(null);
      toast.success(`Loaded "${file.name}"`);
    });
  }, []);

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newAtts: Attachment[] = [];
    let count = 0;
    for (const file of Array.from(files)) {
      file.arrayBuffer().then((buf) => {
        newAtts.push({ name: file.name, data: new Uint8Array(buf), description: "" });
        count++;
        if (count === files.length) {
          setAttachments((prev) => [...prev, ...newAtts]);
          toast.success(`Added ${count} file(s)`);
        }
      });
    }
  }, []);

  const removeAttachment = useCallback((idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const process = useCallback(async () => {
    if (!pdfFile) { setError("Please load a PDF first"); return; }
    if (attachments.length === 0) { setError("Please add at least one attachment"); return; }
    setBusy(true);
    setError(null);
    try {
      const result = await addAttachmentToPdf(pdfFile, attachments);
      if (result.ok) {
        setOutput(result.pdfBytes);
        toast.success(`Added ${result.attachmentCount} attachment(s) to ${result.totalPages}-page PDF`);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [pdfFile, attachments]);

  const reset = useCallback(() => {
    setPdfFile(null);
    setPdfName("");
    setAttachments([]);
    setOutput(null);
    setError(null);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold">1. Load PDF</h3>
          </div>
          <div className="flex items-center gap-3">
            <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && loadPdf(e.target.files[0])} />
            <Button variant="outline" onClick={() => pdfInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Choose PDF
            </Button>
            {pdfName && <Badge variant="outline">{pdfName}</Badge>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-semibold">2. Add Attachments</h3>
            </div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Files
            </Button>
          </div>
          {attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attachments added yet.</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{att.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(att.data.length)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeAttachment(i)} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-2">
        <Button onClick={process} disabled={busy || !pdfFile || attachments.length === 0} className="gap-1.5">
          {busy ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <Paperclip className="h-4 w-4" />}
          {busy ? "Processing…" : "Embed Attachments"}
        </Button>
        <Button variant="ghost" onClick={reset}>Reset</Button>
      </div>

      {output && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">PDF with attachments ready!</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(output.length)} · {attachments.length} attachment(s)</p>
            </div>
            <DownloadButton
              getText={() => Promise.resolve("")}
              filename={`attached-${pdfName}`}
              label="Download PDF"
              mime="application/pdf"
            />
            {/* Direct download */}
            <Button onClick={() => {
              const blob = new Blob([output], { type: "application/pdf" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `attached-${pdfName}`;
              document.body.appendChild(a); a.click();
              document.body.removeChild(a);
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }} className="gap-1.5">
              <Download className="h-4 w-4" /> Download
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All PDF processing runs 100% locally using pdf-lib. Your files never leave your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Re-export getMimeType for tests
export function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    txt: "text/plain", pdf: "application/pdf", json: "application/json",
    xml: "application/xml", csv: "text/csv", html: "text/html",
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", svg: "image/svg+xml", zip: "application/zip",
  };
  return mimeMap[ext || ""] || "application/octet-stream";
}
