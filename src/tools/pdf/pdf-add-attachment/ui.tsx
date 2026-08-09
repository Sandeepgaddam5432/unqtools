"use client";

/**
 * Add Attachment to PDF — real UI.
 * Attach one or more files (with description) to a PDF.
 */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { addAttachments } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };
type Attach = { name: string; bytes: Uint8Array };

export default function AddAttachmentToPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [attachments, setAttachments] = useState<Attach[]>([]);
  const [desc, setDesc] = useState("");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  async function loadAttachments(list: FileList | File[]) {
    const arr = Array.from(list);
    const loaded: Attach[] = [];
    for (const f of arr) {
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (bytes.length > 25 * 1024 * 1024) {
          toast.error(`${f.name} is larger than 25 MB — skipping`);
          continue;
        }
        loaded.push({ name: f.name, bytes });
      } catch {
        toast.error(`Could not read ${f.name}`);
      }
    }
    if (loaded.length > 0) {
      setAttachments((prev) => [...prev, ...loaded]);
      toast.success(`Added ${loaded.length} attachment(s)`);
    }
  }

  function reset() {
    setFile(null);
    setAttachments([]);
    setResult(null);
    setError("");
  }

  async function run() {
    if (!file || attachments.length === 0) return;
    setWorking(true);
    setError("");
    setResult(null);
    const r = await addAttachments(
      file.bytes,
      attachments.map((a) => ({ name: a.name, bytes: a.bytes, description: desc || undefined }))
    );
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      toast.success(`Attached ${r.output.attached.length} file(s)`);
    } else {
      setError(r.error);
    }
  }

  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{file.pageCount} pages • {formatBytes(file.bytes.length)}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={reset}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void loadFile(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-10 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <FileUp className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Then attach any files to it.</p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose PDF"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f);
          e.target.value = "";
        }}
      />

      {file && (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          {attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((a) => (
                <div key={a.name} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-2.5">
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <span className="text-xs text-muted-foreground">{formatBytes(a.bytes.length)}</span>
                  </div>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${a.name}`} onClick={() => setAttachments((p) => p.filter((x) => x.name !== a.name))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No files attached yet.</p>
          )}

          <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => attachRef.current?.click()}>
            <Paperclip className="h-3.5 w-3.5" /> Add attachment(s)
          </Button>
          <input
            ref={attachRef}
            type="file"
            multiple
            className="hidden"
            aria-label="Choose attachments"
            onChange={(e) => {
              if (e.target.files) void loadAttachments(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="space-y-1">
            <Label htmlFor="att-desc">Description (optional)</Label>
            <input
              id="att-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="e.g. Supporting documents"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file || attachments.length === 0} loading={working} label={`Attach ${attachments.length} file${attachments.length === 1 ? "" : "s"}`} />
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Attachments embedded • {formatBytes(result.length)}</p>
              <Button onClick={() => downloadBytes(result, `attached-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — files never leave your device. Attachments appear in the PDF&apos;s attachments panel and a paperclip shows on page 1.
      </p>
    </div>
  );
}
