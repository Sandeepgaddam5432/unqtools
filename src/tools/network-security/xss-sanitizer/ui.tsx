"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  sanitize, sanitizeBatch, batchStats, renderBatchCsv, renderReport,
  encodeForContext, getDefaults, SEVERITY_COLOR,
  type Context, type Severity,
} from "./logic";

const CONTEXTS: Context[] = ["html", "attribute", "js", "css", "url"];

export default function XssSanitizer() {
  const [html, setHtml] = useState('<p>Hello <a href="javascript:evil()">click</a> <img src="x" onerror="alert(1)"></p>');
  const [allowedTags, setAllowedTags] = useState(getDefaults().allowedTags.join(", "));
  const [allowedAttrs, setAllowedAttrs] = useState(getDefaults().allowedAttributes.join(", "));
  const [allowDataUris, setAllowDataUris] = useState(false);
  const [encodeInput, setEncodeInput] = useState("<script>alert('xss')</script>");
  const [encodeCtx, setEncodeCtx] = useState<Context>("html");
  const [error, setError] = useState("");

  const result = useMemo(() => {
    queueMicrotask(() => setError(""));
    try {
      return sanitize(html, {
        allowedTags: allowedTags.split(",").map((s) => s.trim()).filter(Boolean),
        allowedAttributes: allowedAttrs.split(",").map((s) => s.trim()).filter(Boolean),
        allowDataUris,
      });
    } catch (e) {
      queueMicrotask(() => setError(e instanceof Error ? e.message : "Sanitize failed"));
      return null;
    }
  }, [html, allowedTags, allowedAttrs, allowDataUris]);

  const encoded = useMemo(() => encodeForContext(encodeInput, encodeCtx), [encodeInput, encodeCtx]);
  const report = useMemo(() => (result ? renderReport(result) : ""), [result]);

  // Batch across all 5 contexts to show stats.
  const batch = useMemo(() => sanitizeBatch(
    CONTEXTS.map((c) => ({ html: encodeForContext(encodeInput, c) })),
  ), [encodeInput]);
  const stats = useMemo(() => batchStats(batch), [batch]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">HTML input</Label>
          <Textarea value={html} onChange={(e) => setHtml(e.target.value)}
            className="font-mono text-xs min-h-[100px]" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Allowed tags (comma-sep)</Label>
              <Input value={allowedTags} onChange={(e) => setAllowedTags(e.target.value)} className="text-xs h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Allowed attributes (comma-sep)</Label>
              <Input value={allowedAttrs} onChange={(e) => setAllowedAttrs(e.target.value)} className="text-xs h-8" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={allowDataUris}
                onChange={(e) => setAllowDataUris(e.target.checked)} />
              Allow image data: URIs
            </label>
            <div className="ml-auto flex gap-2">
              <CopyButton getText={() => result?.sanitized ?? ""} label="Copy sanitized" />
              <DownloadButton getText={() => report} filename="xss-report.txt" />
              <DownloadButton getText={() => renderBatchCsv(batch)} filename="xss-batch.csv" mime="text/csv" label="CSV" />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-[11px] ${SEVERITY_COLOR[result.severity as Severity]}`}>
                severity: {result.severity}
              </Badge>
              <Badge variant="outline" className="text-[11px]">{result.removedTags} tags</Badge>
              <Badge variant="outline" className="text-[11px]">{result.removedAttributes} attrs</Badge>
              <Badge variant="outline" className="text-[11px]">{result.removedEventHandlers} events</Badge>
              <Badge variant="outline" className="text-[11px]">{result.removedJavascriptUrls} js: URLs</Badge>
            </div>
            <div className="rounded border bg-muted/30 p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Sanitized output</div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">{result.sanitized}</pre>
            </div>
            {result.warnings.length > 0 && (
              <div className="text-[11px] text-yellow-700 dark:text-yellow-300">
                {result.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Context-aware encoder</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Input</Label>
              <Input value={encodeInput} onChange={(e) => setEncodeInput(e.target.value)} className="text-xs h-8 font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Context</Label>
              <select value={encodeCtx} onChange={(e) => setEncodeCtx(e.target.value as Context)}
                className="h-8 w-full text-xs rounded border bg-background px-2 cursor-pointer">
                {CONTEXTS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="rounded border bg-muted/30 p-2 mt-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Encoded ({encodeCtx})</div>
            <code className="text-xs font-mono break-all">{encoded}</code>
          </div>
          <div className="flex gap-2 pt-1">
            <CopyButton getText={() => encoded} label="Copy encoded" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Batch severity distribution</Label>
          <div className="grid grid-cols-5 gap-2 text-center">
            {(Object.keys(stats.bySeverity) as Severity[]).map((s) => (
              <div key={s} className={`rounded border p-2 ${SEVERITY_COLOR[s]}`}>
                <div className="text-[10px] uppercase tracking-wide">{s}</div>
                <div className="text-lg font-mono">{stats.bySeverity[s]}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Total removed patterns across all 5 contexts: {stats.totalRemoved}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all sanitization happens locally.
            No HTML is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
