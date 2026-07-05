"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowDown, ArrowUp, Download, FileImage, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import {
  imagesToPdf,
  type ImageEntry,
  type MarginSize,
  type Orientation,
  type PageSize,
} from "./logic";

const PAGE_SIZES: { value: PageSize; label: string }[] = [
  { value: "a4", label: "A4" },
  { value: "letter", label: "Letter" },
  { value: "fit", label: "Fit to image" },
];
const ORIENTATIONS: { value: Orientation; label: string }[] = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];
const MARGINS: { value: MarginSize; label: string }[] = [
  { value: "none", label: "None" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

interface ImageItem extends ImageEntry { id: string; previewUrl: string; }
let nextId = 0;

export default function ImagesToPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [margin, setMargin] = useState<MarginSize>("medium");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  function addFiles(list: FileList | File[]) {
    const added: ImageItem[] = [];
    for (const file of Array.from(list)) {
      const bytes = new Uint8Array(0); // placeholder — we read async below
      nextId += 1;
      const item: ImageItem = {
        id: `img-${nextId}`,
        name: file.name,
        bytes,
        mimeType: file.type || "image/jpeg",
        previewUrl: URL.createObjectURL(file),
      };
      added.push(item);
      // Read bytes async and update state
      void file.arrayBuffer().then((buf) => {
        setImages((prev) =>
          prev.map((img) =>
            img.id === item.id ? { ...img, bytes: new Uint8Array(buf) } : img
          )
        );
      });
    }
    setImages((prev) => [...prev, ...added]);
    setResult(null); setError("");
  }

  function move(index: number, delta: number) {
    setImages((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[index]; next[index] = next[target]; next[target] = tmp;
      return next;
    });
    setResult(null);
  }

  function remove(id: string) {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
    setResult(null);
  }

  function reset() {
    images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setImages([]); setResult(null); setError("");
  }

  async function run() {
    if (images.length === 0 || images.some((i) => i.bytes.length === 0)) {
      setError("Images are still loading — please wait a moment and try again.");
      return;
    }
    setWorking(true); setError(""); setResult(null);
    const res = await imagesToPdf(images, { pageSize, orientation, margin });
    setWorking(false);
    if (res.ok) { setResult(res.output); toast.success("PDF created!"); }
    else setError(res.error);
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors">
        <FileImage className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Drop images here or click to browse</p>
        <p className="mt-1 text-xs text-muted-foreground">JPEG or PNG — one page per image</p>
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple
        className="hidden" aria-label="Choose images"
        onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />

      {images.length > 0 && (
        <ul className="space-y-2">
          {images.map((img, i) => (
            <li key={img.id} className="flex items-center gap-3 rounded-lg border bg-card p-2">
              <img src={img.previewUrl} alt={img.name} className="h-12 w-12 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{img.name}</p>
                {img.bytes.length > 0 && <p className="text-xs text-muted-foreground">{formatBytes(img.bytes.length)}</p>}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Move ${img.name} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Move ${img.name} down`} disabled={i === images.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${img.name}`} onClick={() => remove(img.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Page size</Label>
          <div className="flex flex-wrap gap-2">
            {PAGE_SIZES.map((s) => <Button key={s.value} variant={pageSize === s.value ? "default" : "outline"} size="sm" onClick={() => setPageSize(s.value)}>{s.label}</Button>)}
          </div>
        </div>
        {pageSize !== "fit" && (
          <div className="space-y-1.5">
            <Label>Orientation</Label>
            <div className="flex flex-wrap gap-2">
              {ORIENTATIONS.map((o) => <Button key={o.value} variant={orientation === o.value ? "default" : "outline"} size="sm" onClick={() => setOrientation(o.value)}>{o.label}</Button>)}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Margin</Label>
          <div className="flex flex-wrap gap-2">
            {MARGINS.map((m) => <Button key={m.value} variant={margin === m.value ? "default" : "outline"} size="sm" onClick={() => setMargin(m.value)}>{m.label}</Button>)}
          </div>
        </div>
      </div>

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={images.length === 0} loading={working}
          label={images.length > 0 ? `Convert ${images.length} image${images.length === 1 ? "" : "s"} to PDF` : "Convert to PDF"} />
        <ClearButton onClick={reset} disabled={images.length === 0 && !result && !error} label="Clear all" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium">PDF ready</p>
            <p className="text-xs text-muted-foreground">{images.length} pages • {formatBytes(result.length)}</p>
          </div>
          <Button onClick={() => downloadBytes(result, "images.pdf")} className="gap-1.5">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Privacy: conversion runs 100% locally in your browser — your images never leave your device.</p>
    </div>
  );
}
