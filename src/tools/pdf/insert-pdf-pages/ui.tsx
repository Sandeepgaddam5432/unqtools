"use client";

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { insertPdfPages } from "./logic";

export default function InsertPdfPages() {
  const targetRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [source, setSource] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [position, setPosition] = useState("end");
  const [sourcePages, setSourcePages] = useState("");
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File, which: "target" | "source") {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      const entry = { name: f.name, bytes, pageCount: doc.getPageCount() };
      if (which === "target") setTarget(entry);
      else setSource(entry);
      setResult(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setTarget(null);
    setSource(null);
    setResult(null);
    setError("");
    setPosition("end");
    setSourcePages("");
  }

  async function run() {
    if (!target || !source) return;
    setWorking(true);
    setError("");
    setResult(null);
    const pos = position === "end" ? "end" : Number(position);
    const res = await insertPdfPages({
      target: target.bytes,
      targetName: target.name,
      source: source.bytes,
      sourceName: source.name,
      sourcePages,
      position: pos,
    });
    setWorking(false);
    if (res.ok) {
      setResult(res.output.bytes);
      toast.success(`Inserted ${res.output.insertedPageCount} pages — ${res.output.newPageCount} total`);
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-4">
      {/* Target PDF */}
      <div>
        <p className="mb-1.5 text-sm font-medium">Main PDF (target)</p>
        {target ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{target.name}</p>
              <p className="text-xs text-muted-foreground">
                {target.pageCount} page{target.pageCount === 1 ? "" : "s"} • {formatBytes(target.bytes.length)}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Remove target" onClick={() => setTarget(null)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => targetRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void loadFile(f, "target");
            }}
            className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <FileUp className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">Drop the main PDF here</p>
          </button>
        )}
        <input
          ref={targetRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          aria-label="Choose target PDF"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadFile(f, "target");
            e.target.value = "";
          }}
        />
      </div>

      {/* Source PDF */}
      <div>
        <p className="mb-1.5 text-sm font-medium">Source PDF (pages to insert)</p>
        {source ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{source.name}</p>
              <p className="text-xs text-muted-foreground">
                {source.pageCount} page{source.pageCount === 1 ? "" : "s"} • {formatBytes(source.bytes.length)}
              </p>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="Remove source" onClick={() => setSource(null)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => sourceRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void loadFile(f, "source");
            }}
            className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <FileUp className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">Drop the source PDF here</p>
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
            if (f) void loadFile(f, "source");
            e.target.value = "";
          }}
        />
      </div>

      {/* Options */}
      {target && source && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="insert-pos">Insert position</Label>
            <Input
              id="insert-pos"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="end or 1–N"
            />
            <p className="text-xs text-muted-foreground">
              Use &quot;end&quot; to append, or a number (1 = before page 1, 3 = before page 3).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="insert-src-pages">Source pages (optional)</Label>
            <Input
              id="insert-src-pages"
              value={sourcePages}
              onChange={(e) => setSourcePages(e.target.value)}
              placeholder="All (e.g. 1-3, 5)"
            />
          </div>
        </div>
      )}

      <ActionBar>
        <RunButton
          onClick={() => void run()}
          disabled={!target || !source}
          loading={working}
          label="Insert pages"
        />
        <ClearButton onClick={reset} disabled={!target && !source && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">PDF with inserted pages ready • {formatBytes(result.length)}</p>
          <Button
            onClick={() => downloadBytes(result, `inserted-${target?.name ?? "output.pdf"}`)}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: inserting runs 100% locally in your browser — your PDFs never leave your device.
      </p>
    </div>
  );
}
