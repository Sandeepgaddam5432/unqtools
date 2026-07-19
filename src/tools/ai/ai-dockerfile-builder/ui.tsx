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
  LANGUAGES,
  BASE_IMAGE_PREFS,
  FRAMEWORKS_BY_LANGUAGE,
  LANGUAGE_LABELS,
  BASE_IMAGE_LABELS,
  FRAMEWORK_LABELS,
  PORT_DEFAULTS,
  generateDockerfile,
  generateDockerignore,
  generateCompose,
  parseDockerfile,
  lintDockerfile,
  optimizeDockerfile,
  explainInstruction,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  LLM_KEY_STORAGE,
  type Language,
  type BaseImagePref,
  type Framework,
  type BuildOptions,
  type HistoryEntry,
  type ShareState,
} from "./logic";
import {
  Container, Sparkles, Key, History, AlertTriangle,
  FileCode, Wand2, ShieldCheck, Gauge,
} from "lucide-react";

type Tab = "dockerfile" | "dockerignore" | "compose" | "lint" | "import";
type ImportTab = "raw" | "optimized";

export default function AiDockerfileBuilder() {
  const [language, setLanguage] = useState<Language>("nodejs");
  const [framework, setFramework] = useState<Framework>("none");
  const [baseImage, setBaseImage] = useState<BaseImagePref>("default");
  const [port, setPort] = useState<number>(PORT_DEFAULTS.nodejs);
  const [pkgManager, setPkgManager] = useState<"npm" | "yarn" | "pnpm">("npm");
  const [appName, setAppName] = useState("app");
  const [healthcheck, setHealthcheck] = useState(true);
  const [nonRoot, setNonRoot] = useState(true);
  const [tab, setTab] = useState<Tab>("dockerfile");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmBusy, setLlmBusy] = useState(false);

  // Import-to-optimize state.
  const [importText, setImportText] = useState("");
  const [importTab, setImportTab] = useState<ImportTab>("raw");

  useEffect(() => {
    setHistory(loadHistory());
    try {
      const k = localStorage.getItem(LLM_KEY_STORAGE);
      if (k) setLlmKey(k);
    } catch { /* ignore */ }
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setLanguage(p.language);
      setFramework(p.framework);
      setBaseImage(p.baseImage);
      setPort(p.port);
      toast.info("Loaded from share link");
    }
  }, []);

  // When language changes, clamp framework to one valid for that language.
  useEffect(() => {
    if (!FRAMEWORKS_BY_LANGUAGE[language].includes(framework)) {
      setFramework("none");
    }
    setPort(PORT_DEFAULTS[language]);
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  const opts: BuildOptions = useMemo(() => ({
    language,
    framework,
    baseImage,
    port,
    pkgManager,
    appName,
    healthcheck,
    nonRoot,
  }), [language, framework, baseImage, port, pkgManager, appName, healthcheck, nonRoot]);

  const result = useMemo(() => generateDockerfile(opts), [opts]);
  const dockerignore = useMemo(() => generateDockerignore(language), [language]);
  const compose = useMemo(() => generateCompose(opts), [opts]);

  const importLint = useMemo(() => importText ? lintDockerfile(importText) : [], [importText]);
  const importParsed = useMemo(() => importText ? parseDockerfile(importText) : [], [importText]);
  const importOptimized = useMemo(() => importText ? optimizeDockerfile(importText) : null, [importText]);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      language,
      framework,
      baseImage,
      port,
      dockerfile: result.dockerfile,
    });
    setHistory(loadHistory());
  }, [language, framework, baseImage, port, result.dockerfile]);

  const handleClear = useCallback(() => {
    setFramework("none");
    setBaseImage("default");
    setPort(PORT_DEFAULTS[language]);
    setHealthcheck(true);
    setNonRoot(true);
    setAppName("app");
    toast.info("Reset to defaults");
  }, [language]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLlmKeySave = useCallback(() => {
    try {
      localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      toast.success("API key saved (localStorage only)");
    } catch {
      toast.error("Could not save API key");
    }
  }, [llmKey]);

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your own LLM API key first");
      return;
    }
    setLlmBusy(true);
    try {
      const prompt = buildLlmPrompt(opts);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${llmKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LLM API error ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = await res.json() as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content ?? "";
      const rendered = renderLlmResult(raw);
      setImportText(rendered.dockerfile);
      setTab("import");
      setImportTab("raw");
      toast.success("LLM polish applied (verify the result!)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "LLM call failed");
    } finally {
      setLlmBusy(false);
    }
  }, [llmKey, opts]);

  const currentText = tab === "dockerfile"
    ? result.dockerfile
    : tab === "dockerignore"
      ? dockerignore
      : tab === "compose"
        ? compose
        : "";

  const currentFile = tab === "dockerfile"
    ? "Dockerfile"
    : tab === "dockerignore"
      ? ".dockerignore"
      : tab === "compose"
        ? "compose.yaml"
        : "";

  const errorCount = result.lint.filter((l) => l.level === "error").length;
  const warnCount = result.lint.filter((l) => l.level === "warning").length;
  const infoCount = result.lint.filter((l) => l.level === "info").length;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Language</Label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Framework</Label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value as Framework)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {FRAMEWORKS_BY_LANGUAGE[language].map((f) => (
                  <option key={f} value={f}>{FRAMEWORK_LABELS[f]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Base image preference</Label>
              <select
                value={baseImage}
                onChange={(e) => setBaseImage(e.target.value as BaseImagePref)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {BASE_IMAGE_PREFS.map((b) => (
                  <option key={b} value={b}>{BASE_IMAGE_LABELS[b]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Port</Label>
              <Input
                type="number"
                value={port}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isFinite(v) && v > 0 && v < 65536) setPort(v);
                }}
                className="text-sm"
              />
            </div>
            {language === "nodejs" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Package manager</Label>
                <select
                  value={pkgManager}
                  onChange={(e) => setPkgManager(e.target.value as "npm" | "yarn" | "pnpm")}
                  className="h-9 w-full text-sm rounded border bg-background px-2"
                >
                  <option value="npm">npm</option>
                  <option value="yarn">yarn</option>
                  <option value="pnpm">pnpm</option>
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">App name (binary / image)</Label>
              <Input
                value={appName}
                onChange={(e) => setAppName(e.target.value || "app")}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={healthcheck} onChange={() => setHealthcheck((v) => !v)} />
              HEALTHCHECK
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={nonRoot} onChange={() => setNonRoot((v) => !v)} />
              Non-root user
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Container className="h-4 w-4" /> Output
            </h3>
            <div className="flex flex-wrap gap-1">
              {(["dockerfile", "dockerignore", "compose", "lint", "import"] as Tab[]).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={tab === t ? "default" : "outline"}
                  onClick={() => setTab(t)}
                  className="h-7 text-xs"
                >{t === "dockerfile" ? "Dockerfile" : t === "dockerignore" ? ".dockerignore" : t === "compose" ? "Compose" : t === "lint" ? `Lint (${result.lint.length})` : "Import"}</Button>
              ))}
            </div>
          </div>

          {tab === "dockerfile" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleSaveHistory(); return result.dockerfile; }} label="Copy Dockerfile" />
                <DownloadButton getText={() => result.dockerfile} filename="Dockerfile" mime="text/plain" label="Download" />
                <DownloadButton getText={() => dockerignore} filename=".dockerignore" mime="text/plain" label=".dockerignore" />
                <DownloadButton getText={() => compose} filename="compose.yaml" mime="text/yaml" label="compose.yaml" />
                <ShareButton getUrl={() => {
                  handleSaveHistory();
                  return buildShareUrl({ language, framework, baseImage, port } as ShareState);
                }} />
                <ClearButton onClick={handleClear} />
                <Button size="sm" variant="ghost" onClick={() => setShowLlm((v) => !v)}>
                  <Wand2 className="h-3.5 w-3.5 mr-1" /> BYO-key LLM
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat icon={<Gauge className="h-3 w-3" />} label="Build stages" value={result.dockerfile.split(/^FROM /m).length - 1} />
                <Stat icon={<ShieldCheck className="h-3 w-3" />} label="Non-root" value={result.dockerfile.includes("USER app") || result.dockerfile.includes("USER nonroot") ? "yes" : "no"} />
                <Stat icon={<Container className="h-3 w-3" />} label="Healthcheck" value={result.dockerfile.includes("HEALTHCHECK") ? "yes" : "no"} />
                <Stat icon={<AlertTriangle className="h-3 w-3" />} label="Lint issues" value={result.lint.length} />
              </div>
              <pre className="rounded border bg-muted/40 p-3 text-xs font-mono overflow-auto max-h-[480px] whitespace-pre">
                {result.dockerfile}
              </pre>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Per-instruction explanations ({result.explanations.length})</summary>
                <ul className="mt-2 space-y-1">
                  {result.explanations.map((e, i) => (
                    <li key={i} className="rounded border bg-background px-2 py-1">
                      <span className="font-mono text-[11px] text-primary">{e.keyword} {e.args}</span>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{e.explanation}</div>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}

          {tab === "dockerignore" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => dockerignore} label="Copy .dockerignore" />
                <DownloadButton getText={() => dockerignore} filename=".dockerignore" mime="text/plain" label="Download" />
              </div>
              <pre className="rounded border bg-muted/40 p-3 text-xs font-mono overflow-auto max-h-[480px] whitespace-pre">
                {dockerignore}
              </pre>
            </div>
          )}

          {tab === "compose" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => compose} label="Copy compose.yaml" />
                <DownloadButton getText={() => compose} filename="compose.yaml" mime="text/yaml" label="Download" />
              </div>
              <pre className="rounded border bg-muted/40 p-3 text-xs font-mono overflow-auto max-h-[480px] whitespace-pre">
                {compose}
              </pre>
            </div>
          )}

          {tab === "lint" && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat icon={<AlertTriangle className="h-3 w-3 text-red-500" />} label="Errors" value={errorCount} highlight={errorCount > 0 ? "bad" : undefined} />
                <Stat icon={<AlertTriangle className="h-3 w-3 text-yellow-500" />} label="Warnings" value={warnCount} highlight={warnCount > 0 ? "bad" : undefined} />
                <Stat icon={<Sparkles className="h-3 w-3 text-blue-500" />} label="Info" value={infoCount} />
              </div>
              {result.lint.length === 0 ? (
                <EmptyState title="No issues — clean Dockerfile" icon={<ShieldCheck className="h-8 w-8" />} />
              ) : (
                <div className="space-y-1 max-h-[420px] overflow-auto">
                  {result.lint.map((l, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={l.level === "error" ? "destructive" : l.level === "warning" ? "secondary" : "outline"} className="text-[10px]">
                          {l.level}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono">{l.rule}</Badge>
                        {l.line && <span className="text-[10px] text-muted-foreground">line {l.line}</span>}
                      </div>
                      <div className="mt-0.5 text-muted-foreground">{l.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "import" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Paste an existing Dockerfile to lint and optimize it. The optimizer applies common fixes (ADD→COPY, --no-cache, non-root USER, HEALTHCHECK) and explains each change.
              </p>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant={importTab === "raw" ? "default" : "outline"} onClick={() => setImportTab("raw")} className="h-7 text-xs">Original ({importParsed.length} ins)</Button>
                <Button size="sm" variant={importTab === "optimized" ? "default" : "outline"} onClick={() => setImportTab("optimized")} className="h-7 text-xs">Optimized</Button>
              </div>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="FROM node:latest&#10;ADD . /app&#10;RUN npm install&#10;CMD node index.js"
                className="min-h-[180px] resize-y font-mono text-xs"
              />
              {importText && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <CopyButton getText={() => importTab === "raw" ? importText : (importOptimized?.dockerfile ?? "")} label="Copy" />
                    <DownloadButton getText={() => importTab === "raw" ? importText : (importOptimized?.dockerfile ?? "")} filename="Dockerfile.optimized" label="Download" />
                  </div>
                  {importTab === "optimized" && importOptimized && (
                    <>
                      <pre className="rounded border bg-muted/40 p-3 text-xs font-mono overflow-auto max-h-[300px] whitespace-pre">
                        {importOptimized.dockerfile}
                      </pre>
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-foreground">Suggestions applied:</div>
                        {importOptimized.suggestions.map((s, i) => (
                          <div key={i} className="rounded border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                            • {s}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-foreground">Lint ({importLint.length} issues):</div>
                    {importLint.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground">No issues.</div>
                    ) : (
                      importLint.map((l, i) => (
                        <div key={i} className="rounded border bg-background px-2 py-1 text-[11px]">
                          <Badge variant={l.level === "error" ? "destructive" : l.level === "warning" ? "secondary" : "outline"} className="text-[9px] mr-1">
                            {l.level}
                          </Badge>
                          <span className="font-mono text-[10px] mr-2">{l.rule}</span>
                          <span className="text-muted-foreground">{l.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Key className="h-4 w-4" /> Bring your own LLM API key
            </h3>
            <p className="text-xs text-muted-foreground">
              Optional. Paste an OpenAI API key and the tool will call OpenAI directly from your browser to generate a Dockerfile from your stack. The key is stored only in this browser&apos;s localStorage. The on-device templates work without any key.
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="sk-..."
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                className="text-xs font-mono"
              />
              <Button size="sm" variant="outline" onClick={handleLlmKeySave}>Save key</Button>
              <Button size="sm" onClick={handleLlmEnhance} disabled={llmBusy}>
                {llmBusy ? "Working…" : (<><Sparkles className="h-3.5 w-3.5 mr-1" />Polish with LLM</>)}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Honesty: LLM output is a starting point — always build and scan the image (docker scout / trivy) before production. On-device templates are weaker than a BYO-key LLM for exotic build systems.
            </p>
          </CardContent>
        </Card>
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
                <button
                  key={i}
                  onClick={() => {
                    setLanguage(h.language);
                    setFramework(h.framework);
                    setBaseImage(h.baseImage);
                    setPort(h.port);
                    setImportText(h.dockerfile);
                    setTab("import");
                    setImportTab("raw");
                    toast.info("Restored from history");
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent"
                >
                  <Badge variant="outline" className="mr-2">{LANGUAGE_LABELS[h.language]}</Badge>
                  {h.framework !== "none" && <Badge variant="outline" className="mr-2">{FRAMEWORK_LABELS[h.framework]}</Badge>}
                  {h.baseImage !== "default" && <Badge variant="outline" className="mr-2">{BASE_IMAGE_LABELS[h.baseImage]}</Badge>}
                  <Badge variant="secondary" className="mr-2">:{h.port}</Badge>
                  <span className="text-muted-foreground">· {new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy + Honesty:</strong> All Dockerfile generation, linting, parsing, and optimization run locally. The only network call is to OpenAI when you click &quot;Polish with LLM&quot; with your own API key. Always build the image and scan it (docker scout / trivy) before production — AI can miss project-specific needs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
