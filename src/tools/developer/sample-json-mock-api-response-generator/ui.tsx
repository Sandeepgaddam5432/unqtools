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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  ENDPOINT_TYPES,
  ENVELOPE_PRESETS,
  HTTP_METHODS,
  STATUS_CODES,
  WEBHOOK_TEMPLATES,
  DEFAULT_OPTIONS,
  SAMPLE_SCHEMAS,
  MAX_COUNT,
  generateResponse,
  exportHttp,
  generateMswSnippet,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  validateSchema,
  inferSchemaFromExample,
  parseSchema,
  serializeSchema,
  type MockOptions,
  type EndpointType,
  type Envelope,
  type StatusCode,
  type HttpMethod,
  type Json,
  type JsonSchema,
  type HttpResponse,
  type HistoryEntry,
} from "./logic";
import { History, Braces, Wand2, AlertTriangle, Code, Webhook } from "lucide-react";

type ViewMode = "http" | "json" | "msw";

export default function SampleJsonMockApiResponseGenerator() {
  const [opts, setOpts] = useState<MockOptions>({ ...DEFAULT_OPTIONS });
  const [schemaText, setSchemaText] = useState<string>(() => serializeSchema(DEFAULT_OPTIONS.schema));
  const [exampleText, setExampleText] = useState<string>("");
  const [resp, setResp] = useState<HttpResponse | null>(null);
  const [view, setView] = useState<ViewMode>("http");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setOpts(parsed);
      setSchemaText(serializeSchema(parsed.schema));
      toast.info("Loaded options from share link");
    }
  }, []);

  const setOpt = useCallback(
    <K extends keyof MockOptions>(key: K, value: MockOptions[K]) => {
      setOpts((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Live schema parse — updates opts.schema when text changes.
  useEffect(() => {
    const r = parseSchema(schemaText);
    if (!r.ok) {
      setSchemaError(r.error);
      return;
    }
    const sv = validateSchema(r.output);
    if (!sv.ok) {
      setSchemaError(sv.error);
      return;
    }
    setSchemaError(null);
    setOpts((prev) => ({ ...prev, schema: r.output }));
  }, [schemaText]);

  const validation = useMemo(() => validateOptions(opts), [opts]);

  const handleGenerate = useCallback(() => {
    const v = validateOptions(opts);
    if (!v.ok) {
      toast.error(v.error);
      return;
    }
    const r = generateResponse(opts);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setResp(r.output);
    saveHistory({
      ts: Date.now(),
      endpoint: opts.endpoint,
      envelope: opts.envelope,
      status: opts.status,
      count: opts.count,
      seed: opts.seed,
      url: opts.url,
      bytes: r.output.bodyText.length,
      preview: r.output.statusLine,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${opts.status} ${opts.endpoint} response`);
  }, [opts]);

  const handleClear = useCallback(() => {
    setResp(null);
    toast.info("Cleared output");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSampleSchema = useCallback((id: string) => {
    const s = SAMPLE_SCHEMAS.find((x) => x.id === id);
    if (s) {
      setSchemaText(serializeSchema(s.schema));
      toast.success(`Loaded ${s.label} schema`);
    }
  }, []);

  const handleInferFromExample = useCallback(() => {
    if (!exampleText.trim()) {
      toast.error("Paste an example JSON value first");
      return;
    }
    try {
      const parsed = JSON.parse(exampleText) as Json;
      const schema = inferSchemaFromExample(parsed);
      setSchemaText(serializeSchema(schema));
      toast.success("Inferred schema from example");
    } catch (e) {
      toast.error(`Invalid example JSON: ${(e as Error).message}`);
    }
  }, [exampleText]);

  const outputText = useMemo(() => {
    if (!resp) return "";
    if (view === "http") return exportHttp(resp);
    if (view === "json") return resp.bodyText;
    if (view === "msw") return generateMswSnippet(opts, resp);
    return "";
  }, [resp, view, opts]);

  const showWebhook = opts.endpoint === "webhook";
  const showError = opts.endpoint === "error";
  const envelopeDisabled = showError || showWebhook || opts.endpoint === "paginated" || opts.endpoint === "json-api" || opts.endpoint === "graphql";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Wand2 className="h-4 w-4" /> Endpoint options
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Field label="Endpoint type">
              <select
                value={opts.endpoint}
                onChange={(e) => setOpt("endpoint", e.target.value as EndpointType)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {ENDPOINT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="HTTP method">
              <select
                value={opts.method}
                onChange={(e) => setOpt("method", e.target.value as HttpMethod)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {HTTP_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </Field>
            <Field label="Status code">
              <select
                value={opts.status}
                onChange={(e) => setOpt("status", Number(e.target.value) as StatusCode)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {STATUS_CODES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Envelope">
              <select
                value={opts.envelope}
                onChange={(e) => setOpt("envelope", e.target.value as Envelope)}
                disabled={envelopeDisabled}
                className="h-8 w-full text-xs rounded border bg-background px-2 disabled:opacity-50"
              >
                {ENVELOPE_PRESETS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </Field>
            <Field label={`Count (max ${MAX_COUNT.toLocaleString()})`}>
              <Input
                type="number"
                min={1}
                max={MAX_COUNT}
                value={opts.count}
                onChange={(e) => setOpt("count", Math.max(1, Math.min(MAX_COUNT, Number(e.target.value) || 1)))}
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Seed (optional)">
              <Input
                type="text"
                value={opts.seed}
                onChange={(e) => setOpt("seed", e.target.value.slice(0, 200))}
                placeholder="leave blank for random"
                className="h-8 text-xs"
              />
            </Field>
            <Field label="Request URL">
              <Input
                type="text"
                value={opts.url}
                onChange={(e) => setOpt("url", e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </Field>
            {showWebhook && (
              <Field label="Webhook template">
                <select
                  value={opts.webhook}
                  onChange={(e) => setOpt("webhook", e.target.value)}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  {WEBHOOK_TEMPLATES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </select>
              </Field>
            )}
            <Field label="Pretty-print">
              <input
                type="checkbox"
                checked={opts.pretty}
                onChange={(e) => setOpt("pretty", e.target.checked)}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleGenerate} disabled={!validation.ok || schemaError !== null} className="gap-1.5">
              <Braces className="h-3.5 w-3.5" /> Generate response
            </Button>
            <span className="text-[10px] text-muted-foreground">
              {showWebhook ? "Webhook mode: schema ignored" : showError ? "Error mode: schema ignored" : "Schema-driven mock"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Code className="h-4 w-4" /> JSON Schema
            </h3>
            <div className="flex flex-wrap gap-2">
              <select
                value=""
                onChange={(e) => e.target.value && handleLoadSampleSchema(e.target.value)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="">Load sample schema…</option>
                {SAMPLE_SCHEMAS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <ClearButton onClick={() => setSchemaText(serializeSchema(DEFAULT_OPTIONS.schema))} label="Reset" />
            </div>
          </div>
          <Textarea
            value={schemaText}
            onChange={(e) => setSchemaText(e.target.value)}
            placeholder="paste your JSON Schema here…"
            className="min-h-[180px] resize-y font-mono text-xs"
          />
          {schemaError && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>Schema: {schemaError}</span>
            </div>
          )}
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Example JSON (paste + infer Schema)
            </Label>
            <div className="mt-1 flex gap-2">
              <Textarea
                value={exampleText}
                onChange={(e) => setExampleText(e.target.value)}
                placeholder='e.g. { "id": 1, "email": "user@example.com", "createdAt": "2024-06-15T10:30:00Z" }'
                className="min-h-[80px] resize-y font-mono text-xs flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleInferFromExample} className="gap-1.5">
                <Wand2 className="h-3.5 w-3.5" /> Infer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {validation && !validation.ok && (
        <ErrorBanner message={validation.error} />
      )}

      {resp ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                {showWebhook ? <Webhook className="h-4 w-4" /> : <Braces className="h-4 w-4" />}
                Response
              </h3>
              <div className="flex flex-wrap gap-2">
                <div className="flex rounded border overflow-hidden">
                  {(["http", "json", "msw"] as ViewMode[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`px-2.5 h-8 text-xs uppercase ${view === v ? "bg-primary text-primary-foreground" : "bg-background"}`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <CopyButton getText={() => outputText} label="Copy" />
                <DownloadButton
                  getText={() => outputText}
                  filename={view === "msw" ? "handler.ts" : view === "json" ? "response.json" : "response.http"}
                  mime={view === "msw" ? "text/typescript" : view === "json" ? "application/json" : "text/plain"}
                  label="Download"
                />
                <ShareButton getUrl={() => buildShareUrl(opts)} />
                <ClearButton onClick={handleClear} />
              </div>
            </div>
            <Textarea
              readOnly
              value={outputText}
              className="min-h-[320px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <Badge variant="outline">{resp.statusLine}</Badge>
              <Badge variant="outline">{Object.keys(resp.headers).length} headers</Badge>
              <Badge variant="outline">{resp.bodyText.length.toLocaleString()} bytes (body)</Badge>
              <Badge variant="outline">{opts.endpoint}</Badge>
              {opts.seed && <Badge variant="outline">seed: {opts.seed}</Badge>}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Generate a realistic mock API response"
          hint="Paste a JSON Schema (or an example JSON to infer one), pick an endpoint type, status code, and count. We generate a constraint-honoring mock with status line, headers, and a ready-to-paste MSW handler. 100% client-side."
          icon={<Braces className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.endpoint}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.status}</Badge>
                    <Badge variant="outline" className="text-[10px]">×{h.count}</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate">
                    {h.url} · {h.bytes.toLocaleString()}B
                  </code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Schemas and examples are processed entirely in
            your browser — nothing is uploaded. History (last 20) is stored in localStorage on this device only,
            and the shareable URL encodes options in the fragment (after #) which browsers never transmit.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div>{children}</div>
    </div>
  );
}
