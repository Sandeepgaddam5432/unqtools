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
  PALETTES,
  PALETTE_BY_NAME,
  parseColors,
  paletteFromInput,
  generateSvg,
  minifySvg,
  validateSvg,
  svgToReactComponent,
  renderPngAsync,
  buildLlmRequestBody,
  extractSvgFromLlmResponse,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  parsePromptToOptions,
  type ArtStyle,
  type PatternKind,
  type IconShape,
  type SvgOptions,
  type Palette,
  type HistoryEntry,
} from "./logic";
import {
  Shapes, History, Wand2, Code2, Image as ImageIcon, AlertTriangle, Sparkles,
} from "lucide-react";

const STYLES: ArtStyle[] = ["geometric", "mandala", "pattern", "landscape", "icon"];
const PATTERNS: PatternKind[] = ["dots", "hex-tiles", "chevrons", "waves", "triangles"];
const ICONS: IconShape[] = ["heart", "star", "leaf", "lightning", "badge", "hex-flower"];

export default function AiSvgVectorArtGenerator() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<ArtStyle>("geometric");
  const [pattern, setPattern] = useState<PatternKind>("dots");
  const [icon, setIcon] = useState<IconShape>("heart");
  const [paletteName, setPaletteName] = useState<string>(PALETTES[0].name);
  const [customColors, setCustomColors] = useState("");
  const [customBg, setCustomBg] = useState("#ffffff");
  const [useCustom, setUseCustom] = useState(false);
  const [seed, setSeed] = useState(42);
  const [complexity, setComplexity] = useState(5);
  const [width, setWidth] = useState(400);
  const [height, setHeight] = useState(400);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fill, setFill] = useState(true);
  const [rounded, setRounded] = useState(false);
  const [minified, setMinified] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [svg, setSvg] = useState("");
  const [stats, setStats] = useState<{ bytes: number; pathCount: number; seed: number } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.style) setStyle(p.style);
      if (p.seed !== undefined) setSeed(p.seed);
      if (p.complexity !== undefined) setComplexity(p.complexity);
      if (p.paletteName) setPaletteName(p.paletteName);
      if (p.pattern) setPattern(p.pattern);
      if (p.icon) setIcon(p.icon);
      if (p.prompt) setPrompt(p.prompt);
      if (p.style || p.prompt) toast.info("Loaded from share link");
    }
  }, []);

  const palette: Palette = useMemo(() => {
    if (useCustom) return paletteFromInput(customBg, customColors, "custom");
    return PALETTE_BY_NAME[paletteName] ?? PALETTES[0];
  }, [useCustom, customBg, customColors, paletteName]);

  const opts: SvgOptions = useMemo(() => ({
    style,
    width,
    height,
    complexity,
    seed,
    palette,
    strokeWidth,
    fill,
    rounded,
    pattern,
    icon,
  }), [style, width, height, complexity, seed, palette, strokeWidth, fill, rounded, pattern, icon]);

  const finalSvg = useMemo(() => {
    if (!svg) return "";
    return minified ? minifySvg(svg) : svg;
  }, [svg, minified]);

  const validation = useMemo(() => (finalSvg ? validateSvg(finalSvg) : null), [finalSvg]);

  const handleGenerate = useCallback(() => {
    const r = generateSvg(opts);
    setSvg(r.svg);
    setStats({ bytes: r.bytes, pathCount: r.pathCount, seed: r.seed });
    setWarnings(r.warnings);
    saveHistory({ ts: Date.now(), style, seed: r.seed, bytes: r.bytes, prompt });
    setHistory(loadHistory());
    if (r.warnings.length > 0) toast.info(`Generated with ${r.warnings.length} warning(s)`);
    else toast.success(`Generated ${r.pathCount} shapes`);
  }, [opts, style, prompt]);

  const handlePromptParse = useCallback(() => {
    if (!prompt.trim()) {
      toast.error("Enter a prompt first");
      return;
    }
    const o = parsePromptToOptions(prompt);
    let changed: string[] = [];
    if (o.style) { setStyle(o.style); changed.push(`style=${o.style}`); }
    if (o.complexity !== undefined) { setComplexity(o.complexity); changed.push(`complexity=${o.complexity}`); }
    if (o.palette) { setPaletteName(o.palette.name); setUseCustom(false); changed.push(`palette=${o.palette.name}`); }
    if (o.pattern) { setPattern(o.pattern); changed.push(`pattern=${o.pattern}`); }
    if (o.icon) { setIcon(o.icon); changed.push(`icon=${o.icon}`); }
    toast.success(`Parsed: ${changed.join(", ") || "no signals"}`);
  }, [prompt]);

  const handleRandomize = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 1_000_000);
    setSeed(newSeed);
    toast.info(`New seed: ${newSeed}`);
  }, []);

  const handleLlmEnhance = useCallback(async () => {
    if (!apiKey.trim()) { toast.error("Paste an API key to use LLM enhancement"); return; }
    if (!prompt.trim()) { toast.error("Enter a prompt first"); return; }
    setLlmLoading(true);
    try {
      const body = buildLlmRequestBody({ prompt, apiKey, style, colors: palette.colors });
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body,
      });
      if (!res.ok) {
        toast.error(`LLM error: ${res.status}`);
        return;
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content ?? "";
      const extracted = extractSvgFromLlmResponse(text);
      if (!extracted) {
        toast.error("LLM response contained no <svg> block");
        return;
      }
      setSvg(extracted);
      setStats({ bytes: extracted.length, pathCount: 0, seed });
      setWarnings([]);
      saveHistory({ ts: Date.now(), style, seed, bytes: extracted.length, prompt: `[LLM] ${prompt}` });
      setHistory(loadHistory());
      toast.success("LLM-enhanced SVG applied");
    } catch (e) {
      toast.error(`LLM fetch failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
    }
  }, [apiKey, prompt, style, palette, seed]);

  const handleDownloadPng = useCallback(async () => {
    if (!finalSvg) return;
    const dataUrl = await renderPngAsync(finalSvg, 2);
    if (!dataUrl) { toast.error("PNG rasterization not available"); return; }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "vector-art.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Downloaded PNG");
  }, [finalSvg]);

  const handleClear = useCallback(() => {
    setSvg("");
    setStats(null);
    setWarnings([]);
    setPrompt("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const reactComponent = useMemo(() => (finalSvg ? svgToReactComponent(finalSvg, "VectorArt") : ""), [finalSvg]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="svgart-prompt">Prompt (optional — describes what to make)</Label>
            <Textarea
              id="svgart-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={"dense neon mandala\nsimple sunset landscape\nhex tile pattern with autumn colors"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handlePromptParse} className="gap-1.5">
                <Wand2 className="h-3.5 w-3.5" /> Parse prompt
              </Button>
              <Button variant="outline" size="sm" onClick={handleRandomize} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Randomize seed
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Style</Label>
              <select value={style} onChange={(e) => setStyle(e.target.value as ArtStyle)} className="w-full h-9 text-xs rounded border bg-background px-2 mt-1">
                {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Palette preset</Label>
              <select
                value={paletteName}
                onChange={(e) => { setPaletteName(e.target.value); setUseCustom(false); }}
                disabled={useCustom}
                className="w-full h-9 text-xs rounded border bg-background px-2 mt-1 disabled:opacity-50"
              >
                {PALETTES.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">Seed</Label>
              <Input
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                className="h-9 text-xs mt-1"
              />
            </div>
          </div>

          {style === "pattern" && (
            <div>
              <Label className="text-xs">Pattern kind</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {PATTERNS.map((p) => (
                  <Button
                    key={p}
                    variant={pattern === p ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setPattern(p)}
                  >{p}</Button>
                ))}
              </div>
            </div>
          )}

          {style === "icon" && (
            <div>
              <Label className="text-xs">Icon shape</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {ICONS.map((i) => (
                  <Button
                    key={i}
                    variant={icon === i ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setIcon(i)}
                  >{i}</Button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Complexity (1-10): {complexity}</Label>
              <input
                type="range"
                min={1}
                max={10}
                value={complexity}
                onChange={(e) => setComplexity(parseInt(e.target.value, 10))}
                className="w-full mt-2"
              />
            </div>
            <div>
              <Label className="text-xs">Width</Label>
              <Input type="number" value={width} onChange={(e) => setWidth(parseInt(e.target.value, 10) || 400)} className="h-9 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Height</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value, 10) || 400)} className="h-9 text-xs mt-1" />
            </div>
            <div>
              <Label className="text-xs">Stroke width</Label>
              <Input type="number" step="0.5" value={strokeWidth} onChange={(e) => setStrokeWidth(parseFloat(e.target.value) || 1)} className="h-9 text-xs mt-1" />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} /> Fill
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={rounded} onChange={(e) => setRounded(e.target.checked)} /> Rounded joins
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={minified} onChange={(e) => setMinified(e.target.checked)} /> Minify output
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} /> Custom colors
            </label>
          </div>

          {useCustom && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Background hex</Label>
                <Input value={customBg} onChange={(e) => setCustomBg(e.target.value)} placeholder="#ffffff" className="h-9 text-xs mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-xs">Colors (space or comma separated)</Label>
                <Input
                  value={customColors}
                  onChange={(e) => setCustomColors(e.target.value)}
                  placeholder="#ff6b6b #feca57"
                  className="h-9 text-xs mt-1 font-mono"
                />
                <div className="text-[10px] text-muted-foreground mt-1">
                  Parsed: {parseColors(customColors).length} valid colors
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={handleGenerate} className="gap-1.5">
              <Shapes className="h-3.5 w-3.5" /> Generate SVG
            </Button>
            <ClearButton onClick={handleClear} disabled={!svg && !prompt} />
          </div>
        </CardContent>
      </Card>

      {finalSvg ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4" /> Preview
                </h3>
                {stats && (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">{stats.pathCount} shapes</Badge>
                    <Badge variant="secondary" className="text-[10px]">{stats.bytes} bytes</Badge>
                    <Badge variant="outline" className="text-[10px]">seed {stats.seed}</Badge>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center rounded-lg border bg-background p-4 overflow-auto" style={{ maxHeight: 400 }}>
                <div
                  className="max-w-full"
                  style={{ maxWidth: "100%" }}
                  // Render the SVG via dangerouslySetInnerHTML — generated locally, trusted.
                  dangerouslySetInnerHTML={{ __html: finalSvg }}
                />
              </div>
              {validation && !validation.valid && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{validation.errors.join("; ")}</span>
                </div>
              )}
              {validation && validation.warnings.length > 0 && (
                <div className="rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
                  {validation.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                </div>
              )}
              {warnings.length > 0 && (
                <div className="rounded border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                  {warnings.map((w, i) => <div key={i}>• {w}</div>)}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton getText={() => finalSvg} label="Copy SVG" />
                <DownloadButton getText={() => finalSvg} filename="vector-art.svg" mime="image/svg+xml" label="Download SVG" />
                <Button variant="outline" size="sm" onClick={handleDownloadPng} className="gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" /> Download PNG
                </Button>
                <CopyButton getText={() => reactComponent} label="Copy React" />
                <DownloadButton getText={() => reactComponent} filename="VectorArt.tsx" mime="text/typescript" label="Download .tsx" />
                <ShareButton getUrl={() => buildShareUrl({ style, seed, complexity, paletteName, pattern, icon, prompt })} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Code2 className="h-4 w-4" /> SVG source
              </h3>
              <pre className="max-h-[260px] overflow-auto rounded border bg-muted/40 p-3 text-[10px] font-mono whitespace-pre-wrap break-all">
                {finalSvg}
              </pre>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Generate SVG vector art"
          hint="Pick a style + palette, optionally describe what you want in the prompt, then click Generate. Same seed reproduces the same art."
          icon={<Shapes className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Wand2 className="h-4 w-4" /> Optional BYO-key LLM enhancement
          </h3>
          <p className="text-xs text-muted-foreground">
            On-device templates are best for icons, simple shapes, and decorative art. For complex illustrative work, paste an OpenAI API key (kept in memory only — never stored) and the prompt will be sent directly from your browser.
          </p>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            className="h-9 text-xs font-mono"
          />
          <Button variant="outline" size="sm" onClick={handleLlmEnhance} disabled={llmLoading} className="gap-1.5">
            {llmLoading ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {llmLoading ? "Calling LLM…" : "Enhance with LLM"}
          </Button>
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
                  <Badge variant="outline" className="mr-2">{h.style}</Badge>
                  <Badge variant="outline" className="mr-2">seed {h.seed}</Badge>
                  <Badge variant="outline" className="mr-2">{h.bytes}B</Badge>
                  <span className="text-muted-foreground">{h.prompt || "(no prompt)"}</span>
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
            <strong className="text-foreground">Privacy & honesty:</strong> All generation runs locally in your browser — your prompt and colors never leave this device unless you explicitly paste an API key for LLM enhancement (and even then the request goes directly to the model endpoint you specify). The on-device path is best for icons / simple shapes / decorative art; complex illustrative work genuinely needs a capable model — we say so plainly rather than shipping messy SVGs. No watermark, no forced sign-up, no upload. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
