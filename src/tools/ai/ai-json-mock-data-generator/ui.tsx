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
  SUPPORTED_LOCALES,
  SAMPLE_SCHEMAS,
  parseSchema,
  generateMockData,
  renderJson,
  renderCsv,
  renderSql,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type GeneratorOptions,
  type JsonSchema,
  type HistoryEntry,
  type LlmResult,
} from "./logic";
import {
  FlaskConical, History, Key, Database, FileJson, FileSpreadsheet,
  Sparkles, AlertCircle, Wand2, RefreshCw, ShieldCheck,
} from "lucide-react";

const DEFAULT_SCHEMA = `{
  "type": "object",
  "required": ["id", "name", "email", "role"],
  "properties": {
    "id": { "type": "integer", "minimum": 1, "maximum": 99999 },
    "name": { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "role": { "type": "string", "enum": ["admin", "user", "guest"] },
    "active": { "type": "boolean" },
    "createdAt": { "type": "string", "format": "date-time" }
  }
}`;

export default function AiJsonMockDataGenerator() {
  const [schemaText, setSchemaText] = useState(DEFAULT_SCHEMA);
  const [rowCount, setRowCount] = useState(5);
  const [options, setOptions] = useState<GeneratorOptions>({ seed: "", locale: "en" });
  const [result, setResult] = useState<{
    records: unknown[];
    warnings: string[];
    notes: Array<{ path: string; note: string }>;
  } | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"json" | "csv" | "sql">("json");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmDescription, setLlmDescription] = useState("");
  const [llmResult, setLlmResult] = useState<LlmResult | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem(LLM_KEY_STORAGE)
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.schema) setSchemaText(p.schema);
      if (p.rowCount) setRowCount(p.rowCount);
      if (Object.keys(p.options).length > 0) setOptions((prev) => ({ ...prev, ...p.options }));
      if (p.schema || Object.keys(p.options).length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const parsedSchema = useMemo(() => parseSchema(schemaText), [schemaText]);

  const handleRun = useCallback(() => {
    setError("");
    setResult(null);
    const p = parseSchema(schemaText);
    if (!p.ok) {
      setError(p.error);
      return;
    }
    if (rowCount < 1 || rowCount > 10000) {
      setError("Row count must be between 1 and 10000.");
      return;
    }
    const r = generateMockData(p.schema, rowCount, options);
    setResult({ records: r.records, warnings: r.warnings, notes: r.notes });
    saveHistory({
      ts: Date.now(),
      rowCount,
      seed: options.seed ?? "",
      rootType: typeof p.schema.type === "string" ? p.schema.type : "any",
      fieldCount: p.schema.properties ? Object.keys(p.schema.properties).length : 0,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${rowCount} record(s)`);
  }, [schemaText, rowCount, options]);

  const jsonOut = useMemo(() => (result ? renderJson(result.records, 2) : ""), [result]);
  const csvOut = useMemo(() => (result ? renderCsv(result.records) : ""), [result]);
  const sqlOut = useMemo(() => (result ? renderSql(result.records, "mock_data") : ""), [result]);

  const handleClear = useCallback(() => {
    setSchemaText(DEFAULT_SCHEMA);
    setRowCount(5);
    setOptions({ seed: "", locale: "en" });
    setResult(null);
    setError("");
    setLlmResult(null);
    setLlmError("");
    setLlmDescription("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = (s: JsonSchema) => {
    setSchemaText(JSON.stringify(s, null, 2));
  };

  const handleLlm = useCallback(async () => {
    if (!llmDescription.trim()) {
      setLlmError("Describe the records you want first.");
      return;
    }
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
      const prompt = buildLlmPrompt(llmDescription);
      const res = await callLlm(llmProvider, llmKey, prompt);
      const r = renderLlmResult(res);
      if (!r.ok) {
        setLlmError(r.error);
      } else {
        setLlmResult(r.result);
        setSchemaText(JSON.stringify(r.result.schema, null, 2));
        toast.success("Schema inferred from description");
      }
    } catch (e) {
      setLlmError((e as Error).message);
    } finally {
      setLlmLoading(false);
    }
  }, [llmDescription, llmKey, llmProvider]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai44-schema" className="flex items-center gap-1.5">
              <FileJson className="h-3.5 w-3.5" /> JSON Schema (Draft 7 or 2020-12)
            </Label>
            <Textarea
              id="ai44-schema"
              value={schemaText}
              onChange={(e) => setSchemaText(e.target.value)}
              placeholder={DEFAULT_SCHEMA}
              className="min-h-[200px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-muted-foreground mr-1">Presets:</span>
              {SAMPLE_SCHEMAS.map((s) => (
                <Button
                  key={s.name}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handleLoadSample(s.schema)}
                >+ {s.name}</Button>
              ))}
            </div>
            {parsedSchema.ok && (
              <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                <Badge variant="outline">root: {parsedSchema.schema.type ?? "any"}</Badge>
                {parsedSchema.schema.properties && (
                  <Badge variant="outline">
                    {Object.keys(parsedSchema.schema.properties).length} fields
                  </Badge>
                )}
                {parsedSchema.schema.required && (
                  <Badge variant="outline">{parsedSchema.schema.required.length} required</Badge>
                )}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ai44-rows" className="text-xs">Rows (1–10000)</Label>
              <Input
                id="ai44-rows"
                type="number"
                min={1}
                max={10000}
                value={rowCount}
                onChange={(e) => setRowCount(parseInt(e.target.value || "1", 10))}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai44-seed" className="text-xs">Seed (blank = random)</Label>
              <Input
                id="ai44-seed"
                type="text"
                value={options.seed ?? ""}
                onChange={(e) => setOptions((prev) => ({ ...prev, seed: e.target.value }))}
                placeholder="e.g. my-test-1"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai44-locale" className="text-xs">Locale hint</Label>
              <select
                id="ai44-locale"
                value={options.locale ?? "en"}
                onChange={(e) => setOptions((prev) => ({ ...prev, locale: e.target.value }))}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                {SUPPORTED_LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleRun} disabled={!schemaText.trim()} label="Generate" />
            <ShareButton
              getUrl={() => buildShareUrl(schemaText, rowCount, options)}
              disabled={!schemaText.trim()}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setOptions((prev) => ({ ...prev, seed: Math.random().toString(36).slice(2, 10) }))}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Random seed
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowLlm((v) => !v)}
            >
              <Wand2 className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Infer schema (LLM)"}
            </Button>
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Infer a JSON Schema from a description
            </h3>
            <p className="text-xs text-muted-foreground">
              Describe the records you want in plain English (e.g., "a user with id, name, email, role enum, and createdAt date"). The LLM will write a Draft-7 JSON Schema and load it into the editor above. Optional. Bring your own API key — stored in localStorage on this device only and sent directly to your chosen provider.
            </p>
            <Textarea
              value={llmDescription}
              onChange={(e) => setLlmDescription(e.target.value)}
              placeholder={"a customer order with orderId UUID, customerId integer, items array of {productId, qty, price}, total number, currency enum USD/EUR/GBP"}
              className="min-h-[80px] resize-y text-xs"
            />
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
              <RunButton onClick={handleLlm} loading={llmLoading} label="Infer schema" />
            </div>
            {llmError && <ErrorBanner message={llmError} />}
            {llmResult && llmResult.notes.length > 0 && (
              <div className="rounded border bg-background p-2 text-xs space-y-1">
                <div className="font-semibold">LLM notes</div>
                {llmResult.notes.map((n, i) => <div key={i}>• {n}</div>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="h-4 w-4" /> {result.records.length} record(s) generated
                </h3>
                <div className="flex gap-1">
                  {(["json", "csv", "sql"] as const).map((t) => (
                    <Button
                      key={t}
                      variant={activeTab === t ? "default" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setActiveTab(t)}
                    >
                      {t === "json" ? "JSON" : t === "csv" ? "CSV" : "SQL"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Rows: {result.records.length}</Badge>
                {options.seed && <Badge variant="outline">Seed: {options.seed}</Badge>}
                <Badge variant="outline">Locale: {options.locale ?? "en"}</Badge>
                {result.warnings.length > 0 && (
                  <Badge variant="destructive">{result.warnings.length} warning(s)</Badge>
                )}
                {result.notes.length > 0 && (
                  <Badge variant="secondary">{result.notes.length} note(s)</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {activeTab === "json" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => jsonOut} label="Copy JSON" />
                  <DownloadButton
                    getText={() => jsonOut}
                    filename="mock-data.json"
                    mime="application/json"
                    label="Download .json"
                  />
                </div>
                <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[500px]">
                  {jsonOut}
                </pre>
              </CardContent>
            </Card>
          )}

          {activeTab === "csv" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => csvOut} label="Copy CSV" />
                  <DownloadButton
                    getText={() => csvOut}
                    filename="mock-data.csv"
                    mime="text/csv"
                    label="Download .csv"
                  />
                </div>
                <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[500px]">
                  {csvOut || "(no CSV output — records must be objects)"}
                </pre>
              </CardContent>
            </Card>
          )}

          {activeTab === "sql" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => sqlOut} label="Copy SQL" />
                  <DownloadButton
                    getText={() => sqlOut}
                    filename="mock-data.sql"
                    mime="application/sql"
                    label="Download .sql"
                  />
                </div>
                <pre className="rounded border bg-muted/30 p-3 text-xs font-mono overflow-auto max-h-[500px]">
                  {sqlOut}
                </pre>
              </CardContent>
            </Card>
          )}

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
              <summary className="cursor-pointer text-muted-foreground">{result.notes.length} generation notes</summary>
              <ul className="pt-1 space-y-0.5">
                {result.notes.map((n, i) => (
                  <li key={i}><span className="font-mono text-muted-foreground">{n.path}</span> — {n.note}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      {!result && !error && (
        <EmptyState
          title="Write or paste a JSON Schema to generate mock data"
          hint="Click a preset to load a sample schema, set the row count, and click Generate. Output renders as JSON, CSV, or INSERT SQL. Use the seed field for reproducible output."
          icon={<FlaskConical className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.rowCount} rows</Badge>
                  <Badge variant="outline" className="mr-2">{h.fieldCount} fields</Badge>
                  <Badge variant="outline" className="mr-2">root: {h.rootType}</Badge>
                  {h.seed && <span className="text-muted-foreground mr-2">seed: {h.seed}</span>}
                  <span className="text-muted-foreground">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy & honesty:</strong> All schema parsing, mock value generation, and export rendering run locally in your browser — your schemas and generated data never leave this device. Data is synthetic and must not be mistaken for real records. The only network call is if you paste your own LLM API key and click 'Infer schema' — that request goes directly from your browser to your chosen LLM provider.
          </p>
        </CardContent>
      </Card>
    </div>
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
          { role: "system", content: "You are a JSON Schema designer. Respond only with the JSON object the user requested — no prose, no code fences." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  }
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
      system: "You are a JSON Schema designer. Respond only with the JSON object the user requested — no prose, no code fences.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
  const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
  return data.content?.[0]?.text ?? "";
}

// Unused-import guards (keep file strict-clean if imports are added later).
export type _Unused = { ShieldCheck: typeof ShieldCheck; FileSpreadsheet: typeof FileSpreadsheet };
