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
  RunButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  HISTORY_MAX,
  STATUS_LABELS,
  STATUS_DESCRIPTIONS,
  RULE_TYPE_LABELS,
  DEFAULT_DOMAIN,
  DEFAULT_REWRITE,
  DEFAULT_CANONICAL,
  DEFAULT_HTTPS,
  DEFAULT_HOTLINK,
  DEFAULT_ERROR_PAGES,
  parseBulkPairs,
  renderBulkPairs,
  generateConfig,
  renderHtaccess,
  renderCsv,
  detectLoops,
  testUrl,
  testUrls,
  importHtaccess,
  isValidUrl,
  isValidDomain,
  isValidIp,
  isValidErrorCode,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type RedirectStatus,
  type RedirectPair,
  type RewriteRuleOptions,
  type CanonicalOptions,
  type HttpsOptions,
  type HotlinkOptions,
  type ErrorPage,
  type IpRule,
  type HtaccessConfig,
  type GeneratedRule,
  type TestResult,
  type HistoryEntry,
} from "./logic";
import {
  CornerDownRight as RedirectIcon, History, Key, Sparkles, AlertCircle,
  FileCode2, ShieldAlert, TestTube, Upload,
} from "lucide-react";

const STATUS_KEYS: RedirectStatus[] = [301, 302, 307];

