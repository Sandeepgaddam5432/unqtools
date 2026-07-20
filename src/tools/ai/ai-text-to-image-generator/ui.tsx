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
  STYLE_PRESETS,
  ASPECT_RATIOS,
  LIGHTING_PRESETS,
  MOOD_PRESETS,
  NEGATIVE_PRESETS,
  DEFAULT_OPTIONS,
  SAMPLE_PROMPTS,
  generateAllPrompts,
  parsePromptToOptions,
  validatePrompt,
  renderText,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildDallEImageRequest,
  extractImageUrlFromResponse,
  type BuildOptions,
  type StylePreset,
  type AspectRatio,
  type LightingPreset,
  type MoodPreset,
  type NegativePreset,
  type HistoryEntry,
  type ModelPrompt,
} from "./logic";
import {
  ImagePlus, History, Sparkles, KeyRound, Loader2, AlertTriangle, Wand2,
} from "lucide-react";

const STYLE_LIST: StylePreset[] = Object.keys(STYLE_PRESETS) as StylePreset[];
const AR_LIST: AspectRatio[] = Object.keys(ASPECT_RATIOS) as AspectRatio[];
const LIGHT_LIST: LightingPreset[] = Object.keys(LIGHTING_PRESETS) as LightingPreset[];
const MOOD_LIST: MoodPreset[] = Object.keys(MOOD_PRESETS) as MoodPreset[];
const NEG_LIST: NegativePreset[] = Object.keys(NEGATIVE_PRESETS) as NegativePreset[];

