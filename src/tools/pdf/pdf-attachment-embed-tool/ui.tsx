"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { embedAttachments, getMimeFromName, humanSize, getFileIcon, type FileToEmbed } from "./logic";
import { Paperclip, Upload, X, Download, FileText, File, Image, Archive, Table2 } from "lucide-react";

function FileIcon({ name }: { name: string }) {
  const icon = getFileIcon(name);
  switch (icon) {
    case "file-text": return <FileText className="h-4 w-4 text-primary" />;
    case "image": return <Image className="h-4 w-4 text-emerald-500" />;
    case "archive": return <Archive className="h-4 w-4 text-amber-500" />;
    case "table": return <Table2 className="h-4 w-4 text-blue-500" />;
    default: return <File className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function PdfAttachmentEmbedTool() {
  const [pdfBuf, setPdfBuf] = useState<ArrayBuffer | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [files, setFiles] = useState<FileToEmbed[]>([]);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pdfRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);

  const loadPdf = useCallback(async (file: File) => {
    setPdfBuf(await file.arrayBuffer());
    setPdfName(file.name);
    setOutput(null);
    toast.success(`PDF: ${file.name}`);
  }, []);

  const addFiles = useCallback(async (list: FileList | null) => {
    if (!list) return;
    const newFiles: FileToEmbed[] = [];
    for (const f of Array.from(list)) {
      const buf = await f.arrayBuffer();
      newFiles.push({ name: f.name, data: new Uint8Array(buf), mimeType: getMimeFromName(f.name), size: f.size });
    }
    setFiles((prev) => [...prev, ...newFiles]);
    toast.success(`+${newFiles.length} file(s)`);
  }, []);

  const removeFile = useCallback((i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i)), []);

  const process = useCallback(async () => {
    if (!pdfBuf || files.length === 0) return;
    setBusy(true); setError(null);
    const res = await embedAttachments(pdfBuf, files);
    if (res.ok) { setOutput(res.outputBytes); toast.success(`Done: ${res.filesCount} files in ${res.pageCount} pages`); }
    else setError(res.error);
    setBusy(false);
  }, [pdfBuf, files]);

  const download = useCallback(() => {
    if (!output) return;
    const blob = new Blob([output], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attached-${pdfName}`;
    a.click(); URL.revokeObjectURL(url);
  }, [output, pdfName]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-dashed border-primary/30">
          <CardContent className="p-6 text-center space-y-2">
            <FileText className="h-10 w-10 mx-auto text-primary/50" />
            <p className="text-sm font-medium">PDF Document</p>
            <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && loadPdf(e.target.files[0])} />
            <Button size="sm" variant="outline" onClick={() => pdfRef.current?.click()} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Select PDF
            </Button>
            {pdfName && <Badge variant="secondary" className="text-xs block mt-1">{pdfName}</Badge>}
          </CardContent>
        </Card>
        <Card className="border-dashed border-primary/30">
          <CardContent className="p-6 text-center space-y-2">
            <Paperclip className="h-10 w-10 mx-auto text-primary/50" />
            <p className="text-sm font-medium">Files to Attach</p>
            <input ref={filesRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
            <Button size="sm" variant="outline" onClick={() => filesRef.current?.click()} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Add Files
            </Button>
          </CardContent>
        </Card>
      </div>

      {files.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Attachments ({files.length})</h3>
              <span className="text-xs text-muted-foreground">Total: {humanSize(files.reduce((a, f) => a + f.size, 0))}</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded border p-2">
                  <FileIcon name={f.name} />
                  <span className="flex-1 text-sm truncate font-mono">{f.name}</span>
                  <Badge variant="outline" className="text-[10px]">{humanSize(f.size)}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(i)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-2">
        <Button onClick={process} disabled={busy || !pdfBuf || !files.length} className="gap-1.5">
          {busy ? "Processing…" : "Embed Attachments"}
        </Button>
        {output && (
          <Button variant="outline" onClick={download} className="gap-1.5">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> 100% local processing with pdf-lib. No uploads.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
