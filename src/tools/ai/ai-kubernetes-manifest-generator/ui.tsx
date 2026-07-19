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
  RESOURCE_TYPES,
  RESOURCE_LABELS,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  APP_NAME_PRESETS,
  IMAGE_PRESETS,
  NAMESPACE_PRESETS,
  normalizeAppName,
  normalizeImage,
  normalizeNamespace,
  parsePort,
  generateAll,
  parseExistingYaml,
  reSerializeManifests,
  lintManifests,
  explainManifest,
  emitYaml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type ResourceType,
  type ServiceType,
  type OutputFormat,
  type ManifestFile,
  type HistoryEntry,
  type ShareState,
  type BuildOptions,
  type LintIssue,
} from "./logic";
import {
  Ship, History, Key, AlertCircle, ShieldCheck, ShieldAlert,
  Wand2, FileCode2, Download, Info,
} from "lucide-react";

export default function AiKubernetesManifestGenerator() {
  const [appName, setAppName] = useState("api-gateway");
  const [image, setImage] = useState("nginx:1.27-alpine");
  const [port, setPort] = useState("8080");
  const [replicas, setReplicas] = useState("3");
  const [namespace, setNamespace] = useState("default");
  const [serviceType, setServiceType] = useState<ServiceType>("ClusterIP");
  const [ingressHost, setIngressHost] = useState("");
  const [ingressTLS, setIngressTLS] = useState(true);
  const [cronSchedule, setCronSchedule] = useState("0 */6 * * *");
  const [hpaMax, setHpaMax] = useState("10");
  const [hpaCpu, setHpaCpu] = useState("70");
  const [selected, setSelected] = useState<ResourceType[]>([
    "deployment", "service", "ingress", "configmap", "secret", "hpa",
  ]);
  const [format, setFormat] = useState<OutputFormat>("yaml");
  const [result, setResult] = useState<ReturnType<typeof generateAll> | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ResourceType | "all">("all");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmOutput, setLlmOutput] = useState<string>("");
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-k8s-manifest-generator:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.appName) setAppName(p.appName);
      if (p.image) setImage(p.image);
      if (p.port) setPort(String(p.port));
      if (p.replicas) setReplicas(String(p.replicas));
      if (p.namespace) setNamespace(p.namespace);
      if (p.serviceType) setServiceType(p.serviceType);
      if (p.ingressHost) setIngressHost(p.ingressHost);
      if (p.resources && p.resources.length > 0) setSelected(p.resources);
      if (p.appName || p.resources?.length) toast.info("Loaded from share link");
    }
  }, []);

  const toggleResource = (t: ResourceType) => {
    setSelected((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  const buildOpts = useCallback((): BuildOptions | null => {
    const portN = parsePort(port);
    const repN = parseInt(replicas, 10);
    if (!portN) {
      setError("Port must be a number between 1 and 65535.");
      return null;
    }
    if (!Number.isFinite(repN) || repN < 1) {
      setError("Replicas must be a positive integer.");
      return null;
    }
    if (selected.length === 0) {
      setError("Select at least one resource to generate.");
      return null;
    }
    setError("");
    return {
      appName: normalizeAppName(appName) || "app",
      image: normalizeImage(image),
      tag: normalizeImage(image).split(":")[1] || "",
      port: portN,
      replicas: repN,
      namespace: normalizeNamespace(namespace) || "default",
      serviceType,
      ingressHost: ingressHost || `${normalizeAppName(appName) || "app"}.example.com`,
      ingressPath: "/",
      ingressTLS,
      resources: selected,
      cronSchedule,
      hpaMaxReplicas: parseInt(hpaMax, 10) || 10,
      hpaCpuTarget: parseInt(hpaCpu, 10) || 70,
      envFromRefs: true,
      format,
    };
  }, [appName, image, port, replicas, namespace, serviceType, ingressHost, ingressTLS, selected, format, cronSchedule, hpaMax, hpaCpu]);

  const handleGenerate = useCallback(() => {
    const opts = buildOpts();
    if (!opts) {
      toast.error("Fix the input errors first");
      return;
    }
    const r = generateAll(opts);
    setResult(r);
    saveHistory({
      ts: Date.now(),
      appName: opts.appName,
      image: opts.image,
      port: opts.port,
      replicas: opts.replicas,
      resources: opts.resources,
      fileCount: r.files.length,
    });
    setHistory(loadHistory());
    setActiveTab("all");
    toast.success(`Generated ${r.files.length} manifests`);
  }, [buildOpts]);

  const activeFile: ManifestFile | undefined = useMemo(() => {
    if (!result || activeTab === "all") return undefined;
    return result.files.find((f) => f.type === activeTab);
  }, [result, activeTab]);

  const allInOne = useMemo(() => result?.allInOne ?? "", [result]);
  const visibleYaml = activeFile?.yaml ?? allInOne;
  const visibleExplanations = activeFile?.explanations ?? [];

  const lintByLevel = useMemo(() => {
    const issues = result?.lint ?? [];
    return {
      errors: issues.filter((i) => i.level === "error"),
      warnings: issues.filter((i) => i.level === "warning"),
      info: issues.filter((i) => i.level === "info"),
    };
  }, [result]);

  const shareState: ShareState = {
    appName, image,
    port: parsePort(port) ?? 8080,
    replicas: parseInt(replicas, 10) || 1,
    namespace, serviceType, ingressHost, resources: selected,
  };

  const handleClear = useCallback(() => {
    setResult(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveLlmKey = () => {
    if (typeof localStorage !== "undefined") {
      if (llmKey) localStorage.setItem("unqtools:ai-k8s-manifest-generator:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-k8s-manifest-generator:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    const opts = buildOpts();
    if (!opts) {
      toast.error("Fix inputs first");
      return;
    }
    if (!llmKey) {
      toast.error("Paste your API key first");
      return;
    }
    setLlmLoading(true);
    setError("");
    try {
      const prompt = buildLlmPrompt(opts);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: Record<string, unknown>;
      if (llmProvider === "openai") {
        headers["Authorization"] = `Bearer ${llmKey}`;
        body = {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a Kubernetes expert who generates production-ready manifests." },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        };
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = {
          model: "claude-3-5-haiku-20241022",
          max_tokens: 4096,
          messages: [{ role: "user", content: prompt }],
        };
      }
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text();
        setError(`LLM request failed (${res.status}): ${txt.slice(0, 200)}`);
        toast.error("LLM request failed");
        setLlmLoading(false);
        return;
      }
      const data = await res.json();
      const rawText = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(rawText);
      if (!parsed.ok) {
        setError(parsed.error);
        setLlmLoading(false);
        return;
      }
      const combined = parsed.manifests.map((m) => m.yaml).join("---\n");
      setLlmOutput(combined);
      toast.success(`LLM generated ${parsed.manifests.length} manifests`);
    } catch (err) {
      setError(`LLM error: ${err instanceof Error ? err.message : String(err)}`);
      toast.error("LLM enhancement failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, buildOpts]);

  const handleImport = useCallback(() => {
    const r = parseExistingYaml(importText);
    if (!r.ok) {
      setError(r.error);
      toast.error(r.error);
      return;
    }
    setError("");
    const re = reSerializeManifests(r.manifests);
    const fakeFiles: ManifestFile[] = r.manifests.map((m, i) => ({
      type: "deployment" as ResourceType,
      filename: `imported-${i}`,
      yaml: m.raw,
      explanations: [],
    }));
    const lint = lintManifests(fakeFiles, {
      appName: "imported", image: "nginx:1.27-alpine", port: 8080, replicas: 1, resources: [],
    });
    setResult({
      files: fakeFiles,
      allInOne: re,
      lint,
    });
    setActiveTab("all");
    toast.success(`Imported ${r.manifests.length} manifests`);
  }, [importText]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="k8s-app">App name (DNS-1123)</Label>
              <Input id="k8s-app" value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="api-gateway" className="text-sm font-mono" />
              <div className="flex flex-wrap gap-1">
                {APP_NAME_PRESETS.slice(0, 4).map((p) => (
                  <Button key={p} variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setAppName(p)}>+ {p}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k8s-image">Container image</Label>
              <Input id="k8s-image" value={image} onChange={(e) => setImage(e.target.value)} placeholder="nginx:1.27-alpine" className="text-sm font-mono" />
              <div className="flex flex-wrap gap-1">
                {IMAGE_PRESETS.slice(0, 4).map((p) => (
                  <Button key={p} variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setImage(p)}>+ {p}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k8s-port">Port (1-65535)</Label>
              <Input id="k8s-port" type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="8080" className="text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k8s-replicas">Replicas</Label>
              <Input id="k8s-replicas" type="number" min={1} value={replicas} onChange={(e) => setReplicas(e.target.value)} placeholder="3" className="text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k8s-ns">Namespace</Label>
              <Input id="k8s-ns" value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="default" className="text-sm font-mono" />
              <div className="flex flex-wrap gap-1">
                {NAMESPACE_PRESETS.slice(0, 4).map((p) => (
                  <Button key={p} variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setNamespace(p)}>+ {p}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k8s-st">Service type</Label>
              <select
                id="k8s-st"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as ServiceType)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {SERVICE_TYPES.map((s) => <option key={s} value={s}>{SERVICE_TYPE_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k8s-host">Ingress host (optional)</Label>
              <Input id="k8s-host" value={ingressHost} onChange={(e) => setIngressHost(e.target.value)} placeholder="api.example.com" className="text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k8s-cron">CronJob schedule (5-field cron)</Label>
              <Input id="k8s-cron" value={cronSchedule} onChange={(e) => setCronSchedule(e.target.value)} placeholder="0 */6 * * *" className="text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k8s-hpamax">HPA max replicas</Label>
              <Input id="k8s-hpamax" type="number" min={1} value={hpaMax} onChange={(e) => setHpaMax(e.target.value)} className="text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="k8s-hpacpu">HPA CPU target %</Label>
              <Input id="k8s-hpacpu" type="number" min={1} max={100} value={hpaCpu} onChange={(e) => setHpaCpu(e.target.value)} className="text-sm font-mono" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input id="k8s-tls" type="checkbox" checked={ingressTLS} onChange={(e) => setIngressTLS(e.target.checked)} />
            <Label htmlFor="k8s-tls" className="text-xs cursor-pointer">Ingress TLS (cert-manager)</Label>
          </div>
          <div>
            <Label className="text-xs">Resources to generate</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {RESOURCE_TYPES.map((t) => (
                <Button
                  key={t}
                  variant={selected.includes(t) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleResource(t)}
                >{RESOURCE_LABELS[t]}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Output format</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(["yaml", "kustomize", "helm"] as OutputFormat[]).map((f) => (
                <Button
                  key={f}
                  variant={format === f ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs capitalize"
                  onClick={() => setFormat(f)}
                >{f}</Button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton onClick={handleGenerate} label="Generate manifests" />
            <Button variant="outline" size="sm" onClick={() => setShowImport((v) => !v)}>Import to edit</Button>
            <Button variant="outline" size="sm" onClick={() => setShowLlm((v) => !v)}>
              <Wand2 className="h-3.5 w-3.5 mr-1.5" /> BYO-key LLM
            </Button>
            <ClearButton onClick={handleClear} disabled={!result} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {showImport && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <FileCode2 className="h-4 w-4" /> Import existing YAML
            </h3>
            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"---\napiVersion: apps/v1\nkind: Deployment\n..."}
              className="min-h-[160px] font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <RunButton onClick={handleImport} label="Parse + lint" />
              <Button variant="ghost" size="sm" onClick={() => { setImportText(""); setShowImport(false); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Key className="h-4 w-4" /> Bring your own LLM key
            </h3>
            <p className="text-xs text-muted-foreground">
              Stored only in this browser&apos;s localStorage. Calls go directly from your browser to the provider.
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                className="h-9 text-xs rounded border bg-background px-2"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
              <Input
                type="password"
                value={llmKey}
                onChange={(e) => setLlmKey(e.target.value)}
                placeholder="sk-… / sk-ant-…"
                className="flex-1 min-w-[200px] text-sm font-mono"
              />
              <Button variant="outline" size="sm" onClick={handleSaveLlmKey}>Save key</Button>
            </div>
            <Button size="sm" onClick={handleLlmEnhance} disabled={llmLoading} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" /> {llmLoading ? "Working…" : "Polish with LLM"}
            </Button>
            {llmOutput && (
              <div className="pt-2">
                <Label className="text-xs">LLM output</Label>
                <pre className="mt-1 max-h-[300px] overflow-auto rounded border bg-muted p-2 text-xs font-mono">{llmOutput}</pre>
                <div className="flex flex-wrap gap-2 mt-2">
                  <CopyButton getText={() => llmOutput} label="Copy LLM output" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Security lint
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={lintByLevel.errors.length ? "destructive" : "secondary"} className="text-[10px]">{lintByLevel.errors.length} errors</Badge>
                  <Badge variant={lintByLevel.warnings.length ? "default" : "secondary"} className="text-[10px]">{lintByLevel.warnings.length} warnings</Badge>
                  <Badge variant="outline" className="text-[10px]">{lintByLevel.info.length} info</Badge>
                </div>
              </div>
              {result.lint.length === 0 ? (
                <p className="text-xs text-muted-foreground">No issues — manifests look clean.</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {result.lint.map((issue, i) => (
                    <LintRow key={i} issue={issue} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Ship className="h-4 w-4" /> Manifests ({result.files.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Button variant={activeTab === "all" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setActiveTab("all")}>All-in-one</Button>
                  {result.files.map((f) => (
                    <Button
                      key={f.type}
                      variant={activeTab === f.type ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setActiveTab(f.type)}
                    >{RESOURCE_LABELS[f.type]}</Button>
                  ))}
                </div>
              </div>
              <pre className="max-h-[500px] overflow-auto rounded border bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {visibleYaml}
              </pre>
              {visibleExplanations.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Per-field explanations ({visibleExplanations.length})</summary>
                  <div className="mt-2 space-y-1">
                    {visibleExplanations.map((e, i) => (
                      <div key={i} className="rounded border bg-background px-2 py-1">
                        <code className="text-[10px] text-foreground">{e.line}</code>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{e.explanation}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              {result.kustomize && (
                <div className="pt-2">
                  <Label className="text-xs">kustomization.yaml</Label>
                  <pre className="mt-1 max-h-[200px] overflow-auto rounded border bg-muted p-2 text-xs font-mono">{result.kustomize}</pre>
                </div>
              )}
              {result.helmValues && (
                <div className="pt-2">
                  <Label className="text-xs">values.yaml</Label>
                  <pre className="mt-1 max-h-[200px] overflow-auto rounded border bg-muted p-2 text-xs font-mono">{result.helmValues}</pre>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton getText={() => visibleYaml} label="Copy YAML" />
                <DownloadButton getText={() => visibleYaml} filename={`${activeTab === "all" ? "manifests" : activeTab}.yaml`} mime="text/yaml" label="Download .yaml" />
                {activeTab === "all" && (
                  result.files.map((f) => (
                    <DownloadButton
                      key={f.type}
                      getText={() => f.yaml}
                      filename={`${f.filename}.yaml`}
                      mime="text/yaml"
                      label={`Download ${f.filename}.yaml`}
                    />
                  ))
                )}
                <ShareButton getUrl={() => buildShareUrl(shareState)} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!result && (
        <EmptyState
          title="Describe your app to generate Kubernetes manifests"
          hint="Enter app name, image, port, replicas. Pick the resources you need. Click Generate manifests. Security defaults (non-root, resource limits, probes) are baked in."
          icon={<Ship className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.fileCount} files</Badge>
                  <span className="font-mono text-foreground">{h.appName}</span>
                  <span className="text-muted-foreground ml-2">· {h.image}</span>
                  <span className="text-muted-foreground ml-2">· {h.replicas} replicas</span>
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
            <strong className="text-foreground">Privacy:</strong> All manifest generation runs locally. History is stored in localStorage on this device only.
            {" "}
            <strong className="text-foreground">Honesty:</strong> Templates are starting points — always run <code>kubectl apply --dry-run=server</code> and review before deploying.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LintRow({ issue }: { issue: LintIssue }) {
  const Icon = issue.level === "error" ? ShieldAlert : issue.level === "warning" ? ShieldAlert : Info;
  const color = issue.level === "error"
    ? "text-red-600 dark:text-red-400"
    : issue.level === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : "text-blue-600 dark:text-blue-400";
  return (
    <div className="rounded border bg-background px-3 py-1.5 text-xs">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <Badge variant="outline" className="text-[10px]">{issue.rule}</Badge>
        <Badge variant="outline" className="text-[10px] capitalize">{issue.level}</Badge>
        {issue.line && <Badge variant="outline" className="text-[10px]">line {issue.line}</Badge>}
      </div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{issue.message}</p>
    </div>
  );
}
