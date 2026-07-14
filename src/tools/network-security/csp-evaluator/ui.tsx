"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import { analyze, scoreLabel, type Severity } from "./logic";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";

const SEVERITY_STYLES: Record<Severity, string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  info: "border-muted bg-muted/30 text-muted-foreground",
};

const SCORE_STYLES: Record<string, string> = {
  Excellent: "text-emerald-600 dark:text-emerald-400",
  Good: "text-emerald-600 dark:text-emerald-400",
  Fair: "text-amber-600 dark:text-amber-400",
  Weak: "text-orange-600 dark:text-orange-400",
  Critical: "text-red-600 dark:text-red-400",
};

export default function CspEvaluator() {
  const [input, setInput] = useState("");

  const analysis = useMemo(() => (input.trim() ? analyze(input) : null), [input]);

  const counts = useMemo(() => {
    if (!analysis?.findings) return { high: 0, medium: 0, low: 0, info: 0 };
    return analysis.findings.reduce(
      (acc, f) => {
        acc[f.severity]++;
        return acc;
      },
      { high: 0, medium: 0, low: 0, info: 0 } as Record<Severity, number>,
    );
  }, [analysis]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="csp-input" className="text-xs text-muted-foreground">
              Content-Security-Policy header value
            </Label>
            <button
              type="button"
              onClick={() =>
                setInput("default-src 'none'; script-src 'self' 'unsafe-inline' cdn.example.com http:; img-src *; style-src 'self' 'unsafe-inline'")
              }
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              Load sample (weak)
            </button>
          </div>
          <Textarea
            id="csp-input"
            placeholder="default-src 'self'; script-src 'self'; object-src 'none'"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[80px] font-mono text-xs resize-y"
            aria-label="CSP header input"
            spellCheck={false}
          />
        </CardContent>
      </Card>

      {analysis && !analysis.isValid && (
        <ErrorBanner message={analysis.error ?? "Invalid CSP"} />
      )}

      {analysis?.isValid && (
        <>
          {/* Score card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Score</p>
                  <p className={`text-5xl font-bold ${SCORE_STYLES[scoreLabel(analysis.score)]}`}>
                    {analysis.score}
                  </p>
                  <p className={`text-sm font-medium mt-1 ${SCORE_STYLES[scoreLabel(analysis.score)]}`}>
                    {scoreLabel(analysis.score)}
                  </p>
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    {analysis.score >= 75 ? (
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    ) : analysis.score >= 50 ? (
                      <ShieldAlert className="h-4 w-4 text-amber-600" />
                    ) : (
                      <ShieldX className="h-4 w-4 text-red-600" />
                    )}
                    <span>
                      {analysis.findings.length} {analysis.findings.length === 1 ? "finding" : "findings"}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[10px]">
                    <Badge variant="outline" className={`${SEVERITY_STYLES.high} justify-center`}>{counts.high} high</Badge>
                    <Badge variant="outline" className={`${SEVERITY_STYLES.medium} justify-center`}>{counts.medium} med</Badge>
                    <Badge variant="outline" className={`${SEVERITY_STYLES.low} justify-center`}>{counts.low} low</Badge>
                    <Badge variant="outline" className={`${SEVERITY_STYLES.info} justify-center`}>{counts.info} info</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Directives summary */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Directives ({Object.keys(analysis.directives).length})</Label>
              <div className="space-y-1">
                {Object.entries(analysis.directives).map(([name, sources]) => (
                  <div key={name} className="grid grid-cols-[120px_1fr] gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                    <code className="font-mono text-foreground font-semibold">{name}</code>
                    <code className="font-mono text-muted-foreground break-all">
                      {sources.length === 0 ? <span className="italic">(empty)</span> : sources.join(" ")}
                    </code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Findings */}
          {analysis.findings.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm font-semibold">Findings</Label>
                <div className="space-y-2">
                  {analysis.findings.map((f, i) => (
                    <div
                      key={i}
                      className={`rounded-md border p-3 ${SEVERITY_STYLES[f.severity]}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] uppercase bg-background/50">
                          {f.severity}
                        </Badge>
                        <code className="text-xs font-mono font-semibold">{f.directive}</code>
                      </div>
                      <p className="text-xs mb-2">{f.message}</p>
                      <p className="text-[11px] opacity-80">
                        <strong>Fix:</strong> {f.recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!input.trim() && (
        <EmptyState
          title="Paste a CSP header to analyze"
          hint="Analysis runs locally. Detects unsafe-inline, wildcards, http: schemes, missing base-uri/form-action, and more."
          icon={<ShieldCheck className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> CSP analysis
            is pure string parsing. Nothing leaves your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
