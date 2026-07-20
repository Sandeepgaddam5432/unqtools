"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  SHADE_STEPS,
  HARMONY_LABELS,
  HARMONY_DESCRIPTIONS,
  COLOR_PRESETS,
  VIBE_PRESETS,
  DEFAULT_BASE,
  isValidHex,
  normalizeHex,
  hexToCssRgb,
  hexToCssHsl,
  generatePalette,
  generateHarmony,
  generateSystemPalette,
  contrastMatrix,
  computeStats,
  readableTextOn,
  renderTailwindV3,
  renderTailwindV4,
  renderCssVars,
  renderJson,
  renderSystemTailwindV3,
  renderSystemJson,
  renderText,
  renderMarkdown,
  randomBaseHex,
  rerollBase,
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
  buildPreviewHtml,
  LLM_KEY_STORAGE,
  type Harmony,
  type Palette,
  type SystemPalette,
  type HistoryEntry,
  type FavoriteEntry,
} from "./logic";
import {
  Palette as PaletteIcon, Sparkles, Key, History, Star, RefreshCw,
  Shuffle, Lock, Unlock, Copy, Eye, Moon, Sun, Contrast, Trash2,
} from "lucide-react";

type Tab = "palette" | "harmony" | "system" | "contrast" | "preview" | "export";
type ExportTab = "tw3" | "tw4" | "css" | "json" | "system" | "text" | "md";

