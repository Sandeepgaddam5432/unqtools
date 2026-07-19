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
  TYPE_PRESETS,
  parseSqlDdl,
  parseNaturalLanguage,
  inferRelationships,
  generateMermaid,
  generateDbml,
  renderCsv,
  renderText,
  mermaidLiveUrl,
  validateSchema,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  LLM_KEY_STORAGE,
  type Schema,
  type HistoryEntry,
  type ShareState,
} from "./logic";
import {
  Database, Sparkles, Key, History, AlertTriangle,
  FileCode, Table2, ExternalLink, Copy, Wand2,
} from "lucide-react";

type Tab = "mermaid" | "dbml" | "csv" | "text";
type Source = "nl" | "sql";

const NL_PRESETS: { label: string; text: string }[] = [
  {
    label: "Blog",
    text: "Table users has columns: id (pk, int), email (varchar, unique), name (text)\nTable posts has columns: id (pk, int), user_id (int), title (text), body (text)\nusers has many posts",
  },
  {
    label: "E-commerce",
    text: "Table customers has columns: id (pk, int), email (varchar, unique), name\nTable orders has columns: id (pk, int), customer_id (int), total (decimal)\nTable items has columns: id (pk, int), order_id (int), product_id (int), qty (int)\ncustomers has many orders\norders has many items",
  },
  {
    label: "Many-to-many",
    text: "users: id (pk), name\ntags: id (pk), label\nusers many-to-many tags via user_tags",
  },
];

