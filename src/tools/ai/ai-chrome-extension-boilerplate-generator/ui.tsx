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
  LLM_KEY_STORAGE,
  FRAMEWORK_LABELS,
  SURFACE_LABELS,
  PERMISSIONS,
  PERMISSION_MAP,
  DEFAULT_INPUTS,
  kebabCase,
  isValidVersion,
  validateInputs,
  buildManifest,
  buildFirefoxManifest,
  stringifyManifest,
  generateScaffold,
  buildFileTree,
  scaffoldToZip,
  parseDescription,
  renderJson,
  renderMarkdown,
  renderText,
  honestyNote,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Framework,
  type Surface,
  type ExtensionInputs,
  type GeneratedFile,
  type FileTreeNode,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  Puzzle, Key, History, ChevronDown, ChevronRight, ShieldAlert,
  Sparkles, Wand2, FileText, Folder, File, Download, AlertCircle,
} from "lucide-react";

export default function AiChromeExtensionBoilerplateGenerator() {
  const [inputs, setInputs] = useState<ExtensionInputs>(DEFAULT_INPUTS);
  const [permissionsText, setPermissionsText] = useState(
    DEFAULT_INPUTS.permissions.join("\n"),
  );
  const [hostText, setHostText] = useState(DEFAULT_INPUTS.hostPermissions.join("\n"));
  const [contentMatchesText, setContentMatchesText] = useState(
    DEFAULT_INPUTS.contentMatches.join("\n"),
  );
  const [nlText, setNlText] = useState("");
  const [output, setOutput] = useState<ReturnType<typeof generateScaffold> | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem(LLM_KEY_STORAGE)
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.inputs && Object.keys(p.inputs).length > 0) {
        setInputs((prev) => ({ ...prev, ...p.inputs }));
        if (p.inputs.permissions) setPermissionsText(p.inputs.permissions.join("\n"));
        if (p.inputs.hostPermissions) setHostText(p.inputs.hostPermissions.join("\n"));
        if (p.inputs.contentMatches) setContentMatchesText(p.inputs.contentMatches.join("\n"));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const effectiveInputs = useMemo<ExtensionInputs>(() => ({
    ...inputs,
    permissions: permissionsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    hostPermissions: hostText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    contentMatches: contentMatchesText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  }), [inputs, permissionsText, hostText, contentMatchesText]);

  const warnings = useMemo(() => validateInputs(effectiveInputs), [effectiveInputs]);

  const handleGenerate = useCallback(() => {
    setError("");
    try {
      const out = generateScaffold(effectiveInputs);
      setOutput(out);
      setSelectedFile(out.manifestPath);
      saveHistory({
        ts: Date.now(),
        name: effectiveInputs.name,
        framework: effectiveInputs.framework,
        surfaces: effectiveInputs.surfaces,
        permissionCount: effectiveInputs.permissions.length,
        fileCount: out.stats.fileCount,
      });
      setHistory(loadHistory());
      if (out.warnings.length > 0) {
        toast.info(`${out.warnings.length} warning(s) — see below`);
      } else {
        toast.success(`Generated ${out.stats.fileCount} files`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      toast.error(msg);
    }
  }, [effectiveInputs]);

  const handleApplyNl = useCallback(() => {
    if (!nlText.trim()) {
      toast.error("Describe your extension first");
      return;
    }
    const parsed = parseDescription(nlText);
    setInputs((prev) => ({
      ...prev,
      framework: parsed.framework,
      surfaces: parsed.surfaces,
      permissions: parsed.permissions,
    }));
    setPermissionsText(parsed.permissions.join("\n"));
    toast.success(`Detected: ${parsed.framework} + ${parsed.surfaces.join(", ")}`);
    if (parsed.notes.length > 0) {
      toast.info(parsed.notes[0]);
    }
  }, [nlText]);

  const handleClear = useCallback(() => {
    setInputs(DEFAULT_INPUTS);
    setPermissionsText(DEFAULT_INPUTS.permissions.join("\n"));
    setHostText(DEFAULT_INPUTS.hostPermissions.join("\n"));
    setContentMatchesText(DEFAULT_INPUTS.contentMatches.join("\n"));
    setNlText("");
    setOutput(null);
    setSelectedFile(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleDownloadZip = useCallback(() => {
    if (!output) {
      toast.error("Generate the scaffold first");
      return;
    }
    try {
      const zip = scaffoldToZip(output.files);
      const blob = new Blob([zip as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = output.zipPath;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success(`Downloaded ${output.zipPath}`);
    } catch {
      toast.error("Could not build ZIP");
    }
  }, [output]);

  const toggleSurface = (s: Surface) => {
    setInputs((prev) => ({
      ...prev,
      surfaces: prev.surfaces.includes(s)
        ? prev.surfaces.filter((x) => x !== s)
        : [...prev.surfaces, s],
    }));
  };

  const togglePermission = (name: string) => {
    setPermissionsText((prev) => {
      const list = prev.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
      const next = list.includes(name)
        ? list.filter((x) => x !== name)
        : [...list, name];
      return next.join("\n");
    });
  };

  const handleLlmPolish = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      }
      const prompt = buildLlmPrompt(effectiveInputs);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const res = await fetch(url, {
        method: "POST",
        headers: llmProvider === "openai"
          ? { "Content-Type": "application/json", Authorization: `Bearer ${llmKey}` }
          : {
              "Content-Type": "application/json",
              "x-api-key": llmKey,
              "anthropic-version": "2023-06-01",
            },
        body: JSON.stringify(
          llmProvider === "openai"
            ? {
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: "You are a senior Chrome extension architect. Always respond with valid JSON." },
                  { role: "user", content: prompt },
                ],
                temperature: 0.6,
              }
            : {
                model: "claude-3-5-haiku-latest",
                max_tokens: 1500,
                system: "You are a senior Chrome extension architect. Always respond with valid JSON.",
                messages: [{ role: "user", content: prompt }],
              },
        ),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LLM API ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      const raw = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      setLlmResult(parsed.result);
      toast.success("LLM polish complete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM polish failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, effectiveInputs]);

  const fileTree = useMemo(
    () => output ? buildFileTree(output.files) : [],
    [output],
  );
  const currentFile = useMemo<GeneratedFile | null>(() => {
    if (!output || !selectedFile) return null;
    return output.files.find((f) => f.path === selectedFile) ?? null;
  }, [output, selectedFile]);
  const manifestPreview = useMemo(() => {
    if (!output) return "";
    return stringifyManifest(buildManifest(effectiveInputs));
  }, [output, effectiveInputs]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Extension name">
              <Input
                value={inputs.name}
                onChange={(e) => setInputs((p) => ({ ...p, name: e.target.value }))}
                className="h-9 text-sm"
              />
            </Field>
            <Field label="Version (semver)">
              <Input
                value={inputs.version}
                onChange={(e) => setInputs((p) => ({ ...p, version: e.target.value }))}
                className={`h-9 text-sm font-mono ${isValidVersion(inputs.version) ? "" : "border-amber-500"}`}
              />
            </Field>
            <Field label="Framework">
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={inputs.framework}
                onChange={(e) => setInputs((p) => ({ ...p, framework: e.target.value as Framework }))}
              >
                {(Object.keys(FRAMEWORK_LABELS) as Framework[]).map((f) => (
                  <option key={f} value={f}>{FRAMEWORK_LABELS[f]}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <Textarea
              value={inputs.description}
              onChange={(e) => setInputs((p) => ({ ...p, description: e.target.value }))}
              className="min-h-[60px] resize-y text-sm"
            />
          </Field>
          <div>
            <Label className="text-xs">Surfaces</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(Object.keys(SURFACE_LABELS) as Surface[]).map((s) => (
                <Button
                  key={s}
                  variant={inputs.surfaces.includes(s) ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleSurface(s)}
                >
                  {SURFACE_LABELS[s]}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Field label="Describe your extension in plain English (optional — auto-fills framework/surfaces/permissions)">
            <Textarea
              value={nlText}
              onChange={(e) => setNlText(e.target.value)}
              placeholder={"e.g., I want a React popup extension with storage and notifications that injects a content script on all pages"}
              className="min-h-[60px] resize-y text-sm"
            />
          </Field>
          <Button variant="outline" size="sm" onClick={handleApplyNl} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Apply description
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Permissions (one per line — or click below to toggle)</Label>
            <Textarea
              value={permissionsText}
              onChange={(e) => setPermissionsText(e.target.value)}
              placeholder={"storage\nactiveTab"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1 pt-1.5 max-h-[160px] overflow-auto">
              {PERMISSIONS.map((p) => {
                const selected = effectiveInputs.permissions.includes(p.name);
                const riskColor = p.risk === "high"
                  ? "border-red-400 text-red-700 dark:text-red-300"
                  : p.risk === "medium"
                    ? "border-amber-400 text-amber-800 dark:text-amber-200"
                    : "border-emerald-400 text-emerald-700 dark:text-emerald-300";
                return (
                  <button
                    key={p.name}
                    onClick={() => togglePermission(p.name)}
                    title={p.description}
                    className={`h-6 rounded border px-2 text-[10px] font-mono ${selected ? "bg-primary text-primary-foreground border-primary" : riskColor}`}
                  >
                    {p.name} <span className="opacity-60">({p.risk})</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Host permissions (one per line)">
              <Textarea
                value={hostText}
                onChange={(e) => setHostText(e.target.value)}
                placeholder={"https://*.example.com/*"}
                className="min-h-[60px] resize-y font-mono text-xs"
              />
            </Field>
            <Field label="Content-script match patterns (one per line)">
              <Textarea
                value={contentMatchesText}
                onChange={(e) => setContentMatchesText(e.target.value)}
                placeholder={"<all_urls>"}
                className="min-h-[60px] resize-y font-mono text-xs"
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4 pt-1 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.firefoxVariant}
                onChange={(e) => setInputs((p) => ({ ...p, firefoxVariant: e.target.checked }))}
              /> Firefox variant
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.includeMessageHelper}
                onChange={(e) => setInputs((p) => ({ ...p, includeMessageHelper: e.target.checked }))}
              /> Message helper
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.includeStorageHelper}
                onChange={(e) => setInputs((p) => ({ ...p, includeStorageHelper: e.target.checked }))}
              /> Storage helper
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.includeReadme}
                onChange={(e) => setInputs((p) => ({ ...p, includeReadme: e.target.checked }))}
              /> README
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.includeViteConfig}
                onChange={(e) => setInputs((p) => ({ ...p, includeViteConfig: e.target.checked }))}
              /> Vite config
            </label>
          </div>
        </CardContent>
      </Card>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span className="text-amber-800 dark:text-amber-200">{w}</span>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <RunButton onClick={handleGenerate} label="Generate scaffold" />
            <Button variant="outline" size="sm" onClick={handleDownloadZip} disabled={!output} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Download ZIP
            </Button>
            <ShareButton getUrl={() => buildShareUrl(effectiveInputs)} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {output && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Puzzle className="h-4 w-4" /> {output.stats.fileCount} files · {output.stats.totalBytes.toLocaleString()} bytes
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <Stat label="Files" value={output.stats.fileCount} />
                <Stat label="Permissions" value={output.stats.permissionCount} />
                <Stat label="Host perms" value={output.stats.hostPermissionCount} />
                <Stat label="Surfaces" value={output.stats.surfaceCount} />
                <Stat
                  label="High-risk"
                  value={output.stats.highRiskPermissions}
                  highlight={output.stats.highRiskPermissions > 0 ? "bad" : "good"}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => renderText(output)} label="Copy file list" />
                <CopyButton getText={() => manifestPreview} label="Copy manifest.json" />
                <DownloadButton getText={() => manifestPreview} filename="manifest.json" mime="application/json" label="manifest.json" />
                <DownloadButton getText={() => renderMarkdown(output)} filename="scaffold-report.md" mime="text/markdown" label="Report .md" />
                <DownloadButton getText={() => renderJson(output)} filename="scaffold.json" mime="application/json" label="JSON" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4">
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2">File tree</h4>
                <div className="text-xs font-mono space-y-0.5 max-h-[400px] overflow-auto">
                  {fileTree.map((node) => (
                    <FileTreeItem
                      key={node.path}
                      node={node}
                      depth={0}
                      selected={selectedFile}
                      onSelect={setSelectedFile}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground mb-2">
                  {currentFile ? currentFile.path : "Select a file"}
                  {currentFile && (
                    <span className="text-muted-foreground ml-2 font-normal">
                      {currentFile.bytes.toLocaleString()} bytes · {currentFile.language}
                    </span>
                  )}
                </h4>
                {currentFile ? (
                  <div className="space-y-2">
                    <pre className="rounded border bg-muted/40 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap break-all">
                      {currentFile.content}
                    </pre>
                    <div className="flex gap-2">
                      <CopyButton getText={() => currentFile.content} label="Copy" />
                      <DownloadButton
                        getText={() => currentFile.content}
                        filename={currentFile.path.split("/").pop() ?? "file.txt"}
                        mime="text/plain"
                        label="Download"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Click a file in the tree to preview.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLlm((s) => !s)}
                className="gap-1.5"
              >
                <Wand2 className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Show"} optional LLM polish (BYO key)
              </Button>
              {showLlm && (
                <div className="mt-3 space-y-2">
                  <div className="rounded border bg-amber-50 dark:bg-amber-950/30 p-2 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      Optional LLM polish sends your extension name + description + selected
                      permissions to your chosen LLM provider (OpenAI or Anthropic) using <strong>your own API key</strong>, stored only in this browser. Skip this for 100% offline use.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      className="h-9 rounded border bg-background px-2 text-xs"
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                    <Input
                      type="password"
                      placeholder="Paste your API key (sk-... or sk-ant-...)"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      className="h-9 flex-1 min-w-[200px] font-mono text-xs"
                    />
                    <RunButton onClick={handleLlmPolish} loading={llmLoading} label="Polish with LLM" />
                  </div>
                  {llmError && <ErrorBanner message={llmError} />}
                  {llmResult && (
                    <div className="rounded border bg-background p-3 text-xs space-y-2">
                      {llmResult.refinedDescription && (
                        <div>
                          <strong className="text-foreground">Refined description:</strong>
                          <p className="text-muted-foreground mt-1">{llmResult.refinedDescription}</p>
                        </div>
                      )}
                      {llmResult.recommendedPermissions.length > 0 && (
                        <div>
                          <strong className="text-foreground">Recommended permissions:</strong>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {llmResult.recommendedPermissions.map((p, i) => {
                              const meta = PERMISSION_MAP[p];
                              return (
                                <Badge key={i} variant="outline" className="text-[10px] font-mono">
                                  {p}{meta ? ` (${meta.risk})` : ""}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {llmResult.notes.length > 0 && (
                        <div>
                          <strong className="text-foreground">Notes:</strong>
                          <ul className="mt-1 list-disc list-inside text-muted-foreground">
                            {llmResult.notes.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                      {llmResult.starterCode && (
                        <div>
                          <strong className="text-foreground">Starter code:</strong>
                          <pre className="mt-1 rounded border bg-muted/40 p-2 text-[10px] font-mono overflow-auto whitespace-pre-wrap">
                            {llmResult.starterCode}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!output && (
        <EmptyState
          title="Configure your extension and click Generate"
          hint="Pick a framework, tick surfaces, select permissions, then generate a downloadable ZIP scaffold. The NL box auto-fills fields from a description."
          icon={<Puzzle className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length}/{HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{FRAMEWORK_LABELS[h.framework]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.fileCount} files</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.permissionCount} perms</Badge>
                  <span className="font-mono text-foreground">{h.name}</span>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy + Honesty:</strong> {honestyNote()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
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

function FileTreeItem({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const indent = { paddingLeft: `${depth * 12 + 4}px` };
  if (node.isFile) {
    const isSelected = selected === node.path;
    return (
      <div
        style={indent}
        onClick={() => onSelect(node.path)}
        className={`flex items-center gap-1 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/60 ${isSelected ? "bg-primary/10 text-primary" : "text-foreground"}`}
      >
        <File className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
        {node.bytes !== undefined && (
          <span className="ml-auto text-[9px] text-muted-foreground">{node.bytes}b</span>
        )}
      </div>
    );
  }
  return (
    <div>
      <div
        style={indent}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/60 text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Folder className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        <span>{node.name}</span>
      </div>
      {open && node.children && node.children.map((c) => (
        <FileTreeItem
          key={c.path}
          node={c}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
