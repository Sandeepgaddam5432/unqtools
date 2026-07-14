"use client";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton, ShareButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  jsonToXml, xmlToJson, validateXml, validateJson,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  DEFAULT_OPTIONS,
  type ConvertOptions, type ConversionHistoryEntry,
} from "./logic";
import { Braces, ArrowRightLeft, CheckCircle2, XCircle, History, Share2 } from "lucide-react";

type Direction = "json2xml" | "xml2json";

const SAMPLE_JSON = `{
  "name": "Alice",
  "age": 30,
  "@id": "user-1",
  "roles": ["admin", "user"],
  "address": {
    "city": "Hyderabad",
    "zip": "500001"
  }
}`;

export default function JsonToXmlConverter() {
  const [direction, setDirection] = useState<Direction>("json2xml");
  const [input, setInput] = useState<string>(SAMPLE_JSON);
  const [options, setOptions] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ConversionHistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  const update = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const result = useMemo<{ output: string | null; error: string | null }>(() => {
    if (!input.trim()) return { output: null, error: null };
    if (direction === "json2xml") {
      const r = jsonToXml(input, options);
      if (!r.ok) return { output: null, error: r.error };
      return { output: r.xml, error: null };
    }
    const r = xmlToJson(input, options);
    if (!r.ok) return { output: null, error: r.error };
    return { output: r.json, error: null };
  }, [input, direction, options]);

  // Derived error — kept in React state only for the swap-direction feature,
  // but never set inside useMemo.
  useEffect(() => {
    setError(result.error);
  }, [result.error]);

  const validation = useMemo(() => {
    if (!input.trim()) return null;
    if (direction === "json2xml") {
      const r = validateJson(input);
      return r.ok ? { ok: true, message: "Valid JSON" } : { ok: false, message: r.error };
    }
    const r = validateXml(input);
    return r.ok ? { ok: true, message: "Well-formed XML" } : { ok: false, message: r.error! };
  }, [input, direction]);

  const swapDirection = useCallback(() => {
    setDirection((d) => (d === "json2xml" ? "xml2json" : "json2xml"));
    setInput((prev) => {
      // Try to use the converted output as new input
      if (result.output) return result.output;
      return prev;
    });
  }, [result.output]);

  const onConvert = () => {
    if (!result.output) return;
    const entry: ConversionHistoryEntry = {
      direction,
      rootName: options.rootName,
      inputSize: input.length,
      outputSize: result.output.length,
      convertedAt: new Date().toISOString(),
    };
    setHistory(saveToHistory(entry));
  };

  const inputLabel = direction === "json2xml" ? "JSON input" : "XML input";
  const outputLabel = direction === "json2xml" ? "XML output" : "JSON output";
  const outputFilename = direction === "json2xml" ? "converted.xml" : "converted.json";
  const outputMime = direction === "json2xml" ? "application/xml" : "application/json";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Conversion direction</Label>
            <button type="button" onClick={swapDirection} className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer" aria-label="Swap direction">
              <ArrowRightLeft className="h-3 w-3" /> Swap
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setDirection("json2xml")} className={`rounded-md border px-3 py-2 text-xs cursor-pointer ${direction === "json2xml" ? "bg-primary/10 border-primary/30 font-semibold" : "bg-background border-input"}`} aria-pressed={direction === "json2xml"}>
              JSON → XML
            </button>
            <button type="button" onClick={() => setDirection("xml2json")} className={`rounded-md border px-3 py-2 text-xs cursor-pointer ${direction === "xml2json" ? "bg-primary/10 border-primary/30 font-semibold" : "bg-background border-input"}`} aria-pressed={direction === "xml2json"}>
              XML → JSON (reverse)
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="json-xml-input" className="text-sm font-semibold">{inputLabel}</Label>
            {validation && (
              <Badge variant="outline" className={`text-[10px] ${validation.ok ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "border-red-500/30 text-red-700 dark:text-red-400"}`}>
                {validation.ok ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                {validation.ok ? "Valid" : "Invalid"}
              </Badge>
            )}
          </div>
          <Textarea
            id="json-xml-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={direction === "json2xml" ? "Paste JSON here..." : "Paste XML here..."}
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
              <label className="text-[10px] text-muted-foreground">Root element name</label>
              <Input value={options.rootName} onChange={(e) => update("rootName", e.target.value)} className="h-8 text-xs" aria-label="Root element name" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Attribute prefix</label>
              <Input value={options.attributePrefix} onChange={(e) => update("attributePrefix", e.target.value)} className="h-8 text-xs" aria-label="Attribute prefix" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Array item name</label>
              <Input value={options.arrayItemName} onChange={(e) => update("arrayItemName", e.target.value)} className="h-8 text-xs" aria-label="Array item name" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Namespace URL</label>
              <Input value={options.namespace} onChange={(e) => update("namespace", e.target.value)} placeholder="https://example.com/ns" className="h-8 text-xs" aria-label="Namespace URL" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Namespace prefix</label>
              <Input value={options.namespacePrefix} onChange={(e) => update("namespacePrefix", e.target.value)} placeholder="ns" className="h-8 text-xs" aria-label="Namespace prefix" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Indent spaces</label>
              <Input type="number" min={0} max={8} value={options.indent} onChange={(e) => update("indent", parseInt(e.target.value) || 0)} className="h-8 text-xs" aria-label="Indent spaces" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">CDATA threshold (chars)</label>
              <Input type="number" min={0} value={options.cdataThreshold} onChange={(e) => update("cdataThreshold", parseInt(e.target.value) || 0)} className="h-8 text-xs" aria-label="CDATA threshold" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Depth limit</label>
              <Input type="number" min={1} value={options.depthLimit} onChange={(e) => update("depthLimit", parseInt(e.target.value) || 100)} className="h-8 text-xs" aria-label="Depth limit" />
            </div>
            <div className="space-y-1 flex items-end gap-2">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={options.prettyPrint} onChange={(e) => update("prettyPrint", e.target.checked)} className="cursor-pointer" />
                <span>Pretty</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={options.includeTypeInfo} onChange={(e) => update("includeTypeInfo", e.target.checked)} className="cursor-pointer" />
                <span>Type info</span>
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
                <ShareButton getUrl={() => buildShareUrl(options)} label="Share" size="sm" />
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
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">No history yet.</p>
          ) : (
            <div className="space-y-1 max-h-[160px] overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                  <p className="font-medium">{h.direction} · root="{h.rootName}"</p>
                  <p className="text-[10px] text-muted-foreground">{h.inputSize} → {h.outputSize} chars · {new Date(h.convertedAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!input && !error && (
        <EmptyState title="Enter JSON or XML to convert" hint="Bi-directional · attributes · CDATA · namespaces · pretty-print · type info · shareable URL. 100% local." icon={<Braces className="h-8 w-8" />} />
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
