"use client";

/** PDF Permissions Editor — real UI. */

import React, { useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, FileUp, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { downloadBytes, formatBytes } from "../_shared/download";
import { setPermissions } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function PermissionsEditor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [ownerPass, setOwnerPass] = useState("");
  const [userPass, setUserPass] = useState("");
  const [printing, setPrinting] = useState<"none" | "low" | "high">("high");
  const [copying, setCopying] = useState(true);
  const [modifying, setModifying] = useState(true);
  const [filling, setFilling] = useState(true);
  const [annotations, setAnnotations] = useState(true);
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
    const r = await setPermissions(file.bytes, {
      ownerPassword: ownerPass,
      userPassword: userPass || undefined,
      flags: { printing, copying, modifying, fillingForms: filling, annotations, accessibility: true },
    });
    setWorking(false);
    if (r.ok) {
      setResult(r.output.bytes);
      toast.success("Permissions set");
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
          <Lock className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Control printing, copying and editing with a password lock.</p>
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
              <Label htmlFor="perm-owner">Owner password (required)</Label>
              <Input id="perm-owner" type="password" value={ownerPass} onChange={(e) => setOwnerPass(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="perm-user">User password (optional)</Label>
              <Input id="perm-user" type="password" value={userPass} onChange={(e) => setUserPass(e.target.value)} placeholder="Leave empty = no password to open" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Printing</Label>
            <div className="flex flex-wrap gap-1">
              {(["none", "low", "high"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrinting(p)}
                  aria-pressed={printing === p}
                  className={`px-2 py-1 rounded text-xs cursor-pointer ${printing === p ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            {(
              [
                ["Allow copying", copying, setCopying],
                ["Allow modifying", modifying, setModifying],
                ["Allow form filling", filling, setFilling],
                ["Allow annotations", annotations, setAnnotations],
              ] as const
            ).map(([label, val, setter]) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={val} onChange={(e) => setter(e.target.checked)} className="h-4 w-4 accent-primary" />
                {label}
              </label>
            ))}
          </div>

          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file || !ownerPass} loading={working} label="Lock permissions" />
            <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {result && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Permissions locked • {formatBytes(result.length)}</p>
              <Button onClick={() => downloadBytes(result, `locked-${file?.name ?? "output.pdf"}`)} className="gap-1.5">
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
