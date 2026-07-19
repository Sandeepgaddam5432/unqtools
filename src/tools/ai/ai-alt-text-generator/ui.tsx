"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  CATEGORY_LABELS,
  ROLE_LABELS,
  SUPPORTED_LANGUAGES,
  localizePrefix,
  MAX_ALT_LENGTH,
  MIN_ALT_LENGTH,
  fileNameToSubject,
  guessRoleFromFileName,
  computeAspectRatio,
  formatFileSize,
  normalizeFormat,
  generateAltSuggestions,
  weaveKeyword,
  lintAlt,
  renderImgTag,
  renderAriaHiddenImg,
  renderBatchCsv,
  renderBatchJson,
  renderBatchHtml,
  computeBatchStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  describeColor,
  type ImageMeta,
  type ImageRole,
  type ImageCategory,
  type BatchEntry,
  type AltSuggestion,
  type HistoryEntry,
  type ShareState,
  type LintResult,
} from "./logic";
import {
  Image as ImageIcon, Sparkles, Key, AlertCircle, Check, X,
  History, Upload, Plus, Trash2,
} from "lucide-react";

interface ImageEntry {
  id: string;
  meta: ImageMeta | null;
  dataUrl: string | null;
  alt: string;
  category: ImageCategory;
  role: ImageRole;
  context: string;
}

