"use client";

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { interleavePdf } from "./logic";

export default function InterleavePdf() {
  const inputARef = useRef<HTMLInputElement>(null);
  const inputBRef = useRef<HTMLInputElement>(null);
  const [pdfA, setPdfA] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [pdfB, setPdfB] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File, which: "A" | "B") {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      const entry = { name: f.name, bytes, pageCount: doc.getPageCount() };
      if (which === "A") setPdfA(entry);
      else setPdfB(entry);
      setResult(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setPdfA(null);
    setPdfB(null);
    setResult(null);
    setError("");
  }

  async function run() {
    if (!pdfA || !pdfB) return;
    setWorking(true);
    setError("");
    setResult(null);
    const res = await interleavePdf({
      bytesA: pdfA.bytes, nameA: pdfA.name, bytesB: pdfB.bytes, nameB: pdfB.name,
    });
    setWorking(false);
    if (res.ok) {
      setResult(res.output.bytes);
      toast.success(`Interleaved! ${res.output.totalPageCount} pages total`);
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      {/* PDF A */}
      <div>
        <p className="mb-1.5 text-sm font-medium">PDF A (first page goes first)</p>
        {pdfA ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{pdfA.name}</p>
              <p className="text-xs text-muted-foreground">
                {pdfA.pageCount} page{pdfA.pageCount === 1 ? "" : "s"} • {formatBytes(pdfA.bytes.length)}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Remove PDF A" onClick={() => setPdfA(null)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputARef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void loadFile(f, "A");
            }}
            className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <FileUp className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">Drop PDF A here</p>
          </button>
        )}
        <input
          ref={inputARef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          aria-label="Choose PDF A"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadFile(f, "A");
            e.target.value = "";
          }}
        />
      </div>

      {/* PDF B */}
      <div>
        <p className="mb-1.5 text-sm font-medium">PDF B (alternates with A)</p>
        {pdfB ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{pdfB.name}</p>
              <p className="text-xs text-muted-foreground">
                {pdfB.pageCount} page{pdfB.pageCount === 1 ? "" : "s"} • {formatBytes(pdfB.bytes.length)}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Remove PDF B" onClick={() => setPdfB(null)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputBRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void loadFile(f, "B");
            }}
            className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <FileUp className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">Drop PDF B here</p>
          </button>
        )}
        <input
          ref={inputBRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          aria-label="Choose PDF B"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadFile(f, "B");
            e.target.value = "";
          }}
        />
      </div>

      {pdfA && pdfB && (
        <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-3">
          Output order: A1, B1, A2, B2, A3, B3…
          {pdfA.pageCount !== pdfB.pageCount && (
            <> — the longer PDF's extra pages are appended at the end.</>
          )}
        </p>
      )}

      <ActionBar>
        <RunButton
          onClick={() => void run()}
          disabled={!pdfA || !pdfB}
          loading={working}
          label="Interleave PDFs"
        />
        <ClearButton onClick={reset} disabled={!pdfA && !pdfB && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Interleaved PDF ready • {formatBytes(result.length)}</p>
          <Button
            onClick={() => downloadBytes(result, `interleaved.pdf`)}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: interleaving runs 100% locally in your browser — your PDFs never leave your device.
      </p>
    </div>
  );
}
