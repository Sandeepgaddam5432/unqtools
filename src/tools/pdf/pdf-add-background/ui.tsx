"use client";

/**
 * Add Background to PDF — real UI.
 * Color / image / page-underlay backgrounds with opacity + page ranges.
 */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { addBackground, type BgMode, type ImageFit } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function AddBackgroundToPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const underRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mode, setMode] = useState<BgMode>("color");
  const [color, setColor] = useState("#f5f0e6");
  const [opacity, setOpacity] = useState("1");
  const [imageBytes, setImageBytes] = useState<Uint8Array | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageFit, setImageFit] = useState<ImageFit>("fit");
  const [underBytes, setUnderBytes] = useState<Uint8Array | null>(null);
  const [underName, setUnderName] = useState("");
  const [underPage, setUnderPage] = useState("1");
  const [pages, setPages] = useState("");
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

  async function loadImage(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      setImageBytes(bytes);
      setImageName(f.name);
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  async function loadUnderlay(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setUnderBytes(bytes);
      setUnderName(`${f.name} (${doc.getPageCount()} pages)`);
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    setImageBytes(null);
    setImageName("");
    setUnderBytes(null);
    setUnderName("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    const r = await addBackground(file.bytes, {
      mode,
      color,
      opacity: Number(opacity) || 1,
      imageBytes: imageBytes ?? undefined,
      imageFit,
      underlayBytes: underBytes ?? undefined,
      underlayPage: Number(underPage) || 1,
      pages,
    });
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      toast.success(`Background added to ${r.output.pagesModified} page(s)`);
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
          <p className="mt-1 text-xs text-muted-foreground">Add a color, image or page background.</p>
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
          {/* Mode */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "color", label: "Solid color" },
                { id: "image", label: "Image" },
                { id: "page", label: "PDF page" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
                className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                  mode === m.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mode === "color" && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="bg-color">Color</Label>
                <Input id="bg-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-20 p-1" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bg-op">Opacity ({Math.round(Number(opacity) * 100)}%)</Label>
                <input id="bg-op" type="range" min={5} max={100} value={Math.round((Number(opacity) || 1) * 100)} onChange={(e) => setOpacity((Number(e.target.value) / 100).toFixed(2))} className="w-40" />
              </div>
            </div>
          )}

          {mode === "image" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => imgRef.current?.click()}>
                  <ImageIcon className="h-3.5 w-3.5" /> {imageName || "Choose PNG/JPG"}
                </Button>
                {imageBytes && (
                  <Button variant="ghost" size="icon-sm" aria-label="Remove image" onClick={() => { setImageBytes(null); setImageName(""); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(["fit", "tile", "stretch"] as ImageFit[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setImageFit(f)}
                    aria-pressed={imageFit === f}
                    className={`px-2 py-1 rounded text-xs cursor-pointer ${
                      imageFit === f ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
          <input
            ref={imgRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            aria-label="Choose background image"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadImage(f);
              e.target.value = "";
            }}
          />

          {mode === "page" && (
            <div className="flex flex-wrap items-end gap-3">
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => underRef.current?.click()}>
                <FileUp className="h-3.5 w-3.5" /> {underName || "Choose background PDF"}
              </Button>
              {underBytes && (
                <div className="space-y-1">
                  <Label htmlFor="bg-up">Underlay page</Label>
                  <Input id="bg-up" type="number" min={1} value={underPage} onChange={(e) => setUnderPage(e.target.value)} className="w-20" />
                </div>
              )}
            </div>
          )}
          <input
            ref={underRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            aria-label="Choose underlay PDF"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadUnderlay(f);
              e.target.value = "";
            }}
          />

          <div className="space-y-1">
            <Label htmlFor="bg-pages">Pages (optional)</Label>
            <Input id="bg-pages" value={pages} onChange={(e) => setPages(e.target.value)} placeholder={`All — or e.g. 1, 3-5`} />
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file || (mode === "image" && !imageBytes) || (mode === "page" && !underBytes)} loading={working} label="Add background" />
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Background added • {formatBytes(result.length)}</p>
              <Button onClick={() => downloadBytes(result, `background-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF and images never leave your device.
      </p>
    </div>
  );
}
