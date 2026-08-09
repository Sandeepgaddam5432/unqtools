"use client";

/** PDF Summarize (On-Device AI) — real UI (extractive). */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Download, FileUp, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton, CopyButton } from "../../_shared";
import { formatBytes } from "../_shared/download";
import { summarizePdf } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function SummarizeAi() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [sentences, setSentences] = useState("5");
  const [summary, setSummary] = useState("");
  const [report, setReport] = useState("");
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setSummary("");
      setResultBytes(null);
      setError("");
      setReport("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setSummary("");
    setResultBytes(null);
    setError("");
    setReport("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setSummary("");
    setResultBytes(null);
    setReport("");
    const r = await summarizePdf(file.bytes, Number(sentences) || 5);
    setWorking(false);
    if (r.ok) {
      setSummary(r.output.summary);
      setResultBytes(r.output.bytes);
      setReport(`${r.output.sentences} source sentence(s) → summary is ~${r.output.ratio}% of the text`);
      toast.success("Summary generated!");
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
          <Sparkles className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">On-device extractive summary — no cloud, no API key.</p>
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
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="sum-n">Summary length (sentences)</Label>
              <Input id="sum-n" type="number" min={1} max={20} value={sentences} onChange={(e) => setSentences(e.target.value)} className="w-28" />
            </div>
            <p className="text-xs text-muted-foreground pb-2">Top key sentences, reordered by position.</p>
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Summarize" />
            <ClearButton onClick={reset} disabled={!file && !summary && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {summary && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Summary</p>
                  {report && <p className="text-xs text-muted-foreground">{report}</p>}
                </div>
                <div className="flex gap-2">
                  <CopyButton getText={() => summary} label="Copy summary" />
                  {resultBytes && (
                    <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => downloadSummary(resultBytes, file.name)}>
                      <Download className="h-3.5 w-3.5" /> Download .txt
                    </Button>
                  )}
                </div>
              </div>
              <Textarea value={summary} readOnly className="min-h-[180px] text-sm resize-y" />
            </>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device. This is extractive summarization (key sentences), not
        generative AI.
      </p>
    </div>
  );
}

function downloadSummary(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/\.pdf$/i, "")}-summary.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
