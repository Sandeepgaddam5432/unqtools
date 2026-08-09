"use client";

/** Extract Text from PDF (PDF to TXT) — real UI. */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download, FileUp, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton, CopyButton } from "../../_shared";
import { formatBytes } from "../_shared/download";
import { extractText } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function ExtractText() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [text, setText] = useState("");
  const [report, setReport] = useState("");
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setText("");
      setResultBytes(null);
      setError("");
      setReport("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setText("");
    setResultBytes(null);
    setError("");
    setReport("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setText("");
    setResultBytes(null);
    setReport("");
    const r = await extractText(file.bytes);
    setWorking(false);
    if (r.ok) {
      setText(r.output.text);
      setResultBytes(r.output.bytes);
      setReport(`${r.output.pageCount} page(s) · ${r.output.totalChars.toLocaleString()} characters`);
      toast.success("Text extracted!");
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
          <FileText className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Extract the selectable text layer as a plain TXT file.</p>
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
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Extract text" />
            <ClearButton onClick={reset} disabled={!file && !text && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {text && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{report}</p>
                <div className="flex gap-2">
                  <CopyButton getText={() => text} label="Copy text" />
                  {resultBytes && (
                    <Button onClick={() => downloadTxt(resultBytes, file?.name.replace(/\.pdf$/i, "") ?? "extracted")} className="gap-1.5 cursor-pointer">
                      <Download className="h-4 w-4" /> Download .txt
                    </Button>
                  )}
                </div>
              </div>
              <Textarea value={text} readOnly className="min-h-[260px] font-mono text-sm resize-y" />
            </>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device. Only the selectable text layer is extracted; scanned
        (image) PDFs need OCR.
      </p>
    </div>
  );
}

function downloadTxt(bytes: Uint8Array, base: string) {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
