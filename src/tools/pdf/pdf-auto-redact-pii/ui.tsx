"use client";

/** PDF Auto-Redact PII — real UI (detection report + redacted text export). */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Download, FileUp, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { formatBytes } from "../_shared/download";
import { autoRedactPii, type PiiMatch } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function AutoRedactPii() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [matches, setMatches] = useState<PiiMatch[]>([]);
  const [byKind, setByKind] = useState<Record<string, number>>({});
  const [redacted, setRedacted] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setMatches([]);
      setByKind({});
      setRedacted(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    setFile(null);
    setMatches([]);
    setByKind({});
    setRedacted(null);
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setMatches([]);
    setByKind({});
    setRedacted(null);
    const r = await autoRedactPii(file.bytes);
    setWorking(false);
    if (r.ok) {
      setMatches(r.output.matches);
      setByKind(r.output.byKind);
      setRedacted(r.output.bytes);
      toast.success(`Found ${r.output.matches.length} PII match(es)`);
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
          <ShieldAlert className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Scan for emails, phones, Aadhaar, cards, IPs, PAN, SSN.</p>
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
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Scan for PII" />
            <ClearButton onClick={reset} disabled={!file && matches.length === 0 && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {matches.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {Object.entries(byKind).map(([kind, count]) => (
                  <span key={kind} className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
                    {kind}: {count}
                  </span>
                ))}
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-1.5 pr-3 font-medium">Page</th>
                      <th className="py-1.5 pr-3 font-medium">Type</th>
                      <th className="py-1.5 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.slice(0, 50).map((m, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        <td className="py-1.5 pr-3">{m.page}</td>
                        <td className="py-1.5 pr-3 text-muted-foreground">{m.kind}</td>
                        <td className="py-1.5 font-mono text-xs">{m.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {matches.length > 50 && <p className="text-xs text-muted-foreground mt-1">… +{matches.length - 50} more</p>}
              </div>
              <p className="text-xs text-muted-foreground rounded-lg border bg-muted/40 p-3">
                ⚠️ Detection is pattern-based (may miss obfuscated values). Review the list before acting on it.
              </p>
              {redacted && (
                <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => downloadRedacted(redacted, file.name)}>
                  <Download className="h-3.5 w-3.5" /> Download masked TXT
                </Button>
              )}
            </div>
          )}

          {matches.length === 0 && !error && (
            <p className="text-sm text-muted-foreground rounded-lg border bg-muted/40 p-3">
              Run the scan to check this PDF for personal data.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device.
      </p>
    </div>
  );
}

function downloadRedacted(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/\.pdf$/i, "")}-redacted.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
