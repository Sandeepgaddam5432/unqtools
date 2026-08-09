"use client";

/**
 * Add Header & Footer to PDF — real UI.
 * Header/footer text with {page}/{pages} placeholders, positions, rules.
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
import { addHeaderFooter, type HfPosition } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

const POSITIONS: { value: HfPosition; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

export default function AddHeaderFooter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [header, setHeader] = useState("UnQTools");
  const [footer, setFooter] = useState("Page {page} of {pages}");
  const [headerPos, setHeaderPos] = useState<HfPosition>("left");
  const [footerPos, setFooterPos] = useState<HfPosition>("right");
  const [fontSize, setFontSize] = useState("9");
  const [bold, setBold] = useState(false);
  const [color, setColor] = useState("#333333");
  const [rules, setRules] = useState(false);
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

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    const r = await addHeaderFooter(file.bytes, {
      headerText: header,
      footerText: footer,
      headerPosition: headerPos,
      footerPosition: footerPos,
      fontSize: Number(fontSize) || 9,
      bold,
      color,
      rules,
      pages,
    });
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      toast.success(`Added to ${r.output.pagesModified} page(s)`);
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
          <p className="mt-1 text-xs text-muted-foreground">
            Add a header and/or footer with automatic page numbers ({`{page}`} / {`{pages}`}).
          </p>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="hf-h">Header text</Label>
              <Input id="hf-h" value={header} onChange={(e) => setHeader(e.target.value)} placeholder="e.g. Confidential" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hf-f">Footer text</Label>
              <Input id="hf-f" value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="e.g. Page {page} of {pages}" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Header position</Label>
              <div className="flex flex-wrap gap-1">
                {POSITIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setHeaderPos(p.value)}
                    aria-pressed={headerPos === p.value}
                    className={`px-2 py-1 rounded text-xs cursor-pointer ${
                      headerPos === p.value ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Footer position</Label>
              <div className="flex flex-wrap gap-1">
                {POSITIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFooterPos(p.value)}
                    aria-pressed={footerPos === p.value}
                    className={`px-2 py-1 rounded text-xs cursor-pointer ${
                      footerPos === p.value ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="hf-size">Font size</Label>
              <Input id="hf-size" type="number" min={6} max={36} value={fontSize} onChange={(e) => setFontSize(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hf-color">Color</Label>
              <Input id="hf-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 p-1" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} className="h-4 w-4 accent-primary" />
                Bold
              </label>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)} className="h-4 w-4 accent-primary" />
                Rule lines
              </label>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="hf-pages">Pages (optional)</Label>
            <Input id="hf-pages" value={pages} onChange={(e) => setPages(e.target.value)} placeholder={`All — or e.g. 1, 3-5`} />
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Add header & footer" />
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Header/footer added • {formatBytes(result.length)}</p>
              <Button onClick={() => downloadBytes(result, `header-footer-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device. Use {`{page}`} and {`{pages}`} for automatic numbers.
      </p>
    </div>
  );
}
