"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowDown, ArrowUp, Download, FileUp, GripVertical, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, EmptyState, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { getMergeOutputName, mergePdfs, previewMerge, type MergeInput } from "./logic";

interface PdfEntry extends MergeInput {
  id: string;
  pageCount: number;
  /** Optional page-range spec, e.g. "1-3, 5" — empty = all pages */
  pages: string;
}

let nextId = 0;

export default function MergePdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PdfEntry[]>([]);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [outputName, setOutputName] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaAuthor, setMetaAuthor] = useState("");
  const [metaSubject, setMetaSubject] = useState("");
  const [interleave, setInterleave] = useState(false);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);

  async function addFiles(list: FileList | File[]) {
    const added: PdfEntry[] = [];
    for (const file of Array.from(list)) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const doc = await PDFDocument.load(bytes);
        nextId += 1;
        added.push({
          id: `pdf-${nextId}`,
          name: file.name,
          bytes,
          pageCount: doc.getPageCount(),
          pages: "",
        });
      } catch {
        toast.error(`Could not read ${file.name} — it may be corrupted or password-protected.`);
      }
    }
    if (added.length > 0) {
      setFiles((prev) => [...prev, ...added]);
      setResult(null);
      setError("");
    }
  }

  const move = useCallback((index: number, delta: number) => {
    setFiles((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
    setResult(null);
  }, []);

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setResult(null);
  }

  function updatePages(id: string, value: string) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, pages: value } : f)));
    setResult(null);
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setError("");
    setOutputName("");
    setMetaTitle("");
    setMetaAuthor("");
    setMetaSubject("");
    setShowAdvanced(false);
    setPreviewTotal(null);
  }

  // Drag-and-drop reordering
  function onDragStart(id: string) {
    setDraggedId(id);
  }
  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    if (id !== draggedId) setDragOverId(id);
  }
  function onDrop(id: string) {
    if (!draggedId || draggedId === id) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    setFiles((prev) => {
      const from = prev.findIndex((f) => f.id === draggedId);
      const to = prev.findIndex((f) => f.id === id);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDraggedId(null);
    setDragOverId(null);
    setResult(null);
  }

  // Live preview: total pages that will end up in the merged PDF.
  useEffect(() => {
    let cancelled = false;
    if (files.length === 0) {
      setPreviewTotal(null);
      return;
    }
    previewMerge(files, { outputName, interleave, metadata: { title: metaTitle, author: metaAuthor, subject: metaSubject } })
      .then((res) => {
        if (!cancelled && res.ok) setPreviewTotal(res.output.totalSelectedPages);
        else if (!cancelled) setPreviewTotal(null);
      })
      .catch(() => !cancelled && setPreviewTotal(null));
    return () => {
      cancelled = true;
    };
  }, [files, outputName, metaTitle, metaAuthor, metaSubject, interleave]);

  async function merge() {
    setWorking(true);
    setError("");
    setResult(null);
    const res = await mergePdfs(files, {
      outputName,
      interleave,
      metadata: { title: metaTitle, author: metaAuthor, subject: metaSubject },
    });
    setWorking(false);
    if (res.ok) {
      setResult(res.output);
      toast.success(`Merged ${files.length} PDFs into ${previewTotal ?? ""} pages!`.trim());
    } else {
      setError(res.error);
    }
  }

  const finalName = `${getMergeOutputName({ outputName })}.pdf`;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void addFiles(e.dataTransfer.files);
        }}
        className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
      >
        <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Drop PDFs here or click to browse</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add two or more PDFs. Drag to reorder. Optionally pick page ranges per file.
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        aria-label="Choose PDF files to merge"
        onChange={(e) => {
          if (e.target.files) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {files.length === 0 ? (
        <EmptyState
          title="No files added yet"
          hint="Your files stay on your device — merging runs entirely in your browser."
        />
      ) : (
        <>
          <ul className="space-y-2" role="list" aria-label="Files to merge, drag to reorder">
            {files.map((f, i) => {
              const isDragOver = dragOverId === f.id && draggedId !== f.id;
              const isDragging = draggedId === f.id;
              return (
                <li
                  key={f.id}
                  draggable
                  onDragStart={() => onDragStart(f.id)}
                  onDragOver={(e) => onDragOver(e, f.id)}
                  onDrop={() => onDrop(f.id)}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDragOverId(null);
                  }}
                  className={
                    "flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 transition-shadow " +
                    (isDragOver ? "ring-2 ring-primary border-primary " : "") +
                    (isDragging ? "opacity-50 " : "")
                  }
                >
                  <span
                    className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-muted-foreground"
                    aria-label={`Drag handle for ${f.name}`}
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <span
                    className="w-5 text-center text-xs font-semibold text-muted-foreground"
                    aria-label={`Position ${i + 1} of ${files.length}`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.pageCount} page{f.pageCount === 1 ? "" : "s"} • {formatBytes(f.bytes.length)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor={`pages-${f.id}`} className="text-xs text-muted-foreground">
                      Pages
                    </Label>
                    <Input
                      id={`pages-${f.id}`}
                      value={f.pages}
                      onChange={(e) => updatePages(f.id, e.target.value)}
                      placeholder="All (e.g. 1-3, 5)"
                      className="h-8 w-36 text-xs"
                      aria-describedby={`pages-${f.id}-hint`}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${f.name} up`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${f.name} down`}
                      disabled={i === files.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => removeFile(f.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Output summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
            <div>
              <span className="font-medium text-foreground">{files.length}</span>
              <span className="text-muted-foreground"> file{files.length === 1 ? "" : "s"}</span>
              {previewTotal !== null && (
                <>
                  <span className="text-muted-foreground"> • </span>
                  <span className="font-medium text-foreground">{previewTotal}</span>
                  <span className="text-muted-foreground"> page{previewTotal === 1 ? "" : "s"} in output</span>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((s) => !s)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {showAdvanced ? "Hide" : "Output"} settings
            </Button>
          </div>

          {/* Advanced output settings */}
          {showAdvanced && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="space-y-1.5">
                <Label htmlFor="merge-output-name">Output filename</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="merge-output-name"
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder="merged"
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">.pdf</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Download will be saved as <code className="text-foreground">{finalName}</code>
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="merge-meta-title">Title (metadata)</Label>
                  <Input
                    id="merge-meta-title"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="merge-meta-author">Author (metadata)</Label>
                  <Input
                    id="merge-meta-author"
                    value={metaAuthor}
                    onChange={(e) => setMetaAuthor(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="merge-meta-subject">Subject (metadata)</Label>
                  <Input
                    id="merge-meta-subject"
                    value={metaSubject}
                    onChange={(e) => setMetaSubject(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Metadata is embedded inside the PDF and shows up in document properties. Leave blank to skip.
              </p>
            </div>
          )}
        </>
      )}

                <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={interleave}
              onChange={(e) => setInterleave(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Interleave pages (A1, B1, A2, B2…) — for two-sided scanning of separate files
          </label>

<ActionBar>
        <RunButton
          onClick={() => void merge()}
          disabled={files.length === 0}
          loading={working}
          label={
            files.length > 1
              ? `Merge ${files.length} PDFs${previewTotal !== null ? ` · ${previewTotal} pages` : ""}`
              : "Merge PDF"
          }
        />
        <ClearButton onClick={reset} disabled={files.length === 0 && !result && !error} label="Clear all" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Merged PDF ready</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(result.length)}
              {previewTotal !== null && ` • ${previewTotal} pages`}
            </p>
          </div>
          <Button onClick={() => downloadBytes(result, finalName)} className="gap-1.5">
            <Download className="h-4 w-4" /> Download {finalName}
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: merging runs 100% locally in your browser — your PDFs never leave your device.
      </p>
    </div>
  );
}
