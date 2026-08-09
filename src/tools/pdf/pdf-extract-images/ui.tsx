"use client";

/** Extract Images from PDF — real UI (individual + ZIP download). */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Download, FileUp, FolderArchive, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { formatBytes } from "../_shared/download";
import { extractImages, type ExtractedImage } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function ExtractImages() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setImages([]);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setImages([]);
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setImages([]);
    const r = await extractImages(file.bytes);
    setWorking(false);
    if (r.ok) {
      setImages(r.output.images);
      toast.success(`Found ${r.output.count} image(s)`);
    } else {
      setError(r.error);
    }
  }

  function downloadOne(img: ExtractedImage) {
    const blob = new Blob([img.bytes.slice().buffer as ArrayBuffer], {
      type: img.format === "jpg" ? "image/jpeg" : img.format === "png" ? "image/png" : "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = img.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadAll() {
    if (images.length === 1) {
      downloadOne(images[0]!);
      return;
    }
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const img of images) zip.file(img.name, img.bytes.slice().buffer as ArrayBuffer);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file?.name.replace(/\.pdf$/i, "") ?? "pdf"}-images.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Could not create ZIP — downloading individually.");
      for (const img of images) downloadOne(img);
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
          <ImageIcon className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Pull every embedded image out as a file.</p>
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
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Extract images" />
            <ClearButton onClick={reset} disabled={!file && images.length === 0 && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {images.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{images.length} image(s) found</p>
                <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => void downloadAll()}>
                  <FolderArchive className="h-3.5 w-3.5" /> {images.length === 1 ? "Download" : "Download all (ZIP)"}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-1.5 pr-3 font-medium">File</th>
                      <th className="py-1.5 pr-3 font-medium">Format</th>
                      <th className="py-1.5 pr-3 font-medium">Dimensions</th>
                      <th className="py-1.5 pr-3 font-medium">Size</th>
                      <th className="py-1.5 font-medium">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {images.map((img, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3 font-medium">{img.name}</td>
                        <td className="py-2 pr-3 uppercase">{img.format}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{img.width}×{img.height}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{formatBytes(img.size)}</td>
                        <td className="py-2">
                          <Button variant="ghost" size="icon-sm" aria-label={`Download ${img.name}`} onClick={() => downloadOne(img)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
