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
  TEMPLATE_LABELS,
  TEMPLATE_DESCRIPTIONS,
  DEFAULT_OPTIONS,
  DOMAIN_PRESETS,
  UPSTREAM_PRESETS,
  generateConfig,
  lintConfig,
  countWarnings,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type NginxOptions,
  type TemplateId,
  type LoadBalancingMethod,
  type NginxConfig,
  type RiskWarning,
  type HistoryEntry,
} from "./logic";
import {
  Server, History, Key, Sparkles, ShieldAlert, FileCode2,
  Copy, Check, ChevronDown, ChevronRight,
} from "lucide-react";

const TEMPLATE_KEYS = Object.keys(TEMPLATE_LABELS) as TemplateId[];
const LB_KEYS: LoadBalancingMethod[] = ["none", "round-robin", "ip-hash", "least-conn"];
const LB_LABELS: Record<LoadBalancingMethod, string> = {
  "none": "None",
  "round-robin": "Round-robin",
  "ip-hash": "IP hash (sticky)",
  "least-conn": "Least connections",
};

export default function AiNginxConfigRuleBuilder() {
  const [options, setOptions] = useState<NginxOptions>({ ...DEFAULT_OPTIONS });
  const [config, setConfig] = useState<NginxConfig | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [error, setError] = useState<string>("");
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [showExplanations, setShowExplanations] = useState(true);

  // LLM
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic" | "openrouter">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmOutput, setLlmOutput] = useState<string>("");

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.options && Object.keys(p.options).length > 0) {
        setOptions((prev) => ({ ...prev, ...p.options }));
        toast.info("Loaded options from share link");
      }
    }
  }, []);

  const warningCounts = useMemo(
    () => config ? countWarnings(config.warnings) : { ok: 0, warn: 0, danger: 0 },
    [config],
  );

  const updateOption = useCallback(<K extends keyof NginxOptions>(key: K, value: NginxOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleGenerate = useCallback(() => {
    setError("");
    if (!options.domain.trim()) {
      setError("Please enter a domain.");
      toast.error("Enter a domain first");
      return;
    }
    const cfg = generateConfig(options);
    setConfig(cfg);
    setActiveFileIdx(0);
    setHasGenerated(true);
    saveHistory({
      ts: Date.now(),
      template: options.template,
      domain: options.domain,
      upstream: options.upstream,
      ssl: options.ssl,
      fileCount: cfg.files.length,
      warningCount: cfg.warnings.filter((w) => w.level !== "ok").length,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${cfg.files.length} file(s) — ${cfg.warnings.length} warning(s)`);
  }, [options]);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste an API key first");
      return;
    }
    setLlmLoading(true);
    try {
      const prompt = buildLlmPrompt(options);
      const text = await callLlm(llmProvider, llmKey, prompt.system, prompt.user);
      setLlmOutput(renderLlmResult(text));
      toast.success("LLM config generated");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`LLM call failed: ${msg}`);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, options]);

  const handleClear = useCallback(() => {
    setOptions({ ...DEFAULT_OPTIONS });
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

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ngx-template">Template</Label>
            <select
              id="ngx-template"
              value={options.template}
              onChange={(e) => updateOption("template", e.target.value as TemplateId)}
              className="h-9 w-full text-sm rounded border bg-background px-2"
            >
              {TEMPLATE_KEYS.map((t) => (
                <option key={t} value={t}>{TEMPLATE_LABELS[t]}</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground">{TEMPLATE_DESCRIPTIONS[options.template]}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ngx-domain">Domain</Label>
              <Input
                id="ngx-domain"
                value={options.domain}
                onChange={(e) => updateOption("domain", e.target.value)}
                placeholder="example.com"
              />
              <div className="flex flex-wrap gap-1">
                {DOMAIN_PRESETS.slice(0, 3).map((p) => (
                  <Button key={p} variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => updateOption("domain", p)}>+ {p}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ngx-upstream">Upstream (host:port or unix:/path)</Label>
              <Input
                id="ngx-upstream"
                value={options.upstream}
                onChange={(e) => updateOption("upstream", e.target.value)}
                placeholder="127.0.0.1:3000"
              />
              <div className="flex flex-wrap gap-1">
                {UPSTREAM_PRESETS.slice(0, 3).map((p) => (
                  <Button key={p} variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => updateOption("upstream", p)}>+ {p}</Button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ngx-root">Root path</Label>
              <Input
                id="ngx-root"
                value={options.rootPath}
                onChange={(e) => updateOption("rootPath", e.target.value)}
                placeholder="/var/www/example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ngx-index">Index file</Label>
              <Input
                id="ngx-index"
                value={options.indexFile}
                onChange={(e) => updateOption("indexFile", e.target.value)}
                placeholder="index.html"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Features</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <ToggleCheck label="SSL/TLS" checked={options.ssl} onChange={(v) => updateOption("ssl", v)} />
              <ToggleCheck label="HTTP→HTTPS redirect" checked={options.httpToHttps} onChange={(v) => updateOption("httpToHttps", v)} disabled={!options.ssl} />
              <ToggleCheck label="www→non-www redirect" checked={options.wwwRedirect} onChange={(v) => updateOption("wwwRedirect", v)} disabled={!options.ssl} />
              <ToggleCheck label="non-www→www redirect" checked={options.nonWwwRedirect} onChange={(v) => updateOption("nonWwwRedirect", v)} disabled={!options.ssl} />
              <ToggleCheck label="gzip compression" checked={options.gzip} onChange={(v) => updateOption("gzip", v)} />
              <ToggleCheck label="Browser caching" checked={options.caching} onChange={(v) => updateOption("caching", v)} />
              <ToggleCheck label="Rate limiting" checked={options.rateLimit} onChange={(v) => updateOption("rateLimit", v)} />
              <ToggleCheck label="Security headers" checked={options.securityHeaders} onChange={(v) => updateOption("securityHeaders", v)} />
              <ToggleCheck label="WebSocket (Node)" checked={options.websocket} onChange={(v) => updateOption("websocket", v)} disabled={options.template !== "node-proxy"} />
              <ToggleCheck label="server_tokens on" checked={options.serverTokens} onChange={(v) => updateOption("serverTokens", v)} />
            </div>
          </div>

          {options.ssl && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ngx-cert">SSL cert path</Label>
                <Input
                  id="ngx-cert"
                  value={options.sslCertPath}
                  onChange={(e) => updateOption("sslCertPath", e.target.value)}
                  placeholder="/etc/letsencrypt/live/example.com/fullchain.pem"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ngx-key">SSL key path</Label>
                <Input
                  id="ngx-key"
                  value={options.sslKeyPath}
                  onChange={(e) => updateOption("sslKeyPath", e.target.value)}
                  placeholder="/etc/letsencrypt/live/example.com/privkey.pem"
                />
              </div>
            </div>
          )}

          {options.rateLimit && (
            <div className="space-y-1.5">
              <Label htmlFor="ngx-rate">Rate limit rate (e.g. 10r/s, 60r/m)</Label>
              <Input
                id="ngx-rate"
                value={options.rateLimitRate}
                onChange={(e) => updateOption("rateLimitRate", e.target.value)}
                placeholder="10r/s"
              />
            </div>
          )}

          {options.securityHeaders && (
            <div className="space-y-1.5">
              <Label htmlFor="ngx-csp">Content-Security-Policy</Label>
              <Input
                id="ngx-csp"
                value={options.csp}
                onChange={(e) => updateOption("csp", e.target.value)}
                placeholder="default-src 'self'; script-src 'self'"
              />
              <Label htmlFor="ngx-hsts" className="text-xs">HSTS max-age (seconds)</Label>
              <Input
                id="ngx-hsts"
                type="number"
                value={options.hstsMaxAge}
                onChange={(e) => updateOption("hstsMaxAge", Number(e.target.value) || 0)}
                placeholder="31536000"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ngx-lb">Load balancing</Label>
              <select
                id="ngx-lb"
                value={options.loadBalancing}
                onChange={(e) => updateOption("loadBalancing", e.target.value as LoadBalancingMethod)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {LB_KEYS.map((lb) => (
                  <option key={lb} value={lb}>{LB_LABELS[lb]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ngx-upstreams">Upstreams (comma-separated, for LB)</Label>
              <Input
                id="ngx-upstreams"
                value={options.upstreams.join(",")}
                onChange={(e) => updateOption("upstreams", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                placeholder="10.0.0.1:3000,10.0.0.2:3000"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate config" />
            <ShareButton getUrl={() => buildShareUrl(options)} />
            <ClearButton onClick={handleClear} />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {hasGenerated && config ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> Risk warnings
                </h3>
                <div className="flex gap-2">
                  {warningCounts.danger > 0 && <Badge variant="destructive" className="text-[10px]">{warningCounts.danger} danger</Badge>}
                  {warningCounts.warn > 0 && <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px]">{warningCounts.warn} warn</Badge>}
                  {warningCounts.ok > 0 && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px]">{warningCounts.ok} ok</Badge>}
                </div>
              </div>
              <div className="space-y-1">
                {config.warnings.map((w, i) => (
                  <WarningRow key={i} warning={w} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileCode2 className="h-4 w-4" /> Generated config ({config.files.length} file(s))
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => renderText(config)} label="Copy all" />
                  <DownloadButton
                    getText={() => renderText(config)}
                    filename="nginx-config.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => renderCsv(config)}
                    filename="nginx-config.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {config.files.map((f, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveFileIdx(i)}
                    className={`px-2 py-1 rounded text-[11px] font-mono ${i === activeFileIdx ? "bg-primary text-primary-foreground" : "bg-background border text-foreground"}`}
                    title={f.description}
                  >
                    {f.path.split("/").pop()}
                  </button>
                ))}
              </div>

              {config.files[activeFileIdx] && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono text-foreground">{config.files[activeFileIdx].path}</span>
                    {" — "}
                    {config.files[activeFileIdx].description}
                  </div>
                  <pre className="bg-muted/50 dark:bg-muted/20 rounded p-3 text-[11px] font-mono overflow-auto max-h-[500px] whitespace-pre">
                    {config.files[activeFileIdx].content}
                  </pre>
                  <div className="flex gap-2">
                    <CopyButton getText={() => config.files[activeFileIdx].content} label="Copy file" />
                  </div>
                </div>
              )}

              {showExplanations && config.explanations.length > 0 && (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setShowExplanations(false)}
                    className="flex items-center gap-1 text-xs font-semibold text-foreground"
                  >
                    <ChevronDown className="h-3 w-3" /> Per-directive explanations ({config.explanations.length})
                  </button>
                  <div className="space-y-1 max-h-[300px] overflow-auto">
                    {config.explanations.map((e, i) => (
                      <div key={i} className="rounded border bg-background px-2 py-1 text-xs">
                        <code className="text-primary font-medium">{e.directive}</code>
                        {" = "}
                        <code className="text-foreground">{e.value}</code>
                        <p className="text-muted-foreground mt-0.5 text-[11px]">{e.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!showExplanations && config.explanations.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowExplanations(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-foreground"
                >
                  <ChevronRight className="h-3 w-3" /> Show per-directive explanations ({config.explanations.length})
                </button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Key className="h-4 w-4" /> Optional: Enhance with BYO-key LLM
              </h3>
              <p className="text-xs text-muted-foreground">
                Paste your own API key (OpenAI / Anthropic / OpenRouter) to ask an LLM for an alternative config. Key stays in your browser.
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
                    <span className="text-xs font-semibold text-foreground">LLM-generated config</span>
                    <CopyButton getText={() => llmOutput} label="Copy" size="sm" />
                    <DownloadButton getText={() => llmOutput} filename="nginx-llm.conf" label="Download" size="sm" />
                  </div>
                  <pre className="bg-muted/50 dark:bg-muted/20 rounded p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre">
                    {llmOutput}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Generate a production-ready nginx config"
          hint="Pick a template (static, PHP-FPM, Node proxy, SPA, WordPress), enter your domain and upstream, toggle features, and click Generate. We'll produce nginx.conf + a per-site conf with SSL, redirects, gzip, caching, rate limiting, and security headers — explained line by line with risk warnings."
          icon={<Server className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{TEMPLATE_LABELS[h.template]}</Badge>
                  <Badge variant="outline" className="mr-2">{h.ssl ? "SSL" : "no SSL"}</Badge>
                  <Badge variant="outline" className="mr-2">{h.fileCount} files</Badge>
                  <span className="text-muted-foreground font-mono">{h.domain}</span>
                  {h.upstream && <span className="text-muted-foreground ml-1">→ {h.upstream}</span>}
                  <div className="text-[10px] text-muted-foreground">{new Date(h.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy & Honesty:</strong> All config generation, linting, and risk analysis run locally. Always run <code className="text-foreground">nginx -t</code> on staging before reload — a bad config can break your site. Generated defaults are sensible but not tuned to your exact load. On-device models are less reliable than BYO-key for complex setups.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleCheck({
  label, checked, onChange, disabled,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center gap-1.5 cursor-pointer ${disabled ? "opacity-50" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function WarningRow({ warning }: { warning: RiskWarning }) {
  const color = warning.level === "danger"
    ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400"
    : warning.level === "warn"
      ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
      : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400";
  const icon = warning.level === "danger" ? "✗" : warning.level === "warn" ? "⚠" : "✓";
  return (
    <div className={`rounded border px-3 py-1.5 text-xs ${color}`}>
      <span className="mr-2 font-mono">{icon}</span>
      <span>{warning.message}</span>
      {warning.directive && <code className="ml-2 text-[10px] opacity-70">[{warning.directive}]</code>}
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
        temperature: 0.3,
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
        max_tokens: 1500,
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
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

// Suppress unused-import lint (Copy, Check may be used in future inline copy)
export type _Unused = typeof Copy | typeof Check;
