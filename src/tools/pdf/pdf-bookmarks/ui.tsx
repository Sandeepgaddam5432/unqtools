"use client";

/** PDF Bookmarks Editor — real UI (add / list / remove outline items). */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Plus, Trash2, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { addBookmarks, removeBookmarks, readOutlines, type BookmarkItem } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function BookmarksEditor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [title, setTitle] = useState("");
  const [page, setPage] = useState("1");
  const [existing, setExisting] = useState<{ title: string; page: number }[]>([]);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setExisting(readOutlines(doc));
      setResult(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setItems([]);
    setExisting([]);
    setResult(null);
    setError("");
  }

  function addItem() {
    const t = title.trim();
    if (!t) return;
    setItems((prev) => [...prev, { title: t, page: Math.max(1, Number(page) || 1) }]);
    setTitle("");
  }

  async function run() {
    if (!file) return;
    if (items.length === 0) {
      setError("Add at least one bookmark.");
      return;
    }
    setWorking(true);
    setError("");
    setResult(null);
    const r = await addBookmarks(file.bytes, items);
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      toast.success(`Added ${r.output.bookmarks.length} bookmark(s)`);
    } else {
      setError(r.error);
    }
  }

  async function runRemove() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    const r = await removeBookmarks(file.bytes);
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      toast.success("Bookmarks removed");
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
          <Bookmark className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Add or remove bookmarks (outline) with page links.</p>
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
          {existing.length > 0 && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs font-medium text-foreground mb-1">Existing bookmarks ({existing.length})</p>
              <p className="text-xs text-muted-foreground">
                {existing.slice(0, 6).map((b) => `${b.title} → p.${b.page}`).join(" · ")}
                {existing.length > 6 ? ` … +${existing.length - 6} more` : ""}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="bm-title">Title</Label>
              <Input id="bm-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chapter 1" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bm-page">Page</Label>
              <Input id="bm-page" type="number" min={1} max={file.pageCount} value={page} onChange={(e) => setPage(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="space-y-1.5">
              {items.map((it, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border bg-muted/40 p-2 text-sm">
                  <span className="truncate">{it.title} → p.{it.page}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove bookmark" onClick={() => setItems((p) => p.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file || items.length === 0} loading={working} label={`Save ${items.length} bookmark(s)`} />
            <Button variant="outline" size="sm" onClick={() => void runRemove()} disabled={!file || existing.length === 0} className="cursor-pointer">
              Remove all bookmarks
            </Button>
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Bookmarks saved • {formatBytes(result.length)}</p>
              <Button onClick={() => downloadBytes(result, `bookmarks-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
                <Download className="h-4 w-4" /> Download
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
