"use client";

/** PDF to HTML — real UI. */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download, FileUp, Globe, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton, CopyButton } from "../../_shared";
import { formatBytes } from "../_shared/download";
import { pdfToHtml } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function PdfToHtml() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [html, setHtml] = useState("");
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setHtml("");
      setResultBytes(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setHtml("");
    setResultBytes(null);
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setHtml("");
    setResultBytes(null);
    const r = await pdfToHtml(file.bytes);
    setWorking(false);
    if (r.ok) {
      setHtml(r.output.html);
      setResultBytes(r.output.bytes);
      toast.success("Converted to HTML!");
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
          <Globe className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Convert to a clean, self-contained HTML document.</p>
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
          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Convert to HTML" />
            <ClearButton onClick={reset} disabled={!file && !html && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {html && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">HTML ready</p>
                <div className="flex gap-2">
                  <CopyButton getText={() => html} label="Copy HTML" />
                  {resultBytes && (
                    <Button onClick={() => downloadHtml(resultBytes, file?.name.replace(/\.pdf$/i, "") ?? "doc")} className="gap-1.5 cursor-pointer">
                      <Download className="h-4 w-4" /> Download .html
                    </Button>
                  )}
                </div>
              </div>
              <Textarea value={html} readOnly className="min-h-[240px] font-mono text-sm resize-y" />
            </>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device.
      </p>
    </div>
  );
}

function downloadHtml(bytes: Uint8Array, base: string) {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
