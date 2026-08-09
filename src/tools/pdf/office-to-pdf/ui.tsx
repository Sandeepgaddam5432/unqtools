"use client";

/**
 * Office to PDF — real UI.
 * DOCX / XLSX / PPTX / TXT / RTF / CSV → PDF entirely in the browser.
 */

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { officeToPdf, officeKindFromName, type OfficeToPdfOptions } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; kind: string };

const ACCEPT = ".docx,.xlsx,.pptx,.txt,.rtf,.csv";

export default function OfficeToPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [pageSize, setPageSize] = useState<OfficeToPdfOptions["pageSize"]>("a4");
  const [orientation, setOrientation] = useState<OfficeToPdfOptions["orientation"]>("portrait");
  const [margin, setMargin] = useState("48");
  const [bodySize, setBodySize] = useState("12");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [meta, setMeta] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const kind = officeKindFromName(f.name);
      if (!kind) {
        toast.error("Unsupported file — use .docx, .xlsx, .pptx, .txt, .rtf or .csv");
        return;
      }
      const bytes = new Uint8Array(await f.arrayBuffer());
      setFile({ name: f.name, bytes, kind });
      setResult(null);
      setError("");
      setMeta("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    setMeta("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    setMeta("");
    const r = await officeToPdf(file.name, file.bytes, {
      pageSize,
      orientation,
      margin: Number(margin) || 48,
      bodySize: Number(bodySize) || 12,
    });
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      setMeta(`${r.output.kind.toUpperCase()} • ${r.output.extractedChars.toLocaleString()} characters extracted`);
      toast.success("Converted to PDF!");
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
            <p className="text-xs text-muted-foreground">
              {file.kind.toUpperCase()} • {formatBytes(file.bytes.length)}
            </p>
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
          <p className="text-sm font-medium">Drop a Word, Excel, PowerPoint or text file</p>
          <p className="mt-1 text-xs text-muted-foreground">.docx • .xlsx • .pptx • .txt • .rtf • .csv</p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        aria-label="Choose Office file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f);
          e.target.value = "";
        }}
      />

      {file && (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Page size</Label>
              <select value={pageSize} onChange={(e) => setPageSize(e.target.value as OfficeToPdfOptions["pageSize"])} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Orientation</Label>
              <select value={orientation} onChange={(e) => setOrientation(e.target.value as OfficeToPdfOptions["orientation"])} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="off-margin">Margin (pt)</Label>
              <input id="off-margin" type="number" min={20} max={120} value={margin} onChange={(e) => setMargin(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="off-size">Body size</Label>
              <input id="off-size" type="number" min={9} max={20} value={bodySize} onChange={(e) => setBodySize(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </div>
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Convert to PDF" />
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div>
                <p className="text-sm font-medium">PDF ready • {formatBytes(result.length)}</p>
                {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
              </div>
              <Button onClick={() => downloadBytes(result, `${file?.name.replace(/\.[^.]+$/, "") ?? "document"}.pdf`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your file never leaves your device. Text is extracted and rendered as a clean, searchable PDF (bold/italic and tables are preserved).
      </p>
    </div>
  );
}
