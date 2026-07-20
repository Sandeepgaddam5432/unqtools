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
  DEFAULT_OPTIONS,
  AI_CRAWLER_PRESETS,
  genId,
  normalizeAgent,
  generateRobots,
  testUrl,
  parseIntent,
  parseRobotsText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RobotsTxtOptions,
  type Rule,
  type HistoryEntry,
} from "./logic";
import { FileText, Bot, ShieldCheck, History } from "lucide-react";

export default function AIRobotsTxt() {
  const [options, setOptions] = useState<RobotsTxtOptions>({ ...DEFAULT_OPTIONS });
  const [intent, setIntent] = useState("");
  const [testUrlInput, setTestUrlInput] = useState("https://example.com/admin");
  const [testAgent, setTestAgent] = useState("*");
  const [importText, setImportText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.options.rules) setOptions({ ...DEFAULT_OPTIONS, ...p.options });
      if (p.options.rules?.length) toast.info("Loaded from share link");
    }
  }, []);

  const result = useMemo(() => generateRobots(options), [options]);
  const testResult = useMemo(
    () => testUrl(options, testUrlInput, testAgent),
    [options, testUrlInput, testAgent],
  );

  const addRule = useCallback((type: "allow" | "disallow") => {
    setOptions((prev) => ({
      ...prev,
      rules: [...prev.rules, { id: genId(), userAgent: "*", type, path: "/" }],
    }));
  }, []);

  const updateRule = useCallback((id: string, field: keyof Rule, value: string) => {
    setOptions((prev) => ({
      ...prev,
      rules: prev.rules.map((r) => (r.id === id ? { ...r, [field]: field === "userAgent" ? normalizeAgent(value) : value } : r)),
    }));
  }, []);

  const removeRule = useCallback((id: string) => {
    setOptions((prev) => ({ ...prev, rules: prev.rules.filter((r) => r.id !== id) }));
  }, []);

  const addSitemap = useCallback(() => {
    setOptions((prev) => ({ ...prev, sitemaps: [...prev.sitemaps, ""] }));
  }, []);

  const updateSitemap = useCallback((idx: number, value: string) => {
    setOptions((prev) => ({
      ...prev,
      sitemaps: prev.sitemaps.map((s, i) => (i === idx ? value : s)),
    }));
  }, []);

  const removeSitemap = useCallback((idx: number) => {
    setOptions((prev) => ({ ...prev, sitemaps: prev.sitemaps.filter((_, i) => i !== idx) }));
  }, []);

  const handleParseIntent = useCallback(() => {
    if (!intent.trim()) return;
    const parsed = parseIntent(intent);
    setOptions((prev) => ({
      ...prev,
      rules: [...prev.rules, ...(parsed.options.rules ?? [])],
      sitemaps: [...prev.sitemaps, ...(parsed.options.sitemaps ?? [])],
      blockAllAiCrawlers: prev.blockAllAiCrawlers || (parsed.options.blockAllAiCrawlers ?? false),
    }));
    if (parsed.notes.length) toast.success(`Parsed: ${parsed.notes.join(", ")}`);
    else toast.info("Intent parsed");
  }, [intent]);

  const handleImport = useCallback(() => {
    if (!importText.trim()) return;
    const parsed = parseRobotsText(importText);
    setOptions(parsed.options);
    toast.success(`Imported ${parsed.options.rules.length} rules`);
  }, [importText]);

  const handleBlockAllAi = useCallback(() => {
    setOptions((prev) => ({
      ...prev,
      blockAllAiCrawlers: !prev.blockAllAiCrawlers,
      rules: prev.blockAllAiCrawlers
        ? prev.rules.filter((r) => !AI_CRAWLER_PRESETS.some((p) => p.userAgent === r.userAgent && r.path === "/"))
        : [...prev.rules, ...AI_CRAWLER_PRESETS.map((p) => ({ id: genId(), userAgent: p.userAgent, type: "disallow" as const, path: "/" }))],
    }));
  }, []);

  const handleClear = useCallback(() => {
    setOptions({ ...DEFAULT_OPTIONS });
    setIntent("");
    setImportText("");
    toast.info("Cleared");
  }, []);

  const handleSaveHistory = useCallback(() => {
    saveHistory({ ts: Date.now(), summary: `${options.rules.length} rules`, ruleCount: options.rules.length });
    setHistory(loadHistory());
  }, [options.rules.length]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="intent">Natural language intent (optional)</Label>
            <Textarea
              id="intent"
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="e.g. 'Block GPTBot from crawling /admin, allow everything else'"
              className="min-h-[60px] resize-y text-sm"
            />
            <Button size="sm" onClick={handleParseIntent} className="gap-1.5">
              <Bot className="h-3.5 w-3.5" /> Parse intent
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleBlockAllAi} className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {options.blockAllAiCrawlers ? "Unblock AI crawlers" : "Block all AI crawlers"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => addRule("disallow")} className="gap-1.5">
              + Disallow rule
            </Button>
            <Button variant="outline" size="sm" onClick={() => addRule("allow")} className="gap-1.5">
              + Allow rule
            </Button>
            <Button variant="outline" size="sm" onClick={addSitemap} className="gap-1.5">
              + Sitemap
            </Button>
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(options); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {options.rules.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Rules ({options.rules.length})</h3>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {options.rules.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant={r.type === "disallow" ? "destructive" : "secondary"} className="text-[10px]">{r.type}</Badge>
                  <Input
                    value={r.userAgent}
                    onChange={(e) => updateRule(r.id, "userAgent", e.target.value)}
                    className="h-7 w-24 text-xs"
                    placeholder="*"
                  />
                  <Input
                    value={r.path}
                    onChange={(e) => updateRule(r.id, "path", e.target.value)}
                    className="h-7 flex-1 text-xs font-mono"
                    placeholder="/admin"
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeRule(r.id)}>×</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {options.sitemaps.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Sitemaps ({options.sitemaps.length})</h3>
            <div className="space-y-1">
              {options.sitemaps.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={s}
                    onChange={(e) => updateSitemap(i, e.target.value)}
                    className="h-8 text-xs font-mono"
                    placeholder="https://example.com/sitemap.xml"
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeSitemap(i)}>×</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> robots.txt
            </h3>
            <div className="flex gap-2">
              <CopyButton getText={() => { handleSaveHistory(); return result.text; }} label="Copy" />
              <DownloadButton getText={() => result.text} filename="robots.txt" mime="text/plain" label="Download" />
            </div>
          </div>
          <pre className="text-xs font-mono bg-muted/30 rounded-lg p-3 overflow-auto max-h-[400px] whitespace-pre-wrap">{result.text}</pre>
          {result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className={`text-xs rounded px-2 py-1 ${
                  w.level === "danger" ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                  w.level === "warn" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                }`}>{w.message}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">URL tester</h3>
          <div className="flex flex-wrap gap-2">
            <Input
              value={testUrlInput}
              onChange={(e) => setTestUrlInput(e.target.value)}
              className="h-9 flex-1 text-sm"
              placeholder="https://example.com/admin"
            />
            <Input
              value={testAgent}
              onChange={(e) => setTestAgent(e.target.value)}
              className="h-9 w-32 text-sm"
              placeholder="*"
            />
          </div>
          <div className="text-xs">
            <Badge variant={testResult.allowed ? "secondary" : "destructive"}>
              {testResult.allowed ? "ALLOWED" : "BLOCKED"}
            </Badge>
            <span className="ml-2 text-muted-foreground">{testResult.matchedRule || "No matching rule"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Import existing robots.txt</h3>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="User-agent: *&#10;Disallow: /admin"
            className="min-h-[80px] resize-y text-xs font-mono"
          />
          <Button variant="outline" size="sm" onClick={handleImport}>Import</Button>
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
                  <Badge variant="outline" className="mr-2">{h.ruleCount} rules</Badge>
                  <span className="text-muted-foreground">{h.summary} · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All rule generation runs locally. The only network call is if you paste your own LLM API key. History stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
