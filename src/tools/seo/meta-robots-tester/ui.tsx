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
  DIRECTIVE_REFERENCE,
  testInput,
  renderReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";
import { History, Bot, AlertTriangle, CheckCircle2, Info } from "lucide-react";

const SAMPLE = `<meta name="robots" content="index, noindex, follow, noarchive">`;

export default function MetaRobotsTester() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) {
        setInput(p.data);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => testInput(input), [input]);
  const report = useMemo(() => renderReport(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (input.trim()) {
      saveHistory({
        ts: Date.now(),
        source: result.source,
        valid: result.valid,
        conflictCount: result.conflicts.length,
        fixedTag: result.fixedTag,
      });
      setHistory(loadHistory());
    }
  }, [input, result]);

  const handleClear = useCallback(() => {
    setInput("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const directiveList = Object.entries(result.parsed.directives);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="mrt-input">HTML meta tag, X-Robots-Tag header, or raw directives</Label>
            <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); toast.info("Sample loaded (with conflicts)"); }}>
              Load sample
            </Button>
          </div>
          <Textarea
            id="mrt-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={'<meta name="robots" content="noindex, nofollow">\n\nor\n\nX-Robots-Tag: noindex, nofollow\n\nor\n\nnoindex, nofollow'}
            className="min-h-[100px] resize-y font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Auto-detects: HTML meta tag, X-Robots-Tag header, or plain directive string.
          </p>
        </CardContent>
      </Card>

      {input.trim() ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Bot className="h-4 w-4" /> Test result
                </h3>
                <Badge variant="outline">{result.source}</Badge>
                {result.valid ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" /> valid
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-0.5" /> issues found
                  </Badge>
                )}
              </div>

              {directiveList.length === 0 ? (
                <p className="text-xs text-muted-foreground">No directives detected.</p>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Parsed directives</div>
                  <div className="flex flex-wrap gap-1.5">
                    {directiveList.map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="text-xs font-mono">
                        {k}{typeof v === "string" ? `: ${v}` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {result.conflicts.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Conflicts ({result.conflicts.length})
                </h3>
                <div className="space-y-2">
                  {result.conflicts.map((c, i) => (
                    <div
                      key={i}
                      className={`rounded border p-2 text-xs ${
                        c.type === "error"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}
                    >
                      <div className="font-medium">[{c.type}] {c.message}</div>
                      <div className="mt-0.5 opacity-90">→ {c.recommendation}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="h-4 w-4" /> Recommendations
                </h3>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" /> Fixed tag
                </Label>
                <CopyButton getText={() => { handleSaveHistory(); return result.fixedTag; }} label="Copy tag" size="icon-sm" />
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs">
                {result.fixedTag}
              </pre>
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton getText={() => report} label="Copy report" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste meta robots directives to test"
          hint="Paste an HTML meta tag, an X-Robots-Tag header line, or a plain directive string. The tool parses, validates, detects conflicts, and outputs a fixed tag."
          icon={<Bot className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Directive reference</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[400px] overflow-auto">
            {DIRECTIVE_REFERENCE.map((d) => (
              <div key={d.name} className="rounded border bg-background px-2 py-1.5 text-xs">
                <code className="font-medium text-foreground">{d.name}</code>
                <div className="text-muted-foreground mt-0.5">{d.description}</div>
              </div>
            ))}
          </div>
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
                <button
                  key={i}
                  onClick={() => { setInput(h.fixedTag); toast.info("Loaded fixed tag"); }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <Badge variant="outline" className="mr-2">{h.source}</Badge>
                  {h.valid ? (
                    <Badge variant="outline" className="mr-2 text-emerald-700 dark:text-emerald-400">valid</Badge>
                  ) : (
                    <Badge variant="outline" className="mr-2 text-red-700 dark:text-red-400">{h.conflictCount} conflicts</Badge>
                  )}
                  <code className="font-mono text-[11px] truncate">{h.fixedTag}</code>
                  <div className="text-muted-foreground/70 mt-1">{new Date(h.ts).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All parsing runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