const SQL_PRESETS: { label: string; text: string }[] = [
  {
    label: "Blog (SQL)",
    text: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name TEXT
);
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);`,
  },
];

export default function AiDbSchemaDiagramBuilder() {
  const [source, setSource] = useState<Source>("nl");
  const [input, setInput] = useState("");
  const [infer, setInfer] = useState(true);
  const [tab, setTab] = useState<Tab>("mermaid");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmBusy, setLlmBusy] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    try {
      const k = localStorage.getItem(LLM_KEY_STORAGE);
      if (k) setLlmKey(k);
    } catch { /* ignore */ }
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setSource(p.source);
      setInput(p.input);
      if (p.input) toast.info("Loaded from share link");
    }
  }, []);

  const schema: Schema = useMemo(() => {
    const base = source === "sql" ? parseSqlDdl(input) : parseNaturalLanguage(input);
    if (!infer) return base;
    const inferred = inferRelationships(base.entities);
    const seen = new Set(base.relationships.map((r) => r.id));
    const merged = [...base.relationships];
    for (const r of inferred) {
      if (!seen.has(r.id)) {
        merged.push(r);
        seen.add(r.id);
      }
    }
    return { ...base, relationships: merged };
  }, [input, source, infer]);

  const validation = useMemo(() => validateSchema(schema), [schema]);
  const mermaid = useMemo(() => generateMermaid(schema), [schema]);
  const dbml = useMemo(() => generateDbml(schema), [schema]);
  const csv = useMemo(() => renderCsv(schema), [schema]);
  const text = useMemo(() => renderText(schema), [schema]);
  const liveUrl = useMemo(() => (mermaid && mermaid !== "erDiagram" ? mermaidLiveUrl(mermaid) : ""), [mermaid]);

  const handleSaveHistory = useCallback(() => {
    if (schema.entities.length > 0) {
      saveHistory({
        ts: Date.now(),
        title: schema.title,
        entityCount: schema.entities.length,
        relCount: schema.relationships.length,
        source,
        mermaid,
      });
      setHistory(loadHistory());
    }
  }, [schema, source, mermaid]);

  const handleClear = useCallback(() => {
    setInput("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLlmKeySave = useCallback(() => {
    try {
      localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      toast.success("API key saved (localStorage only)");
    } catch {
      toast.error("Could not save API key");
    }
  }, [llmKey]);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your own LLM API key first");
      return;
    }
    if (source !== "nl" || !input.trim()) {
      toast.error("LLM polish works on plain-English input");
      return;
    }
    setLlmBusy(true);
    try {
      const prompt = buildLlmPrompt(input);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LLM API error ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = await res.json() as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content ?? "";
      const rendered = renderLlmResult(raw);
      setSource("sql");
      setInput(rendered.sql);
      toast.success("LLM polish applied (verify the result!)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "LLM call failed");
    } finally {
      setLlmBusy(false);
    }
  }, [llmKey, input, source]);

  const current = tab === "mermaid" ? mermaid : tab === "dbml" ? dbml : tab === "csv" ? csv : text;
  const fileExt = tab === "mermaid" ? "mmd" : tab === "dbml" ? "dbml" : tab === "csv" ? "csv" : "txt";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={source === "nl" ? "default" : "outline"}
              onClick={() => setSource("nl")}
            >Plain English</Button>
            <Button
              size="sm"
              variant={source === "sql" ? "default" : "outline"}
              onClick={() => setSource("sql")}
            >SQL DDL</Button>
            <label className="ml-auto flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={infer}
                onChange={() => setInfer((v) => !v)}
              />
              Infer relationships from naming
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dbs-input">
              {source === "nl" ? "Describe your tables (plain English)" : "Paste SQL DDL (CREATE TABLE …)"}
            </Label>
            <Textarea
              id="dbs-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                source === "nl"
                  ? "Table users has columns: id (pk, int), email (varchar, unique), name\nTable posts has columns: id (pk, int), user_id (int), title\nusers has many posts"
                  : "CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255) UNIQUE NOT NULL\n);"
              }
              className="min-h-[160px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {(source === "nl" ? NL_PRESETS : SQL_PRESETS).map((p) => (
                <Button
                  key={p.label}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setInput(p.text)}
                >+ {p.label}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {validation.errors.length > 0 && (
        <ErrorBanner message={`Schema issues: ${validation.errors.join("; ")}`} />
      )}

      {schema.entities.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Database className="h-4 w-4" /> {schema.entities.length} entities · {schema.relationships.length} relationships
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Entities" value={schema.entities.length} />
                <Stat label="Relationships" value={schema.relationships.length} />
                <Stat label="1:N" value={schema.relationships.filter((r) => r.type === "1:N").length} />
                <Stat label="N:M" value={schema.relationships.filter((r) => r.type === "N:M").length} />
              </div>
              {validation.warnings.length > 0 && (
                <div className="space-y-1 pt-2">
                  {validation.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5 rounded border border-yellow-300/40 bg-yellow-50 dark:bg-yellow-900/10 px-2 py-1 text-[11px] text-yellow-800 dark:text-yellow-200">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {(["mermaid", "dbml", "csv", "text"] as Tab[]).map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant={tab === t ? "default" : "outline"}
                      onClick={() => setTab(t)}
                      className="h-7 text-xs"
                    >{t === "mermaid" ? "Mermaid" : t === "dbml" ? "DBML" : t.toUpperCase()}</Button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return current; }}
                    label={`Copy ${tab}`}
                  />
                  <DownloadButton
                    getText={() => current}
                    filename={`schema.${fileExt}`}
                    mime={tab === "csv" ? "text/csv" : "text/plain"}
                    label={`Download .${fileExt}`}
                  />
                  {tab === "mermaid" && liveUrl && (
                    <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" /> mermaid.live
                      </Button>
                    </a>
                  )}
                  <ShareButton getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({ source, input } as ShareState);
                  }} />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <pre className="rounded border bg-muted/40 p-3 text-xs font-mono overflow-auto max-h-[480px] whitespace-pre">
                {current || "—"}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Table2 className="h-4 w-4" /> Entities
                </h3>
                <Button size="sm" variant="ghost" onClick={() => setShowLlm((v) => !v)}>
                  <Wand2 className="h-3.5 w-3.5 mr-1" /> BYO-key LLM
                </Button>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-auto">
                {schema.entities.map((e) => (
                  <div key={e.name} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-foreground">{e.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{e.columns.length} cols</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {e.columns.map((c) => (
                        <span key={c.name} className="font-mono text-[10px] text-muted-foreground">
                          {c.name}
                          {c.keys.length > 0 && (
                            <span className="ml-0.5 text-primary">
                              [{c.keys.join(",")}]
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {showLlm && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-4 w-4" /> Bring your own LLM API key
                </h3>
                <p className="text-xs text-muted-foreground">
                  Optional. If you paste an OpenAI API key, the tool will call OpenAI directly from your browser to polish your plain-English schema into SQL DDL. The key is stored only in this browser&apos;s localStorage. The on-device parser works without any key.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    className="text-xs font-mono"
                  />
                  <Button size="sm" variant="outline" onClick={handleLlmKeySave}>Save key</Button>
                  <Button
                    size="sm"
                    onClick={handleLlmEnhance}
                    disabled={llmBusy}
                  >
                    {llmBusy ? "Working…" : (<><Sparkles className="h-3.5 w-3.5 mr-1" />Polish with LLM</>)}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Honesty: LLM output is a starting point — verify against your real schema. On-device rule-based parsing is weaker than a BYO-key LLM for large/complex schemas.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Describe your schema or paste SQL DDL"
          hint="Plain English ('Table users has columns: id (pk), email (unique)') or SQL CREATE TABLE statements. Get Mermaid erDiagram code, DBML export, and a mermaid.live deep link. Everything runs locally."
          icon={<Database className="h-8 w-8" />}
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
                <button
                  key={i}
                  onClick={() => { setSource(h.source === "sql" ? "sql" : "nl"); setInput(h.mermaid); toast.info("Restored Mermaid from history"); }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent"
                >
                  <Badge variant="outline" className="mr-2">{h.source.toUpperCase()}</Badge>
                  <Badge variant="outline" className="mr-2">{h.entityCount} entities</Badge>
                  <Badge variant="outline" className="mr-2">{h.relCount} rels</Badge>
                  <span className="text-muted-foreground">· {new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy + Honesty:</strong> All parsing, generation, and inference run locally. The only outbound link is the mermaid.live button (opens in a new tab). Verify the diagram against your real schema before relying on it — complex constraints (composite FKs, partial indexes, triggers) are represented best-effort.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
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