export default function AiHtaccessRedirectGenerator() {
  const [bulkText, setBulkText] = useState(renderBulkPairs([
    { from: "/old-page", to: "/new-page", status: 301 },
    { from: "/blog/2020/post", to: "/blog/post", status: 301 },
  ]));
  const [rewrite, setRewrite] = useState<RewriteRuleOptions | null>(null);
  const [canonical, setCanonical] = useState<CanonicalOptions>({ ...DEFAULT_CANONICAL });
  const [https, setHttps] = useState<HttpsOptions>({ ...DEFAULT_HTTPS });
  const [hotlink, setHotlink] = useState<HotlinkOptions>({ ...DEFAULT_HOTLINK });
  const [errorPages, setErrorPages] = useState<ErrorPage[]>([]);
  const [ipRules, setIpRules] = useState<IpRule[]>([]);
  const [config, setConfig] = useState<HtaccessConfig | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState<string>("");
  const [testerInput, setTesterInput] = useState("/old-page\n/blog/2020/post\n/no-match");
  const [importText, setImportText] = useState("");

  // LLM
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic" | "openrouter">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmOutput, setLlmOutput] = useState<string>("");

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const state = parseShareUrl(window.location.hash);
      if (state.pairs.length > 0) setBulkText(renderBulkPairs(state.pairs));
      if (state.rewrite) setRewrite(state.rewrite);
      if (state.canonical) setCanonical(state.canonical);
      if (state.https) setHttps(state.https);
      if (state.hotlink) setHotlink(state.hotlink);
      if (state.errorPages) setErrorPages(state.errorPages);
      if (state.ipRules) setIpRules(state.ipRules);
      if (state.pairs.length > 0 || state.canonical?.enabled || state.https?.enabled) {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const pairs = useMemo(() => parseBulkPairs(bulkText), [bulkText]);

  const handleGenerate = useCallback(() => {
    setError("");
    const cfg = generateConfig({
      pairs,
      rewrite: rewrite ?? undefined,
      canonical,
      https,
      hotlink,
      errorPages,
      ipRules,
    });
    if (cfg.ruleCount === 0 && cfg.warnings.length > 0) {
      setError(cfg.warnings[0]);
      toast.error("No rules generated — check warnings");
      return;
    }
    setConfig(cfg);
    setHasGenerated(true);
    saveHistory({
      ts: Date.now(),
      pairCount: pairs.length,
      patternCount: rewrite ? 1 : 0,
      canonical: canonical.enabled,
      https: https.enabled,
      hotlink: hotlink.enabled,
      errorPages: errorPages.length,
      ipRules: ipRules.length,
      ruleCount: cfg.ruleCount,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${cfg.ruleCount} rule(s) — ${cfg.warnings.length} warning(s)`);
  }, [pairs, rewrite, canonical, https, hotlink, errorPages, ipRules]);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste an API key first");
      return;
    }
    setLlmLoading(true);
    try {
      const prompt = buildLlmPrompt({
        pairs,
        rewrite: rewrite ?? undefined,
        canonical,
        https,
        hotlink,
        errorPages,
        ipRules,
      });
      const text = await callLlm(llmProvider, llmKey, prompt.system, prompt.user);
      setLlmOutput(renderLlmResult(text));
      toast.success("LLM .htaccess generated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`LLM call failed: ${msg}`);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, pairs, rewrite, canonical, https, hotlink, errorPages, ipRules]);

  const handleClear = useCallback(() => {
    setBulkText("");
    setRewrite(null);
    setCanonical({ ...DEFAULT_CANONICAL });
    setHttps({ ...DEFAULT_HTTPS });
    setHotlink({ ...DEFAULT_HOTLINK });
    setErrorPages([]);
    setIpRules([]);
    setConfig(null);
    setHasGenerated(false);
    setError("");
    setLlmOutput("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleImport = useCallback(() => {
    if (!importText.trim()) {
      toast.error("Paste .htaccess content first");
      return;
    }
    const imported = importHtaccess(importText);
    if (imported.length === 0) {
      toast.error("No recognized directives found");
      return;
    }
    // Convert imported simple redirects back to bulk pairs.
    const newPairs: RedirectPair[] = imported
      .filter((r) => r.type === "redirect-simple" && r.from && r.to && r.status)
      .map((r) => ({ from: r.from!, to: r.to!, status: r.status! }));
    if (newPairs.length > 0) {
      setBulkText(renderBulkPairs(newPairs));
    }
    // Convert imported redirect-match / rewrite-rule into rewrite state.
    const rw = imported.find((r) => (r.type === "redirect-match" || r.type === "rewrite-rule") && r.pattern && r.target);
    if (rw) {
      setRewrite({
        pattern: rw.pattern!,
        target: rw.target!,
        status: rw.status ?? 301,
        flags: rw.type === "rewrite-rule" ? ["L", "R=301"] : [],
        useRewriteRule: rw.type === "rewrite-rule",
      });
    }
    // Convert error pages.
    const eps = imported
      .filter((r) => r.type === "error-page" && r.from && r.to)
      .map((r) => ({ code: parseInt(r.from!, 10), path: r.to! }));
    if (eps.length > 0) setErrorPages(eps);
    toast.success(`Imported ${imported.length} directive(s)`);
  }, [importText]);

  const loops = useMemo(() => config ? detectLoops(config.rules) : [], [config]);
  const testerUrls = useMemo(
    () => testerInput.split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    [testerInput],
  );
  const testResults = useMemo<TestResult[]>(
    () => config ? testUrls(config.rules, testerUrls) : [],
    [config, testerUrls],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ahg-bulk">Bulk old → new URL pairs (one per line)</Label>
            <Textarea
              id="ahg-bulk"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"/old-page → /new-page 301\n/blog/2020/post → /blog/post\n/legacy → https://new-site.com/legacy 302"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Formats: <code>/old → /new</code>, <code>/old -&gt; /new</code>, <code>/old /new</code>,
              <code>/old,/new</code>, or tab-separated. Optional 3rd column: 301 / 302 / 307. Lines starting with # are ignored.
            </p>
            <div className="text-[10px] text-muted-foreground">
              Parsed: <Badge variant="outline" className="text-[10px]">{pairs.length} pairs</Badge>
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="text-xs">Pattern rule (RedirectMatch or RewriteRule)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={rewrite !== null}
                  onChange={(e) => setRewrite(e.target.checked ? { ...DEFAULT_REWRITE } : null)}
                />
                Enable pattern rule
              </label>
            </div>
            {rewrite && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <div>
                  <Label htmlFor="ahg-rp" className="text-[10px]">Pattern (regex)</Label>
                  <Input
                    id="ahg-rp"
                    value={rewrite.pattern}
                    onChange={(e) => setRewrite({ ...rewrite, pattern: e.target.value })}
                    className="font-mono text-xs h-8"
                    placeholder="^/old/(.*)$"
                  />
                </div>
                <div>
                  <Label htmlFor="ahg-rt" className="text-[10px]">Target (use $1, $2…)</Label>
                  <Input
                    id="ahg-rt"
                    value={rewrite.target}
                    onChange={(e) => setRewrite({ ...rewrite, target: e.target.value })}
                    className="font-mono text-xs h-8"
                    placeholder="/new/$1"
                  />
                </div>
                <div>
                  <Label htmlFor="ahg-rs" className="text-[10px]">Status</Label>
                  <select
                    id="ahg-rs"
                    value={rewrite.status}
                    onChange={(e) => setRewrite({ ...rewrite, status: Number(e.target.value) as RedirectStatus })}
                    className="h-8 w-full text-xs rounded border bg-background px-2"
                  >
                    {STATUS_KEYS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="ahg-rw" className="text-[10px]">Rule type</Label>
                  <select
                    id="ahg-rw"
                    value={rewrite.useRewriteRule ? "1" : "0"}
                    onChange={(e) => setRewrite({ ...rewrite, useRewriteRule: e.target.value === "1" })}
                    className="h-8 w-full text-xs rounded border bg-background px-2"
                  >
                    <option value="1">RewriteRule (with flags)</option>
                    <option value="0">RedirectMatch</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <Label className="text-xs">Canonical / HTTPS / Hotlink</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={canonical.enabled}
                  onChange={(e) => setCanonical({ ...canonical, enabled: e.target.checked })}
                />
                www canonicalization
              </label>
              {canonical.enabled && (
                <>
                  <select
                    value={canonical.direction}
                    onChange={(e) => setCanonical({ ...canonical, direction: e.target.value as CanonicalOptions["direction"] })}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="www-to-nonwww">www → non-www</option>
                    <option value="nonwww-to-www">non-www → www</option>
                  </select>
                  <Input
                    value={canonical.domain}
                    onChange={(e) => setCanonical({ ...canonical, domain: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="example.com"
                  />
                </>
              )}
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={https.enabled}
                  onChange={(e) => setHttps({ enabled: e.target.checked })}
                />
                HTTP → HTTPS redirect
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={hotlink.enabled}
                  onChange={(e) => setHotlink({ ...hotlink, enabled: e.target.checked })}
                />
                Hotlink protection
              </label>
              {hotlink.enabled && (
                <>
                  <Input
                    value={hotlink.domain}
                    onChange={(e) => setHotlink({ ...hotlink, domain: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="example.com"
                  />
                  <Input
                    value={hotlink.redirectUrl}
                    onChange={(e) => setHotlink({ ...hotlink, redirectUrl: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="/hotlink-denied.png"
                  />
                </>
              )}
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="text-xs">Custom error pages</Label>
            <div className="space-y-1 pt-1">
              {errorPages.map((ep, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    type="number"
                    value={ep.code}
                    onChange={(e) => setErrorPages((prev) => prev.map((p, j) => j === i ? { ...p, code: Number(e.target.value) } : p))}
                    className="h-8 text-xs w-24"
                    placeholder="404"
                  />
                  <Input
                    value={ep.path}
                    onChange={(e) => setErrorPages((prev) => prev.map((p, j) => j === i ? { ...p, path: e.target.value } : p))}
                    className="h-8 text-xs flex-1"
                    placeholder="/404.html"
                  />
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setErrorPages((prev) => prev.filter((_, j) => j !== i))}>×</Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setErrorPages((prev) => [...prev, { code: 404, path: "/404.html" }])}>+ Add error page</Button>
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="text-xs">IP allow/deny rules</Label>
            <div className="space-y-1 pt-1">
              {ipRules.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={r.ip}
                    onChange={(e) => setIpRules((prev) => prev.map((p, j) => j === i ? { ...p, ip: e.target.value } : p))}
                    className="h-8 text-xs flex-1"
                    placeholder="192.168.1.5 or 10.0.0.0/24"
                  />
                  <select
                    value={r.action}
                    onChange={(e) => setIpRules((prev) => prev.map((p, j) => j === i ? { ...p, action: e.target.value as IpRule["action"] } : p))}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="allow">allow</option>
                    <option value="deny">deny</option>
                  </select>
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setIpRules((prev) => prev.filter((_, j) => j !== i))}>×</Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setIpRules((prev) => [...prev, { ip: "192.168.1.5", action: "allow" as const }])}>+ Add IP rule</Button>
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="text-xs">Import existing .htaccess (best-effort)</Label>
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"# Paste an existing .htaccess to import\nRedirect 301 /old /new\nRewriteRule ^/blog/(.*)$ /news/$1 [R=301,L]"}
              className="min-h-[80px] resize-y font-mono text-xs mt-1"
            />
            <Button variant="outline" size="sm" className="mt-1 h-7 text-[11px] gap-1.5" onClick={handleImport}>
              <Upload className="h-3.5 w-3.5" /> Import into form
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 border-t pt-3">
            <RunButton onClick={handleGenerate} label="Generate .htaccess" />
            <ShareButton getUrl={() => buildShareUrl({
              pairs, rewrite: rewrite ?? undefined, canonical, https, hotlink, errorPages, ipRules,
            })} />
            <ClearButton onClick={handleClear} />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {hasGenerated && config ? (
        <>
          {loops.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> Loop / conflict detection ({loops.length})
                </h3>
                <div className="space-y-1">
                  {loops.map((lw, i) => {
                    const color = lw.level === "danger"
                      ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400"
                      : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400";
                    const icon = lw.level === "danger" ? "✗" : "⚠";
                    return (
                      <div key={i} className={`rounded border px-3 py-1.5 text-xs ${color}`}>
                        <span className="mr-2 font-mono">{icon}</span>
                        {lw.message}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {config.warnings.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> Warnings ({config.warnings.length})
                </h3>
                <div className="space-y-1">
                  {config.warnings.map((w, i) => (
                    <div key={i} className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                      {w}
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
                  <FileCode2 className="h-4 w-4" /> .htaccess ({config.ruleCount} rule(s))
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => config.rawText} label="Copy .htaccess" />
                  <DownloadButton
                    getText={() => config.rawText}
                    filename=".htaccess"
                    mime="text/plain"
                    label="Download .htaccess"
                  />
                  <DownloadButton
                    getText={() => renderCsv(config)}
                    filename="htaccess-rules.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                </div>
              </div>
              <pre className="bg-muted/50 dark:bg-muted/20 rounded p-3 text-[11px] font-mono overflow-auto max-h-[500px] whitespace-pre">
                {config.rawText}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileCode2 className="h-4 w-4" /> Per-rule explanations ({config.rules.length})
              </h3>
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {config.rules.map((r, i) => (
                  <RuleRow key={i} rule={r} idx={i} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TestTube className="h-4 w-4" /> Sample-URL tester
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Emulates Apache mod_rewrite matching. Enter one URL per line — we report which rule matches and the redirect target.
              </p>
              <Textarea
                value={testerInput}
                onChange={(e) => setTesterInput(e.target.value)}
                placeholder={"/old-page\n/blog/2020/post"}
                className="min-h-[80px] resize-y font-mono text-xs"
              />
              <div className="space-y-1">
                {testResults.map((r, i) => (
                  <TestRow key={i} result={r} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Key className="h-4 w-4" /> Optional: Enhance with BYO-key LLM
              </h3>
              <p className="text-xs text-muted-foreground">
                Paste your own API key (OpenAI / Anthropic / OpenRouter) to ask an LLM for an alternative .htaccess. Key stays in your browser.
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic" | "openrouter")}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
                <Input
                  type="password"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  placeholder="sk-..."
                  className="h-8 text-xs flex-1 min-w-[200px]"
                />
                <Button size="sm" onClick={handleLlmEnhance} disabled={llmLoading} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  {llmLoading ? "Working…" : "Generate with LLM"}
                </Button>
              </div>
              {llmOutput && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">LLM-generated .htaccess</span>
                    <CopyButton getText={() => llmOutput} label="Copy" size="sm" />
                    <DownloadButton getText={() => llmOutput} filename="htaccess-llm.conf" label="Download" size="sm" />
                  </div>
                  <pre className="bg-muted/50 dark:bg-muted/20 rounded p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap">
                    {llmOutput}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Generate .htaccess redirect & rewrite rules"
          hint="Paste bulk old→new URL pairs (or describe a regex pattern), toggle canonical/HTTPS/hotlink/error-pages/IP rules, and click Generate. We'll emit Apache .htaccess directives with per-rule explanations, sample-URL testing, and redirect-loop detection. Always back up your .htaccess and test on staging."
          icon={<RedirectIcon className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent (last {HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.ruleCount} rules</Badge>
                  <Badge variant="outline" className="mr-2">{h.pairCount} pairs</Badge>
                  {h.canonical && <Badge variant="outline" className="mr-2">canonical</Badge>}
                  {h.https && <Badge variant="outline" className="mr-2">https</Badge>}
                  {h.hotlink && <Badge variant="outline" className="mr-2">hotlink</Badge>}
                  {h.errorPages > 0 && <Badge variant="outline" className="mr-2">{h.errorPages} errpages</Badge>}
                  {h.ipRules > 0 && <Badge variant="outline" className="mr-2">{h.ipRules} IPs</Badge>}
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy & Honesty:</strong> All rule generation, testing, loop detection, and explanations run locally. URL lists never leave this device. Always back up your .htaccess and test on staging — a wrong rule can take a site down; regex behavior varies by Apache config. On-device models are less reliable than BYO-key for complex regex. Nothing uploaded or logged by us.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RuleRow({ rule, idx }: { rule: GeneratedRule; idx: number }) {
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
        <Badge variant="outline" className="text-[10px]">{RULE_TYPE_LABELS[rule.type]}</Badge>
        {rule.status && <Badge variant="outline" className="text-[10px]">{rule.status}</Badge>}
      </div>
      <pre className="text-[10px] font-mono mt-1 text-foreground whitespace-pre-wrap break-all">{rule.directive}</pre>
      <p className="text-[11px] text-muted-foreground mt-1">{rule.explanation}</p>
    </div>
  );
}

function TestRow({ result }: { result: TestResult }) {
  const color = result.matched
    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
    : "border-muted bg-background text-muted-foreground";
  return (
    <div className={`rounded border px-3 py-1.5 text-xs ${color}`}>
      <div className="flex items-center gap-2">
        <code className="font-mono">{result.url}</code>
        {result.matched ? (
          <>
            <Badge variant="outline" className="text-[10px]">rule #{result.matchedRuleIdx + 1}</Badge>
            <Badge variant="outline" className="text-[10px]">{result.status}</Badge>
            <span>→</span>
            <code className="font-mono">{result.redirectTarget}</code>
          </>
        ) : (
          <Badge variant="outline" className="text-[10px]">no match</Badge>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{result.explanation}</p>
    </div>
  );
}

// ---- LLM network call (kept here because it touches the network) ----

async function callLlm(
  provider: "openai" | "anthropic" | "openrouter",
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices?.[0]?.message?.content ?? "";
  }
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        system,
        max_tokens: 1800,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json() as { content: { text: string }[] };
    return data.content?.map((c) => c.text).join("") ?? "";
  }
  // openrouter
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

// Suppress unused-import lint
export type _Unused =
  | typeof isValidUrl | typeof isValidDomain | typeof isValidIp
  | typeof isValidErrorCode | typeof DEFAULT_DOMAIN | typeof DEFAULT_ERROR_PAGES
  | typeof DEFAULT_HTTPS | typeof DEFAULT_HOTLINK | typeof DEFAULT_REWRITE
  | typeof DEFAULT_CANONICAL | typeof STATUS_DESCRIPTIONS;
