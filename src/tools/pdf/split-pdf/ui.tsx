"use client";

import React, { useRef, useState, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Trash2, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import {
  previewSplit,
  splitPdf,
  type SplitMode,
  type SplitOutputFile,
  type SplitPreviewGroup,
} from "./logic";

const MODES: { value: SplitMode; label: string; hint: string }[] = [
  {
    value: "ranges",
    label: "Custom ranges",
    hint: "Each comma-separated group becomes its own file, e.g. 1-3, 4-6",
  },
  { value: "every", label: "Every N pages", hint: "Split into equal chunks of N pages" },
  { value: "single", label: "One file per page", hint: "Extract every page as a separate PDF" },
];

const TEMPLATE_HELP = (
  <details className="text-xs text-muted-foreground">
    <summary className="cursor-pointer hover:text-foreground">Filename template help</summary>
    <ul className="mt-1 space-y-0.5 pl-4">
      <li><code>{"{base}"}</code> — original filename without .pdf</li>
      <li><code>{"{n}"}</code> — part number (1, 2, 3, …)</li>
      <li><code>{"{start}"}</code> — first page of this part</li>
      <li><code>{"{end}"}</code> — last page of this part</li>
      <li><code>{"{count}"}</code> — number of pages in this part</li>
    </ul>
  </details>
);

export default function SplitPdf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [mode, setMode] = useState<SplitMode>("ranges");
  const [ranges, setRanges] = useState("");
  const [every, setEvery] = useState("2");
  const [filenameTemplate, setFilenameTemplate] = useState("");
  const [reverse, setReverse] = useState(false);
  const [preview, setPreview] = useState<SplitPreviewGroup[] | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [results, setResults] = useState<SplitOutputFile[]>([]);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResults([]);
      setError("");
      setPreview(null);
      setPreviewError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setResults([]);
    setError("");
    setRanges("");
    setPreview(null);
    setPreviewError("");
    setReverse(false);
  }

  // Live preview: recompute whenever inputs change.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      setPreviewError("");
      return;
    }
    let cancelled = false;
    previewSplit(file.bytes, {
      mode,
      ranges,
      every: Number(every),
      baseName: file.name,
      filenameTemplate,
      reverse,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setPreview(res.output.groups);
          setPreviewError("");
        } else {
          setPreview(null);
          setPreviewError(res.error);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreview(null);
          setPreviewError("Could not compute preview.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [file, mode, ranges, every, filenameTemplate, reverse]);

  async function split() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResults([]);
    const res = await splitPdf(file.bytes, {
      mode,
      ranges,
      every: Number(every),
      baseName: file.name,
      filenameTemplate,
      reverse,
    });
    setWorking(false);
    if (res.ok) {
      setResults(res.output);
      toast.success(`Split into ${res.output.length} file${res.output.length === 1 ? "" : "s"}`);
    } else {
      setError(res.error);
    }
  }

  async function downloadAll() {
    if (results.length === 0) return;
    setDownloadingAll(true);
    try {
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        downloadBytes(r.bytes, r.name);
        // Small gap so browsers don't block multi-download prompts
        if (i < results.length - 1) await new Promise((res) => setTimeout(res, 400));
      }
      toast.success(`Downloaded ${results.length} files`);
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} page{file.pageCount === 1 ? "" : "s"} • {formatBytes(file.bytes.length)}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${file.name}`} onClick={reset}>
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
            const dropped = e.dataTransfer.files[0];
            if (dropped) void loadFile(dropped);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
        >
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Split by custom ranges, every N pages, or one file per page.
          </p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose a PDF file to split"
        onChange={(e) => {
          const picked = e.target.files?.[0];
          if (picked) void loadFile(picked);
          e.target.value = "";
        }}
      />

      <div role="radiogroup" aria-label="Split mode" className="grid gap-2 sm:grid-cols-3">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            onClick={() => setMode(m.value)}
            className={
              mode === m.value
                ? "rounded-lg border border-primary bg-primary/10 p-3 text-left"
                : "rounded-lg border border-border p-3 text-left transition-colors hover:border-primary/40"
            }
          >
            <p className="text-sm font-medium text-foreground">{m.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{m.hint}</p>
          </button>
        ))}
      </div>

      {mode === "ranges" && (
        <div className="space-y-1.5">
          <Label htmlFor="split-ranges">Page ranges (each group becomes a file)</Label>
          <Input
            id="split-ranges"
            value={ranges}
            onChange={(e) => setRanges(e.target.value)}
            placeholder="e.g. 1-3, 4-6"
            aria-describedby="split-ranges-hint"
          />
          <p id="split-ranges-hint" className="text-xs text-muted-foreground">
            Each comma-separated group becomes its own PDF. Overlapping or duplicate ranges are allowed.
          </p>
        </div>
      )}
      {mode === "every" && (
        <div className="space-y-1.5">
          <Label htmlFor="split-every">Pages per file</Label>
          <Input
            id="split-every"
            type="number"
            min={1}
            value={every}
            onChange={(e) => setEvery(e.target.value)}
            className="w-32"
          />
        </div>
      )}

      {/* Output settings */}
      <div className="space-y-3 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="split-template">Filename template</Label>
          <Input
            id="split-template"
            value={filenameTemplate}
            onChange={(e) => setFilenameTemplate(e.target.value)}
            placeholder="{base}-{n}"
            aria-describedby="split-template-help"
          />
          <div id="split-template-help">{TEMPLATE_HELP}</div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={reverse}
            onChange={(e) => setReverse(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <span>Reverse output order (last pages first)</span>
        </label>
      </div>

      {/* Live preview */}
      {file && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Preview
            {preview && (
              <span className="ml-2 text-xs text-muted-foreground">
                {preview.length} file{preview.length === 1 ? "" : "s"} will be created
              </span>
            )}
          </p>
          {previewError ? (
            <p className="text-xs text-muted-foreground italic">{previewError}</p>
          ) : preview && preview.length > 0 ? (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border bg-muted/30 p-2 text-xs">
              {preview.slice(0, 50).map((g) => (
                <li
                  key={g.partNumber}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-background"
                >
                  <span className="truncate font-mono text-foreground">{g.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {g.label} • {g.pageCount}p
                  </span>
                </li>
              ))}
              {preview.length > 50 && (
                <li className="px-2 py-1 text-muted-foreground italic">
                  … and {preview.length - 50} more
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">Enter valid options to see the preview.</p>
          )}
        </div>
      )}

      <ActionBar>
        <RunButton
          onClick={() => void split()}
          disabled={!file || !!previewError || (preview !== null && preview.length === 0)}
          loading={working}
          label={
            preview && preview.length > 0
              ? `Split into ${preview.length} file${preview.length === 1 ? "" : "s"}`
              : "Split PDF"
          }
        />
        <ClearButton onClick={reset} disabled={!file && results.length === 0 && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {results.length} file{results.length === 1 ? "" : "s"} ready
              <span className="ml-2 text-xs text-muted-foreground">
                {formatBytes(results.reduce((sum, r) => sum + r.bytes.length, 0))} total
              </span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void downloadAll()}
              disabled={downloadingAll}
              className="gap-1.5"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              {downloadingAll ? "Downloading…" : `Download all (${results.length})`}
            </Button>
          </div>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li
                key={`${i}-${r.name}`}
                className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Pages {r.startPage}-{r.endPage} • {r.pageCount} page{r.pageCount === 1 ? "" : "s"} •{" "}
                    {formatBytes(r.bytes.length)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Download ${r.name}`}
                  onClick={() => downloadBytes(r.bytes, r.name)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: splitting runs 100% locally in your browser — your PDF never leaves your device.
      </p>
    </div>
  );
}