export default function AiTextToImageGenerator() {
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState<StylePreset>(DEFAULT_OPTIONS.style);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(DEFAULT_OPTIONS.aspectRatio);
  const [lighting, setLighting] = useState<LightingPreset>(DEFAULT_OPTIONS.lighting);
  const [mood, setMood] = useState<MoodPreset>(DEFAULT_OPTIONS.mood);
  const [negativePresets, setNegativePresets] = useState<NegativePreset[]>(DEFAULT_OPTIONS.negativePresets);
  const [customNegative, setCustomNegative] = useState("");
  const [seed, setSeed] = useState<number | null>(null);
  const [quality, setQuality] = useState<"draft" | "standard" | "high">(DEFAULT_OPTIONS.quality);
  const [stylize, setStylize] = useState(DEFAULT_OPTIONS.stylize);
  const [version, setVersion] = useState(DEFAULT_OPTIONS.version);
  const [detail, setDetail] = useState(DEFAULT_OPTIONS.detail);
  const [apiKey, setApiKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.description !== undefined) setDescription(p.description);
      if (p.style) setStyle(p.style);
      if (p.aspectRatio) setAspectRatio(p.aspectRatio);
      if (p.lighting) setLighting(p.lighting);
      if (p.mood) setMood(p.mood);
      if (p.seed !== undefined) setSeed(p.seed);
      if (p.quality) setQuality(p.quality);
      if (p.stylize !== undefined) setStylize(p.stylize);
      if (p.version !== undefined) setVersion(p.version);
      if (p.detail !== undefined) setDetail(p.detail);
      if (p.description) toast.info("Loaded from share link");
    }
  }, []);

  const options: BuildOptions = useMemo(
    () => ({
      description,
      style,
      aspectRatio,
      lighting,
      mood,
      negativePresets,
      customNegative,
      seed,
      quality,
      stylize,
      version,
      detail,
    }),
    [description, style, aspectRatio, lighting, mood, negativePresets, customNegative, seed, quality, stylize, version, detail],
  );

  const result = useMemo(() => generateAllPrompts(options), [options]);
  const validation = useMemo(() => validatePrompt(options), [options]);

  const handleAutoDetect = useCallback(() => {
    if (!description) {
      toast.error("Enter a description first");
      return;
    }
    const detected = parsePromptToOptions(description);
    if (Object.keys(detected).length === 0) {
      toast.info("No style / aspect / mood keywords detected");
      return;
    }
    if (detected.style) setStyle(detected.style);
    if (detected.aspectRatio) setAspectRatio(detected.aspectRatio);
    if (detected.lighting) setLighting(detected.lighting);
    if (detected.mood) setMood(detected.mood);
    toast.success("Auto-detected options from description");
  }, [description]);

  const handleSaveHistory = useCallback(() => {
    if (!description) return;
    saveHistory({
      ts: Date.now(),
      description,
      style,
      aspectRatio,
      seed,
    });
    setHistory(loadHistory());
  }, [description, style, aspectRatio, seed]);

  const handleClear = useCallback(() => {
    setDescription("");
    setCustomNegative("");
    setImageUrl("");
    setSeed(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const toggleNegative = (n: NegativePreset) => {
    setNegativePresets((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
    );
  };

  const handleGenerateImage = useCallback(async () => {
    if (!apiKey) {
      toast.error("Paste your OpenAI API key first");
      return;
    }
    if (!description) {
      toast.error("Enter a description first");
      return;
    }
    setLlmLoading(true);
    setImageUrl("");
    try {
      const req = buildDallEImageRequest(options);
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        const txt = await res.text();
        toast.error(`API error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      const json = await res.json();
      const url = extractImageUrlFromResponse(json);
      if (url) {
        setImageUrl(url);
        toast.success("Image generated");
        handleSaveHistory();
      } else {
        toast.error("No image URL in response");
      }
    } catch (e) {
      toast.error(`Could not reach API: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
    }
  }, [apiKey, description, options, handleSaveHistory]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="t2i-desc">Describe your image</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] gap-1"
                onClick={handleAutoDetect}
                disabled={!description}
              >
                <Wand2 className="h-3 w-3" /> Auto-detect options
              </Button>
            </div>
            <Textarea
              id="t2i-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={"A serene mountain lake at dawn with mist rising from the water..."}
              className="min-h-[100px] resize-y text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {SAMPLE_PROMPTS.map((s) => (
                <Button
                  key={s.label}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setDescription(s.text)}
                >+ {s.label}</Button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Style</Label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as StylePreset)}
                className="mt-1 w-full h-9 text-sm rounded border bg-background px-2"
              >
                {STYLE_LIST.map((s) => (
                  <option key={s} value={s}>{STYLE_PRESETS[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Aspect ratio</Label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                className="mt-1 w-full h-9 text-sm rounded border bg-background px-2"
              >
                {AR_LIST.map((a) => (
                  <option key={a} value={a}>{ASPECT_RATIOS[a].label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Lighting</Label>
              <select
                value={lighting}
                onChange={(e) => setLighting(e.target.value as LightingPreset)}
                className="mt-1 w-full h-9 text-sm rounded border bg-background px-2"
              >
                {LIGHT_LIST.map((l) => (
                  <option key={l} value={l}>{LIGHTING_PRESETS[l].label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Mood</Label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value as MoodPreset)}
                className="mt-1 w-full h-9 text-sm rounded border bg-background px-2"
              >
                {MOOD_LIST.map((m) => (
                  <option key={m} value={m}>{MOOD_PRESETS[m].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Quality</Label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as "draft" | "standard" | "high")}
                className="mt-1 w-full h-9 text-sm rounded border bg-background px-2"
              >
                <option value="draft">Draft</option>
                <option value="standard">Standard</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Detail boost ({detail})</Label>
              <input
                type="range"
                min={1}
                max={5}
                value={detail}
                onChange={(e) => setDetail(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </div>
            <div>
              <Label className="text-xs">MJ --v</Label>
              <Input
                type="number"
                value={version}
                min={1}
                max={10}
                onChange={(e) => setVersion(Number(e.target.value) || 6)}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">MJ --stylize</Label>
              <Input
                type="number"
                value={stylize}
                min={0}
                max={1000}
                onChange={(e) => setStylize(Number(e.target.value) || 0)}
                className="mt-1 h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Seed (optional, for reproducibility)</Label>
              <Input
                type="number"
                value={seed ?? ""}
                onChange={(e) => setSeed(e.target.value === "" ? null : Number(e.target.value))}
                placeholder="random"
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Custom negative prompt (comma-separated)</Label>
              <Input
                value={customNegative}
                onChange={(e) => setCustomNegative(e.target.value)}
                placeholder="e.g. ugly, deformed, blurry"
                className="mt-1 h-9 text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Negative-prompt presets</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {NEG_LIST.filter((n) => n !== "none").map((n) => (
                <label key={n} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={negativePresets.includes(n)}
                    onChange={() => toggleNegative(n)}
                  />
                  {NEGATIVE_PRESETS[n].label}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {description ? (
        <>
          {validation.warnings.length > 0 && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <ul className="space-y-0.5">
                  {validation.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total tokens" value={result.stats.totalTokens} />
                <Stat label="DALL·E tokens" value={result.stats.byModel["dall-e-3"]} />
                <Stat label="SD tokens" value={result.stats.byModel["stable-diffusion"]} />
                <Stat label="MJ tokens" value={result.stats.byModel["midjourney"]} />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {result.prompts.map((p) => (
              <PromptCard key={p.model} prompt={p} />
            ))}
          </div>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return renderText(result); }}
                  label="Copy all prompts"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return renderText(result); }}
                  filename="image-prompts.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => renderJson(result)}
                  filename="image-prompts.json"
                  mime="application/json"
                  label="Download JSON"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({
                      description,
                      style,
                      aspectRatio,
                      lighting,
                      mood,
                      seed,
                      quality,
                      stylize,
                      version,
                      detail,
                    });
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <KeyRound className="h-4 w-4" /> Optional: generate with your OpenAI DALL·E 3 key
              </div>
              <p className="text-xs text-muted-foreground">
                Paste an OpenAI API key with image-generation access to call DALL·E 3 directly. The key is used only from your browser — it is never sent to us.
              </p>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="h-8 text-xs font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={llmLoading || !apiKey || !description}
                onClick={handleGenerateImage}
              >
                {llmLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                {llmLoading ? "Generating…" : "Generate with DALL·E 3"}
              </Button>
              {imageUrl && (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="Generated"
                    className="max-w-full rounded border"
                  />
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Open image in new tab
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Describe an image to build optimized prompts"
          hint="We'll generate tailored prompts for DALL·E 3, Stable Diffusion, and Midjourney with style presets, aspect ratios, lighting, mood, and seed reproducibility. 100% on-device."
          icon={<ImagePlus className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{STYLE_PRESETS[h.style].label}</Badge>
                  <Badge variant="outline" className="mr-2">{h.aspectRatio}</Badge>
                  {h.seed !== null && <Badge variant="outline" className="mr-2">seed:{h.seed}</Badge>}
                  <span className="text-muted-foreground">{h.description.slice(0, 60)}{h.description.length > 60 ? "…" : ""}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">Honesty:</strong> This tool builds optimized prompts — it does not generate images without your own API key. On-device prompt engineering is rule-based and works best for descriptive prompts. The optional DALL·E 3 call goes directly from your browser to OpenAI; we never proxy or log prompts.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PromptCard({ prompt }: { prompt: ModelPrompt }) {
  const label =
    prompt.model === "dall-e-3"
      ? "DALL·E 3"
      : prompt.model === "stable-diffusion"
        ? "Stable Diffusion"
        : "Midjourney";

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-[10px]">{prompt.tokens} tokens</Badge>
            <Badge variant="outline" className="text-[10px]">{prompt.characters} chars</Badge>
          </div>
        </div>
        <div className="rounded border bg-background p-3 text-sm font-mono whitespace-pre-wrap">
          {prompt.prompt || <span className="text-muted-foreground font-sans">No prompt.</span>}
        </div>
        {prompt.negativePrompt && (
          <div>
            <Label className="text-xs">Negative prompt</Label>
            <div className="rounded border bg-background p-2 text-xs font-mono whitespace-pre-wrap mt-1">
              {prompt.negativePrompt}
            </div>
          </div>
        )}
        {prompt.parameters && (
          <div>
            <Label className="text-xs">Parameters</Label>
            <div className="rounded border bg-background p-2 text-xs font-mono mt-1">
              {prompt.parameters}
            </div>
          </div>
        )}
        {prompt.notes.length > 0 && (
          <ul className="text-[11px] text-muted-foreground space-y-0.5">
            {prompt.notes.map((n, i) => (
              <li key={i}>• {n}</li>
            ))}
          </ul>
        )}
        <div className="flex gap-2 pt-1">
          <CopyButton getText={() => prompt.prompt} label="Copy prompt" />
          {prompt.negativePrompt && (
            <CopyButton getText={() => prompt.negativePrompt ?? ""} label="Copy negative" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
