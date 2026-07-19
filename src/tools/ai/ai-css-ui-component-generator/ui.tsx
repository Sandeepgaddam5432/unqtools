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
  TYPE_LABELS,
  TARGET_LABELS,
  VARIANT_LABELS,
  FONT_PRESETS,
  COMPONENT_PRESETS,
  DEFAULT_THEME,
  normalizeDescription,
  matchComponentType,
  generateComponent,
  parseRefinement,
  applyRefinement,
  cssToTailwind,
  toReactComponent,
  buildPreviewSrcDoc,
  computeStats,
  renderText,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadFavorites,
  saveFavorite,
  removeFavorite,
  clearFavorites,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type ComponentType,
  type Variant,
  type OutputTarget,
  type Theme,
  type GeneratedComponent,
  type HistoryEntry,
  type FavoriteEntry,
  type ShareState,
} from "./logic";
import {
  LayoutTemplate, Sparkles, Key, History, ChevronDown, ChevronRight,
  Star, Eye, Code, Palette, RefreshCw, AlertCircle, Trash2,
} from "lucide-react";

export default function AiCssUiComponentGenerator() {
  const [description, setDescription] = useState("");
  const [variant, setVariant] = useState<Variant>("primary");
  const [target, setTarget] = useState<OutputTarget>("vanilla");
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [customText, setCustomText] = useState("");
  const [component, setComponent] = useState<GeneratedComponent | null>(null);
  const [refinement, setRefinement] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [faves, setFaves] = useState<FavoriteEntry[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"preview" | "html" | "css" | "tailwind" | "react">("preview");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    setFaves(loadFavorites());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-css-ui-comp:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.description) setDescription(p.description);
      if (p.variant) setVariant(p.variant);
      if (p.target) setTarget(p.target);
      if (p.theme) setTheme(p.theme);
      if (p.text !== undefined) setCustomText(p.text);
      if (p.description) {
        toast.info("Loaded from share link");
        handleGenerate({
          description: p.description,
          variant: p.variant ?? "primary",
          target: p.target ?? "vanilla",
          theme: p.theme ?? DEFAULT_THEME,
          text: p.text ?? "",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = useCallback(
    (override?: {
      description?: string;
      variant?: Variant;
      target?: OutputTarget;
      theme?: Theme;
      text?: string;
    }) => {
      const desc = (override?.description ?? description).trim();
      const vr = override?.variant ?? variant;
      const tg = override?.target ?? target;
      const th = override?.theme ?? theme;
      const tx = override?.text ?? customText;
      setError("");
      if (!desc) {
        setError("Describe a component (e.g., 'pricing card with toggle', 'navbar with search').");
        return;
      }
      const c = generateComponent({
        description: desc, variant: vr, target: tg, theme: th, text: tx,
      });
      if (!c) {
        setError("Could not generate — try a different description.");
        return;
      }
      setComponent(c);
      setTab("preview");
      saveHistory({
        ts: Date.now(),
        description: desc,
        type: c.type,
        variant: c.variant,
        target: c.target,
        score: c.score,
      });
      setHistory(loadHistory());
      toast.success(`Generated ${TYPE_LABELS[c.type]} (score ${c.score})`);
    },
    [description, variant, target, theme, customText],
  );

  const handleRefine = useCallback(() => {
    const r = parseRefinement(refinement);
    if (r.mods.length === 0) {
      toast.info("Try: 'make it dark, add shadow, more rounded'");
      return;
    }
    const newTheme = applyRefinement(theme, r);
    setTheme(newTheme);
    if (component) {
      const c = generateComponent({
        description: description || TYPE_LABELS[component.type].toLowerCase(),
        variant,
        target,
        theme: newTheme,
        text: customText,
      });
      if (c) setComponent(c);
    }
    toast.success(`Applied: ${r.mods.join(", ")}`);
    setRefinement("");
  }, [refinement, theme, component, description, variant, target, customText]);

  const matchPreview = useMemo(() => {
    if (!description.trim()) return null;
    return matchComponentType(description);
  }, [description]);

  const stats = useMemo(() => component ? computeStats([component]) : [], [component]);
  const previewDoc = useMemo(
    () => component ? buildPreviewSrcDoc(component, theme) : "",
    [component, theme],
  );
  const reactCode = useMemo(
    () => component ? toReactComponent(component.target === "tailwind" ? component.tailwind : component.html) : "",
    [component],
  );
  const tailwindSuggestions = useMemo(
    () => component ? cssToTailwind(component.css) : [],
    [component],
  );

  const shareState: ShareState = {
    description, variant, target, theme, text: customText,
  };

  const toggleVariant = (v: Variant) => {
    setVariant(v);
    if (component) {
      const c = generateComponent({
        description: description || TYPE_LABELS[component.type].toLowerCase(),
        variant: v, target, theme, text: customText,
      });
      if (c) setComponent(c);
    }
  };

  const toggleTarget = (t: OutputTarget) => {
    setTarget(t);
    if (component) {
      const c = generateComponent({
        description: description || TYPE_LABELS[component.type].toLowerCase(),
        variant, target: t, theme, text: customText,
      });
      if (c) setComponent(c);
    }
  };

  const handleThemeChange = (patch: Partial<Theme>) => {
    const next = { ...theme, ...patch };
    setTheme(next);
    if (component) {
      const c = generateComponent({
        description: description || TYPE_LABELS[component.type].toLowerCase(),
        variant, target, theme: next, text: customText,
      });
      if (c) setComponent(c);
    }
  };

  const handleClear = useCallback(() => {
    setDescription("");
    setCustomText("");
    setComponent(null);
    setRefinement("");
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveFavorite = useCallback(() => {
    if (!component) return;
    saveFavorite({
      id: component.id,
      ts: Date.now(),
      description,
      type: component.type,
      variant: component.variant,
      target: component.target,
      html: component.html,
      css: component.css,
      tailwind: component.tailwind,
      score: component.score,
    });
    setFaves(loadFavorites());
    toast.success("Saved to snippet library");
  }, [component, description]);

  const handleRemoveFavorite = useCallback((id: string) => {
    removeFavorite(id);
    setFaves(loadFavorites());
    toast.info("Removed from snippet library");
  }, []);

  const handleClearFavorites = useCallback(() => {
    clearFavorites();
    setFaves([]);
    toast.success("Snippet library cleared");
  }, []);

  const handleSaveLlmKey = () => {
    if (typeof localStorage !== "undefined") {
      if (llmKey) localStorage.setItem("unqtools:ai-css-ui-comp:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-css-ui-comp:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Please paste your API key first");
      return;
    }
    if (!description.trim()) {
      toast.error("Enter a description first");
      return;
    }
    setLlmLoading(true);
    setError("");
    try {
      const match = matchComponentType(description);
      const prompt = buildLlmPrompt(description, match.type, variant, target, theme);
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
            { role: "system", content: "You are a senior front-end engineer who writes clean, accessible, responsive UI components." },
            { role: "user", content: prompt },
          ],
          temperature: 0.6,
        };
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = {
          model: "claude-3-5-haiku-20241022",
          max_tokens: 2048,
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
      const newComp: GeneratedComponent = {
        ...component!,
        id: `llm-${Date.now()}`,
        html: parsed.html,
        css: parsed.css,
        tailwind: parsed.tailwind,
        score: Math.min(100, (component?.score ?? 50) + 5),
      };
      setComponent(newComp);
      setTab("html");
      toast.success("LLM-enhanced component loaded");
    } catch (e) {
      setError(`LLM request error: ${(e as Error).message}`);
      toast.error("LLM request error");
    }
    setLlmLoading(false);
  }, [llmKey, llmProvider, description, variant, target, theme, component]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-css-desc">Describe a UI component in plain English</Label>
            <Textarea
              id="ai-css-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"e.g., pricing card with toggle, navbar with search and dark mode, gradient button"}
              className="min-h-[70px] resize-y text-sm"
            />
            {matchPreview && matchPreview.confidence > 0 && (
              <div className="text-xs text-muted-foreground">
                Detected: <Badge variant="outline" className="text-[10px] ml-1">{TYPE_LABELS[matchPreview.type]}</Badge>
                <span className="ml-2">confidence {matchPreview.confidence}%</span>
                {matchPreview.matched.length > 0 && (
                  <span className="ml-2">matched: {matchPreview.matched.join(", ")}</span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {COMPONENT_PRESETS.map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setDescription(p)}
                >+ {p}</Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Output target</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(Object.keys(TARGET_LABELS) as OutputTarget[]).map((t) => (
                  <Button
                    key={t}
                    variant={target === t ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => toggleTarget(t)}
                  >
                    {TARGET_LABELS[t]}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Variant</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(Object.keys(VARIANT_LABELS) as Variant[]).map((v) => (
                  <Button
                    key={v}
                    variant={variant === v ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => toggleVariant(v)}
                  >
                    {VARIANT_LABELS[v]}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ai-css-text" className="text-xs">Custom label / text (optional)</Label>
              <Input
                id="ai-css-text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="e.g., Sign up now"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ai-css-refine" className="text-xs">Refine: make it dark, add shadow, more rounded</Label>
              <div className="flex gap-2">
                <Input
                  id="ai-css-refine"
                  value={refinement}
                  onChange={(e) => setRefinement(e.target.value)}
                  placeholder="refinement hint"
                  className="h-8 text-xs"
                  onKeyDown={(e) => { if (e.key === "Enter") handleRefine(); }}
                />
                <Button size="sm" variant="outline" onClick={handleRefine} className="h-8 gap-1">
                  <RefreshCw className="h-3 w-3" /> Apply
                </Button>
              </div>
            </div>
          </div>

          {/* Theme controls */}
          <div className="rounded border p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Palette className="h-3.5 w-3.5" /> Theme controls
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="space-y-1">
                <Label htmlFor="ai-css-color" className="text-[11px]">Primary color</Label>
                <input
                  id="ai-css-color"
                  type="color"
                  value={theme.primary}
                  onChange={(e) => handleThemeChange({ primary: e.target.value })}
                  className="h-8 w-full rounded border"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ai-css-radius" className="text-[11px]">Radius: {theme.radius}px</Label>
                <input
                  id="ai-css-radius"
                  type="range"
                  min={0}
                  max={32}
                  value={theme.radius}
                  onChange={(e) => handleThemeChange({ radius: parseInt(e.target.value, 10) })}
                  className="w-full"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ai-css-font" className="text-[11px]">Font</Label>
                <select
                  id="ai-css-font"
                  value={theme.font}
                  onChange={(e) => handleThemeChange({ font: e.target.value })}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  {FONT_PRESETS.map((f) => (
                    <option key={f} value={f}>{f.split(",")[0].replace(/['"]/g, "")}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Dark mode</Label>
                <Button
                  size="sm"
                  variant={theme.dark ? "default" : "outline"}
                  className="h-8 w-full text-xs"
                  onClick={() => handleThemeChange({ dark: !theme.dark })}
                >
                  {theme.dark ? "On" : "Off"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton
              onClick={() => handleGenerate()}
              label="Generate component"
              loading={false}
              disabled={!description.trim()}
            />
            <ShareButton getUrl={() => buildShareUrl(shareState)} disabled={!description.trim()} />
            <ClearButton onClick={handleClear} disabled={!description && !component} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {component ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> {TYPE_LABELS[component.type]} · {VARIANT_LABELS[component.variant]} · {TARGET_LABELS[component.target]}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Confidence" value={`${component.confidence}%`} />
                <Stat label="Score" value={`${component.score}/100`} />
                <Stat label="A11y issues" value={component.a11y.issues.length === 0 ? "0" : component.a11y.issues.length} highlight={component.a11y.issues.length === 0 ? "good" : "bad"} />
                <Stat label="HTML size" value={`${component.html.length} chars`} />
              </div>
              {component.a11y.issues.length > 0 && (
                <div className="rounded border border-amber-300/40 bg-amber-50/60 dark:bg-amber-900/20 p-2 text-[11px] text-amber-800 dark:text-amber-300">
                  ⚠ {component.a11y.issues.join("; ")}
                </div>
              )}
              {tailwindSuggestions.length > 0 && component.target === "vanilla" && (
                <div className="flex flex-wrap gap-1 pt-1">
                  <span className="text-[10px] text-muted-foreground">Tailwind equiv:</span>
                  {tailwindSuggestions.slice(0, 8).map((c) => (
                    <Badge key={c} variant="outline" className="text-[10px] font-mono">{c}</Badge>
                  ))}
                </div>
              )}
              {stats.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {stats.map((s) => (
                    <Badge key={s.type} variant="outline" className="text-[10px]">
                      {TYPE_LABELS[s.type]}: avg {s.avgScore}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {(["preview", "html", "css", "tailwind", "react"] as const).map((t) => {
                    const disabled =
                      (t === "css" && component.target !== "vanilla") ||
                      (t === "tailwind" && component.target === "vanilla");
                    return (
                      <Button
                        key={t}
                        variant={tab === t ? "default" : "ghost"}
                        size="sm"
                        className="h-7 text-xs gap-1"
                        disabled={disabled}
                        onClick={() => setTab(t)}
                      >
                        {t === "preview" && <Eye className="h-3 w-3" />}
                        {t === "html" && <Code className="h-3 w-3" />}
                        {t === "css" && <Code className="h-3 w-3" />}
                        {t === "tailwind" && <Code className="h-3 w-3" />}
                        {t === "react" && <Code className="h-3 w-3" />}
                        {t.toUpperCase()}
                      </Button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={handleSaveFavorite}>
                    <Star className="h-3 w-3" /> Save to library
                  </Button>
                  {tab === "preview" && (
                    <DownloadButton
                      getText={() => previewDoc}
                      filename="component-preview.html"
                      mime="text/html"
                      label="Download .html"
                    />
                  )}
                  {tab === "html" && (
                    <>
                      <CopyButton getText={() => component.html} label="Copy HTML" />
                      <DownloadButton
                        getText={() => component.html}
                        filename="component.html"
                        mime="text/html"
                        label="Download"
                      />
                    </>
                  )}
                  {tab === "css" && (
                    <>
                      <CopyButton getText={() => component.css} label="Copy CSS" />
                      <DownloadButton
                        getText={() => component.css}
                        filename="component.css"
                        mime="text/css"
                        label="Download"
                      />
                    </>
                  )}
                  {tab === "tailwind" && (
                    <>
                      <CopyButton getText={() => component.tailwind} label="Copy Tailwind" />
                      <DownloadButton
                        getText={() => component.tailwind}
                        filename="component-tailwind.html"
                        mime="text/html"
                        label="Download"
                      />
                    </>
                  )}
                  {tab === "react" && (
                    <>
                      <CopyButton getText={() => reactCode} label="Copy JSX" />
                      <DownloadButton
                        getText={() => reactCode}
                        filename="Component.tsx"
                        mime="text/plain"
                        label="Download"
                      />
                    </>
                  )}
                  <CopyButton getText={() => renderText([component])} label="Copy all" />
                  <DownloadButton
                    getText={() => renderMarkdown([component])}
                    filename="component.md"
                    mime="text/markdown"
                    label=".md"
                  />
                  <DownloadButton
                    getText={() => renderJson([component])}
                    filename="component.json"
                    mime="application/json"
                    label=".json"
                  />
                </div>
              </div>

              <div className="rounded border bg-background min-h-[260px] max-h-[480px] overflow-auto">
                {tab === "preview" && (
                  <iframe
                    title="Live preview"
                    srcDoc={previewDoc}
                    sandbox="allow-same-origin"
                    className="w-full h-[440px] bg-white"
                  />
                )}
                {tab === "html" && (
                  <pre className="text-xs font-mono p-3 whitespace-pre-wrap">{component.html}</pre>
                )}
                {tab === "css" && (
                  <pre className="text-xs font-mono p-3 whitespace-pre-wrap">{component.css}</pre>
                )}
                {tab === "tailwind" && (
                  <pre className="text-xs font-mono p-3 whitespace-pre-wrap">{component.tailwind}</pre>
                )}
                {tab === "react" && (
                  <pre className="text-xs font-mono p-3 whitespace-pre-wrap">{reactCode}</pre>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Optional LLM enhancement */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="flex items-center gap-1.5 text-sm font-semibold text-foreground w-full"
                onClick={() => setShowLlm((v) => !v)}
              >
                {showLlm ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Key className="h-4 w-4" /> Optional: Enhance with LLM (BYO API key)
              </button>
              {showLlm && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Paste your own OpenAI or Anthropic API key. Stored only in localStorage on this device. The tool builds an optimal prompt and parses the JSON response into an enhanced component.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="password"
                      placeholder="sk-... or anthropic key"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <div className="flex gap-2">
                      <select
                        value={llmProvider}
                        onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                        className="h-8 text-xs rounded border bg-background px-2 flex-1"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                      </select>
                      <Button size="sm" variant="outline" onClick={handleSaveLlmKey} className="h-8">Save key</Button>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleLlmEnhance}
                    disabled={llmLoading || !llmKey || !description.trim() || !component}
                    className="gap-1.5"
                  >
                    {llmLoading ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {llmLoading ? "Working…" : "Enhance with LLM"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    Scores are heuristics, not guarantees. Always review LLM output for accessibility and correctness.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Describe a UI component to generate"
          hint="Type a natural-language description (e.g., 'pricing card with toggle'), choose target (vanilla / Tailwind / inline), pick a variant, and click Generate. Live preview updates as you tweak the theme."
          icon={<LayoutTemplate className="h-8 w-8" />}
        />
      )}

      {faves.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Star className="h-4 w-4" /> Snippet library ({faves.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearFavorites}>Clear all</Button>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {faves.slice(0, 10).map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[f.type]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{VARIANT_LABELS[f.variant]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{TARGET_LABELS[f.target]}</Badge>
                  <span className="flex-1 truncate text-muted-foreground">{f.description}</span>
                  <span className="text-[10px] text-muted-foreground">{f.score}/100</span>
                  <button
                    aria-label="Remove from library"
                    onClick={() => handleRemoveFavorite(f.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
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
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/40 transition"
                  onClick={() => {
                    setDescription(h.description);
                    setVariant(h.variant);
                    setTarget(h.target);
                    handleGenerate({
                      description: h.description, variant: h.variant, target: h.target, theme, text: customText,
                    });
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{TYPE_LABELS[h.type]}</Badge>
                    <Badge variant="outline">{VARIANT_LABELS[h.variant]}</Badge>
                    <Badge variant="outline">{TARGET_LABELS[h.target]}</Badge>
                    <Badge variant="secondary">{h.score}/100</Badge>
                    <span className="font-medium text-foreground">{h.description}</span>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All keyword matching, HTML/CSS generation, theming, and refinement parsing runs locally in your browser. Descriptions never leave this device. The only network call is if you paste your own LLM API key and click &ldquo;Enhance with LLM&rdquo; — that request goes directly to your chosen provider. History and snippet library are stored in localStorage on this device only.
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
