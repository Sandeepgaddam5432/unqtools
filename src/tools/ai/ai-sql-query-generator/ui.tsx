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
} from "../../_shared";
import { toast } from "sonner";
import {
  Database, History, Sparkles, AlertTriangle, Key, FileText, Check, ArrowRight, BookOpen,
} from "lucide-react";
import {
  ALL_DIALECTS,
  DIALECT_LABELS,
  SAMPLE_SCHEMA,
  SAMPLE_QUESTIONS,
  parseSchema,
  normalizeQuestion,
  generateSql,
  convertDialect,
  renderText,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  parseLlmResult,
  type Dialect,
  type HistoryEntry,
  type GenerationResult,
} from "./logic";

export default function AISqlQueryGenerator() {
  const [schemaText, setSchemaText] = useState("");
  const [question, setQuestion] = useState("");
  const [dialect, setDialect] = useState<Dialect>("sqlite");
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [llmKey, setLlmKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [showLlm, setShowLlm] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.schema) setSchemaText(p.schema);
      if (p.question) setQuestion(p.question);
      setDialect(p.dialect);
      if (p.schema || p.question) toast.info("Loaded from share link");
    }
  }, []);

  const schema = useMemo(() => parseSchema(schemaText), [schemaText]);

  const handleGenerate = useCallback(() => {
    const clean = normalizeQuestion(question);
    if (!clean) {
      toast.error("Enter a question first");
      return;
    }
    if (schema.tables.length === 0) {
      toast.error("Paste a schema first (CREATE TABLE DDL or table.column list)");
      return;
    }
    const r = generateSql(clean, schema, dialect);
    setResult(r);
    saveHistory({
      ts: Date.now(),
      question: clean,
      dialect,
      sql: r.sql,
      tableCount: r.tables.length,
    });
    setHistory(loadHistory());
    if (r.validation.ok) {
      toast.success(`Generated ${DIALECT_LABELS[dialect]} SQL (${r.tables.length} table(s))`);
    } else {
      toast.warning("Generated SQL has validation issues — review below");
    }
  }, [question, schema, dialect]);

  const handleConvertDialect = useCallback((target: Dialect) => {
    if (!result) return;
    const convertedSql = convertDialect(result.sql, dialect, target);
    const r = generateSql(result.question, schema, target);
    // Override the SQL with the converted version to preserve any manual edits
    r.sql = convertedSql;
    setResult(r);
    setDialect(target);
    toast.success(`Converted to ${DIALECT_LABELS[target]}`);
  }, [result, dialect, schema]);

  const handleClear = useCallback(() => {
    setQuestion("");
    setResult(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback(() => {
    setSchemaText(SAMPLE_SCHEMA);
    setQuestion(SAMPLE_QUESTIONS[0].question);
    toast.info("Sample schema loaded");
  }, []);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    const clean = normalizeQuestion(question);
    if (!clean) {
      toast.error("Enter a question first");
      return;
    }
    if (schema.tables.length === 0) {
      toast.error("Paste a schema first");
      return;
    }
    setLlmLoading(true);
    try {
      const prompt = buildLlmPrompt(clean, schema, dialect);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are an expert SQL engineer." },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { choices?: { message?: { content?: string } }[] };
      const text = json.choices?.[0]?.message?.content ?? "";
      const parsed = parseLlmResult(text);
      if (!parsed) throw new Error("No SQL returned");
      // Re-generate so validation, explanation, etc. are filled, but override SQL.
      const r = generateSql(clean, schema, dialect);
      r.sql = parsed.sql;
      r.explanation = parsed.explanation || r.explanation;
      setResult(r);
      toast.success("LLM-generated SQL applied — review before running");
    } catch (e) {
      toast.error(`LLM call failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, question, schema, dialect]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="asq-schema">Table schema (CREATE TABLE DDL or table.column list)</Label>
            <Textarea
              id="asq-schema"
              value={schemaText}
              onChange={(e) => setSchemaText(e.target.value)}
              placeholder={"CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  email TEXT\n);"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleLoadSample}>
                + Load sample schema
              </Button>
              {schema.tables.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {schema.tables.length} table(s) · {schema.columnNames.length} unique column(s)
                </Badge>
              )}
              {schema.errors.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {schema.errors.length} parse error(s)
                </Badge>
              )}
            </div>
            {schema.errors.length > 0 && (
              <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
                {schema.errors[0]}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asq-question">Ask a question in plain English</Label>
            <Textarea
              id="asq-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={"Count the number of users grouped by country"}
              className="min-h-[60px] resize-y text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_QUESTIONS.map((s) => (
                <Button
                  key={s.label}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setQuestion(s.question)}
                >+ {s.label}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Dialect</Label>
              <select
                value={dialect}
                onChange={(e) => setDialect(e.target.value as Dialect)}
                className="mt-1 h-8 w-full text-xs rounded border bg-background px-2"
              >
                {ALL_DIALECTS.map((d) => (
                  <option key={d} value={d}>{DIALECT_LABELS[d]}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-2 flex items-end">
              <Button onClick={handleGenerate} className="h-8 gap-1.5 text-xs w-full">
                <Sparkles className="h-3.5 w-3.5" /> Generate SQL
              </Button>
            </div>
            <div className="flex items-end">
              <ClearButton onClick={handleClear} />
            </div>
          </div>
        </CardContent>
      </Card>

      {result ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="h-4 w-4" /> Generated SQL
                </h3>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">{DIALECT_LABELS[result.dialect]}</Badge>
                  {result.validation.ok ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400">valid</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">{result.validation.errors.length} error(s)</Badge>
                  )}
                  {result.tables.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">{result.tables.length} table(s)</Badge>
                  )}
                </div>
              </div>
              <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap rounded border bg-background px-3 py-2">{result.sql}</pre>

              {result.validation.errors.length > 0 && (
                <div className="space-y-1">
                  {result.validation.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{e}</span>
                    </div>
                  ))}
                </div>
              )}
              {result.validation.warnings.length > 0 && (
                <div className="space-y-1">
                  {result.validation.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 rounded border border-amber-300/40 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-1.5 text-[11px]">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-foreground">{w}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => result.sql} label="Copy SQL" />
                <CopyButton getText={() => { handleSaveHistory(); return renderText(result); }} label="Copy report" />
                <DownloadButton
                  getText={() => renderMarkdown(result)}
                  filename="sql-query.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(schemaText, question, dialect); }} />
              </div>
            </CardContent>
          </Card>

          {result.parameters.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Check className="h-4 w-4" /> Parameterized ({result.parameters.length} param(s))
                </h3>
                <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap rounded border bg-background px-3 py-2">{result.parameterized}</pre>
                <div className="flex flex-wrap gap-1.5">
                  {result.parameters.map((p, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {result.dialect === "postgres" ? `$${i + 1}` : "?"} = {p}
                    </Badge>
                  ))}
                </div>
                <CopyButton getText={() => result.parameterized} label="Copy parameterized SQL" />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Explanation
              </h3>
              <p className="text-xs text-foreground">{result.explanation}</p>
              {result.explainHint && (
                <p className="text-[11px] text-muted-foreground italic">{result.explainHint}</p>
              )}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground">Intent:</span>
                <Badge variant="outline" className="text-[10px]">{result.intent.count ? "COUNT" : "SELECT"}</Badge>
                {result.intent.aggregate.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">{result.intent.aggregate.join(", ")}</Badge>
                )}
                {result.intent.join && <Badge variant="outline" className="text-[10px]">{result.intent.joinType || "INNER"} JOIN</Badge>}
                {result.intent.groupBy && <Badge variant="outline" className="text-[10px]">GROUP BY</Badge>}
                {result.intent.orderBy && <Badge variant="outline" className="text-[10px]">ORDER BY {result.intent.orderDirection || "ASC"}</Badge>}
                {result.intent.limit !== null && <Badge variant="outline" className="text-[10px]">LIMIT {result.intent.limit}</Badge>}
                {result.intent.distinct && <Badge variant="outline" className="text-[10px]">DISTINCT</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ArrowRight className="h-4 w-4" /> Convert to another dialect
              </h3>
              <div className="flex flex-wrap gap-2">
                {ALL_DIALECTS.filter((d) => d !== result.dialect).map((d) => (
                  <Button
                    key={d}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleConvertDialect(d)}
                  >
                    {DIALECT_LABELS[d]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {result.tables.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Schema context
                </h3>
                <div className="space-y-1">
                  {result.tables.map((t, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-[11px]">
                      <span className="font-mono font-medium text-foreground">{t.table.name}</span>
                      <span className="text-muted-foreground ml-2">{t.table.columns.length} column(s)</span>
                      <span className="text-muted-foreground ml-2">matched on: "{t.matchedOn}"</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Paste a schema and ask a question to generate SQL"
          hint="We'll parse your CREATE TABLE DDL (or table.column list), detect intent from your question (count, filter, join, aggregate, sort), and emit a SELECT-only query grounded in your actual columns. Always review before running."
          icon={<Database className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <button
            onClick={() => setShowLlm(!showLlm)}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
          >
            <Key className="h-4 w-4" /> Optional: enhance with your own LLM key
          </button>
          {showLlm && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Paste your own OpenAI API key to ask GPT for a richer SQL query. AI-generated SQL must always be reviewed and tested — the EXPLAIN hint below helps you verify the plan. The key is stored only in this browser tab and sent directly to OpenAI — never to us.
              </p>
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-..."
                className="font-mono text-xs"
              />
              <Button onClick={handleLlmEnhance} disabled={llmLoading} size="sm" className="gap-1.5 text-xs">
                {llmLoading ? "Working…" : <><Sparkles className="h-3.5 w-3.5" /> Enhance with LLM</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{DIALECT_LABELS[h.dialect]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.tableCount} table(s)</Badge>
                    <span className="text-muted-foreground text-[11px] truncate flex-1">{h.question}</span>
                    <span className="text-muted-foreground text-[10px]">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 font-mono text-[10px] text-foreground truncate">{h.sql}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All schema parsing, SQL generation, validation, and dialect conversion run locally in your browser. Your DDL and questions never leave this device. The only network call is if you paste your own LLM API key. Always review generated SQL before running it on real data.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  function handleSaveHistory() {
    if (result) {
      saveHistory({
        ts: Date.now(),
        question: result.question,
        dialect: result.dialect,
        sql: result.sql,
        tableCount: result.tables.length,
      });
      setHistory(loadHistory());
    }
  }
}
