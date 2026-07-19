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
  SCENARIO_LABELS,
  STATUS_PRESETS,
  ENDPOINT_PRESETS,
  parseJsonSample,
  parseOpenApiSpec,
  parseDescription,
  buildCrudRoutes,
  generateMockResponse,
  renderJsonPretty,
  renderJsonCompact,
  renderCurl,
  renderFetchHandler,
  renderMockoonConfig,
  hashStringToSeed,
  addInspectorEntry,
  loadInspector,
  clearInspector,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  computeStats,
  type MockRoute,
  type MockConfig,
  type Scenario,
  type HttpMethod,
  type SchemaField,
  type InspectorEntry,
  type HistoryEntry,
  type ShareState,
} from "./logic";
import {
  Server, Play, Copy, Download, Share2, Trash2,
  History, Sparkles, Key, Zap, ChevronDown, ChevronRight,
} from "lucide-react";

type Source = "openapi" | "json-sample" | "description";

const SOURCE_LABELS: Record<Source, string> = {
  openapi: "OpenAPI Spec",
  "json-sample": "JSON Sample",
  description: "Description",
};

export default function AiApiPayloadMockingTool() {
  const [source, setSource] = useState<Source>("json-sample");
  const [input, setInput] = useState("");
  const [resourceName, setResourceName] = useState("Resource");
  const [routes, setRoutes] = useState<MockRoute[]>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [seed, setSeed] = useState(42);
  const [scenario, setScenario] = useState<Scenario>("default");
  const [status, setStatus] = useState(200);
  const [latencyMs, setLatencyMs] = useState(50);
  const [inspector, setInspector] = useState<InspectorEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmResult, setLlmResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [expandedRoutes, setExpandedRoutes] = useState<Set<number>>(new Set([0]));

  useEffect(() => {
    setInspector(loadInspector());
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined" ? localStorage.getItem("unqtools:ai-api-mocking:llm-key") : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.source) setSource(p.source);
      if (p.input) setInput(p.input);
      if (p.name) setResourceName(p.name);
      if (p.scenario) setScenario(p.scenario);
      if (p.status) setStatus(p.status);
      if (p.latencyMs) setLatencyMs(p.latencyMs);
      if (p.input) {
        toast.info("Loaded from share link");
        handleGenerate(p.input, p.source, p.name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = useCallback(
    (overrideInput?: string, overrideSource?: Source, overrideName?: string) => {
      const src = overrideSource ?? source;
      const inp = overrideInput ?? input;
      const name = (overrideName ?? resourceName) || "Resource";
      setError("");
      setRoutes([]);
      if (!inp.trim()) {
        setError("Please provide input (OpenAPI spec, JSON sample, or endpoint description).");
        return;
      }
      let fields: SchemaField[] = [];
      let isArray = false;
      let desc: string | undefined;
      if (src === "openapi") {
        const r = parseOpenApiSpec(inp);
        if (!r.ok) { setError(r.error); return; }
        if (r.routes.length === 0 && r.schemas.length === 0) {
          setError("No paths or schemas found in spec.");
          return;
        }
        // Prefer routes; if none, build CRUD from first schema
        if (r.routes.length > 0) {
          // Build MockConfig routes from the spec routes; status/latency/scenario defaults
          const builtRoutes: MockRoute[] = r.routes.map((rt) => ({
            ...rt,
            status: rt.status || 200,
            latencyMs: rt.latencyMs || 50,
            scenario: rt.scenario || "default",
          }));
          setRoutes(builtRoutes);
          setSelectedRouteIdx(0);
          setExpandedRoutes(new Set([0]));
          saveHistory({
            ts: Date.now(),
            source: src,
            name,
            routeCount: builtRoutes.length,
            fieldCount: builtRoutes.reduce((a, b) => a + b.fields.length, 0),
          });
          setHistory(loadHistory());
          toast.success(`Parsed ${builtRoutes.length} route(s) from OpenAPI spec`);
          return;
        }
        const s = r.schemas[0];
        fields = s.fields;
        isArray = s.isArray;
        desc = s.description;
      } else if (src === "json-sample") {
        const r = parseJsonSample(inp, name);
        if (!r.ok) { setError(r.error); return; }
        fields = r.schema.fields;
        isArray = r.schema.isArray;
        desc = r.schema.description;
      } else {
        fields = parseDescription(inp);
        if (fields.length === 0) {
          setError("Could not infer any fields from description. Try mentioning: email, name, id, phone, price, date, etc.");
          return;
        }
        isArray = true; // description endpoints default to list
      }
      // Build CRUD routes
      const builtRoutes = buildCrudRoutes(name, fields);
      // Apply user-selected scenario/status/latency to first route
      if (builtRoutes.length > 0 && src !== "openapi") {
        builtRoutes[0] = { ...builtRoutes[0], scenario, status, latencyMs };
      }
      setRoutes(builtRoutes);
      setSelectedRouteIdx(0);
      setExpandedRoutes(new Set([0]));
      saveHistory({
        ts: Date.now(),
        source: src,
        name,
        routeCount: builtRoutes.length,
        fieldCount: builtRoutes.reduce((a, b) => a + b.fields.length, 0),
      });
      setHistory(loadHistory());
      toast.success(`Generated ${builtRoutes.length} CRUD routes for ${name}`);
    },
    [input, source, resourceName, scenario, status, latencyMs],
  );

  const selectedRoute: MockRoute | null = routes[selectedRouteIdx] ?? null;

  const effectiveRoute: MockRoute | null = useMemo(() => {
    if (!selectedRoute) return null;
    return { ...selectedRoute, scenario, status, latencyMs };
  }, [selectedRoute, scenario, status, latencyMs]);

  const response = useMemo(() => {
    if (!effectiveRoute) return null;
    return generateMockResponse(effectiveRoute, seed);
  }, [effectiveRoute, seed]);

  const responseJson = useMemo(
    () => response ? renderJsonPretty(response.body) : "",
    [response],
  );

  const curlCmd = useMemo(() => {
    if (!effectiveRoute) return "";
    return renderCurl(effectiveRoute, "https://api.example.com");
  }, [effectiveRoute]);

  const fetchHandler = useMemo(() => {
    if (routes.length === 0) return "";
    const config: MockConfig = {
      name: resourceName || "MockApi",
      basePath: "/api",
      routes,
      createdAt: Date.now(),
    };
    return renderFetchHandler(config);
  }, [routes, resourceName]);

  const mockoonConfig = useMemo(() => {
    if (routes.length === 0) return "";
    const config: MockConfig = {
      name: resourceName || "MockApi",
      basePath: "/api",
      routes,
      createdAt: Date.now(),
    };
    return renderMockoonConfig(config);
  }, [routes, resourceName]);

  const stats = useMemo(() => computeStats(routes), [routes]);

  const handleSimulateRequest = useCallback(() => {
    if (!effectiveRoute) return;
    addInspectorEntry({
      ts: Date.now(),
      method: effectiveRoute.method,
      path: effectiveRoute.path,
      status: response?.status ?? 0,
      latencyMs: effectiveRoute.latencyMs,
      matchedRoute: `${effectiveRoute.method} ${effectiveRoute.path}`,
    });
    setInspector(loadInspector());
    toast.success(`Simulated ${effectiveRoute.method} ${effectiveRoute.path} → ${response?.status}`);
  }, [effectiveRoute, response]);

  const handleClear = useCallback(() => {
    setInput("");
    setRoutes([]);
    setResourceName("Resource");
    setError("");
    setLlmResult("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleClearInspector = useCallback(() => {
    clearInspector();
    setInspector([]);
    toast.success("Inspector cleared");
  }, []);

  const toggleRoute = (idx: number) => {
    setExpandedRoutes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSaveLlmKey = () => {
    if (typeof localStorage !== "undefined") {
      if (llmKey) localStorage.setItem("unqtools:ai-api-mocking:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-api-mocking:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Please paste your API key first");
      return;
    }
    setLlmLoading(true);
    setError("");
    try {
      const prompt = buildLlmPrompt(source, input, "Use realistic values matching the schema.");
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: Record<string, unknown>;
      if (llmProvider === "openai") {
        headers["Authorization"] = `Bearer ${llmKey}`;
        body = {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an API mocking expert." },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        };
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = {
          model: "claude-3-5-haiku-20241022",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        };
      }
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text();
        setError(`LLM request failed (${res.status}): ${txt.slice(0, 200)}`);
        toast.error("LLM request failed");
        setLlmLoading(false);
        return;
      }
      const data = await res.json();
      const rawText = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(rawText);
      if (!parsed.ok) {
        setError(parsed.error);
        setLlmLoading(false);
        return;
      }
      const pretty = renderJsonPretty(parsed.body);
      setLlmResult(pretty);
      toast.success("LLM enhanced the mock data");
    } catch (e) {
      setError(`LLM request error: ${(e as Error).message}`);
      toast.error("LLM request error");
    }
    setLlmLoading(false);
  }, [llmKey, llmProvider, source, input]);

  const shareState: ShareState = {
    source, input, name: resourceName, scenario, status, latencyMs,
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Label className="text-xs">Source:</Label>
            {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
              <Button
                key={s}
                variant={source === s ? "default" : "outline"}
                size="sm"
                onClick={() => setSource(s)}
                className="h-7 text-xs"
              >
                {SOURCE_LABELS[s]}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-mock-input">
              {source === "openapi" && "OpenAPI/Swagger JSON spec"}
              {source === "json-sample" && "JSON sample (object or array of objects)"}
              {source === "description" && "Plain-English endpoint description (e.g., 'User list with id, email, name, phone')"}
            </Label>
            <Textarea
              id="ai-mock-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                source === "openapi"
                  ? '{"openapi":"3.0.0","paths":{...},"components":{...}}'
                  : source === "json-sample"
                    ? '{"id":1,"email":"jane@example.com","name":"Jane Doe","createdAt":"2024-01-15"}'
                    : "User list with id, email, name, phone, createdAt"
              }
              className="min-h-[140px] resize-y font-mono text-xs"
            />
          </div>
          {source === "description" && (
            <div className="flex flex-wrap gap-1">
              {ENDPOINT_PRESETS.map((p) => (
                <Button
                  key={p.label}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => { setInput(p.description); setResourceName(p.label.split(" ")[0]); }}
                >
                  + {p.label}
                </Button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ai-mock-name" className="text-xs">Resource name</Label>
              <Input
                id="ai-mock-name"
                value={resourceName}
                onChange={(e) => setResourceName(e.target.value)}
                className="h-8 text-xs"
                placeholder="User"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-mock-seed" className="text-xs">Seed (deterministic output)</Label>
              <Input
                id="ai-mock-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value || "0", 10))}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Scenario</Label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as Scenario)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {(Object.keys(SCENARIO_LABELS) as Scenario[]).map((s) => (
                  <option key={s} value={s}>{SCENARIO_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(parseInt(e.target.value, 10))}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {Object.keys(STATUS_PRESETS).map((c) => (
                  <option key={c} value={c}>{c} — {STATUS_PRESETS[Number(c)]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-mock-latency" className="text-xs">Latency (ms)</Label>
              <Input
                id="ai-mock-latency"
                type="number"
                value={latencyMs}
                onChange={(e) => setLatencyMs(parseInt(e.target.value || "0", 10))}
                className="h-8 text-xs w-24"
              />
            </div>
            <RunButton onClick={() => handleGenerate()} label="Generate mock config" />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowLlm((v) => !v)}
            >
              <Sparkles className="h-3.5 w-3.5" /> LLM enhance
            </Button>
          </div>
        </CardContent>
      </Card>

      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Key className="h-4 w-4" /> Optional: enhance mocks with your own LLM API key
            </div>
            <p className="text-xs text-muted-foreground">
              Your key is stored only in this browser's localStorage. Requests go directly from your browser to the LLM provider. The pure-JS faker works without any key.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Provider</Label>
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                  className="h-8 text-xs rounded border bg-background px-2 w-full"
                >
                  <option value="openai">OpenAI (gpt-4o-mini)</option>
                  <option value="anthropic">Anthropic (claude-3-5-haiku)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">API key</Label>
                <Input
                  type="password"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="sk-..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleSaveLlmKey}>Save key locally</Button>
              <RunButton
                onClick={handleLlmEnhance}
                loading={llmLoading}
                label="Enhance with LLM"
              />
            </div>
            {llmResult && (
              <div className="space-y-1">
                <Label className="text-xs">LLM-generated mock data</Label>
                <pre className="rounded border bg-muted/30 p-2 text-[11px] font-mono overflow-auto max-h-[300px]">
                  {llmResult}
                </pre>
                <CopyButton getText={() => llmResult} label="Copy LLM output" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {routes.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Server className="h-4 w-4" /> {routes.length} routes · {stats.totalFields} fields
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Routes" value={routes.length} />
                <Stat label="Fields (total)" value={stats.totalFields} />
                <Stat label="Avg fields/route" value={stats.fieldCount} />
                <Stat label="Seed" value={seed} />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(Object.keys(stats.byMethod) as HttpMethod[]).map((m) => (
                  stats.byMethod[m] > 0 && (
                    <Badge key={m} variant="secondary" className="text-[10px]">
                      {m}: {stats.byMethod[m]}
                    </Badge>
                  )
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Routes</h3>
              <div className="space-y-1">
                {routes.map((r, idx) => (
                  <div key={idx} className="rounded border bg-background">
                    <button
                      type="button"
                      onClick={() => toggleRoute(idx)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-muted/30"
                    >
                      {expandedRoutes.has(idx)
                        ? <ChevronDown className="h-3 w-3" />
                        : <ChevronRight className="h-3 w-3" />}
                      <Badge variant="outline" className="text-[10px]">{r.method}</Badge>
                      <span className="font-mono text-foreground flex-1 truncate">{r.path}</span>
                      <Badge variant="secondary" className="text-[10px]">{r.scenario}</Badge>
                      <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                      <Button
                        size="sm"
                        variant={idx === selectedRouteIdx ? "default" : "ghost"}
                        className="h-6 text-[10px]"
                        onClick={(e) => { e.stopPropagation(); setSelectedRouteIdx(idx); }}
                      >
                        {idx === selectedRouteIdx ? "Selected" : "Use"}
                      </Button>
                    </button>
                    {expandedRoutes.has(idx) && (
                      <div className="px-3 pb-2 text-xs">
                        {r.description && (
                          <div className="text-muted-foreground italic mb-1">{r.description}</div>
                        )}
                        {r.fields.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {r.fields.map((f, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] font-mono">
                                {f.name}: {f.type}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="text-muted-foreground italic">No body (empty response)</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {response && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Play className="h-4 w-4" /> Mock response — {effectiveRoute?.method} {effectiveRoute?.path}
                  </h3>
                  <Button
                    size="sm"
                    onClick={handleSimulateRequest}
                    className="gap-1.5"
                  >
                    <Zap className="h-3.5 w-3.5" /> Simulate request
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={response.status >= 400 ? "destructive" : "secondary"} className="text-[10px]">
                    HTTP {response.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{effectiveRoute?.latencyMs}ms</Badge>
                  <Badge variant="outline" className="text-[10px]">{effectiveRoute?.scenario}</Badge>
                  <Badge variant="outline" className="text-[10px]">seed={seed}</Badge>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Response body (JSON)</Label>
                  <pre className="rounded border bg-muted/30 p-2 text-[11px] font-mono overflow-auto max-h-[400px]">
                    {responseJson}
                  </pre>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">cURL command</Label>
                  <pre className="rounded border bg-muted/30 p-2 text-[11px] font-mono overflow-auto">
                    {curlCmd}
                  </pre>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => { handleSimulateRequest(); return responseJson; }} label="Copy JSON" />
                  <CopyButton getText={() => curlCmd} label="Copy cURL" />
                  <DownloadButton
                    getText={() => renderJsonCompact(response.body)}
                    filename="mock-response.json"
                    mime="application/json"
                    label="Download JSON"
                  />
                  <DownloadButton
                    getText={() => fetchHandler}
                    filename="mock-fetch-handler.js"
                    mime="text/javascript"
                    label="Download fetch handler"
                  />
                  <DownloadButton
                    getText={() => mockoonConfig}
                    filename="mockoon-config.json"
                    mime="application/json"
                    label="Download Mockoon config"
                  />
                  <ShareButton getUrl={() => buildShareUrl(shareState)} />
                  <ClearButton onClick={handleClear} />
                </div>
              </CardContent>
            </Card>
          )}

          {inspector.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <History className="h-4 w-4" /> Inspector ({inspector.length})
                  </h3>
                  <Button variant="ghost" size="sm" onClick={handleClearInspector}>Clear</Button>
                </div>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {inspector.slice(0, 10).map((e, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="outline" className="text-[10px]">{e.method}</Badge>
                      <span className="font-mono text-foreground flex-1 truncate">{e.path}</span>
                      <Badge variant={e.status >= 400 ? "destructive" : "secondary"} className="text-[10px]">{e.status}</Badge>
                      <span className="text-muted-foreground text-[10px]">{e.latencyMs}ms</span>
                      <span className="text-muted-foreground text-[10px]">{new Date(e.ts).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Generate mock API responses from a spec, sample, or description"
          hint="Paste an OpenAPI spec, a JSON sample, or describe your endpoint in plain English. The tool generates CRUD routes with realistic faker data, latency/error simulation, and exportable Mockoon/fetch-handler configs."
          icon={<Server className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{SOURCE_LABELS[h.source]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.routeCount} routes</Badge>
                  <Badge variant="outline" className="mr-2">{h.fieldCount} fields</Badge>
                  <span className="font-mono text-foreground">{h.name}</span>
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
            <strong className="text-foreground">Privacy:</strong> All parsing, faker generation, and CRUD-route building run locally in your browser. Specs, samples, and history never leave this device. The only network call is if you paste your own LLM API key and click "Enhance with LLM" — that request goes directly to your chosen provider.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label, value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
