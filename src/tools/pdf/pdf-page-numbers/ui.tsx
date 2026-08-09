"use client";

/**
 * PDF Page Numbers — 100x UI.
 * 7 formats, 6 positions, start page + start number, skip/apply ranges,
 * font size, bold, color, prefix/suffix, live preview of labels.
 */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import {
  addPageNumbers,
  formatNumber,
  previewNumbers,
  type NumberFormat,
  type NumberPosition,
} from "./logic";

const POSITIONS: { value: NumberPosition; label: string }[] = [
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
];

const FORMATS: { value: NumberFormat; label: string; sample: string }[] = [
  { value: "x", label: "Plain", sample: "1, 2, 3" },
  { value: "page-x", label: "Page X", sample: "Page 1" },
  { value: "page-x-of-n", label: "Page X of N", sample: "Page 1 of 10" },
  { value: "x-of-n", label: "X / N", sample: "1 / 10" },
  { value: "dash-x-dash", label: "- X -", sample: "- 1 -" },
  { value: "padded", label: "Zero-padded", sample: "01, 02" },
  { value: "roman", label: "Roman", sample: "I, II, III" },
];

export default function PdfPageNumbers() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [position, setPosition] = useState<NumberPosition>("bottom-center");
  const [format, setFormat] = useState<NumberFormat>("page-x-of-n");
  const [startAt, setStartAt] = useState("1");
  const [startPage, setStartPage] = useState("1");
  const [fontSize, setFontSize] = useState("12");
  const [bold, setBold] = useState(false);
  const [color, setColor] = useState("#333333");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [skipPages, setSkipPages] = useState("");
  const [applyPages, setApplyPages] = useState("");
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

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
  }

  const preview = file
    ? previewNumbers(file.pageCount, {
        position,
        format,
        startAt: Number(startAt) || 1,
        startPage: Number(startPage) || 1,
        fontSize: Number(fontSize) || 12,
        skipPages,
        applyPages,
      })
    : null;

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    const res = await addPageNumbers(file.bytes, {
      position,
      format,
      startAt: Number(startAt) || 1,
      startPage: Number(startPage) || 1,
      fontSize: Number(fontSize) || 12,
      bold,
      color,
      prefix,
      suffix,
      skipPages,
      applyPages,
    });
    setWorking(false);
    if (res.ok) {
      setResult(res.output);
      toast.success("Page numbers added!");
    } else {
      setError(res.error);
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
            const f = e.dataTransfer.files[0];
            if (f) void loadFile(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Position</Label>
          <div className="flex flex-wrap gap-2">
            {POSITIONS.map((p) => (
              <Button
                key={p.value}
                variant={position === p.value ? "default" : "outline"}
                size="sm"
                className="cursor-pointer"
                onClick={() => setPosition(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Format</Label>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <Button
                key={f.value}
                variant={format === f.value ? "default" : "outline"}
                size="sm"
                className="cursor-pointer"
                title={f.sample}
                onClick={() => setFormat(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pn-start">First number</Label>
          <Input id="pn-start" type="number" min={1} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-startpage">Start on page</Label>
          <Input id="pn-startpage" type="number" min={1} value={startPage} onChange={(e) => setStartPage(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-size">Font size (px)</Label>
          <Input id="pn-size" type="number" min={6} max={72} value={fontSize} onChange={(e) => setFontSize(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-color">Color</Label>
          <Input id="pn-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 p-1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-prefix">Prefix</Label>
          <Input id="pn-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g. § " />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-suffix">Suffix</Label>
          <Input id="pn-suffix" value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="e.g. ." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-skip">Skip pages</Label>
          <Input id="pn-skip" value={skipPages} onChange={(e) => setSkipPages(e.target.value)} placeholder="e.g. 1, 3" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pn-apply">Only on pages</Label>
          <Input id="pn-apply" value={applyPages} onChange={(e) => setApplyPages(e.target.value)} placeholder="e.g. 2-6" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} className="h-4 w-4 accent-primary" />
        Bold numbers
      </label>

      {preview && (
        <p className="text-xs text-muted-foreground rounded-lg border bg-muted/40 p-3">
          Preview: <span className="font-medium text-foreground">{prefix || ""}{preview.firstLabel}{suffix || ""}</span> …{" "}
          <span className="font-medium text-foreground">{prefix || ""}{preview.lastLabel}{suffix || ""}</span> —{" "}
          {preview.numbered} of {preview.total} pages numbered.
        </p>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Add page numbers" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Numbered PDF ready • {formatBytes(result.length)}</p>
          <Button onClick={() => downloadBytes(result, `numbered-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Privacy: runs 100% locally in your browser — your PDF never leaves your device.
      </p>
    </div>
  );
}
