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
  ShareButton,
  ClearButton,
  EmptyState,
} from "../../_shared";
import { toast } from "sonner";
import {
  CheckCheck, AlertTriangle, AlertCircle, Info, Wand2, FileText,
  History, Settings, ChevronRight, Eye, EyeOff, ListChecks,
} from "lucide-react";
import {
  RULES,
  RULE_COUNT,
  DEFAULT_CONFIG,
  SAMPLE_DOC,
  lint,
  autoFix,
  format,
  disableComment,
  diffLines,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  isRuleId,
  type LintConfig,
  type RuleId,
  type Violation,
  type HistoryEntry,
} from "./logic";

export default function MarkdownLinterFormatter() {
  const [text, setText] = useState("");
  const [config, setConfig] = useState<LintConfig>(DEFAULT_CONFIG);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [lastFix, setLastFix] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setConfig({ ...DEFAULT_CONFIG, ...p });
        toast.info("Loaded config from share link");
      }
    }
  }, []);

  const result = useMemo(() => lint(text, config), [text, config]);
  const fixResult = useMemo(() => autoFix(text, config), [text, config]);
  const diff = useMemo(
    () => showDiff && lastFix !== null ? diffLines(text, lastFix) : [],
    [showDiff, lastFix, text],
  );

  const handleAutoFix = useCallback(() => {
    if (!text.trim()) { toast.info("Nothing to fix"); return; }
    const r = autoFix(text, config);
    setText(r.output);
    setLastFix(r.output);
    if (r.fixesApplied > 0) {
      toast.success(`Applied ${r.fixesApplied} fixes`);
      saveHistory({
        ts: Date.now(),
        total: result.total,
        fixable: result.fixable,
        errors: result.errors,
        warnings: result.warnings,
        preview: `${r.fixesApplied} fixes applied`,
      });
      setHistory(loadHistory());
    } else {
      toast.info("No fixable violations");
    }
  }, [text, config, result]);

  const handleFormat = useCallback(() => {
    if (!text.trim()) { toast.info("Nothing to format"); return; }
    const r = format(text, config);
    setText(r.output);
    setLastFix(r.output);
    toast.success(`Formatted with ${r.fixesApplied} adjustments`);
    saveHistory({
      ts: Date.now(),
      total: result.total,
      fixable: result.fixable,
      errors: result.errors,
      warnings: result.warnings,
      preview: `Formatted (${r.fixesApplied} changes)`,
    });
    setHistory(loadHistory());
  }, [text, config, result]);

  const handleLoadSample = useCallback(() => {
    setText(SAMPLE_DOC);
    setLastFix(null);
    toast.info("Loaded sample document");
  }, []);

  const handleClear = useCallback(() => {
    setText("");
    setLastFix(null);
    toast.info("Cleared");
  }, []);

  const handleCopyDisableComment = useCallback(() => {
    const c = disableComment("all");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(c).then(
        () => toast.success("Inline-disable comment copied"),
        () => toast.error("Could not copy"),
      );
    }
  }, []);

  const toggleRule = useCallback((id: RuleId) => {
    setConfig((prev) => {
      const key = id.toLowerCase() as keyof LintConfig;
      return { ...prev, [key]: !prev[key] };
    });
  }, []);

  const updateConfig = useCallback(<K extends keyof LintConfig>(key: K, value: LintConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="mdlf-input" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" /> Markdown source
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={handleLoadSample} className="h-7 text-xs">
                Load sample
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfig((s) => !s)}
                className="h-7 text-xs gap-1"
              >
                <Settings className="h-3 w-3" />
                {showConfig ? "Hide" : "Config"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDiff((s) => !s)}
                className="h-7 text-xs gap-1"
                disabled={!lastFix}
              >
                {showDiff ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showDiff ? "Hide diff" : "Show diff"}
              </Button>
            </div>
          </div>
          <Textarea
            id="mdlf-input"
            value={text}
            onChange={(e) => { setText(e.target.value); setLastFix(null); }}
            placeholder={"# Paste your Markdown here\n\n- list item\n- another"}
            className="min-h-[240px] resize-y font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleAutoFix} disabled={!text.trim()} size="sm" className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" /> Auto-fix ({fixResult.fixesApplied})
            </Button>
            <Button onClick={handleFormat} disabled={!text.trim()} variant="outline" size="sm" className="gap-1.5">
              <CheckCheck className="h-3.5 w-3.5" /> Format (Prettier)
            </Button>
            <CopyButton getText={() => text} label="Copy" disabled={!text} />
            <DownloadButton getText={() => text} filename="markdown.md" disabled={!text} />
            <ShareButton getUrl={() => buildShareUrl(config)} />
            <Button variant="ghost" size="sm" onClick={handleCopyDisableComment} className="gap-1.5">
              <ListChecks className="h-3.5 w-3.5" /> Copy disable comment
            </Button>
            <ClearButton onClick={handleClear} disabled={!text} />
          </div>
        </CardContent>
      </Card>

      {showConfig && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Settings className="h-4 w-4" /> Configuration ({RULE_COUNT} rules)
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfig(DEFAULT_CONFIG)}
                className="h-7 text-xs"
              >
                Reset to defaults
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 max-h-[260px] overflow-auto rounded border p-2 bg-background">
              {RULES.map((r) => {
                const enabled = config[r.id.toLowerCase() as keyof LintConfig] === true;
                return (
                  <label
                    key={r.id}
                    className="flex items-start gap-2 p-1 rounded hover:bg-muted/40 cursor-pointer text-xs"
                    title={r.description}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleRule(r.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-medium text-foreground flex items-center gap-1">
                        {r.id}
                        <span className="text-muted-foreground font-sans font-normal">— {r.name}</span>
                        {r.fixable && (
                          <Badge variant="outline" className="text-[9px] ml-1 px-1 py-0">fixable</Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">{r.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs">Line length (MD013)</Label>
                <Input
                  type="number"
                  min={40}
                  max={300}
                  value={config.lineLength}
                  onChange={(e) => updateConfig("lineLength", parseInt(e.target.value, 10) || 80)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Heading style (MD003)</Label>
                <select
                  value={config.headingStyle}
                  onChange={(e) => updateConfig("headingStyle", e.target.value as "atx" | "setext")}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="atx">ATX (#)</option>
                  <option value="setext">Setext (=)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">UL marker (MD004)</Label>
                <select
                  value={config.ulMarker}
                  onChange={(e) => updateConfig("ulMarker", e.target.value as "-" | "*" | "+")}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="-">Dash (-)</option>
                  <option value="*">Asterisk (*)</option>
                  <option value="+">Plus (+)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">UL indent (MD007)</Label>
                <Input
                  type="number"
                  min={2}
                  max={8}
                  value={config.ulIndent}
                  onChange={(e) => updateConfig("ulIndent", parseInt(e.target.value, 10) || 2)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">HR style (MD035)</Label>
                <select
                  value={config.hrStyle}
                  onChange={(e) => updateConfig("hrStyle", e.target.value as "---" | "***" | "___")}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="---">---</option>
                  <option value="***">***</option>
                  <option value="___">___</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Emphasis style</Label>
                <select
                  value={config.emphasisStyle}
                  onChange={(e) => updateConfig("emphasisStyle", e.target.value as "asterisk" | "underscore")}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  <option value="asterisk">* (asterisk)</option>
                  <option value="underscore">_ (underscore)</option>
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs">Allowed inline HTML tags (MD033, comma-separated, empty = disabled)</Label>
                <Input
                  type="text"
                  value={config.noInlineHtmlTags}
                  onChange={(e) => updateConfig("noInlineHtmlTags", e.target.value)}
                  placeholder="br, kbd, sub, sup"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {text.trim() ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total violations" value={result.total} highlight={result.total === 0 ? "good" : undefined} />
                <Stat label="Errors" value={result.errors} highlight={result.errors > 0 ? "bad" : "good"} />
                <Stat label="Warnings" value={result.warnings} highlight={result.warnings > 0 ? undefined : "good"} />
                <Stat label="Fixable" value={result.fixable} highlight={result.fixable > 0 ? undefined : "good"} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Violations ({result.violations.length})
              </h3>
              {result.violations.length === 0 ? (
                <div className="rounded border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCheck className="h-4 w-4" /> No violations — your Markdown is clean!
                </div>
              ) : (
                <div className="space-y-1 max-h-[400px] overflow-auto">
                  {result.violations.map((v, i) => (
                    <ViolationRow key={i} v={v} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {Object.keys(result.byRule).length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4" /> Breakdown by rule
                </h3>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(result.byRule)
                    .sort((a, b) => b[1] - a[1])
                    .map(([rule, count]) => (
                      <Badge key={rule} variant="outline" className="text-[10px] font-mono">
                        {rule}: {count}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {showDiff && lastFix !== null && diff.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Eye className="h-4 w-4" /> Diff (before → after)
                </h3>
                <div className="rounded border bg-background font-mono text-[11px] overflow-x-auto max-h-[400px] overflow-y-auto">
                  {diff.map((l, i) => (
                    <div
                      key={i}
                      className={`px-2 py-0.5 whitespace-pre ${
                        l.type === "added"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          : l.type === "removed"
                            ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                            : "text-muted-foreground"
                      }`}
                    >
                      <span className="inline-block w-6 text-muted-foreground select-none">
                        {l.type === "added" ? "+" : l.type === "removed" ? "-" : " "}
                      </span>
                      <span className="inline-block w-10 text-muted-foreground select-none">{l.num}</span>
                      <span>{l.text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Paste your Markdown to lint and format"
          hint="Load the sample document for a quick demo, or paste your own Markdown. Click Auto-fix to clean up violations automatically."
          icon={<CheckCheck className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent runs ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={() => { clearHistory(); setHistory([]); toast.success("History cleared"); }}>
                Clear
              </Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 10).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="text-[10px]">{h.total} total</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.errors} errors</Badge>
                  <span className="font-mono text-foreground truncate flex-1">{h.preview}</span>
                  <span className="text-muted-foreground text-[10px]">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All linting, auto-fix, and formatting run locally. Your Markdown never leaves the browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ViolationRow({ v }: { v: Violation }) {
  const sevIcon = v.severity === "error"
    ? <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
    : v.severity === "warning"
      ? <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
      : <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />;
  return (
    <div className="rounded border bg-background px-3 py-1.5 text-xs flex items-start gap-2">
      <span className="mt-0.5">{sevIcon}</span>
      <span className="font-mono font-medium text-foreground w-14 flex-shrink-0">{v.rule}</span>
      <span className="text-muted-foreground font-mono w-16 flex-shrink-0">L{v.line}:{v.column}</span>
      <span className="flex-1 text-foreground">{v.message}</span>
      {v.fixable && (
        <Badge variant="outline" className="text-[9px] text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700">
          fixable
        </Badge>
      )}
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

// Keep isRuleId import used for type narrowing (suppress unused)
void isRuleId;
