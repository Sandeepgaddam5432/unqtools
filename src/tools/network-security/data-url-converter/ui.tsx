"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  encodeText,
  encodeBytes,
  parseDataUrl,
  getDataUrlSize,
  getUrlLength,
  getMimeType,
  isBinaryMimeType,
  suggestExtension,
  formatBytes,
  checkDataUrlSize,
  optimizeSvgDataUrl,
  toImgTag,
  toCssBackground,
  toFaviconLink,
} from "./logic";
import { toast } from "sonner";
import { AlertTriangle, Code2 } from "lucide-react";
import { FileCode, Upload, Download } from "lucide-react";

export default function DataUrlConverter() {
  const [tab, setTab] = useState<"encode" | "decode">("encode");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 w-full max-w-xs gap-1 p-1 rounded-lg bg-muted">
        <button
          type="button"
          onClick={() => setTab("encode")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            tab === "encode" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={tab === "encode"}
        >
          File → Data URL
        </button>
        <button
          type="button"
          onClick={() => setTab("decode")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            tab === "decode" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={tab === "decode"}
        >
          Data URL → File
        </button>
      </div>

      {tab === "encode" ? <EncodeTab /> : <DecodeTab />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all encoding
            and decoding happens locally. Your files never leave your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function EncodeTab() {
  const [file, setFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File | null) => {
    if (!f) return;
    setError(null);
    setFile(f);
    try {
      // Read as array buffer, then encode
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const url = encodeBytes(bytes, f.type || "application/octet-stream");
      setDataUrl(url);
    } catch (e) {
      setError((e as Error).message ?? "Encoding failed");
      setDataUrl("");
    }
  }, []);

  const handleTextEncode = useCallback(() => {
    if (!file) return;
    // For text files, use encodeText for cleaner output
    file.text().then((text) => {
      try {
        setDataUrl(encodeText(text, file.type || "text/plain"));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }, [file]);

  const download = useCallback(() => {
    if (!dataUrl) return;
    const blob = new Blob([dataUrl], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file?.name ?? "data"}.data-url.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [dataUrl, file]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="encode-file" className="text-sm">File to encode</Label>
          <input
            ref={inputRef}
            id="encode-file"
            type="file"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer file:hover:opacity-90 cursor-pointer"
            aria-label="File to encode as data URL"
          />
          {file && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="font-mono">{file.type || "unknown"}</Badge>
              <span>{formatBytes(file.size)}</span>
              <span>→</span>
              <span>~{formatBytes(Math.ceil(file.size * 1.37))} (base64)</span>
            </div>
          )}
          {file && file.type.startsWith("text/") && (
            <button
              type="button"
              onClick={handleTextEncode}
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              Encode as plain text instead of base64
            </button>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {dataUrl && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Data URL</Label>
              <div className="flex gap-1">
                <CopyButton getText={() => dataUrl} label="Copy" size="sm" />
                <button
                  type="button"
                  onClick={download}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border bg-background hover:bg-muted cursor-pointer"
                >
                  <Download className="h-3 w-3" /> Save .txt
                </button>
              </div>
            </div>
            <Textarea
              readOnly
              value={dataUrl}
              className="min-h-[100px] font-mono text-xs resize-y break-all"
              aria-label="Generated data URL"
            />
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="font-mono">{getMimeType(dataUrl) ?? "unknown"}</Badge>
              <Badge variant="outline">{formatBytes(getDataUrlSize(dataUrl))} data</Badge>
              <Badge variant="outline">{formatBytes(getUrlLength(dataUrl))} URL length</Badge>
            </div>

            {/* Size warning (blueprint feature) */}
            {(() => {
              const warning = checkDataUrlSize(dataUrl);
              if (!warning) return null;
              return (
                <div className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
                  warning.severity === "error" ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400" :
                  warning.severity === "warning" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                  "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                }`}>
                  <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  <div>
                    <p>{warning.message}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{warning.recommendation}</p>
                  </div>
                </div>
              );
            })()}

            {/* Embed templates (blueprint feature + extra) */}
            <div className="pt-2 border-t border-border/40">
              <Label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Code2 className="h-3 w-3" /> Embed as code
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => { navigator.clipboard.writeText(toImgTag(dataUrl, file?.name ?? "image")); toast.success("<img> tag copied"); }}
                  className="px-2 py-1 rounded-md text-[10px] font-medium border bg-background hover:bg-muted cursor-pointer">
                  &lt;img&gt; tag
                </button>
                <button type="button" onClick={() => { navigator.clipboard.writeText(toCssBackground(dataUrl)); toast.success("CSS copied"); }}
                  className="px-2 py-1 rounded-md text-[10px] font-medium border bg-background hover:bg-muted cursor-pointer">
                  CSS background
                </button>
                <button type="button" onClick={() => { navigator.clipboard.writeText(toFaviconLink(dataUrl)); toast.success("Favicon link copied"); }}
                  className="px-2 py-1 rounded-md text-[10px] font-medium border bg-background hover:bg-muted cursor-pointer">
                  Favicon
                </button>
                {(getMimeType(dataUrl) === "image/svg+xml" || file?.type === "image/svg+xml") && (
                  <button type="button" onClick={async () => {
                    if (file) {
                      const text = await file.text();
                      const optimized = optimizeSvgDataUrl(text);
                      navigator.clipboard.writeText(optimized.url);
                      toast.success(`SVG optimized (${optimized.encoding}, saved ${optimized.savings} bytes)`);
                    }
                  }} className="px-2 py-1 rounded-md text-[10px] font-medium border bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">
                    Optimize SVG
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!dataUrl && !error && (
        <EmptyState
          title="Drop a file to encode"
          hint="Files are encoded as base64 data URLs locally. Try images, SVGs, or text files."
          icon={<Upload className="h-8 w-8" />}
        />
      )}
    </div>
  );
}

function DecodeTab() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsed = (() => {
    if (!input.trim()) return null;
    return parseDataUrl(input.trim());
  })();

  const errorMsg = (() => {
    if (!input.trim()) return null;
    if (parsed?.isValid) return null;
    return parsed?.error ?? "Invalid data URL";
  })();

  const download = useCallback(() => {
    if (!parsed?.isValid) return;
    // Convert decoded data back to bytes
    const bytes = new TextEncoder().encode(parsed.data);
    const blob = new Blob([bytes as BlobPart], { type: parsed.mimeType || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `decoded.${suggestExtension(parsed.mimeType)}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [parsed]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="decode-input" className="text-sm">Data URL to decode</Label>
            <button
              type="button"
              onClick={() => setInput("data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==")}
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              Load sample
            </button>
          </div>
          <Textarea
            id="decode-input"
            placeholder="data:text/plain;base64,SGVsbG8="
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[80px] font-mono text-xs resize-y break-all"
            aria-label="Data URL to decode"
            spellCheck={false}
          />
        </CardContent>
      </Card>

      {errorMsg && <ErrorBanner message={errorMsg} />}

      {parsed?.isValid && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Decoded content</Label>
                <div className="flex gap-1">
                  <CopyButton getText={() => parsed.data} label="Copy text" size="sm" />
                  <button
                    type="button"
                    onClick={download}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border bg-background hover:bg-muted cursor-pointer"
                  >
                    <Download className="h-3 w-3" /> Download
                  </button>
                </div>
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all max-h-[300px]">
                {parsed.data}
              </pre>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="font-mono">{parsed.mimeType}</Badge>
                <Badge variant="outline">{parsed.isBase64 ? "base64" : "plain"}</Badge>
                <Badge variant="outline">{isBinaryMimeType(parsed.mimeType) ? "binary" : "text"}</Badge>
                <Badge variant="outline">{formatBytes(getDataUrlSize(input.trim()))}</Badge>
                <Badge variant="outline">.{suggestExtension(parsed.mimeType)}</Badge>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!input.trim() && (
        <EmptyState
          title="Paste a data URL to decode"
          hint="Decoded locally — your data URL never leaves your browser."
          icon={<FileCode className="h-8 w-8" />}
        />
      )}
    </div>
  );
}
