"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  SUPPORTED_TYPES,
  SCHEMA_SPECS,
  validate,
  getRequiredFields,
  getRecommendedFields,
  buildGoogleRichResultsLink,
  buildSchemaDocsLink,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";
import { History, CheckCircle2, AlertTriangle, ExternalLink, Code2 } from "lucide-react";

const SAMPLE = `{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Do SEO in 2026",
  "image": "https://example.com/seo.jpg",
  "datePublished": "2026-01-15",
  "author": { "@type": "Person", "name": "Jane Doe" },
  "publisher": { "@type": "Organization", "name": "Example Pub" }
}`;

export default function StructuredDataValidator() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) {
        setInput(p.input);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => validate(input), [input]);

  const handleSaveHistory = useCallback(() => {
    if (input.trim()) {
      saveHistory({
        ts: Date.now(),
        schemaCount: result.schemas.length,
        totalErrors: result.totalErrors,
        totalWarnings: result.totalWarnings,
        types: result.schemas.map((s) => s.type ?? "unknown"),
      });
      setHistory(loadHistory());
    }
  }, [input, result]);

  const handleClear = useCallback(() => {
    setInput("");
    toast.info("Input cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadSample = useCallback(() => {
    setInput(SAMPLE);
    toast.info("Sample loaded");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="sdv-input">JSON-LD input</Label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={loadSample}>Load sample</Button>
              <ShareButton
                getUrl={() => {
                  handleSaveHistory();
                  return buildShareUrl(input);
                }}
                disabled={!input.trim()}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <Textarea
            id="sdv-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Paste your JSON-LD here — with or without <script> wrapper...'
            className="min-h-[200px] resize-y font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Supported types: {SUPPORTED_TYPES.length}</Badge>
            <span className="text-muted-foreground self-center">Includes:</span>
            {SUPPORTED_TYPES.slice(0, 6).map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
            ))}
            <Badge variant="secondary" className="text-[10px]">+{SUPPORTED_TYPES.length - 6} more</Badge>
          </div>
        </CardContent>
      </Card>

      {input.trim() ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                {result.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
                {result.ok ? "All schemas valid" : "Validation issues found"}
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {result.parseError && (
                  <Badge variant="destructive">parse error</Badge>
                )}
                {!result.parseError && (
                  <>
                    <Badge variant="outline">{result.schemas.length} schema{result.schemas.length === 1 ? "" : "s"}</Badge>
                    {result.totalErrors > 0 && (
                      <Badge variant="destructive">{result.totalErrors} error{result.totalErrors === 1 ? "" : "s"}</Badge>
                    )}
                    {result.totalWarnings > 0 && (
                      <Badge variant="secondary">{result.totalWarnings} warning{result.totalWarnings === 1 ? "" : "s"}</Badge>
                    )}
                  </>
                )}
              </div>
            </div>

            {result.parseError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <strong>Parse error:</strong> {result.parseError}
              </div>
            )}

            {result.schemas.map((s, i) => {
              const spec = s.result.isSupported && s.result.type ? SCHEMA_SPECS[s.result.type as keyof typeof SCHEMA_SPECS] : null;
              return (
                <div key={i} className="rounded border bg-background p-3 text-xs space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">#{i + 1}</Badge>
                    <Badge variant={s.result.isSupported ? "default" : "secondary"}>
                      {s.result.type ?? "unknown"}
                    </Badge>
                    {s.result.ok ? (
                      <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400">valid</Badge>
                    ) : (
                      <Badge variant="destructive">{s.result.errors.length} error{s.result.errors.length === 1 ? "" : "s"}</Badge>
                    )}
                    {s.result.warnings.length > 0 && (
                      <Badge variant="secondary">{s.result.warnings.length} warning{s.result.warnings.length === 1 ? "" : "s"}</Badge>
                    )}
                    {s.result.type && (
                      <Button asChild variant="ghost" size="sm" className="h-6 text-xs gap-1 ml-auto">
                        <a href={buildSchemaDocsLink(s.result.type)} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" /> docs
                        </a>
                      </Button>
                    )}
                  </div>

                  {s.result.errors.length > 0 && (
                    <div className="space-y-1">
                      {s.result.errors.map((e, j) => (
                        <div key={j} className="flex items-start gap-2 text-red-600 dark:text-red-400">
                          <span className="font-mono">•</span>
                          <span><code className="bg-red-500/10 px-1 rounded">{e.field}</code> {e.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {s.result.warnings.length > 0 && (
                    <div className="space-y-1">
                      {s.result.warnings.map((w, j) => (
                        <div key={j} className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                          <span className="font-mono">•</span>
                          <span><code className="bg-amber-500/10 px-1 rounded">{w.field}</code> {w.message}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {spec && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Required fields</div>
                        <div className="flex flex-wrap gap-1">
                          {getRequiredFields(spec.type).map((f) => {
                            const present = s.result.missingRequired.includes(f.key);
                            return (
                              <span
                                key={f.key}
                                className={`rounded px-1.5 py-0.5 text-[10px] ${present ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}
                              >
                                {f.key}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Recommended</div>
                        <div className="flex flex-wrap gap-1">
                          {getRecommendedFields(spec.type).map((f) => {
                            const missing = s.result.missingRecommended.includes(f.key);
                            return (
                              <span
                                key={f.key}
                                className={`rounded px-1.5 py-0.5 text-[10px] ${missing ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}
                              >
                                {f.key}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={buildGoogleRichResultsLink()} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Test in Google Rich Results
                </a>
              </Button>
              <CopyButton
                getText={() => {
                  handleSaveHistory();
                  return JSON.stringify({
                    ok: result.ok,
                    totalErrors: result.totalErrors,
                    totalWarnings: result.totalWarnings,
                    schemas: result.schemas.map((s) => ({
                      type: s.result.type,
                      errors: s.result.errors,
                      warnings: s.result.warnings,
                    })),
                  }, null, 2);
                }}
                label="Copy report JSON"
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Paste JSON-LD to validate"
          hint="Supports Article, Product, Event, Organization, LocalBusiness, Person, Recipe, Review, FAQPage, HowTo, BreadcrumbList, VideoObject. Multi-schema @graph supported."
          icon={<Code2 className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.schemaCount} schema{h.schemaCount === 1 ? "" : "s"}</Badge>
                  {h.totalErrors > 0 && <Badge variant="destructive" className="mr-2">{h.totalErrors} err</Badge>}
                  {h.totalWarnings > 0 && <Badge variant="secondary" className="mr-2">{h.totalWarnings} warn</Badge>}
                  <span className="text-muted-foreground">{h.types.join(", ")}</span>
                  <span className="text-muted-foreground ml-2">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Validation
            runs locally. The Google Rich Results link opens in a new tab —
            your data is not sent there automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
