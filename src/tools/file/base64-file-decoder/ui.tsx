"use client";
import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  decodeBase64, formatHexPreview, suggestFilename,
  bytesToHex, formatBytes, isDataUrl,
  loadHistory, saveToHistory, clearHistory,
  type DecodeResult, type HistoryEntry,
} from "./logic";
import { Upload, FileSearch, History, ShieldCheck, X, FileDown } from "lucide-react";

interface BatchItem {
  id: number;
  input: string;
  result: DecodeResult;
}

export default function Base64FileDecoder() {
  const [input, setInput] = useState<string>("");
  const [customName, setCustomName] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const idCounter = useRef(0);

  const result = useMemo<DecodeResult>(() => decodeBase64(input), [input]);

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
    setInput(text);
    toast.success(`Loaded ${file.name}`);
  }, []);

  const downloadBlob = (bytes: Uint8Array, filename: string, mime: string) => {
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${filename}`);
  };

  const onDownload = useCallback(() => {
    if (!result.ok) return;
    const filename = customName.trim()
      ? (customName.trim().includes(".") ? customName.trim() : `${customName.trim()}.${result.ext}`)
      : suggestFilename(result.mime, result.ext);
    downloadBlob(result.bytes, filename, result.mime);
    const entry: HistoryEntry = {
      inputSize: result.inputSize,
      outputSize: result.outputSize,
      mime: result.mime,
      ext: result.ext,
      decodedAt: new Date().toISOString(),
    };
    setHistory(saveToHistory(entry));
  }, [result, customName]);

  const onCopyHex = useCallback(() => {
    if (!result.ok) return;
    const hex = bytesToHex(result.bytes);
    navigator.clipboard.writeText(hex)
      .then(() => toast.success("Copied hex to clipboard"))
      .catch(() => toast.error("Could not copy hex"));
  }, [result]);

  const onBatchAdd = useCallback(() => {
    if (!input.trim() || !result.ok) {
      toast.error("Nothing to add — enter valid Base64 first.");
      return;
    }
    const item: BatchItem = { id: ++idCounter.current, input, result };
    setBatch((prev) => [...prev, item]);
    toast.success("Added to batch");
  }, [input, result]);

  const onBatchDownload = useCallback(() => {
    for (const item of batch) {
      if (item.result.ok) {
        const filename = suggestFilename(item.result.mime, item.result.ext, `decoded-${item.id}`);
        downloadBlob(item.result.bytes, filename, item.result.mime);
      }
    }
  }, [batch]);

  const stats = result.ok
    ? [
        { label: "Input", value: `${result.inputSize.toLocaleString()} chars` },
        { label: "Output", value: `${result.outputSizeHuman} (${result.outputSize.toLocaleString()} B)` },
        { label: "Compression", value: `${result.overhead.toFixed(1)}% smaller than input` },
      ]
    : null;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="b64-dec-input" className="text-sm font-semibold">Base64 input</Label>
            <input
              type="file"
              accept=".b64,.txt,text/plain"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              className="hidden"
              id="b64-dec-file"
              ref={fileInputRef}
              aria-label="Load .b64 file"
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer">
              <Upload className="h-3 w-3" /> Load .b64
            </button>
          </div>
          <Textarea
            id="b64-dec-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            placeholder="Paste Base64 string or data URL here..."
            className="min-h-[160px] font-mono text-xs resize-y"
            spellCheck={false}
            aria-label="Base64 input"
          />
          {input && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {isDataUrl(input) ? "Data URL" : "Raw Base64"}
              </Badge>
              {result.ok && result.signature && (
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-3 w-3 mr-1" /> {result.signature.ext.toUpperCase()} verified
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {result.ok && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Output</Label>
                <div className="flex gap-2">
                  <CopyButton getText={() => result.ok ? bytesToHex(result.bytes) : ""} label="Copy hex" size="sm" />
                  <DownloadButton
                    getText={() => ""}
                    filename={customName.trim() ? (customName.trim().includes(".") ? customName.trim() : `${customName.trim()}.${result.ext}`) : suggestFilename(result.mime, result.ext)}
                    mime={result.mime}
                    label="Download"
                    size="sm"
                    disabled={!result.ok}
                  />
                  <button type="button" onClick={onDownload} className="text-xs text-primary hover:underline cursor-pointer">Save & download</button>
                  <button type="button" onClick={onBatchAdd} className="text-xs text-primary hover:underline cursor-pointer">Add to batch</button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="b64-dec-filename" className="text-[10px] text-muted-foreground">Custom filename (optional)</Label>
                <Input id="b64-dec-filename" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder={`decoded.${result.ext}`} className="h-8 text-xs" aria-label="Custom output filename" />
              </div>
              {stats && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {stats.map((s, i) => (
                    <div key={i}>
                      <span className="text-[10px] text-muted-foreground block">{s.label}</span>
                      <span className="font-mono">{s.value}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">MIME type</span>
                  <span className="font-mono break-all">{result.mime}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Suggested extension</span>
                  <span className="font-mono">.{result.ext}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Hex preview (first 256 bytes)</Label>
              <pre className="overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-[10px] leading-relaxed whitespace-pre max-h-[240px]">
                {formatHexPreview(result.hexPreview.slice(0, 512))}
              </pre>
            </CardContent>
          </Card>
        </>
      )}

      {!result.ok && input.trim() && (
        <ErrorBanner message={result.error} />
      )}

      {batch.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Batch ({batch.length})</Label>
              <div className="flex gap-2">
                <button type="button" onClick={onBatchDownload} className="text-xs text-primary hover:underline cursor-pointer inline-flex items-center gap-1">
                  <FileDown className="h-3 w-3" /> Download all
                </button>
                <button type="button" onClick={() => setBatch([])} className="text-xs text-red-600 hover:underline cursor-pointer">Clear</button>
              </div>
            </div>
            <div className="space-y-1">
              {batch.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                  <div className="min-w-0">
                    {item.result.ok ? (
                      <>
                        <p className="font-mono truncate">decoded-{item.id}.{item.result.ext}</p>
                        <p className="text-[10px] text-muted-foreground">{item.result.outputSizeHuman} · {item.result.mime}</p>
                      </>
                    ) : (
                      <p className="text-red-600">Invalid Base64</p>
                    )}
                  </div>
                  <button type="button" onClick={() => setBatch((prev) => prev.filter((b) => b.id !== item.id))} className="text-red-600 hover:underline cursor-pointer">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold inline-flex items-center gap-1"><History className="h-3 w-3" /> History ({history.length})</Label>
            {history.length > 0 && (
              <button type="button" onClick={() => { clearHistory(); setHistory([]); }} className="text-xs text-red-600 hover:underline cursor-pointer">Clear</button>
            )}
          </div>
          <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
            {showHistory ? "Hide" : "Show"} history
          </button>
          {showHistory && (
            history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No history yet.</p>
            ) : (
              <div className="space-y-1 max-h-[160px] overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                    <p className="font-medium">{h.inputSize.toLocaleString()} chars → {formatBytes(h.outputSize)} (.{h.ext}, {h.mime})</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(h.decodedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {!input && (
        <EmptyState title="Paste Base64 to decode" hint="Raw · URL-safe · line-wrapped · data URL · magic bytes · hex preview · batch. 100% local." icon={<FileSearch className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all decoding runs in your browser. Your data never leaves your device. Only sizes + MIME types are saved to history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
