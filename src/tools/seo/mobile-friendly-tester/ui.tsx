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
  analyze,
  renderReport,
  DEVICE_DIMENSIONS,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
  type Rating,
} from "./logic";
import { History, Smartphone, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const SAMPLE = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sample Page</title>
</head>
<body>
  <h1 style="font-size: 24px">Welcome</h1>
  <p style="font-size: 14px">This is body text.</p>
  <a href="#" width="48" height="48">Click me</a>
  <a href="#" width="24" height="24">Small link</a>
  <img src="hero.jpg" srcset="hero.jpg 1x, hero@2x.jpg 2x" sizes="100vw">
  <img src="banner.jpg">
  <div style="width: 1000px">Fixed container</div>
</body>
</html>`;

const RATING_COLORS: Record<Rating, string> = {
  pass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  fail: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

const RATING_ICONS: Record<Rating, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
};

export default function MobileFriendlyTester() {
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

  const result = useMemo(() => analyze(input), [input]);
  const report = useMemo(() => renderReport(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (input.trim()) {
      saveHistory({
        ts: Date.now(),
        score: result.score,
        rating: result.rating,
        passCount: result.passCount,
        warnCount: result.warnCount,
        failCount: result.failCount,
        hasViewport: result.hasViewport,
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

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="mft-input">HTML to test</Label>
            <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); toast.info("Sample loaded"); }}>
              Load sample
            </Button>
          </div>
          <Textarea
            id="mft-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"<!DOCTYPE html>\n<html>\n<head>\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  ..."}
            className="min-h-[150px] resize-y font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Paste full HTML or just the <code>&lt;head&gt;</code> + body. The tool checks viewport, font sizes, tap targets, responsive images, and content width.
          </p>
        </CardContent>
      </Card>

      {input.trim() ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4" /> Mobile-friendly score
                </h3>
                <Badge className={`text-base font-bold ${RATING_COLORS[result.rating]}`}>
                  {result.score}/100 · {result.rating}
                </Badge>
              </div>
              {result.viewportContent ? (
                <div className="text-xs">
                  <span className="text-muted-foreground">Viewport: </span>
                  <code className="font-mono text-foreground">{result.viewportContent}</code>
                </div>
              ) : (
                <div className="text-xs">
                  <span className="text-red-600 dark:text-red-400 font-medium">Viewport: MISSING</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Pass" value={result.passCount} highlight="good" />
                <Stat label="Warn" value={result.warnCount} highlight={result.warnCount > 0 ? "bad" : undefined} />
                <Stat label="Fail" value={result.failCount} highlight={result.failCount > 0 ? "bad" : undefined} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Checks</h3>
              <div className="space-y-2">
                {result.checks.map((c) => {
                  const Icon = RATING_ICONS[c.rating];
                  return (
                    <div key={c.name} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${RATING_COLORS[c.rating]}`}>
                          <Icon className="h-3 w-3 mr-0.5" />
                          {c.rating}
                        </Badge>
                        <span className="font-medium text-foreground">{c.label}</span>
                        <Badge variant="secondary" className="text-[10px] ml-auto">+{c.score} pts</Badge>
                      </div>
                      <div className="text-muted-foreground">{c.details}</div>
                      {c.rating !== "pass" && (
                        <div className="text-amber-700 dark:text-amber-400 italic">{c.recommendation}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {result.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Recommendations ({result.recommendations.length})
                </h3>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return report; }} label="Copy report" />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
            <ClearButton onClick={handleClear} />
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Mobile preview dimensions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                {DEVICE_DIMENSIONS.map((d) => (
                  <div key={d.name} className="rounded border bg-background px-2 py-1.5 text-xs">
                    <div className="font-medium text-foreground">{d.name}</div>
                    <div className="text-muted-foreground">{d.width} × {d.height}px</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste HTML to test mobile-friendliness"
          hint="Paste full HTML or head+body. The tool checks viewport meta, font sizes, tap targets, responsive images, and content width."
          icon={<Smartphone className="h-8 w-8" />}
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
                  <Badge variant="outline" className={`mr-2 ${RATING_COLORS[h.rating as Rating]}`}>{h.score}/100</Badge>
                  <Badge variant="outline" className="mr-2 text-emerald-700 dark:text-emerald-400">{h.passCount} pass</Badge>
                  <Badge variant="outline" className="mr-2 text-amber-700 dark:text-amber-400">{h.warnCount} warn</Badge>
                  <Badge variant="outline" className="mr-2 text-red-700 dark:text-red-400">{h.failCount} fail</Badge>
                  {h.hasViewport ? (
                    <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400">viewport ✓</Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-700 dark:text-red-400">viewport ✗</Badge>
                  )}
                  <div className="text-muted-foreground/70 mt-1">{new Date(h.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All HTML parsing runs locally. History is stored in localStorage on this device only.
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
  const color = highlight === "good"
    ? "text-emerald-600 dark:text-emerald-400"
    : highlight === "bad"
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