export default function AiTailwindCssPaletteGenerator() {
  const [baseInput, setBaseInput] = useState(DEFAULT_BASE);
  const [harmony, setHarmony] = useState<Harmony>("monochrome");
  const [name, setName] = useState("primary");
  const [tab, setTab] = useState<Tab>("palette");
  const [exportTab, setExportTab] = useState<ExportTab>("tw3");
  const [darkPreview, setDarkPreview] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [faves, setFaves] = useState<FavoriteEntry[]>([]);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState<"none" | "hue" | "sat" | "light">("none");

  // LLM state
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [vibe, setVibe] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    setFaves(loadFavorites());
    const key = typeof localStorage !== "undefined" ? localStorage.getItem(LLM_KEY_STORAGE) : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.baseHex) setBaseInput(p.baseHex);
      if (p.harmony) setHarmony(p.harmony);
      if (p.name) setName(p.name);
      if (p.baseHex) toast.info("Loaded from share link");
    }
  }, []);

  const baseHex = useMemo(() => normalizeHex(baseInput) || DEFAULT_BASE, [baseInput]);
  const valid = useMemo(() => isValidHex(baseInput), [baseInput]);

  const palette = useMemo<Palette | null>(() => {
    if (!valid) return null;
    return generatePalette(baseHex, { name, harmony });
  }, [baseHex, name, harmony, valid]);

  const harmonies = useMemo<Palette[]>(() => {
    if (!valid) return [];
    return generateHarmony(baseHex, harmony);
  }, [baseHex, harmony, valid]);

  const system = useMemo<SystemPalette | null>(() => {
    if (!valid) return null;
    return generateSystemPalette(baseHex);
  }, [baseHex, valid]);

  const matrix = useMemo(() => palette ? contrastMatrix(palette) : null, [palette]);
  const stats = useMemo(() => palette ? computeStats(palette) : null, [palette]);
  const previewHtml = useMemo(
    () => palette ? buildPreviewHtml(palette, darkPreview) : "",
    [palette, darkPreview],
  );

  const exportText = useMemo(() => {
    if (!palette) return "";
    switch (exportTab) {
      case "tw3": return renderTailwindV3(palette, name);
      case "tw4": return renderTailwindV4(palette, name);
      case "css": return renderCssVars(palette, name);
      case "json": return renderJson(palette);
      case "system": return system ? renderSystemTailwindV3(system) : "";
      case "text": return renderText(palette);
      case "md": return renderMarkdown(palette);
      default: return "";
    }
  }, [palette, system, exportTab, name]);

  const handleSaveHistory = useCallback(() => {
    if (!valid) return;
    saveHistory({ ts: Date.now(), baseHex, harmony, name });
    setHistory(loadHistory());
  }, [valid, baseHex, harmony, name]);

  const handleClear = useCallback(() => {
    setBaseInput(DEFAULT_BASE);
    setHarmony("monochrome");
    setName("primary");
    setLocked("none");
    setError("");
    toast.info("Reset to default");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleRandomize = useCallback(() => {
    const next = rerollBase(baseHex, locked);
    setBaseInput(next);
    handleSaveHistory();
  }, [baseHex, locked, handleSaveHistory]);

  const handleSaveFavorite = useCallback(() => {
    if (!palette) return;
    saveFavorite({
      id: palette.id,
      ts: Date.now(),
      baseHex,
      harmony,
      name,
    });
    setFaves(loadFavorites());
    toast.success("Saved to favorites");
  }, [palette, baseHex, harmony, name]);

  const handleRemoveFavorite = useCallback((id: string) => {
    removeFavorite(id);
    setFaves(loadFavorites());
    toast.info("Removed from favorites");
  }, []);

  const handleClearFavorites = useCallback(() => {
    clearFavorites();
    setFaves([]);
    toast.success("Favorites cleared");
  }, []);

  const handleSaveLlmKey = () => {
    if (typeof localStorage !== "undefined") {
      if (llmKey) localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      else localStorage.removeItem(LLM_KEY_STORAGE);
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmSuggest = useCallback(async () => {
    if (!llmKey) {
      toast.error("Please paste your API key first");
      return;
    }
    if (!vibe.trim()) {
      toast.error("Describe a vibe first");
      return;
    }
    setLlmLoading(true);
    setError("");
    try {
      const prompt = buildLlmPrompt(vibe.trim());
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
            { role: "system", content: "You are a brand colorist who suggests one Tailwind-ready base color." },
            { role: "user", content: prompt },
          ],
          temperature: 0.6,
        };
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = {
          model: "claude-3-5-haiku-20241022",
          max_tokens: 800,
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
        toast.error(parsed.error);
        setLlmLoading(false);
        return;
      }
      setBaseInput(parsed.suggestion.hex);
      if (parsed.suggestion.name) setName(parsed.suggestion.name.toLowerCase().replace(/\s+/g, "-"));
      toast.success(`Suggested ${parsed.suggestion.hex} — ${parsed.suggestion.name}`);
      handleSaveHistory();
    } catch (e) {
      setError(`LLM request error: ${(e as Error).message}`);
      toast.error("LLM request error");
    }
    setLlmLoading(false);
  }, [llmKey, llmProvider, vibe, handleSaveHistory]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="ai-tw-base">Base color (hex)</Label>
              <Input
                id="ai-tw-base"
                value={baseInput}
                onChange={(e) => setBaseInput(e.target.value)}
                placeholder="#4f46e5"
                className={`font-mono text-sm ${!valid ? "border-destructive" : ""}`}
              />
              {!valid && (
                <p className="text-[11px] text-destructive">Enter a valid hex (e.g. #4f46e5 or #fff)</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={baseHex}
                onChange={(e) => setBaseInput(e.target.value)}
                className="h-10 w-14 rounded border cursor-pointer"
                aria-label="Pick base color"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRandomize}
                className="gap-1.5"
                title="Randomize base color (respects locked channel)"
              >
                <Shuffle className="h-3.5 w-3.5" /> Random
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLocked((p) => (p === "none" ? "hue" : p === "hue" ? "sat" : p === "sat" ? "light" : "none"));
                }}
                className="gap-1.5"
                title={`Lock: ${locked === "none" ? "none" : locked}`}
              >
                {locked === "none" ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {locked === "none" ? "Unlock" : `Lock ${locked}`}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ai-tw-name" className="text-xs">Color name (token prefix)</Label>
              <Input
                id="ai-tw-name"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="primary"
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Harmony</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(Object.keys(HARMONY_LABELS) as Harmony[]).map((h) => (
                  <Button
                    key={h}
                    variant={harmony === h ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setHarmony(h)}
                  >
                    {HARMONY_LABELS[h]}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {harmony !== "monochrome" && (
            <p className="text-[11px] text-muted-foreground">{HARMONY_DESCRIPTIONS[harmony]}</p>
          )}

          <div>
            <Label className="text-xs">Presets</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => { setBaseInput(p.hex); setName(p.name.toLowerCase()); }}
                  className="flex items-center gap-1.5 rounded border bg-background px-2 py-1 text-[11px] hover:bg-accent"
                  title={p.name}
                >
                  <span
                    className="h-3 w-3 rounded-sm border"
                    style={{ background: p.hex }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {palette ? (
        <>
          {/* Tabs */}
          <Card>
            <CardContent className="p-2">
              <div className="flex flex-wrap gap-1">
                {([
                  { k: "palette", label: "Palette", icon: <PaletteIcon className="h-3.5 w-3.5" /> },
                  { k: "harmony", label: `Harmony (${harmonies.length})`, icon: <Sparkles className="h-3.5 w-3.5" /> },
                  { k: "system", label: "System", icon: <Star className="h-3.5 w-3.5" /> },
                  { k: "contrast", label: "Contrast", icon: <Contrast className="h-3.5 w-3.5" /> },
                  { k: "preview", label: "Preview", icon: <Eye className="h-3.5 w-3.5" /> },
                  { k: "export", label: "Export", icon: <Copy className="h-3.5 w-3.5" /> },
                ] as { k: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
                  <Button
                    key={t.k}
                    variant={tab === t.k ? "default" : "ghost"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setTab(t.k)}
                  >
                    {t.icon} {t.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Palette tab */}
          {tab === "palette" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <PaletteIcon className="h-4 w-4" /> {name} palette · base {palette.baseHex}
                  </h3>
                  {stats && (
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className="text-[10px]">AA white: {stats.passingAaVsWhite}/11</Badge>
                      <Badge variant="outline" className="text-[10px]">AA black: {stats.passingAaVsBlack}/11</Badge>
                      <Badge variant="outline" className="text-[10px]">AAA white: {stats.passingAaaVsWhite}/11</Badge>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-11 gap-1 min-w-[600px] sm:min-w-0 overflow-x-auto">
                  {palette.shades.map((s) => {
                    const textColor = readableTextOn(s.hex);
                    return (
                      <button
                        key={s.step}
                        type="button"
                        className="rounded border text-xs font-mono p-2 flex flex-col items-center justify-end text-center"
                        style={{ background: s.hex, color: textColor, minHeight: "84px" }}
                        onClick={() => {
                          if (typeof navigator !== "undefined" && navigator.clipboard) {
                            navigator.clipboard.writeText(s.hex);
                            toast.success(`Copied ${s.hex}`);
                          }
                        }}
                        title={`${s.hex}\n${hexToCssRgb(s.hex)}\n${hexToCssHsl(s.hex)}`}
                      >
                        <span className="font-bold">{s.step}</span>
                        <span className="mt-1 text-[10px] opacity-90">{s.hex}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="rounded border bg-muted/30 p-2 text-[11px] text-muted-foreground font-mono">
                  base hsl({Math.round(palette.baseHsl.h)}, {Math.round(palette.baseHsl.s)}%, {Math.round(palette.baseHsl.l)}%)
                </div>
              </CardContent>
            </Card>
          )}

          {/* Harmony tab */}
          {tab === "harmony" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> {HARMONY_LABELS[harmony]} · {harmonies.length} palette(s)
                </h3>
                <div className="space-y-3">
                  {harmonies.map((p, idx) => (
                    <div key={p.id} className="rounded border p-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">#{idx + 1}</Badge>
                          <span className="font-mono text-xs font-medium">{p.name}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{p.baseHex}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => { setBaseInput(p.baseHex); setName(p.name); setHarmony("monochrome"); }}
                        >
                          Use as base
                        </Button>
                      </div>
                      <div className="grid grid-cols-11 gap-1">
                        {p.shades.map((s) => (
                          <div
                            key={s.step}
                            className="rounded text-[10px] font-mono p-1 text-center"
                            style={{ background: s.hex, color: readableTextOn(s.hex) }}
                            title={s.hex}
                          >
                            {s.step}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* System tab */}
          {tab === "system" && system && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Star className="h-4 w-4" /> System palette — brand + neutral + 4 status colors
                </h3>
                <div className="space-y-2">
                  {([
                    { p: system.brand, label: "Brand" },
                    { p: system.neutral, label: "Neutral" },
                    { p: system.success, label: "Success" },
                    { p: system.warning, label: "Warning" },
                    { p: system.danger, label: "Danger" },
                    { p: system.info, label: "Info" },
                  ]).map(({ p, label }) => (
                    <div key={p.id} className="rounded border p-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium">{label} <span className="font-mono text-[10px] text-muted-foreground">({p.baseHex})</span></span>
                      </div>
                      <div className="grid grid-cols-11 gap-1">
                        {p.shades.map((s) => (
                          <div
                            key={s.step}
                            className="rounded text-[10px] font-mono p-1 text-center"
                            style={{ background: s.hex, color: readableTextOn(s.hex) }}
                            title={s.hex}
                          >
                            {s.step}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contrast tab */}
          {tab === "contrast" && matrix && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Contrast className="h-4 w-4" /> WCAG 2.1 contrast per shade
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left">
                        <th className="p-1.5">Step</th>
                        <th className="p-1.5">Hex</th>
                        <th className="p-1.5">vs White</th>
                        <th className="p-1.5">vs Black</th>
                        <th className="p-1.5">Best text</th>
                      </tr>
                    </thead>
                    <tbody>
                      {palette.shades.map((s, i) => {
                        const w = matrix.vsWhite[i];
                        const b = matrix.vsBlack[i];
                        const best = w.ratio >= b.ratio ? "#ffffff" : "#000000";
                        return (
                          <tr key={s.step} className="border-t">
                            <td className="p-1.5 font-mono">{s.step}</td>
                            <td className="p-1.5">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-3 w-3 rounded-sm border" style={{ background: s.hex }} />
                                <span className="font-mono">{s.hex}</span>
                              </span>
                            </td>
                            <td className="p-1.5">
                              <span className={`font-mono ${w.aa ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                {w.ratio.toFixed(2)} {w.aaa ? "AAA" : w.aa ? "AA" : w.aaLarge ? "AA-L" : "—"}
                              </span>
                            </td>
                            <td className="p-1.5">
                              <span className={`font-mono ${b.aa ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                {b.ratio.toFixed(2)} {b.aaa ? "AAA" : b.aa ? "AA" : b.aaLarge ? "AA-L" : "—"}
                              </span>
                            </td>
                            <td className="p-1.5">
                              <span className="inline-flex items-center gap-1">
                                <span className="h-3 w-3 rounded-sm border" style={{ background: best }} />
                                <span className="font-mono">{best}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  AA = 4.5:1 (body text) · AAA = 7:1 · AA-L = 3:1 (large text). Always verify in your real design.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Preview tab */}
          {tab === "preview" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Eye className="h-4 w-4" /> Live component preview
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDarkPreview((d) => !d)}
                    className="gap-1.5"
                  >
                    {darkPreview ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                    {darkPreview ? "Dark" : "Light"}
                  </Button>
                </div>
                <iframe
                  title="Palette preview"
                  srcDoc={previewHtml}
                  sandbox="allow-same-origin"
                  className="w-full h-[260px] rounded border bg-background"
                />
              </CardContent>
            </Card>
          )}

          {/* Export tab */}
          {tab === "export" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Copy className="h-4 w-4" /> Export palette
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { k: "tw3", label: "Tailwind v3" },
                    { k: "tw4", label: "Tailwind v4" },
                    { k: "css", label: "CSS vars" },
                    { k: "json", label: "JSON tokens" },
                    { k: "system", label: "System v3" },
                    { k: "text", label: "Text" },
                    { k: "md", label: "Markdown" },
                  ] as { k: ExportTab; label: string }[]).map((t) => (
                    <Button
                      key={t.k}
                      variant={exportTab === t.k ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setExportTab(t.k)}
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
                <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre">
                  {exportText}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => { handleSaveHistory(); return exportText; }} label="Copy" />
                  <DownloadButton
                    getText={() => exportText}
                    filename={
                      exportTab === "tw3" ? "tailwind.config.js" :
                      exportTab === "tw4" ? "tailwind.v4.css" :
                      exportTab === "css" ? "palette.css" :
                      exportTab === "json" ? "palette.json" :
                      exportTab === "system" ? "tailwind.system.config.js" :
                      exportTab === "md" ? "palette.md" : "palette.txt"
                    }
                    mime={
                      exportTab === "json" ? "application/json" :
                      exportTab === "tw3" || exportTab === "system" ? "text/javascript" :
                      exportTab === "tw4" || exportTab === "css" ? "text/css" :
                      "text/plain"
                    }
                    label="Download"
                  />
                  <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ baseHex, harmony, name }); }} />
                  <Button variant="outline" size="sm" onClick={handleSaveFavorite} className="gap-1.5">
                    <Star className="h-3.5 w-3.5" /> Save to favorites
                  </Button>
                  <ClearButton onClick={handleClear} />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Enter a base color to generate a Tailwind palette"
          hint="Paste a hex code (#4f46e5) or pick a color. The tool generates 11 perceptual shades 50–950, harmony sets, system colors, contrast checks, and copy-ready exports."
          icon={<PaletteIcon className="h-8 w-8" />}
        />
      )}

      {/* Optional LLM */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Optional: suggest base from vibe (BYO key)
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setShowLlm((s) => !s)} className="gap-1.5">
              <Key className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Show"}
            </Button>
          </div>
          {showLlm && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {VIBE_PRESETS.map((v) => (
                  <Button
                    key={v}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => setVibe(v)}
                  >+ {v}</Button>
                ))}
              </div>
              <Input
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                placeholder="e.g., calm fintech app"
                className="h-8 text-xs"
              />
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                <Input
                  type="password"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  placeholder="Paste your OpenAI / Anthropic API key (stored locally)"
                  className="h-8 text-xs font-mono"
                />
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={handleSaveLlmKey} className="h-8">Save key</Button>
                  <Button
                    size="sm"
                    onClick={handleLlmSuggest}
                    disabled={llmLoading}
                    className="h-8 gap-1.5"
                  >
                    {llmLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Suggest
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                The LLM only suggests a base color — all shade math stays local. Your key never leaves this device.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Favorites */}
      {faves.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Star className="h-4 w-4" /> Favorites ({faves.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearFavorites} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Clear all
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {faves.map((f) => (
                <div key={f.id} className="rounded border p-2 flex items-center gap-2">
                  <span className="h-8 w-8 rounded border" style={{ background: f.baseHex }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono truncate">{f.baseHex}</div>
                    <div className="text-[10px] text-muted-foreground">{f.name} · {HARMONY_LABELS[f.harmony]}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => { setBaseInput(f.baseHex); setName(f.name); setHarmony(f.harmony); }}
                  >
                    Load
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7"
                    onClick={() => handleRemoveFavorite(f.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-2">
                  <span className="h-4 w-4 rounded border" style={{ background: h.baseHex }} />
                  <span className="font-mono">{h.baseHex}</span>
                  <Badge variant="outline" className="text-[10px]">{HARMONY_LABELS[h.harmony]}</Badge>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => { setBaseInput(h.baseHex); setName(h.name); setHarmony(h.harmony); }}
                  >
                    Load
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All color math, harmony generation, contrast checks, and exports run locally in your browser. Nothing is uploaded. The only network call is if you paste your own LLM key and click Suggest.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            <strong className="text-foreground">Honesty:</strong> Generated scales are a strong starting point. Verify contrast in your real designs before shipping to production.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
