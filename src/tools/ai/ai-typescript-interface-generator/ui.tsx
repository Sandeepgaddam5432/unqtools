"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  RunButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  DEFAULT_CONFIG,
  SAMPLE_JSON_1,
  SAMPLE_JSON_2,
  safeParseJson,
  generateInterfaces,
  renderTs,
  renderTsMarkdown,
  renderTsJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmRequestBody,
  extractLlmSuggestion,
  type GeneratorConfig,
  type GeneratorResult,
  type DeclKind,
  type OptionalStyle,
  type ArrayStyle,
  type HistoryEntry,
} from "./logic";
import {
  Braces, History, Sparkles, KeyRound, Loader2, AlertTriangle,
  Code2, FileCode, Layers, ToggleLeft, ToggleRight,
} from "lucide-react";

const DECL_KINDS: DeclKind[] = ["interface", "type"];
const OPTIONAL_STYLES: OptionalStyle[] = ["question", "undefined"];
const ARRAY_STYLES: ArrayStyle[] = ["bracket", "generic"];

export default function AiTypescriptInterfaceGenerator() {
  const [jsonText, setJsonText] = useState("");
  const [rootName, setRootName] = useState("Root");
  const [exportDecls, setExportDecls] = useState(true);
  const [declKind, setDeclKind] = useState<DeclKind>("interface");
  const [readonly, setReadonly] = useState(false);
  const [optionalStyle, setOptionalStyle] = useState<OptionalStyle>("question");
  const [arrayStyle, setArrayStyle] = useState<ArrayStyle>("bracket");
  const [detectEnums, setDetectEnums] = useState(true);
  const [generateValidators, setGenerateValidators] = useState(false);
  const [generateJsDoc, setGenerateJsDoc] = useState(false);
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [parseError, setParseError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmText, setLlmText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.json) {
        setJsonText(p.json);
        if (p.rootName) setRootName(p.rootName);
        if (p.config.declKind) setDeclKind(p.config.declKind);
        if (p.config.readonly) setReadonly(p.config.readonly);
        if (p.config.optionalStyle) setOptionalStyle(p.config.optionalStyle);
        if (p.config.arrayStyle) setArrayStyle(p.config.arrayStyle);
        if (p.config.detectEnums === false) setDetectEnums(false);
        if (p.config.generateValidators) setGenerateValidators(true);
        if (p.config.generateJsDoc) setGenerateJsDoc(true);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const config: GeneratorConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      rootName: rootName || "Root",
      exportDecls,
      declKind,
      readonly,
      optionalStyle,
      arrayStyle,
      detectEnums,
      generateValidators,
      generateJsDoc,
    }),
    [rootName, exportDecls, declKind, readonly, optionalStyle, arrayStyle, detectEnums, generateValidators, generateJsDoc],
  );

  const handleGenerate = useCallback(() => {
    const parsed = safeParseJson(jsonText);
    if (!parsed.ok) {
      setParseError(parsed.error);
      toast.error(`Invalid JSON: ${parsed.error}`);
      return;
    }
    setParseError("");
    const samples = Array.isArray(parsed.value) && parsed.value.length > 0 && Array.isArray(parsed.value[0])
      ? (parsed.value as unknown[][])
      : [parsed.value];
    try {
      const r = generateInterfaces(samples, config);
      setResult(r);
      setLlmText("");
      saveHistory({
        ts: Date.now(),
        rootName: config.rootName,
        interfaceCount: r.stats.interfaceCount,
        sampleCount: samples.length,
        preview: jsonText.slice(0, 80),
      });
      setHistory(loadHistory());
      toast.success(`Generated ${r.stats.interfaceCount} interface(s) · ${r.stats.propertyCount} properties`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    }
  }, [jsonText, config]);

  const handleClear = useCallback(() => {
    setJsonText("");
    setResult(null);
    setParseError("");
    setLlmText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample1 = useCallback(() => {
    setJsonText(SAMPLE_JSON_1);
    setRootName("User");
  }, []);

  const handleLoadSample2 = useCallback(() => {
    setJsonText(SAMPLE_JSON_2);
    setRootName("Status");
  }, []);

  const handleLlmEnhance = useCallback(async () => {
    if (!apiKey.trim()) {
      toast.error("Paste your LLM API key first");
      return;
    }
    if (!jsonText.trim()) {
      toast.error("Paste JSON first");
      return;
    }
    setLlmLoading(true);
    try {
      const body = buildLlmRequestBody(jsonText, config);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        toast.error(`LLM error: ${res.status} ${txt.slice(0, 120)}`);
      } else {
        const json = await res.json();
        const text = extractLlmSuggestion(json);
        setLlmText(text);
        toast.success("LLM suggestion generated");
      }
    } catch {
      toast.error("LLM request failed");
    } finally {
      setLlmLoading(false);
    }
  }, [apiKey, jsonText, config]);

  const shareUrl = useMemo(
    () => (jsonText ? buildShareUrl({ json: jsonText, rootName, config }) : ""),
    [jsonText, rootName, config],
  );

  const tsSource = useMemo(() => (result ? renderTs(result) : ""), [result]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="json">JSON sample(s)</Label>
                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleLoadSample1}>
                    Load User sample
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleLoadSample2}>
                    Load Status sample
                  </Button>
                </div>
              </div>
              <Textarea
                id="json"
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={'Paste JSON here — single object, array, or array of samples.\n\n{ "id": 1, "name": "Ada" }'}
                rows={10}
                className="font-mono text-xs"
              />
              {parseError && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> {parseError}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Tip: wrap multiple samples in an outer array — <code className="font-mono">[{"{...}"}, {"{...}"}]</code> —
                to detect optional fields across responses.
              </p>
            </div>
            <div className="space-y-3 md:w-64">
              <div className="space-y-2">
                <Label htmlFor="root">Root name</Label>
                <Input
                  id="root"
                  value={rootName}
                  onChange={(e) => setRootName(e.target.value)}
                  placeholder="Root"
                />
              </div>
              <div className="space-y-2">
                <Label>Decl kind</Label>
                <div className="flex gap-1.5">
                  {DECL_KINDS.map((k) => (
                    <Button
                      key={k}
                      variant={declKind === k ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setDeclKind(k)}
                    >
                      {k}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Optional style</Label>
                <div className="flex gap-1.5">
                  {OPTIONAL_STYLES.map((s) => (
                    <Button
                      key={s}
                      variant={optionalStyle === s ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setOptionalStyle(s)}
                    >
                      {s === "question" ? "name?" : "| undefined"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Array style</Label>
                <div className="flex gap-1.5">
                  {ARRAY_STYLES.map((s) => (
                    <Button
                      key={s}
                      variant={arrayStyle === s ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setArrayStyle(s)}
                    >
                      {s === "bracket" ? "T[]" : "Array<T>"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ToggleChip label="export" on={exportDecls} onClick={() => setExportDecls((v) => !v)} />
            <ToggleChip label="readonly" on={readonly} onClick={() => setReadonly((v) => !v)} />
            <ToggleChip label="enum inference" on={detectEnums} onClick={() => setDetectEnums((v) => !v)} />
            <ToggleChip label="validators" on={generateValidators} onClick={() => setGenerateValidators((v) => !v)} />
            <ToggleChip label="JSDoc" on={generateJsDoc} onClick={() => setGenerateJsDoc((v) => !v)} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RunButton onClick={handleGenerate} label="Generate TS" disabled={!jsonText.trim()} />
            <ClearButton onClick={handleClear} disabled={!jsonText && !result} />
            <ShareButton getUrl={() => shareUrl} disabled={!shareUrl} />
            {result && (
              <>
                <CopyButton getText={() => tsSource} label="Copy .ts" />
                <DownloadButton
                  getText={() => tsSource}
                  filename={`${(rootName || "types").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.ts`}
                  label="Download .ts"
                  mime="text/typescript"
                />
                <CopyButton getText={() => renderTsJson(result)} label="Copy JSON" />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatChip icon={<Layers className="h-4 w-4" />} label="Interfaces" value={String(result.stats.interfaceCount)} />
                <StatChip icon={<Code2 className="h-4 w-4" />} label="Properties" value={String(result.stats.propertyCount)} />
                <StatChip icon={<Braces className="h-4 w-4" />} label="Optionals" value={String(result.stats.optionalCount)} />
                <StatChip icon={<FileCode className="h-4 w-4" />} label="Validators" value={String(result.stats.validatorCount)} />
              </div>
              {result.warnings.length > 0 && (
                <div className="mt-3 space-y-1">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Code2 className="h-4 w-4" /> Generated TypeScript
              </div>
              <pre className="max-h-[600px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
                <code className="font-mono">{tsSource}</code>
              </pre>
            </CardContent>
          </Card>
        </>
      )}

      {!result && (
        <EmptyState
          title="No interfaces yet"
          hint="Paste JSON, choose a root name, then click Generate TS."
          icon={<Braces className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4" /> Optional: enhance with your own LLM key
          </div>
          <p className="text-xs text-muted-foreground">
            Keys are stored only in this browser tab and sent directly to the LLM provider you choose — never to us.
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button onClick={handleLlmEnhance} disabled={llmLoading} className="gap-1.5">
              {llmLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {llmLoading ? "Working…" : "Enhance"}
            </Button>
          </div>
          {llmText && (
            <pre className="max-h-96 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
              <code className="font-mono">{llmText}</code>
            </pre>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <History className="h-4 w-4" /> History (last 20)
              </h3>
              <ClearButton onClick={handleClearHistory} label="Clear history" size="sm" />
            </div>
            <ul className="space-y-1 text-xs">
              {history.map((h, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 rounded border px-2 py-1">
                  <span className="font-medium">{h.rootName}</span>
                  <Badge variant="outline" className="text-xs">{h.interfaceCount} iface</Badge>
                  <Badge variant="outline" className="text-xs">{h.sampleCount} sample(s)</Badge>
                  <span className="text-muted-foreground truncate max-w-md">{h.preview}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function ToggleChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={onClick}>
      {on ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
      <span className={on ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </Button>
  );
}
