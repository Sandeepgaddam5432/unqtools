"use client";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  xmlToJson, jsonToXml, validateXml, validateJson,
  loadHistory, saveToHistory, clearHistory,
  DEFAULT_OPTIONS,
  type ConvertOptions, type ConversionHistoryEntry,
} from "./logic";
import { Braces, ArrowRightLeft, CheckCircle2, XCircle, History, Upload } from "lucide-react";

type Direction = "xml2json" | "json2xml";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<library xmlns:ns="https://example.com/ns">
  <book id="b1" available="true">
    <ns:title>XML for Beginners</ns:title>
    <author>Alice</author>
    <tags>
      <tag>programming</tag>
      <tag>xml</tag>
    </tags>
  </book>
  <book id="b2">
    <ns:title>Advanced JSON</ns:title>
    <author>Bob</author>
  </book>
</library>`;

export default function XmlToJsonConverter() {
  const [direction, setDirection] = useState<Direction>("xml2json");
  const [input, setInput] = useState<string>(SAMPLE_XML);
  const [options, setOptions] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ConversionHistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const update = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const result = useMemo<{ output: string | null; error: string | null }>(() => {
    if (!input.trim()) return { output: null, error: null };
    if (direction === "xml2json") {
      const r = xmlToJson(input, options);
      if (!r.ok) return { output: null, error: r.error };
      return { output: r.json, error: null };
    }
    const r = jsonToXml(input, options);
    if (!r.ok) return { output: null, error: r.error };
    return { output: r.xml, error: null };
  }, [input, direction, options]);

  useEffect(() => {
    setError(result.error);
  }, [result.error]);

  const validation = useMemo(() => {
    if (!input.trim()) return null;
    if (direction === "xml2json") {
      const r = validateXml(input);
      return r.ok ? { ok: true, message: "Well-formed XML" } : { ok: false, message: r.error! };
    }
    const r = validateJson(input);
    return r.ok ? { ok: true, message: "Valid JSON" } : { ok: false, message: r.error };
  }, [input, direction]);

  const swapDirection = useCallback(() => {
    setDirection((d) => (d === "xml2json" ? "json2xml" : "xml2json"));
    setInput((prev) => (result.output ? result.output : prev));
  }, [result.output]);

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.warning("Large file — conversion may take a moment.");
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      setInput(text);
      toast.success(`Loaded ${file.name}`);
    };
    reader.onerror = () => toast.error("Could not read file");
    reader.readAsText(file);
  }, []);

  const onConvert = () => {
    if (!result.output) return;
    const entry: ConversionHistoryEntry = {
      direction,
      attributePrefix: options.attributePrefix,
      textKey: options.textKey,
      inputSize: input.length,
      outputSize: result.output.length,
      convertedAt: new Date().toISOString(),
    };
    setHistory(saveToHistory(entry));
    toast.success("Saved to history");
  };

  const inputLabel = direction === "xml2json" ? "XML input" : "JSON input";
  const outputLabel = direction === "xml2json" ? "JSON output" : "XML output";
  const outputFilename = direction === "xml2json" ? "converted.json" : "converted.xml";
  const outputMime = direction === "xml2json" ? "application/json" : "application/xml";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Conversion direction</Label>
            <button type="button" onClick={swapDirection} className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer" aria-label="Swap direction">
              <ArrowRightLeft className="h-3 w-3" /> Swap
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setDirection("xml2json")} className={`rounded-md border px-3 py-2 text-xs cursor-pointer ${direction === "xml2json" ? "bg-primary/10 border-primary/30 font-semibold" : "bg-background border-input"}`} aria-pressed={direction === "xml2json"}>
              XML → JSON
            </button>
            <button type="button" onClick={() => setDirection("json2xml")} className={`rounded-md border px-3 py-2 text-xs cursor-pointer ${direction === "json2xml" ? "bg-primary/10 border-primary/30 font-semibold" : "bg-background border-input"}`} aria-pressed={direction === "json2xml"}>
              JSON → XML (reverse)
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="xml-json-input" className="text-sm font-semibold">{inputLabel}</Label>
            <div className="flex items-center gap-2">
              {validation && (
                <Badge variant="outline" className={`text-[10px] ${validation.ok ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "border-red-500/30 text-red-700 dark:text-red-400"}`}>
                  {validation.ok ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                  {validation.ok ? "Valid" : "Invalid"}
                </Badge>
              )}
              <input
                type="file"
                accept={direction === "xml2json" ? ".xml,application/xml,text/xml" : ".json,application/json"}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                ref={fileInputRef}
                className="hidden"
                id="xml-json-file"
                aria-label="Load file"
              />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer">
                <Upload className="h-3 w-3" /> Load file
              </button>
            </div>
          </div>
          <Textarea
            id="xml-json-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            placeholder={direction === "xml2json" ? "Paste XML here or drop .xml file..." : "Paste JSON here..."}
            className="min-h-[200px] font-mono text-xs resize-y"
            spellCheck={false}
            aria-label={inputLabel}
          />
          {validation && !validation.ok && (
            <p className="text-[10px] text-red-600 dark:text-red-400 font-mono">{validation.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Options</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Attribute prefix</label>
              <Input value={options.attributePrefix} onChange={(e) => update("attributePrefix", e.target.value)} className="h-8 text-xs" aria-label="Attribute prefix" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Text key</label>
              <Input value={options.textKey} onChange={(e) => update("textKey", e.target.value)} className="h-8 text-xs" aria-label="Text key" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Indent spaces</label>
              <Input type="number" min={0} max={8} value={options.indent} onChange={(e) => update("indent", parseInt(e.target.value) || 0)} className="h-8 text-xs" aria-label="Indent spaces" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Depth limit</label>
              <Input type="number" min={1} value={options.depthLimit} onChange={(e) => update("depthLimit", parseInt(e.target.value) || 100)} className="h-8 text-xs" aria-label="Depth limit" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Empty elements</label>
              <select value={options.collapseEmpty} onChange={(e) => update("collapseEmpty", e.target.value as ConvertOptions["collapseEmpty"])} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Empty elements">
                <option value="omit">omit (null)</option>
                <option value="null">null</option>
                <option value="empty">empty string</option>
              </select>
            </div>
            <div className="space-y-1 flex items-end gap-2 flex-wrap">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={options.prettyPrint} onChange={(e) => update("prettyPrint", e.target.checked)} className="cursor-pointer" />
                <span>Pretty</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={options.arrayDetection} onChange={(e) => update("arrayDetection", e.target.checked)} className="cursor-pointer" />
                <span>Arrays</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={options.coerceTypes} onChange={(e) => update("coerceTypes", e.target.checked)} className="cursor-pointer" />
                <span>Coerce</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={options.ignoreNamespaces} onChange={(e) => update("ignoreNamespaces", e.target.checked)} className="cursor-pointer" />
                <span>Strip ns</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={options.trimWhitespace} onChange={(e) => update("trimWhitespace", e.target.checked)} className="cursor-pointer" />
                <span>Trim</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={options.preserveDeclarations} onChange={(e) => update("preserveDeclarations", e.target.checked)} className="cursor-pointer" />
                <span>xmlns</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {result.output && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">{outputLabel}</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => result.output || ""} label="Copy" size="sm" />
                <DownloadButton getText={() => result.output || ""} filename={outputFilename} mime={outputMime} label="Download" size="sm" />
                <button type="button" onClick={onConvert} className="text-xs text-primary hover:underline cursor-pointer">Save to history</button>
              </div>
            </div>
            <Textarea
              value={result.output}
              readOnly
              className="min-h-[200px] font-mono text-xs resize-y"
              aria-label={outputLabel}
            />
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

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
                    <p className="font-medium">{h.direction} · prefix="{h.attributePrefix}" · text="{h.textKey}"</p>
                    <p className="text-[10px] text-muted-foreground">{h.inputSize} → {h.outputSize} chars · {new Date(h.convertedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      </Card>

      {!input && !error && (
        <EmptyState title="Enter XML or JSON to convert" hint="Namespace-aware · array detection · CDATA · attributes · pretty-print · reverse · drag-drop. 100% local." icon={<Braces className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all conversion runs in your browser. Your data never leaves your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
