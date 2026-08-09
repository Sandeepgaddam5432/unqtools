"use client";

/** PDF Document Info Viewer — real UI. */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Info, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { formatBytes } from "../_shared/download";
import { viewDocumentInfo, type DocInfo } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function InfoViewer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [info, setInfo] = useState<DocInfo | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setInfo(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setInfo(null);
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setInfo(null);
    const r = await viewDocumentInfo(file.bytes);
    setWorking(false);
    if (r.ok) setInfo(r.output.info);
    else setError(r.error);
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
          <Info className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Inspect title, author, page sizes and more.</p>
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
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="View document info" />
            <ClearButton onClick={reset} disabled={!file && !info && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {info && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {(
                  [
                    ["Title", info.title || "—"],
                    ["Author", info.author || "—"],
                    ["Subject", info.subject || "—"],
                    ["Creator", info.creator || "—"],
                    ["Producer", info.producer || "—"],
                    ["Pages", String(info.pageCount)],
                    ["Keywords", info.keywords.join(", ") || "—"],
                    ["Encrypted", info.encrypted ? "Yes" : "No"],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-lg border bg-muted/40 p-2">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium truncate" title={value}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-1.5 pr-3 font-medium">Page</th>
                      <th className="py-1.5 pr-3 font-medium">Width (pt)</th>
                      <th className="py-1.5 pr-3 font-medium">Height (pt)</th>
                      <th className="py-1.5 font-medium">Rotation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.pages.map((p) => (
                      <tr key={p.page} className="border-b border-border/60 last:border-0">
                        <td className="py-1.5 pr-3">{p.page}</td>
                        <td className="py-1.5 pr-3">{p.width}</td>
                        <td className="py-1.5 pr-3">{p.height}</td>
                        <td className="py-1.5">{p.rotation}°</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => downloadJson(info)}>
                <Download className="h-3.5 w-3.5" /> Download JSON
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device.
      </p>
    </div>
  );
}

function downloadJson(info: DocInfo) {
  const blob = new Blob([JSON.stringify(info, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pdf-info.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
