"use client";

/** PDF Word Count & Statistics — real UI. */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { FileUp, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { formatBytes } from "../_shared/download";
import { analyzeText, type WordCountStats } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function WordCount() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [stats, setStats] = useState<WordCountStats | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setStats(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setStats(null);
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setStats(null);
    const r = await analyzeText(file.bytes);
    setWorking(false);
    if (r.ok) setStats(r.output);
    else setError(r.error);
  }

  const cells = stats
    ? [
        { label: "Words", value: stats.words.toLocaleString() },
        { label: "Characters", value: stats.chars.toLocaleString() },
        { label: "No spaces", value: stats.charsNoSpaces.toLocaleString() },
        { label: "Sentences", value: stats.sentences.toLocaleString() },
        { label: "Paragraphs", value: stats.paragraphs.toLocaleString() },
        { label: "Reading time", value: `${stats.readingMinutes} min` },
      ]
    : [];

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
          <Type className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Words, characters, sentences and reading time.</p>
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
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Count words" />
            <ClearButton onClick={reset} disabled={!file && !stats && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {cells.map((c) => (
                <div key={c.label} className="rounded-lg border bg-muted/40 p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{c.value}</p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              ))}
            </div>
          )}

          {stats && stats.perPage.length > 1 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-1.5 pr-3 font-medium">Page</th>
                    <th className="py-1.5 pr-3 font-medium">Words</th>
                    <th className="py-1.5 font-medium">Characters</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perPage.map((p) => (
                    <tr key={p.page} className="border-b border-border/60 last:border-0">
                      <td className="py-1.5 pr-3">Page {p.page}</td>
                      <td className="py-1.5 pr-3">{p.words.toLocaleString()}</td>
                      <td className="py-1.5">{p.chars.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
