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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  HISTORY_MAX,
  LLM_KEY_STORAGE,
  DRAFT_LABELS,
  SAMPLE_OBJECTS,
  inferSchema,
  serializeSchema,
  renderMarkdown,
  parseMultipleInputs,
  validateAgainstSchema,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type InferenceOptions,
  type JsonSchema,
  type JsonSchemaDraft,
  type HistoryEntry,
  type LlmResult,
} from "./logic";
import {
  Braces, History, Key, Eye, EyeOff, Sparkles, AlertCircle,
  FileJson, FileText, ShieldCheck, FlaskConical, Wand2,
} from "lucide-react";

const DEFAULT_OPTIONS: InferenceOptions = {
  detectFormats: true,
  inferEnums: true,
  inferRequired: true,
  inferConstraints: true,
  draft: "draft-07",
};

export default function AiJsObjectToJsonSchemaConverter() {
  const [samplesText, setSamplesText] = useState("");
  const [options, setOptions] = useState<InferenceOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<{
    schema: JsonSchema;
    warnings: string[];
    notes: Array<{ path: string; note: string }>;
    sampleCount: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [validateText, setValidateText] = useState("");
  const [validateResult, setValidateResult] = useState<{ valid: boolean; errors: Array<{ path: string; message: string }> } | null>(null);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmResult | null>(null);
  const [activeTab, setActiveTab] = useState<"schema" | "validate" | "docs">("schema");

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem(LLM_KEY_STORAGE)
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.samples) setSamplesText(p.samples);
      if (Object.keys(p.options).length > 0) setOptions({ ...DEFAULT_OPTIONS, ...p.options });
      if (p.samples || Object.keys(p.options).length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const handleRun = useCallback(() => {
    setError("");
    setResult(null);
    setValidateResult(null);
    const parsed = parseMultipleInputs(samplesText);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (parsed.values.length === 0) {
      setError("Paste at least one sample object to infer a schema.");
      return;
    }
    const r = inferSchema(parsed.values, options);
    setResult({
      schema: r.schema,
      warnings: r.warnings,
      notes: r.notes,
      sampleCount: parsed.values.length,
    });
    saveHistory({
      ts: Date.now(),
      draft: options.draft ?? "draft-07",
      rootType: typeof r.schema.type === "string" ? r.schema.type : "any",
      fieldCount: r.schema.properties ? Object.keys(r.schema.properties).length : 0,
      sampleCount: parsed.values.length,
    });
    setHistory(loadHistory());
  }, [samplesText, options]);

  const handleValidate = useCallback(() => {
    if (!result) return;
    setValidateResult(null);
    try {
      const value = JSON.parse(validateText);
      const v = validateAgainstSchema(value, result.schema);
      setValidateResult(v);
      if (v.valid) toast.success("Value is valid");
      else toast.error(`${v.errors.length} validation error(s)`);
    } catch (e) {
      toast.error("Could not parse validation input as JSON");
      setValidateResult({ valid: false, errors: [{ path: "$", message: (e as Error).message }] });
    }
  }, [result, validateText]);

  const schemaJson = useMemo(
    () => (result ? serializeSchema(result.schema, 2) : ""),
    [result],
  );
  const markdown = useMemo(
    () => (result ? renderMarkdown(result.schema, { sampleCount: result.sampleCount, warnings: result.warnings }) : ""),
    [result],
  );

  const toggleOption = (key: keyof InferenceOptions) => {
    if (key === "draft") return;
    setOptions((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  };

  const handleClear = useCallback(() => {
    setSamplesText("");
    setResult(null);
    setError("");
    setValidateText("");
    setValidateResult(null);
    setLlmResult(null);
    setLlmError("");
    setOptions(DEFAULT_OPTIONS);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = (value: unknown) => {
    setSamplesText(JSON.stringify(value, null, 2));
  };

  const handleLlm = useCallback(async () => {
    if (!result) return;
    if (!llmKey) {
      setLlmError("Paste your OpenAI or Anthropic API key first.");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      }
      const prompt = buildLlmPrompt(result.schema, result.sampleCount);
      const res = await callLlm(llmProvider, llmKey, prompt);
      const r = renderLlmResult(res);
      if (!r.ok) {
        setLlmError(r.error);
      } else {
        setLlmResult(r.result);
        toast.success("LLM descriptions applied");
      }
    } catch (e) {
      setLlmError((e as Error).message);
    } finally {
      setLlmLoading(false);
    }
  }, [result, llmKey, llmProvider]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai43-samples">
              JS object / JSON samples (one per block — separate with blank line, <code className="font-mono">---</code>, or <code className="font-mono">;;</code>)
            </Label>
            <Textarea
              id="ai43-samples"
              value={samplesText}
              onChange={(e) => setSamplesText(e.target.value)}
              placeholder={"{\n  \"id\": 42,\n  \"name\": \"Alice\",\n  \"email\": \"alice@example.com\",\n  \"tags\": [\"a\", \"b\"]\n}"}
              className="min-h-[180px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_OBJECTS.map((s) => (
                <Button
                  key={s.name}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handleLoadSample(s.value)}
                >+ {s.name}</Button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Inference options</Label>
              <div className="flex flex-wrap gap-2 text-xs">
                <ToggleChip label="Formats" on={options.detectFormats !== false} onClick={() => toggleOption("detectFormats")} />
                <ToggleChip label="Enums" on={options.inferEnums !== false} onClick={() => toggleOption("inferEnums")} />
                <ToggleChip label="Required" on={options.inferRequired !== false} onClick={() => toggleOption("inferRequired")} />
                <ToggleChip label="Constraints" on={options.inferConstraints !== false} onClick={() => toggleOption("inferConstraints")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Output draft</Label>
              <div className="flex gap-2">
                {(Object.keys(DRAFT_LABELS) as JsonSchemaDraft[]).map((d) => (
                  <Button
                    key={d}
                    variant={(options.draft ?? "draft-07") === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOptions((prev) => ({ ...prev, draft: d }))}
                  >{DRAFT_LABELS[d]}</Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleRun} disabled={!samplesText.trim()} label="Infer schema" />
            <ShareButton getUrl={() => buildShareUrl(samplesText, options)} disabled={!samplesText.trim()} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileJson className="h-4 w-4" /> Inferred schema
                </h3>
                <div className="flex flex-wrap gap-1">
                  {(["schema", "validate", "docs"] as const).map((t) => (
                    <Button
                      key={t}
                      variant={activeTab === t ? "default" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setActiveTab(t)}
                    >
                      {t === "schema" ? "Schema" : t === "validate" ? "Validate" : "Docs"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Draft: {DRAFT_LABELS[options.draft ?? "draft-07"]}</Badge>
                <Badge variant="outline">Samples: {result.sampleCount}</Badge>
                <Badge variant="outline">Root: {typeof result.schema.type === "string" ? result.schema.type : "any"}</Badge>
                <Badge variant={result.warnings.length > 0 ? "destructive" : "secondary"}>
                  {result.warnings.length} warning(s)
                </Badge>
                {result.notes.length > 0 && (
                  <Badge variant="secondary">{result.notes.length} note(s)</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {activeTab === "schema" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => schemaJson} label="Copy schema" />
                  <DownloadButton
                    getText={() => schemaJson}
                    filename="schema.json"
                    mime="application/json"
                    label="Download .json"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowLlm((v) => !v)}
                  >
                    <Wand2 className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Suggest descriptions (LLM)"}
                  </Button>
                </div>
                <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[500px]">
                  {schemaJson}
                </pre>
                {result.warnings.length > 0 && (
                  <div className="rounded border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs space-y-1">
                    <div className="font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5" /> Warnings
                    </div>
                    {result.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                  </div>
                )}
                {result.notes.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">{result.notes.length} inference notes</summary>
                    <ul className="pt-1 space-y-0.5">
                      {result.notes.map((n, i) => (
                        <li key={i}><span className="font-mono text-muted-foreground">{n.path}</span> — {n.note}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "validate" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label htmlFor="ai43-validate" className="text-xs flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Validate another JSON value against this schema
                </Label>
                <Textarea
                  id="ai43-validate"
                  value={validateText}
                  onChange={(e) => setValidateText(e.target.value)}
                  placeholder={'{\n  "id": 99,\n  "name": "Bob"\n}'}
                  className="min-h-[120px] resize-y font-mono text-xs"
                />
                <div className="flex gap-2">
                  <RunButton
                    onClick={handleValidate}
                    disabled={!validateText.trim()}
                    label="Validate"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setValidateText(""); setValidateResult(null); }}
                  >Clear</Button>
                </div>
                {validateResult && (
                  <div className={`rounded border p-3 text-xs ${validateResult.valid ? "border-emerald-400/50 bg-emerald-50 dark:bg-emerald-950/20" : "border-destructive/40 bg-destructive/10"}`}>
                    {validateResult.valid ? (
                      <div className="font-semibold text-emerald-700 dark:text-emerald-400">✓ Value is valid against the schema.</div>
                    ) : (
                      <div className="space-y-1">
                        <div className="font-semibold text-destructive">{validateResult.errors.length} error(s):</div>
                        {validateResult.errors.map((e, i) => (
                          <div key={i}><span className="font-mono text-muted-foreground">{e.path}</span> — {e.message}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "docs" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => markdown} label="Copy Markdown" />
                  <DownloadButton
                    getText={() => markdown}
                    filename="schema.md"
                    mime="text/markdown"
                    label="Download .md"
                  />
                </div>
                <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[500px] whitespace-pre-wrap">
                  {markdown}
                </pre>
              </CardContent>
            </Card>
          )}

          {showLlm && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Suggest field descriptions with LLM
                </h3>
                <p className="text-xs text-muted-foreground">
                  Optional. Bring your own API key (OpenAI or Anthropic). The key is stored in localStorage on this device only and sent directly to the provider you choose.
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={llmProvider}
                    onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                  <div className="relative flex-1 min-w-[200px]">
                    <Input
                      type="password"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      placeholder="sk-… / sk-ant-…"
                      className="h-8 text-xs pr-8"
                    />
                    <Key className="h-3.5 w-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <RunButton onClick={handleLlm} loading={llmLoading} label="Suggest" />
                </div>
                {llmError && <ErrorBanner message={llmError} />}
                {llmResult && (
                  <div className="space-y-2 text-xs">
                    {llmResult.title && (
                      <div><span className="text-muted-foreground">Suggested title:</span> <strong>{llmResult.title}</strong></div>
                    )}
                    {llmResult.descriptions.length > 0 && (
                      <div className="space-y-1">
                        <div className="font-semibold">Field descriptions</div>
                        {llmResult.descriptions.map((d, i) => (
                          <div key={i} className="rounded border bg-background px-2 py-1">
                            <span className="font-mono text-muted-foreground">{d.path}</span> — {d.description}
                          </div>
                        ))}
                      </div>
                    )}
                    {llmResult.suggestions.length > 0 && (
                      <div className="space-y-1">
                        <div className="font-semibold">Suggestions</div>
                        {llmResult.suggestions.map((s, i) => (
                          <div key={i}>• {s}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!result && !error && (
        <EmptyState
          title="Paste a JS object or JSON sample to infer a schema"
          hint="Single quotes, unquoted keys, and trailing commas are OK. Merge multiple samples separated by blank lines or '---' to detect required vs optional fields. Click a preset to load a sample."
          icon={<Braces className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent (last {HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.draft}</Badge>
                  <Badge variant="outline" className="mr-2">{h.sampleCount} samples</Badge>
                  <Badge variant="outline" className="mr-2">{h.fieldCount} fields</Badge>
                  <span className="text-muted-foreground">root: {h.rootType}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All type inference, format/enum detection, merging, and validation run locally in your browser. Your samples never leave this device. The only network call is if you paste your own LLM API key and click 'Suggest' — that request goes directly from your browser to your chosen LLM provider.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-6 px-2 rounded text-[11px] border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground"}`}
    >
      {on ? "✓" : "○"} {label}
    </button>
  );
}

/** Call OpenAI or Anthropic chat completion. Returns the text response. */
async function callLlm(
  provider: "openai" | "anthropic",
  apiKey: string,
  prompt: string,
): Promise<string> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a JSON Schema documentation assistant. Respond only with the JSON object the user requested — no prose, no code fences." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  }
  // anthropic
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 1500,
      system: "You are a JSON Schema documentation assistant. Respond only with the JSON object the user requested — no prose, no code fences.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
  const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
  return data.content?.[0]?.text ?? "";
}

// Unused-import guards (keep the file strict-clean if imports are added later).
export type _Unused = { FileText: typeof FileText; FlaskConical: typeof FlaskConical; Eye: typeof Eye; EyeOff: typeof EyeOff };

// Local JsonSchema alias is intentionally omitted — we import the real type
// from ./logic so all schema values are typed consistently.
