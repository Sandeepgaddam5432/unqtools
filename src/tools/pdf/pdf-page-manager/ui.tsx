"use client";

/**
 * PDF Page Manager — the merged all-in-one page editor.
 *
 * One file upload, seven operation tabs (delete / extract / duplicate /
 * insert / reorder / rotate / reverse), and "Apply to continue editing" so
 * users chain multiple operations without re-uploading. Every operation
 * delegates to the sibling engines via ./logic.ts — 100% client-side.
 */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Download,
  FileUp,
  Trash2,
  RotateCw,
  Shuffle,
  Scissors,
  CopyPlus,
  FilePlus2,
  Undo2,
  Eraser,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { runPageOperation, type PageOperation } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

const TABS: { id: PageOperation; label: string; icon: typeof Eraser; hint: string }[] = [
  { id: "delete", label: "Delete", icon: Eraser, hint: "Remove pages by number or range (e.g. 2, 5-7)." },
  { id: "extract", label: "Extract", icon: Scissors, hint: "Pull selected pages into a brand-new PDF." },
  { id: "duplicate", label: "Duplicate", icon: CopyPlus, hint: "Clone selected pages 1-100 times." },
  { id: "insert", label: "Insert", icon: FilePlus2, hint: "Insert pages from a second PDF at any position." },
  { id: "reorder", label: "Reorder", icon: Shuffle, hint: "Custom sequence (3,1,2), reverse, or duplicate order." },
  { id: "rotate", label: "Rotate", icon: RotateCw, hint: "Rotate all, odd, even or custom pages by 90/180/270°." },
  { id: "reverse", label: "Reverse", icon: Undo2, hint: "Flip the whole document — last page becomes first." },
];

