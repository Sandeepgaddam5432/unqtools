"use client";

/** Export PDF Form Data — real UI (CSV / JSON / FDF). */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { formatBytes } from "../_shared/download";
import { exportFormData, type ExportResult } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function ExportFormData() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [data, setData] = useState<ExportResult | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setData(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setData(null);
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setData(null);
    const r = await exportFormData(file.bytes);
    setWorking(false);
    if (r.ok) setData(r.output);
    else setError(r.error);
  }

  function download(text: string, base: string, ext: string, mime: string) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
          <Table2 className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a fillable form PDF here</p>
          <p className="mt-1 text-xs text-muted-foreground">Export filled form values as CSV, JSON or FDF.</p>
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
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Export form data" />
            <ClearButton onClick={reset} disabled={!file && !data && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {data && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{data.fields.length} field(s) exported</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-1.5 pr-3 font-medium">Field</th>
                      <th className="py-1.5 pr-3 font-medium">Type</th>
                      <th className="py-1.5 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.fields.map((f, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        <td className="py-1.5 pr-3 font-medium">{f.name}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground">{f.type}</td>
                        <td className="py-1.5">{f.value || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => download(data.csv, file?.name.replace(/\.pdf$/i, "") ?? "form", "csv", "text/csv")}>
                  <Download className="h-3.5 w-3.5" /> Download CSV
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => download(data.json, file?.name.replace(/\.pdf$/i, "") ?? "form", "json", "application/json")}>
                  <Download className="h-3.5 w-3.5" /> Download JSON
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => download(data.fdf, file?.name.replace(/\.pdf$/i, "") ?? "form", "fdf", "application/vnd.fdf")}>
                  <Download className="h-3.5 w-3.5" /> Download FDF
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your form data never leaves your device.
      </p>
    </div>
  );
}
