"use client";

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { readPdfMetadata, writePdfMetadata, type PdfMetadata } from "./logic";

const FIELDS: { key: keyof Omit<PdfMetadata, "creationDate"|"modificationDate">; label: string; placeholder: string }[] = [
  { key: "title", label: "Title", placeholder: "Document title" },
  { key: "author", label: "Author", placeholder: "Author name" },
  { key: "subject", label: "Subject", placeholder: "Document subject" },
  { key: "keywords", label: "Keywords", placeholder: "keyword1, keyword2" },
  { key: "creator", label: "Creator", placeholder: "App that created the PDF" },
  { key: "producer", label: "Producer", placeholder: "App that produced the PDF" },
];

const EMPTY: Omit<PdfMetadata, "creationDate"|"modificationDate"> = {
  title: "", author: "", subject: "", keywords: "", creator: "", producer: "",
};

export default function PdfMetadataEditor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [meta, setMeta] = useState<Omit<PdfMetadata, "creationDate"|"modificationDate">>(EMPTY);
  const [dates, setDates] = useState<{ created?: string; modified?: string }>({});
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      const res = await readPdfMetadata(bytes);
      if (!res.ok) { toast.error(res.error); return; }
      const { metadata } = res.output;
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setMeta({ title: metadata.title, author: metadata.author, subject: metadata.subject,
        keywords: metadata.keywords, creator: metadata.creator, producer: metadata.producer });
      setDates({ created: metadata.creationDate, modified: metadata.modificationDate });
      setResult(null); setError("");
    } catch { toast.error(`Could not read ${f.name}`); }
  }

  function reset() { setFile(null); setMeta(EMPTY); setDates({}); setResult(null); setError(""); }

  async function save() {
    if (!file) return;
    setWorking(true); setError(""); setResult(null);
    const res = await writePdfMetadata(file.bytes, meta);
    setWorking(false);
    if (res.ok) { setResult(res.output); toast.success("Metadata saved!"); }
    else setError(res.error);
  }

  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{file.pageCount} pages • {formatBytes(file.bytes.length)}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={reset}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void loadFile(f); }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors">
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Metadata fields will be loaded automatically.</p>
        </button>
      )}
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Choose PDF"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />

      {file && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`meta-${field.key}`}>{field.label}</Label>
                <Input id={`meta-${field.key}`} value={meta[field.key]} placeholder={field.placeholder}
                  onChange={(e) => setMeta((prev) => ({ ...prev, [field.key]: e.target.value }))} />
              </div>
            ))}
          </div>

          {(dates.created || dates.modified) && (
            <div className="flex flex-wrap gap-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              {dates.created && <span>Created: {new Date(dates.created).toLocaleString()}</span>}
              {dates.modified && <span>Modified: {new Date(dates.modified).toLocaleString()}</span>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMeta(EMPTY)}>
              <ShieldOff className="h-3.5 w-3.5" /> Privacy clean
            </Button>
            <span className="text-xs text-muted-foreground">Clears all fields before sharing.</span>
          </div>
        </>
      )}

      <ActionBar>
        <RunButton onClick={() => void save()} disabled={!file} loading={working} label="Save metadata" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Updated PDF ready • {formatBytes(result.length)}</p>
          <Button onClick={() => downloadBytes(result, `meta-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Privacy: runs 100% locally in your browser — your PDF never leaves your device.</p>
    </div>
  );
}