export default function PdfPageManager() {
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [source, setSource] = useState<LoadedFile | null>(null);
  const [tab, setTab] = useState<PageOperation>("delete");

  // Delete / Extract / Duplicate / Insert(source pages)
  const [pages, setPages] = useState("");
  // Duplicate
  const [dupCount, setDupCount] = useState(2);
  // Insert
  const [insertPos, setInsertPos] = useState<string>("end");
  // Reorder
  const [sequence, setSequence] = useState("");
  const [reorderMode, setReorderMode] = useState<"custom" | "reverse" | "duplicate">("custom");
  // Rotate
  const [rotation, setRotation] = useState<90 | 180 | 270>(90);
  const [rotateTarget, setRotateTarget] = useState<"all" | "odd" | "even" | "custom">("all");
  const [rotatePages, setRotatePages] = useState("");

  const [result, setResult] = useState<{ bytes: Uint8Array; note: string } | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadMain(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setError("");
      toast.success(`Loaded ${f.name} (${doc.getPageCount()} pages)`);
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  async function loadSource(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setSource({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}.`);
    }
  }

  function resetAll() {
    setFile(null);
    setSource(null);
    setResult(null);
    setError("");
    setPages("");
    setSequence("");
    setRotatePages("");
  }

  /** After a successful op, offer the result as the new current file. */
  async function continueEditing(bytes: Uint8Array) {
    try {
      const doc = await PDFDocument.load(bytes);
      setFile({ name: file?.name ?? "edited.pdf", bytes, pageCount: doc.getPageCount() });
      setResult(null);
      toast.success("Result loaded — pick the next operation.");
    } catch {
      toast.error("Could not reload the result.");
    }
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);

    const res = await runPageOperation({
      operation: tab,
      bytes: file.bytes,
      source: source?.bytes,
      pages: pages.trim() || undefined,
      count: dupCount,
      rotation,
      rotateTarget,
      rotatePages: rotatePages.trim() || undefined,
      sequence: sequence.trim() || undefined,
      reorderMode,
      insertPosition: insertPos === "end" ? "end" : Number(insertPos),
    });

    setWorking(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const out = res.output;
    let note = "";
    try {
      const doc = await PDFDocument.load(out);
      note = `${doc.getPageCount()} page${doc.getPageCount() === 1 ? "" : "s"} • ${formatBytes(out.length)}`;
    } catch {
      note = formatBytes(out.length);
    }
    setResult({ bytes: out, note });
    toast.success("Operation complete");
  }

  const canRun = (): boolean => {
    if (!file) return false;
    switch (tab) {
      case "delete":
      case "extract":
      case "duplicate":
        return pages.trim().length > 0;
      case "insert":
        return Boolean(source);
      case "reorder":
        return reorderMode !== "custom" || sequence.trim().length > 0;
      case "rotate":
        return rotateTarget !== "custom" || rotatePages.trim().length > 0;
      case "reverse":
        return file.pageCount >= 2;
      default:
        return false;
    }
  };

  const tabInput = (
    <div className="space-y-4">
      {/* Delete / Extract / Duplicate */}
      {(tab === "delete" || tab === "extract" || tab === "duplicate") && (
        <div className="space-y-1.5">
          <Label htmlFor="pm-pages">
            {tab === "delete"
              ? "Pages to delete"
              : tab === "extract"
                ? "Pages to extract"
                : "Pages to duplicate"}
          </Label>
          <Input
            id="pm-pages"
            value={pages}
            onChange={(e) => {
              setPages(e.target.value);
              setResult(null);
            }}
            placeholder="e.g. 1, 3-5, 8"
          />
          <p className="text-xs text-muted-foreground">
            {file?.pageCount ?? 0} page{file && file.pageCount === 1 ? "" : "s"} total — supports ranges and open ranges like 8-.
          </p>
          {tab === "duplicate" && (
            <div className="space-y-1.5 pt-2">
              <Label htmlFor="pm-dup-count">Copies of each selected page</Label>
              <Input
                id="pm-dup-count"
                type="number"
                min={1}
                max={100}
                value={dupCount}
                onChange={(e) => {
                  setDupCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)));
                  setResult(null);
                }}
                className="w-28"
              />
            </div>
          )}
        </div>
      )}

      {/* Insert */}
      {tab === "insert" && (
        <div className="space-y-4">
          {source ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{source.name}</p>
                <p className="text-xs text-muted-foreground">
                  {source.pageCount} page{source.pageCount === 1 ? "" : "s"} • {formatBytes(source.bytes.length)}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Remove source PDF" onClick={() => setSource(null)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => sourceRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <FilePlus2 className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium">Choose the PDF to insert pages from</p>
            </button>
          )}
          <input
            ref={sourceRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            aria-label="Choose source PDF"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadSource(f);
              e.target.value = "";
            }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pm-pages">Pages from source (optional)</Label>
              <Input
                id="pm-pages"
                value={pages}
                onChange={(e) => {
                  setPages(e.target.value);
                  setResult(null);
                }}
                placeholder="All pages by default"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-insert-pos">Insert at position</Label>
              <Input
                id="pm-insert-pos"
                value={insertPos}
                onChange={(e) => {
                  setInsertPos(e.target.value);
                  setResult(null);
                }}
                placeholder='e.g. 2 or "end"'
              />
              <p className="text-xs text-muted-foreground">
                Position 2 = before page 2. Use “end” to append at the end.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reorder */}
      {tab === "reorder" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "custom", label: "Custom order" },
                { id: "reverse", label: "Reverse" },
                { id: "duplicate", label: "Duplicate each page" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setReorderMode(m.id);
                  setResult(null);
                }}
                aria-pressed={reorderMode === m.id}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  reorderMode === m.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground/80 hover:bg-muted/80"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {reorderMode === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="pm-seq">New page order</Label>
              <Input
                id="pm-seq"
                value={sequence}
                onChange={(e) => {
                  setSequence(e.target.value);
                  setResult(null);
                }}
                placeholder="e.g. 3, 1, 2"
              />
              <p className="text-xs text-muted-foreground">Every page must appear exactly once.</p>
            </div>
          )}
          {reorderMode === "reverse" && (
            <p className="text-xs text-muted-foreground rounded-lg border bg-muted/50 p-3">
              The whole document order is flipped: page N becomes page 1.
            </p>
          )}
          {reorderMode === "duplicate" && (
            <p className="text-xs text-muted-foreground rounded-lg border bg-muted/50 p-3">
              Each page is copied once right after itself (1,1,2,2,3,3…).
            </p>
          )}
        </div>
      )}

      {/* Rotate */}
      {tab === "rotate" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([90, 180, 270] as const).map((deg) => (
              <button
                key={deg}
                type="button"
                onClick={() => {
                  setRotation(deg);
                  setResult(null);
                }}
                aria-pressed={rotation === deg}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  rotation === deg ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80 hover:bg-muted/80"
                }`}
              >
                {deg}°
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "all", label: "All pages" },
                { id: "odd", label: "Odd pages" },
                { id: "even", label: "Even pages" },
                { id: "custom", label: "Custom" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setRotateTarget(t.id);
                  setResult(null);
                }}
                aria-pressed={rotateTarget === t.id}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  rotateTarget === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80 hover:bg-muted/80"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {rotateTarget === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="pm-rot-pages">Pages to rotate</Label>
              <Input
                id="pm-rot-pages"
                value={rotatePages}
                onChange={(e) => {
                  setRotatePages(e.target.value);
                  setResult(null);
                }}
                placeholder="e.g. 1, 3-5"
              />
            </div>
          )}
        </div>
      )}

      {/* Reverse */}
      {tab === "reverse" && (
        <p className="text-xs text-muted-foreground rounded-lg border bg-muted/50 p-3">
          Reverses the order of all {file?.pageCount ?? 0} pages. Content is preserved exactly — only the order changes.
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* File drop zone */}
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} page{file.pageCount === 1 ? "" : "s"} • {formatBytes(file.bytes.length)}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove file" onClick={resetAll}>
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
            if (f) void loadMain(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-10 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <FileUp className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">
            One upload powers all 7 page operations — delete, extract, duplicate, insert, reorder, rotate, reverse.
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
          if (f) void loadMain(f);
          e.target.value = "";
        }}
      />

      {/* Operation tabs */}
      {file && (
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  setResult(null);
                  setError("");
                }}
                aria-pressed={active}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer touch-target ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-foreground/80 hover:bg-muted/80"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Active tab hint + controls */}
      {file && (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            {TABS.find((t) => t.id === tab)?.hint}
          </p>
          {tabInput}

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!canRun()} loading={working} label={`Apply ${tab}`} />
            <ClearButton onClick={resetAll} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> {tab[0]!.toUpperCase() + tab.slice(1)} complete
                </p>
                <p className="text-xs text-muted-foreground">{result.note}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void continueEditing(result.bytes)}
                  className="gap-1.5 cursor-pointer"
                >
                  <Shuffle className="h-3.5 w-3.5" /> Apply next op
                </Button>
                <Button
                  size="sm"
                  onClick={() => downloadBytes(result.bytes, `${file.name.replace(/\.pdf$/i, "")}-${tab}.pdf`)}
                  className="gap-1.5 cursor-pointer"
                >
                  <Download className="h-4 w-4" /> Download
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device. Merged from the old Delete / Extract / Duplicate / Insert / Reorder / Rotate / Reverse PDF tools.
      </p>
    </div>
  );
}
