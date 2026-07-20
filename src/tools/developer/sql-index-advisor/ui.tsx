"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  SAMPLE_QUERY,
  SAMPLE_DDL,
  HOWTO_USE,
  DEFAULT_SHARE_OPTIONS,
  advise,
  renderMarkdown,
  renderSqlScript,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ShareOptions,
  type HistoryEntry,
  type IndexRecommendation,
} from "./logic";
import {
  History, ListTree, Database, Lightbulb, AlertTriangle,
  AlertCircle, Info, Code2,
} from "lucide-react";

export default function SqlIndexAdvisor() {
  const [query, setQuery] = useState("");
  const [ddl, setDdl] = useState("");
  const [opts, setOpts] = useState<ShareOptions>({ ...DEFAULT_SHARE_OPTIONS });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHowto, setShowHowto] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setOpts(parsed);
      toast.info("Loaded options from share link");
    }
  }, []);

  const result = useMemo(() => {
    if (!query.trim()) return null;
    return advise(query, ddl, opts);
  }, [query, ddl, opts]);

  const markdown = useMemo(() => (result?.ok ? renderMarkdown(result.result, opts) : ""), [result, opts]);
  const sqlScript = useMemo(() => (result?.ok ? renderSqlScript(result.result) : ""), [result]);
  const csv = useMemo(() => (result?.ok ? renderCsv(result.result) : ""), [result]);
  const json = useMemo(() => (result?.ok ? renderJson(result.result) : ""), [result]);

  const handleLoadSample = useCallback(() => {
    setQuery(SAMPLE_QUERY);
    setDdl(SAMPLE_DDL);
    toast.info("Loaded sample query + DDL");
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
    setDdl("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const recordHistory = useCallback(() => {
    if (result?.ok) {
      saveHistory({
        ts: Date.now(),
        tableCount: result.result.stats.tables,
        predicateCount: result.result.stats.predicates,
        recommendationCount: result.result.stats.recommendations,
        queryPreview: query.slice(0, 80),
      });
      setHistory(loadHistory());
    }
  }, [result, query]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="sql-query" className="text-sm font-semibold flex items-center gap-1.5">
              <Code2 className="h-4 w-4" /> SQL query
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleLoadSample}>Load sample</Button>
              <Button variant="outline" size="sm" onClick={() => setShowHowto((v) => !v)}>How to use</Button>
              <ClearButton onClick={handleClear} disabled={!query && !ddl} />
            </div>
          </div>
          <Textarea
            id="sql-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={"Paste your SQL query here…\n\nSELECT u.id, u.email, o.total\nFROM users u\nINNER JOIN orders o ON o.user_id = u.id\nWHERE u.status = 'active'\n  AND o.created_at > '2023-01-01'\nORDER BY o.created_at DESC"}
            className="min-h-[160px] resize-y font-mono text-xs"
          />
          <div className="space-y-1.5">
            <Label htmlFor="sql-ddl" className="text-xs text-muted-foreground">
              Table DDL (optional — paste CREATE TABLE / CREATE INDEX statements)
            </Label>
            <Textarea
              id="sql-ddl"
              value={ddl}
              onChange={(e) => setDdl(e.target.value)}
              placeholder={"CREATE TABLE users (id BIGINT PRIMARY KEY, email VARCHAR(255), ...);\nCREATE INDEX idx_users_email ON users(email);"}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={opts.includeCaveats}
                onChange={(e) => setOpts((p) => ({ ...p, includeCaveats: e.target.checked }))}
              /> Show caveats
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={opts.recommendCovering}
                onChange={(e) => setOpts((p) => ({ ...p, recommendCovering: e.target.checked }))}
              /> Suggest covering indexes (INCLUDE)
            </label>
            <Label className="flex items-center gap-1">Dialect:
              <select
                value={opts.dialect}
                onChange={(e) => setOpts((p) => ({ ...p, dialect: e.target.value as ShareOptions["dialect"] }))}
                className="h-7 text-xs rounded border bg-background px-2"
              >
                <option value="ansi">ANSI</option>
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="sqlserver">SQL Server</option>
              </select>
            </Label>
          </div>
        </CardContent>
      </Card>

      {showHowto && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Info className="h-4 w-4" /> How to use this advisor
            </h3>
            <ol className="text-xs space-y-1 list-decimal list-inside">
              {HOWTO_USE.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Heuristic advice:</strong> This advisor applies static rules. Always validate with{" "}
              <code className="px-1 py-0.5 bg-muted/40 rounded">EXPLAIN ANALYZE</code> on real data —
              use the <strong>EXPLAIN Plan Visualizer (#271)</strong> to confirm.
            </p>
          </div>
        </CardContent>
      </Card>

      {result && !result.ok && (
        <ErrorBanner message={result.error} />
      )}

      {result?.ok && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <ListTree className="h-4 w-4" /> Analysis overview
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Tables" value={result.result.stats.tables} />
                <Stat label="Predicates" value={result.result.stats.predicates} />
                <Stat label="Recommendations" value={result.result.stats.recommendations} highlight={result.result.stats.recommendations > 0 ? "good" : undefined} />
                <Stat label="High-confidence" value={result.result.stats.highConfidence} />
                <Stat label="Redundant existing" value={result.result.stats.redundantDetected} highlight={result.result.stats.redundantDetected > 0 ? "bad" : "good"} />
                <Stat label="Warnings" value={result.result.stats.warnings} highlight={result.result.stats.warnings > 0 ? "bad" : "good"} />
              </div>
            </CardContent>
          </Card>

          {result.result.warnings.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Warnings ({result.result.warnings.length})
                </h3>
                <ul className="space-y-1.5 text-xs">
                  {result.result.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 rounded border bg-background px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
                      <span className="text-foreground">{w}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {result.result.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Lightbulb className="h-4 w-4" /> Recommendations ({result.result.recommendations.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton getText={() => { recordHistory(); return sqlScript; }} label="Copy SQL" />
                    <DownloadButton getText={() => sqlScript} filename="recommended-indexes.sql" mime="application/sql" label="Download .sql" />
                    <DownloadButton getText={() => markdown} filename="index-advisor-report.md" mime="text/markdown" label="Download .md" />
                    <DownloadButton getText={() => csv} filename="index-advisor.csv" mime="text/csv" label="CSV" />
                    <DownloadButton getText={() => json} filename="index-advisor.json" mime="application/json" label="JSON" />
                    <ShareButton getUrl={() => buildShareUrl(opts)} />
                  </div>
                </div>
                <div className="space-y-2 max-h-[600px] overflow-auto">
                  {result.result.recommendations.map((r) => (
                    <RecommendationCard key={r.id} rec={r} showCaveats={opts.includeCaveats} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.result.redundantExisting.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Redundant existing indexes ({result.result.redundantExisting.length})
                </h3>
                <ul className="space-y-1 text-xs">
                  {result.result.redundantExisting.map((e, i) => (
                    <li key={i} className="rounded border bg-background px-3 py-1.5">
                      <code className="text-foreground">{e.name}</code> on{" "}
                      <code className="text-foreground">{e.table}</code> ({e.columns.join(", ")})
                      <span className="text-muted-foreground"> — covered by a recommended index; consider DROPping.</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!query.trim() && (
        <EmptyState
          title="Paste a SQL query to get index recommendations"
          hint="The advisor parses WHERE/JOIN/ORDER BY/GROUP BY clauses and recommends composite indexes in correct column order. 100% client-side."
          icon={<Database className="h-8 w-8" />}
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
                    <Badge variant="outline" className="text-[10px]">{h.tableCount} tables</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.predicateCount} predicates</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.recommendationCount} recs</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <code className="block mt-1 text-[10px] text-muted-foreground truncate">{h.queryPreview}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Query and DDL are analyzed entirely in your browser. Nothing is uploaded. History (last 20) is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RecommendationCard({ rec, showCaveats }: { rec: IndexRecommendation; showCaveats: boolean }) {
  const confColor = rec.confidence === "high"
    ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
    : rec.confidence === "medium"
      ? "text-amber-600 dark:text-amber-400 border-amber-500/40"
      : "text-red-600 dark:text-red-400 border-red-500/40";
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={`text-[9px] ${confColor}`}>{rec.confidence}</Badge>
        <span className="font-mono font-medium text-foreground">{rec.id}</span>
        <span className="text-muted-foreground">on</span>
        <span className="font-mono text-foreground">{rec.schema ? `${rec.schema}.` : ""}{rec.table}</span>
        {rec.isExpression && <Badge variant="outline" className="text-[9px]">expression</Badge>}
        {rec.coversExisting && (
          <Badge variant="outline" className="text-[9px] text-amber-600 dark:text-amber-400 border-amber-500/40">
            redundant: {rec.coversExisting.name}
          </Badge>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-[10px]">
          Columns: {rec.columns.map((c) => <code key={c} className="mx-0.5">{c}</code>)}
        </Badge>
        {rec.equalityColumns.length > 0 && (
          <Badge variant="outline" className="text-[10px]">eq: {rec.equalityColumns.join(", ")}</Badge>
        )}
        {rec.rangeColumns.length > 0 && (
          <Badge variant="outline" className="text-[10px]">range: {rec.rangeColumns.join(", ")}</Badge>
        )}
        {rec.sortColumns.length > 0 && (
          <Badge variant="outline" className="text-[10px]">sort: {rec.sortColumns.join(", ")}</Badge>
        )}
        {rec.includeColumns.length > 0 && (
          <Badge variant="outline" className="text-[10px]">INCLUDE: {rec.includeColumns.join(", ")}</Badge>
        )}
      </div>
      <p className="mt-1.5 text-foreground">{rec.reasoning}</p>
      {showCaveats && rec.caveats.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
          {rec.caveats.map((c, i) => (
            <li key={i} className="flex items-start gap-1">
              <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5 text-amber-500" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
      <pre className="mt-2 p-2 bg-muted/40 rounded text-[11px] overflow-auto">{rec.createIndexSql}</pre>
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
