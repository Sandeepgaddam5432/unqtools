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
  SAMPLE_SDL,
  SAMPLE_QUERY,
  HONESTY_BANNER,
  parseSdl,
  parseQuery,
  generateMock,
  renderResult,
  computeStats,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type MockOptions,
  type ExportFormat,
  type OperationKind,
  type HistoryEntry,
} from "./logic";
import { Braces, History, Wand2, AlertTriangle, FileCode2, Loader } from "lucide-react";

export default function MockGraphqlResponseGenerator() {
  const [sdl, setSdl] = useState<string>(SAMPLE_SDL);
  const [query, setQuery] = useState<string>(SAMPLE_QUERY);
  const [listSize, setListSize] = useState(3);
  const [depthLimit, setDepthLimit] = useState(3);
  const [seed, setSeed] = useState("");
  const [nullableRate, setNullableRate] = useState(0);
  const [errorRate, setErrorRate] = useState(0);
  const [format, setFormat] = useState<ExportFormat>("graphql-response");
  const [overridesText, setOverridesText] = useState("");
  const [operationName, setOperationName] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setListSize(parsed.listSize);
      setDepthLimit(parsed.depthLimit);
      setSeed(parsed.seed);
      setNullableRate(parsed.nullableRate);
      setErrorRate(parsed.errorRate);
      setFormat(parsed.format);
      if (parsed.listSize || parsed.seed) toast.info("Loaded from share link");
    }
  }, []);

  const sdlParse = useMemo(() => parseSdl(sdl), [sdl]);
  const queryParse = useMemo(() => parseQuery(query), [query]);

  const overrides = useMemo(() => {
    const out: Record<string, string> = {};
    for (const line of overridesText.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (key) out[key] = val;
    }
    return out;
  }, [overridesText]);

  const options: MockOptions = useMemo(() => ({
    listSize, depthLimit, seed, nullableRate: nullableRate / 100, errorRate: errorRate / 100,
    overrides, operationName: operationName || undefined,
  }), [listSize, depthLimit, seed, nullableRate, errorRate, overrides, operationName]);

  const result = useMemo(() => {
    if (!sdlParse.ok || !queryParse.ok) return null;
    try {
      return generateMock(sdlParse.schema, queryParse.operations, options);
    } catch (e) {
      return { ok: false, warnings: [(e as Error).message], data: null, operationKind: "query" as OperationKind };
    }
  }, [sdlParse, queryParse, options]);

  const output = useMemo(() => {
    if (!result) return "";
    return renderResult(result, format);
  }, [result, format]);

  const stats = useMemo(() => {
    if (!result) return null;
    return computeStats(result, options);
  }, [result, options]);

  const schemaSize = sdl.length;
  const querySize = query.length;

  const handleSaveHistory = useCallback(() => {
    if (!result) return;
    saveHistory({
      ts: Date.now(),
      operationKind: result.operationKind,
      operationName: result.operationName,
      listSize, seed, schemaSize, querySize, format,
    });
    setHistory(loadHistory());
  }, [result, listSize, seed, schemaSize, querySize, format]);

  const handleLoadSample = useCallback(() => {
    setSdl(SAMPLE_SDL);
    setQuery(SAMPLE_QUERY);
    toast.success("Loaded sample schema + query");
  }, []);

  const handleClear = useCallback(() => {
    setSdl("");
    setQuery("");
    setSeed("");
    setNullableRate(0);
    setErrorRate(0);
    setOverridesText("");
    setOperationName("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const downloadFilename = useMemo(() => {
    const ext = format === "json" ? "json" :
                format === "graphql-response" ? "json" :
                format === "msw" ? "ts" : "ts";
    const base = result?.operationName ?? "mock";
    return `${base}.${ext}`;
  }, [format, result]);

  const downloadMime = useMemo(() => {
    if (format === "json" || format === "graphql-response") return "application/json";
    return "text/plain";
  }, [format]);

  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!sdlParse.ok) errs.push(...sdlParse.errors);
    if (!queryParse.ok) errs.push(...queryParse.errors);
    return errs;
  }, [sdlParse, queryParse]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Honesty banner */}
      <Card>
        <CardContent className="p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">{HONESTY_BANNER}</p>
        </CardContent>
      </Card>

      {/* Load sample */}
      <Card>
        <CardContent className="p-4 flex items-center gap-2">
          <Wand2 className="h-4 w-4" />
          <span className="text-sm">Quick start:</span>
          <Button variant="outline" size="sm" onClick={handleLoadSample}>Load sample schema + query</Button>
        </CardContent>
      </Card>

      {/* Two-pane input */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="mgql-sdl" className="text-sm font-semibold">GraphQL SDL Schema</Label>
              <Badge variant="outline" className="text-[10px]">{schemaSize} chars</Badge>
            </div>
            <Textarea
              id="mgql-sdl"
              value={sdl}
              onChange={(e) => setSdl(e.target.value)}
              placeholder={"type Query {\n  user(id: ID!): User\n}\n\ntype User {\n  id: ID!\n  name: String!\n}"}
              className="min-h-[300px] resize-y font-mono text-xs"
            />
            {sdlParse.ok ? (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                ✓ Parsed {Object.keys(sdlParse.schema.types).length} types
                {sdlParse.warnings.length > 0 ? ` · ${sdlParse.warnings.length} warnings` : ""}
              </p>
            ) : (
              <p className="text-[10px] text-red-600 dark:text-red-400">
                ✗ {sdlParse.errors[0]}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="mgql-query" className="text-sm font-semibold">GraphQL Query / Mutation / Subscription</Label>
              <Badge variant="outline" className="text-[10px]">{querySize} chars</Badge>
            </div>
            <Textarea
              id="mgql-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={"query GetUser($id: ID!) {\n  user(id: $id) {\n    id\n    name\n  }\n}"}
              className="min-h-[300px] resize-y font-mono text-xs"
            />
            {queryParse.ok ? (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                ✓ Parsed {queryParse.operations.length} operation(s): {queryParse.operations.map((o) => o.name ?? "<anonymous>").join(", ")}
              </p>
            ) : (
              <p className="text-[10px] text-red-600 dark:text-red-400">
                ✗ {queryParse.errors[0]}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Options */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Mock options</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">List size</Label>
              <Input
                type="number"
                value={listSize}
                min={0}
                max={100}
                onChange={(e) => setListSize(parseInt(e.target.value, 10) || 0)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Depth limit</Label>
              <Input
                type="number"
                value={depthLimit}
                min={0}
                max={20}
                onChange={(e) => setDepthLimit(parseInt(e.target.value, 10) || 0)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nullable % (0-100)</Label>
              <Input
                type="number"
                value={nullableRate}
                min={0}
                max={100}
                onChange={(e) => setNullableRate(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Error % (0-100)</Label>
              <Input
                type="number"
                value={errorRate}
                min={0}
                max={100}
                onChange={(e) => setErrorRate(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Seed (optional)</Label>
              <Input
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="leave blank for random"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Operation name (optional)</Label>
              <Input
                value={operationName}
                onChange={(e) => setOperationName(e.target.value)}
                placeholder="auto-detect"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Export format</Label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                className="h-8 text-xs rounded border bg-background px-2 w-full"
              >
                <option value="graphql-response">GraphQL response ({`{ data, errors }`})</option>
                <option value="json">JSON (data only)</option>
                <option value="msw">MSW handler snippet</option>
                <option value="apollo">Apollo mock resolver</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="mgql-overrides" className="text-xs">
              Per-field overrides (one per line, <code>path = value</code> or <code>path = {"{{faker.template}}"}</code>)
            </Label>
            <Textarea
              id="mgql-overrides"
              value={overridesText}
              onChange={(e) => setOverridesText(e.target.value)}
              placeholder={"user.name = Alice\nuser.email = {{internet.email}}\nuser.posts.id = fixed-id-123"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Errors */}
      {errors.length > 0 && <ErrorBanner message={errors.join(" ")} />}

      {/* Output */}
      {result && stats && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">
                Mock result for {stats.operationKind} {stats.operationName ?? "<anonymous>"}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Operation" value={stats.operationKind} />
                <Stat label="Data size" value={`${stats.dataBytes} B`} />
                <Stat label="Warnings" value={stats.warningsCount} highlight={stats.warningsCount > 0 ? "bad" : undefined} />
                <Stat label="Errors" value={stats.hasErrors ? "yes" : "no"} highlight={stats.hasErrors ? "bad" : "good"} />
              </div>
              {result.warnings.length > 0 && (
                <details className="text-[10px] text-muted-foreground">
                  <summary className="cursor-pointer">{result.warnings.length} warnings</summary>
                  <ul className="list-disc pl-5 pt-1">
                    {result.warnings.slice(0, 20).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileCode2 className="h-4 w-4" /> Output ({output.length.toLocaleString()} bytes)
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return output; }}
                    label="Copy"
                  />
                  <DownloadButton
                    getText={() => { handleSaveHistory(); return output; }}
                    filename={downloadFilename}
                    mime={downloadMime}
                    label={`Download .${downloadFilename.split(".").pop()}`}
                  />
                  <ShareButton
                    getUrl={() => {
                      handleSaveHistory();
                      return buildShareUrl({
                        listSize, depthLimit, seed, nullableRate: nullableRate / 100,
                        errorRate: errorRate / 100, format,
                      });
                    }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <Textarea
                readOnly
                value={output.slice(0, 50000)}
                className="min-h-[300px] resize-y font-mono text-xs"
                placeholder="Output will appear here…"
              />
              {output.length > 50000 && (
                <p className="text-[10px] text-muted-foreground">
                  Output truncated to 50 KB for display. Download to get full {output.length.toLocaleString()} bytes.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!result && errors.length === 0 && (
        <EmptyState
          title="Paste a schema and query to generate a mock response"
          hint="The schema and query are parsed locally in your browser. Click 'Load sample schema + query' to see an example."
          icon={<Braces className="h-8 w-8" />}
        />
      )}

      {/* History */}
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
                  <Badge variant="outline" className="mr-2">{h.operationKind}</Badge>
                  {h.operationName && <Badge variant="outline" className="mr-2">{h.operationName}</Badge>}
                  <Badge variant="outline" className="mr-2">{h.format}</Badge>
                  <Badge variant="outline" className="mr-2">list={h.listSize}</Badge>
                  {h.seed && <Badge variant="outline" className="mr-2">seed: {h.seed}</Badge>}
                  <span className="text-muted-foreground">schema: {h.schemaSize}B · query: {h.querySize}B</span>
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
            <strong className="text-foreground">Privacy:</strong> All SDL parsing and mock generation runs locally. History stores metadata only (not the schema or query text) in localStorage on this device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