export default function AiAltTextGenerator() {
  const [language, setLanguage] = useState("en");
  const [keyword, setKeyword] = useState("");
  const [entries, setEntries] = useState<ImageEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selected = entries.find((e) => e.id === selectedId) ?? null;

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-alt-text:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.language) setLanguage(p.language);
      if (p.keyword !== undefined) setKeyword(p.keyword);
      if (p.context !== undefined || p.role || p.category || p.alt) {
        // Pre-seed a single empty entry with the shared state
        const id = `entry-${Date.now()}`;
        setEntries([{
          id,
          meta: null,
          dataUrl: null,
          alt: p.alt ?? "",
          category: p.category ?? "informative",
          role: p.role ?? "photograph",
          context: p.context ?? "",
        }]);
        setSelectedId(id);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const newEntries: ImageEntry[] = [];
    const list = Array.from(files);
    for (const file of list) {
      if (!file.type.startsWith("image/")) continue;
      const id = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const dataUrl = await readFileAsDataUrl(file);
      const meta = await extractMeta(file, dataUrl);
      const role = guessRoleFromFileName(file.name);
      const category: ImageCategory = role === "decorative" ? "decorative" : "informative";
      const subject = fileNameToSubject(file.name);
      const alt = role === "decorative" ? "" : (subject ? `${ROLE_LABELS[role].replace(" photo", "").replace("graphic", "image")} of ${subject}`.replace(/^Image of\s+/i, "") : "");
      newEntries.push({ id, meta, dataUrl, alt, category, role, context: "" });
    }
    if (newEntries.length > 0) {
      setEntries((prev) => [...prev, ...newEntries]);
      setSelectedId(newEntries[0].id);
      toast.success(`Added ${newEntries.length} image(s)`);
    }
  }, []);

  const handleSelectedChange = useCallback((patch: Partial<ImageEntry>) => {
    if (!selectedId) return;
    setEntries((prev) =>
      prev.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)),
    );
  }, [selectedId]);

  const suggestions: AltSuggestion[] = useMemo(() => {
    if (!selected || !selected.meta) return [];
    return generateAltSuggestions(
      selected.meta,
      selected.context,
      selected.role,
      language,
    );
  }, [selected, language]);

  const lint: LintResult | null = useMemo(() => {
    if (!selected || !selected.meta) return null;
    return lintAlt(selected.alt, selected.category, selected.meta, keyword);
  }, [selected, keyword]);

  const keywordResult = useMemo(() => {
    if (!selected || !keyword) return null;
    return weaveKeyword(selected.alt, keyword);
  }, [selected, keyword]);

  const htmlTag = useMemo(() => {
    if (!selected) return "";
    return renderImgTag(
      selected.dataUrl ?? selected.meta?.fileName ?? "image.png",
      selected.alt,
      selected.meta?.width,
      selected.meta?.height,
    );
  }, [selected]);

  const ariaHiddenTag = useMemo(() => {
    if (!selected) return "";
    return renderAriaHiddenImg(selected.dataUrl ?? selected.meta?.fileName ?? "image.png");
  }, [selected]);

  const batchEntries: BatchEntry[] = useMemo(() => entries
    .filter((e) => e.meta)
    .map((e) => ({
      fileName: e.meta!.fileName,
      alt: e.alt,
      category: e.category,
      width: e.meta!.width,
      height: e.meta!.height,
      format: e.meta!.format,
    })), [entries]);

  const batchStats = useMemo(() => computeBatchStats(batchEntries), [batchEntries]);

  const handleApplySuggestion = useCallback((text: string, cat: ImageCategory) => {
    handleSelectedChange({ alt: text, category: cat });
    toast.success("Applied suggestion");
  }, [handleSelectedChange]);

  const handleApplyKeyword = useCallback(() => {
    if (!keywordResult || keywordResult.stuffed) {
      toast.error(keywordResult?.stuffed ? "Keyword already appears twice — avoid stuffing" : "Nothing to apply");
      return;
    }
    handleSelectedChange({ alt: keywordResult.text });
    toast.success("Keyword woven into alt text");
  }, [keywordResult, handleSelectedChange]);

  const handleRemoveEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const handleClear = useCallback(() => {
    setEntries([]);
    setSelectedId(null);
    setError("");
    toast.info("Cleared all images");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (!selected || !selected.meta) return;
    saveHistory({
      ts: Date.now(),
      fileName: selected.meta.fileName,
      role: selected.role,
      category: selected.category,
      altPreview: selected.alt.slice(0, 60),
      language,
    });
    setHistory(loadHistory());
  }, [selected, language]);

  const handleSaveLlmKey = () => {
    if (typeof localStorage !== "undefined") {
      if (llmKey) localStorage.setItem("unqtools:ai-alt-text:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-alt-text:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!selected || !selected.meta || !selected.dataUrl) {
      toast.error("Select an image first");
      return;
    }
    if (!llmKey) {
      toast.error("Please paste your API key first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    try {
      const prompt = buildLlmPrompt(
        selected.context, selected.role, selected.category, language, keyword,
      );
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
            { role: "system", content: "You are an accessibility expert." },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: selected.dataUrl } },
              ],
            },
          ],
          temperature: 0.5,
        };
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        const base64 = selected.dataUrl.split(",")[1] ?? "";
        const mediaType = selected.dataUrl.split(",")[0]?.match(/data:(.+?);/)?.[1] ?? "image/png";
        body = {
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            ],
          }],
        };
      }
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text();
        setLlmError(`LLM request failed (${res.status}): ${txt.slice(0, 200)}`);
        toast.error("LLM request failed");
        setLlmLoading(false);
        return;
      }
      const data = await res.json();
      const rawText = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const cleaned = renderLlmResult(rawText);
      handleSelectedChange({ alt: cleaned });
      toast.success("LLM enhanced the alt text");
    } catch (e) {
      setLlmError(`LLM request error: ${(e as Error).message}`);
      toast.error("LLM request error");
    }
    setLlmLoading(false);
  }, [selected, llmKey, llmProvider, language, keyword, handleSelectedChange]);

  const shareState: ShareState | null = selected ? {
    context: selected.context,
    role: selected.role,
    category: selected.category,
    language,
    keyword,
    alt: selected.alt,
  } : null;

  const altLen = selected?.alt.length ?? 0;
  const lenColor = altLen === 0 ? "text-muted-foreground"
    : altLen > MAX_ALT_LENGTH ? "text-red-600 dark:text-red-400"
    : altLen < MIN_ALT_LENGTH ? "text-amber-600 dark:text-amber-400"
    : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Upload className="h-4 w-4" /> Add images
            </h3>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Language</Label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l} value={l}>{l}{l === "en" ? " (default)" : ""}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="alt-seo-kw" className="text-xs">SEO keyword (optional)</Label>
                <Input
                  id="alt-seo-kw"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="h-8 text-xs w-40"
                  placeholder="pet care"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setShowLlm((v) => !v)}
              >
                <Sparkles className="h-3.5 w-3.5" /> LLM enhance
              </Button>
            </div>
          </div>
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50"
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            onDragOver={(e) => e.preventDefault()}
          >
            <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground mt-2">
              Click to select or drop images here (PNG, JPEG, WebP, GIF, SVG). Images never leave your browser.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>
        </CardContent>
      </Card>

      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Key className="h-4 w-4" /> Optional: enhance with your own LLM vision API key
            </div>
            <p className="text-xs text-muted-foreground">
              Your key is stored only in this browser's localStorage. The image + prompt are sent directly from your browser to your chosen provider. The on-device metadata + template engine works without any key.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Provider</Label>
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                  className="h-8 text-xs rounded border bg-background px-2 w-full"
                >
                  <option value="openai">OpenAI (gpt-4o-mini vision)</option>
                  <option value="anthropic">Anthropic (claude-3-5-haiku vision)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">API key</Label>
                <Input
                  type="password"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="sk-..."
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleSaveLlmKey}>Save key locally</Button>
              <RunButton
                onClick={handleLlmEnhance}
                loading={llmLoading}
                label="Enhance selected with LLM"
              />
            </div>
            {llmError && <ErrorBanner message={llmError} />}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {entries.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4" /> {entries.length} image(s) loaded
                </h3>
                <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Clear all
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {batchStats.total > 0 && (
                  <>
                    <Stat label="Images" value={batchStats.total} />
                    <Stat label="With alt" value={batchStats.withAlt} highlight={batchStats.withAlt === batchStats.total ? "good" : undefined} />
                    <Stat label="Empty alt (decorative)" value={batchStats.emptyAlt} />
                    <Stat label="Avg length" value={batchStats.avgLength} />
                  </>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2 max-h-[200px] overflow-auto">
                {entries.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelectedId(e.id)}
                    className={`relative group rounded border bg-background overflow-hidden aspect-square ${selectedId === e.id ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                  >
                    {e.dataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.dataUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-background/80 px-1 py-0.5 text-[8px] truncate text-left">
                      {e.meta?.fileName ?? "(no meta)"}
                    </div>
                    <Badge
                      variant={e.alt.trim() ? "secondary" : "outline"}
                      className="absolute top-1 right-1 text-[8px] px-1"
                    >
                      {e.alt.trim() ? "ALT" : "—"}
                    </Badge>
                    <button
                      type="button"
                      className="absolute top-1 left-1 bg-background/80 rounded p-0.5 opacity-0 group-hover:opacity-100"
                      onClick={(ev) => { ev.stopPropagation(); handleRemoveEntry(e.id); }}
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {selected && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap gap-3">
                  {selected.dataUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.dataUrl}
                      alt={selected.alt}
                      className="max-h-32 max-w-[200px] rounded border"
                    />
                  )}
                  <div className="flex-1 space-y-1 text-xs">
                    {selected.meta && (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-[10px]">{selected.meta.fileName}</Badge>
                          <Badge variant="outline" className="text-[10px]">{normalizeFormat(selected.meta.format)}</Badge>
                          <Badge variant="outline" className="text-[10px]">{selected.meta.width}×{selected.meta.height}</Badge>
                          <Badge variant="outline" className="text-[10px]">{selected.meta.aspectRatio}</Badge>
                          <Badge variant="outline" className="text-[10px]">{formatFileSize(selected.meta.fileSize)}</Badge>
                          {selected.meta.dominantColor && (
                            <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                              <span
                                className="inline-block w-3 h-3 rounded"
                                style={{ backgroundColor: selected.meta.dominantColor }}
                              />
                              {describeColor(selected.meta.dominantColor)}
                            </Badge>
                          )}
                        </div>
                      </>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <div className="space-y-1">
                        <Label className="text-xs">Role</Label>
                        <select
                          value={selected.role}
                          onChange={(e) => handleSelectedChange({ role: e.target.value as ImageRole })}
                          className="h-8 text-xs rounded border bg-background px-2 w-full"
                        >
                          {(Object.keys(ROLE_LABELS) as ImageRole[]).map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Category</Label>
                        <select
                          value={selected.category}
                          onChange={(e) => {
                            const cat = e.target.value as ImageCategory;
                            handleSelectedChange({
                              category: cat,
                              alt: cat === "decorative" ? "" : selected.alt,
                            });
                          }}
                          className="h-8 text-xs rounded border bg-background px-2 w-full"
                        >
                          {(Object.keys(CATEGORY_LABELS) as ImageCategory[]).map((c) => (
                            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Context (what's it for?)</Label>
                        <Input
                          value={selected.context}
                          onChange={(e) => handleSelectedChange({ context: e.target.value })}
                          className="h-8 text-xs"
                          placeholder="e.g., product photo for e-commerce"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="alt-text" className="text-xs">Alt text</Label>
                    <span className={`text-xs ${lenColor}`}>{altLen} / {MAX_ALT_LENGTH} chars</span>
                  </div>
                  <Textarea
                    id="alt-text"
                    value={selected.alt}
                    onChange={(e) => handleSelectedChange({ alt: e.target.value })}
                    placeholder={selected.category === "decorative"
                      ? "Decorative images should have empty alt — leave this blank"
                      : "Describe what the image shows in context, e.g., 'Dashboard showing monthly revenue by region'"}
                    className="min-h-[60px] resize-y text-xs font-mono"
                  />
                </div>

                {lint && (
                  <div className="rounded border bg-background p-2 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">WCAG lint</span>
                      <Badge
                        variant={lint.score >= 90 ? "secondary" : lint.score >= 60 ? "outline" : "destructive"}
                        className="text-[10px]"
                      >
                        Score: {lint.score}/100
                      </Badge>
                      {lint.passed
                        ? <Badge variant="secondary" className="text-[10px] text-emerald-600"><Check className="h-3 w-3 mr-1" />No errors</Badge>
                        : <Badge variant="destructive" className="text-[10px]"><AlertCircle className="h-3 w-3 mr-1" />Has errors</Badge>}
                    </div>
                    {lint.issues.length > 0 ? (
                      <ul className="space-y-0.5">
                        {lint.issues.map((i, idx) => (
                          <li key={idx} className={`flex items-start gap-1.5 ${i.severity === "error" ? "text-red-600 dark:text-red-400" : i.severity === "warning" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                            <span className="font-mono text-[10px] mt-0.5">[{i.severity}]</span>
                            <span>{i.message}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-emerald-600 dark:text-emerald-400 text-[11px]">No issues — passes WCAG 2.1 alt-text guidelines.</p>
                    )}
                  </div>
                )}

                {keywordResult && keyword && (
                  <div className="rounded border bg-background p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">SEO keyword weaver</span>
                      {keywordResult.stuffed
                        ? <Badge variant="destructive" className="text-[10px]">Stuffing detected</Badge>
                        : <Badge variant="secondary" className="text-[10px] text-emerald-600">Natural</Badge>}
                    </div>
                    <p className="font-mono text-[11px]">{keywordResult.text}</p>
                    <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={handleApplyKeyword} disabled={keywordResult.stuffed}>
                      Apply woven version
                    </Button>
                  </div>
                )}

                {suggestions.length > 0 && selected.category !== "decorative" && (
                  <div className="rounded border bg-background p-2 text-xs space-y-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Suggestions (on-device)</div>
                    <div className="space-y-1">
                      {suggestions.slice(0, 4).map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px]">{s.category}</Badge>
                          <span className="font-mono text-[11px] flex-1 truncate">{s.text || "(empty — decorative)"}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px]"
                            onClick={() => handleApplySuggestion(s.text, s.category)}
                          >
                            Use
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">HTML output</Label>
                  <pre className="rounded border bg-muted/30 p-2 text-[11px] font-mono overflow-auto">
                    {htmlTag}
                  </pre>
                  <p className="text-[10px] text-muted-foreground">
                    For decorative images, use <code className="font-mono">alt=""</code> with <code className="font-mono">aria-hidden="true"</code>:
                  </p>
                  <pre className="rounded border bg-muted/30 p-2 text-[11px] font-mono overflow-auto">
                    {ariaHiddenTag}
                  </pre>
                </div>

                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return selected.alt; }}
                    label="Copy alt text"
                  />
                  <CopyButton getText={() => htmlTag} label="Copy <img> tag" />
                  <ShareButton getUrl={() => shareState ? buildShareUrl(shareState) : ""} />
                  <ClearButton onClick={handleClear} />
                </div>
              </CardContent>
            </Card>
          )}

          {batchEntries.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Batch export</h3>
                <div className="flex flex-wrap gap-2">
                  <DownloadButton
                    getText={() => renderBatchCsv(batchEntries)}
                    filename="alt-text-batch.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <DownloadButton
                    getText={() => renderBatchJson(batchEntries)}
                    filename="alt-text-batch.json"
                    mime="application/json"
                    label="Download JSON"
                  />
                  <DownloadButton
                    getText={() => renderBatchHtml(batchEntries)}
                    filename="alt-text-batch.html"
                    mime="text/html"
                    label="Download HTML"
                  />
                </div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Preview batch ({batchEntries.length} entries)</summary>
                  <pre className="rounded border bg-muted/30 p-2 text-[11px] font-mono overflow-auto max-h-[200px] mt-2">
                    {renderBatchCsv(batchEntries)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Drop images to generate WCAG-friendly alt text"
          hint="On-device metadata extraction (dimensions, format, dominant color, filename) + template-based suggestions. Optional BYO-key LLM vision enhancement. Images never leave your browser."
          icon={<ImageIcon className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.role}</Badge>
                  <Badge variant="outline" className="mr-2">{h.category}</Badge>
                  <Badge variant="outline" className="mr-2">{h.language}</Badge>
                  <span className="font-mono text-foreground">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">· {h.altPreview || "(empty alt)"}</span>
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
            <strong className="text-foreground">Privacy:</strong> All metadata extraction, template generation, and WCAG linting run locally in your browser. Images never leave this device. The only network call is if you paste your own LLM API key and click "Enhance with LLM" — that request goes directly from your browser to the LLM provider you choose.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- DOM-dependent helpers (only run in browser) ----------

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function extractMeta(file: File, dataUrl: string): Promise<ImageMeta> {
  const format = normalizeFormat(file.type || "unknown");
  const fileSize = file.size;
  // Load image to get dimensions
  const dims = await new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = dataUrl;
  });
  const { dominantColor, hasAlpha } = await computeDominantColor(dataUrl, format);
  return {
    fileName: file.name,
    fileSize,
    width: dims.w,
    height: dims.h,
    format,
    dominantColor,
    aspectRatio: computeAspectRatio(dims.w, dims.h),
    hasAlpha,
    megapixels: Math.round((dims.w * dims.h) / 10000) / 100,
  };
}

async function computeDominantColor(
  dataUrl: string,
  format: string,
): Promise<{ dominantColor: string; hasAlpha: boolean }> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("img load"));
      img.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    // Downsample to 32x32 for speed
    const size = 32;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { dominantColor: "#888888", hasAlpha: false };
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0, count = 0, alphaCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) { alphaCount++; continue; }
      r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
    }
    if (count === 0) {
      // fully transparent
      return { dominantColor: "#000000", hasAlpha: true };
    }
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    return {
      dominantColor: hex,
      hasAlpha: alphaCount > size * size * 0.05 || format === "png" && alphaCount > 0,
    };
  } catch {
    return { dominantColor: "#888888", hasAlpha: false };
  }
}

function Stat({
  label, value, highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "good" | "bad";
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
