"use client";

/** Import/Fill PDF Form Data — real UI (FDF / JSON / CSV). */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { importFormData } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };
type DataFile = { name: string; text: string; format: "fdf" | "json" | "csv" };

export default function ImportFormData() {
  const inputRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [data, setData] = useState<DataFile | null>(null);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setError("");
      setReport("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  async function loadData(f: File) {
    try {
      const text = await f.text();
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const format = ext === "fdf" ? "fdf" : ext === "csv" ? "csv" : "json";
      setData({ name: f.name, text, format });
      setResult(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setData(null);
    setResult(null);
    setError("");
    setReport("");
  }

  async function run() {
    if (!file || !data) return;
    setWorking(true);
    setError("");
    setResult(null);
    setReport("");
    const r = await importFormData(file.bytes, [], data.format, data.text);
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      setReport(`${r.output.setCount}/${r.output.totalFields} field(s) filled${r.output.skipped.length ? ` · skipped: ${r.output.skipped.join(", ")}` : ""}`);
      toast.success(`Filled ${r.output.setCount} field(s)!`);
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
          <p className="text-sm font-medium">Drop a fillable form PDF here</p>
          <p className="mt-1 text-xs text-muted-foreground">Then choose an FDF / JSON / CSV with the values.</p>
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
          {data ? (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-2.5 text-sm">
              <span className="truncate font-medium">{data.name}</span>
              <span className="text-xs text-muted-foreground ml-3 uppercase">{data.format}</span>
              <Button variant="ghost" size="icon-sm" aria-label="Remove data file" onClick={() => setData(null)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => dataRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Choose FDF / JSON / CSV
            </Button>
          )}
          <input
            ref={dataRef}
            type="file"
            accept=".fdf,.json,.csv"
            className="hidden"
            aria-label="Choose data file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadData(f);
              e.target.value = "";
            }}
          />

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file || !data} loading={working} label="Fill form" />
            <ClearButton onClick={reset} disabled={!file && !data && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div>
                <p className="text-sm font-medium">Form filled • {formatBytes(result.length)}</p>
                {report && <p className="text-xs text-muted-foreground mt-0.5">{report}</p>}
              </div>
              <Button onClick={() => downloadBytes(result, `filled-${file?.name ?? "form.pdf"}`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your form and data never leave your device.
      </p>
    </div>
  );
}
