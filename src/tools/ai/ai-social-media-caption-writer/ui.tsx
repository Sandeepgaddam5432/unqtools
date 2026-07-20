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
  PLATFORM_LABELS,
  TONE_LABELS,
  EMOJI_DENSITY_LABELS,
  CTA_LABELS,
  NICHE_PRESETS,
  PLATFORM_CHAR_LIMIT,
  PLATFORM_SOFT_TARGET,
  PLATFORM_HASHTAG_MAX,
  PLATFORM_STYLE_HINTS,
  SHADOWBAN_RISK_TAGS,
  clean,
  countChars,
  suggestHashtags,
  suggestBrandedHashtags,
  flagShadowban,
  generateCaptions,
  generateAbPair,
  generateThread,
  generateCarousel,
  computeStats,
  renderText,
  renderMarkdown,
  renderCsv,
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
  type Platform,
  type Tone,
  type Cta,
  type EmojiDensity,
  type CaptionVariant,
  type AbPair,
  type ThreadTweet,
  type HistoryEntry,
  type FavoriteEntry,
  type ShareState,
} from "./logic";
import {
  PenTool, Sparkles, Key, History, Hash, FlaskConical,
  AlertCircle, Star, Trash2, MessageSquare, Layers, AlertTriangle,
} from "lucide-react";

type Tab = "captions" | "thread" | "carousel" | "ab";

export default function AiSocialMediaCaptionWriter() {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [tone, setTone] = useState<Tone>("bold");
  const [cta, setCta] = useState<Cta>("link-in-bio");
  const [emojiDensity, setEmojiDensity] = useState<EmojiDensity>("medium");
  const [topic, setTopic] = useState("");
  const [accountName, setAccountName] = useState("");
  const [variants, setVariants] = useState<CaptionVariant[]>([]);
  const [abPair, setAbPair] = useState<AbPair | null>(null);
  const [thread, setThread] = useState<ThreadTweet[]>([]);
  const [carousel, setCarousel] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("captions");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [faves, setFaves] = useState<FavoriteEntry[]>([]);
  const [error, setError] = useState("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);

  useEffect(() => {
    setHistory(loadHistory());
    setFaves(loadFavorites());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-social-caption:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.platform) setPlatform(p.platform);
      if (p.tone) setTone(p.tone);
      if (p.cta) setCta(p.cta);
      if (p.emojiDensity) setEmojiDensity(p.emojiDensity);
      if (p.topic) setTopic(p.topic);
      if (p.accountName) setAccountName(p.accountName);
      if (p.topic || p.accountName) toast.info("Loaded from share link");
    }
  }, []);

  const handleGenerate = useCallback(() => {
    const tp = clean(topic);
    if (!tp) {
      setError("Enter a topic to generate captions.");
      toast.error("Enter a topic first");
      return;
    }
    setError("");
    const out = generateCaptions(platform, tone, cta, emojiDensity, tp, clean(accountName) || undefined, 5);
    setVariants(out);
    setAbPair(generateAbPair(platform, tone, cta, emojiDensity, tp, clean(accountName) || undefined));
    setThread(generateThread(tp, tone, cta, emojiDensity, 5));
    setCarousel(generateCarousel(tp, tone, cta, emojiDensity, 6));
    setTab("captions");
    saveHistory({
      ts: Date.now(),
      platform, tone, cta, emojiDensity, topic: tp,
      accountName: clean(accountName), variantCount: out.length,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${out.length} captions`);
  }, [platform, tone, cta, emojiDensity, topic, accountName]);

  const stats = useMemo(() => computeStats(variants), [variants]);
  const hashtagPool = useMemo(
    () => suggestHashtags(clean(topic), 30),
    [topic],
  );
  const brandedPool = useMemo(
    () => suggestBrandedHashtags(clean(accountName), clean(topic), 5),
    [accountName, topic],
  );
  const flaggedPool = useMemo(
    () => flagShadowban([...hashtagPool, ...brandedPool]),
    [hashtagPool, brandedPool],
  );

  const shareState: ShareState = { platform, tone, cta, emojiDensity, topic, accountName };

  const handleClear = useCallback(() => {
    setVariants([]);
    setAbPair(null);
    setThread([]);
    setCarousel([]);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveFavorite = useCallback((v: CaptionVariant) => {
    saveFavorite({
      ts: Date.now(),
      platform: v.platform,
      tone: v.tone,
      cta: v.cta,
      emojiDensity: v.emojiDensity,
      text: v.text,
      topic: clean(topic),
    });
    setFaves(loadFavorites());
    toast.success("Saved to favorites");
  }, [topic]);

  const handleRemoveFavorite = useCallback((ts: number) => {
    removeFavorite(ts);
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
      if (llmKey) localStorage.setItem("unqtools:ai-social-caption:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-social-caption:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Please paste your API key first");
      return;
    }
    const tp = clean(topic);
    if (!tp) {
      toast.error("Enter a topic first");
      return;
    }
    setLlmLoading(true);
    setError("");
    try {
      const prompt = buildLlmPrompt(platform, tone, cta, emojiDensity, tp, clean(accountName));
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
            { role: "system", content: "You are an expert social media copywriter who writes per-platform captions." },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
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
      const extra: CaptionVariant[] = parsed.variants.map((v, i) => {
        const charCount = countChars(v.text);
        const base: CaptionVariant = {
          id: `llm-${Date.now()}-${i}`,
          platform,
          tone,
          cta,
          emojiDensity,
          hook: v.hook,
          body: v.text.split("\n").slice(1).join("\n") || v.text,
          ctaLine: "",
          emojis: [],
          hashtags: v.hashtags.slice(0, PLATFORM_HASHTAG_MAX[platform]),
          text: v.text,
          charCount,
          charLimit: PLATFORM_CHAR_LIMIT[platform],
          softTarget: PLATFORM_SOFT_TARGET[platform],
          exceedsLimit: charCount > PLATFORM_CHAR_LIMIT[platform],
          exceedsSoftTarget: charCount > PLATFORM_SOFT_TARGET[platform],
          trimmed: false,
          warnings: [],
          hookStyle: "llm",
        };
        return base;
      });
      setVariants((prev) => [...extra, ...prev]);
      toast.success(`LLM added ${extra.length} captions`);
    } catch (err) {
      setError(`LLM error: ${err instanceof Error ? err.message : String(err)}`);
      toast.error("LLM enhancement failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, platform, tone, cta, emojiDensity, topic, accountName]);

  const charLimit = PLATFORM_CHAR_LIMIT[platform];
  const softTarget = PLATFORM_SOFT_TARGET[platform];

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Platform</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                <Button
                  key={p}
                  variant={platform === p ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setPlatform(p)}
                >{PLATFORM_LABELS[p]}</Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">{PLATFORM_STYLE_HINTS[platform]}</p>
          </div>
          <div>
            <Label className="text-xs">Tone</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
                <Button
                  key={t}
                  variant={tone === t ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setTone(t)}
                >{TONE_LABELS[t]}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Emoji density</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(EMOJI_DENSITY_LABELS) as EmojiDensity[]).map((e) => (
                <Button
                  key={e}
                  variant={emojiDensity === e ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEmojiDensity(e)}
                >{EMOJI_DENSITY_LABELS[e]}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Call-to-action</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(CTA_LABELS) as Cta[]).map((c) => (
                <Button
                  key={c}
                  variant={cta === c ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCta(c)}
                >{CTA_LABELS[c]}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="smc-topic">Topic</Label>
              <Input
                id="smc-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="morning workouts, indie SaaS launch, …"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smc-account">Account name (optional — for branded hashtags)</Label>
              <Input
                id="smc-account"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="@acme"
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {NICHE_PRESETS.map((n) => (
              <Button
                key={n}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => setTopic(n)}
              >+ {n}</Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton onClick={handleGenerate} label="Generate captions" />
            <ShareButton getUrl={() => buildShareUrl(shareState)} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {(variants.length > 0 || thread.length > 0 || carousel.length > 0 || abPair) && (
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-1.5">
              <TabBtn active={tab === "captions"} onClick={() => setTab("captions")} icon={<PenTool className="h-3.5 w-3.5" />} label={`Captions (${variants.length})`} />
              <TabBtn active={tab === "thread"} onClick={() => setTab("thread")} icon={<MessageSquare className="h-3.5 w-3.5" />} label={`Thread (${thread.length})`} />
              <TabBtn active={tab === "carousel"} onClick={() => setTab("carousel")} icon={<Layers className="h-3.5 w-3.5" />} label={`Carousel (${carousel.length})`} />
              <TabBtn active={tab === "ab"} onClick={() => setTab("ab")} icon={<FlaskConical className="h-3.5 w-3.5" />} label="A/B pair" />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "captions" && variants.length > 0 && (
        <>
          {stats.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> {variants.length} captions · {PLATFORM_LABELS[platform]} · limit {charLimit} · soft target {softTarget}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Variants" value={variants.length} />
                  <Stat label="Char limit" value={charLimit} />
                  <Stat
                    label="Over limit"
                    value={variants.filter((v) => v.exceedsLimit).length}
                    highlight={variants.some((v) => v.exceedsLimit) ? "bad" : "good"}
                  />
                  <Stat
                    label="Over soft target"
                    value={variants.filter((v) => v.exceedsSoftTarget).length}
                    highlight={variants.some((v) => v.exceedsSoftTarget) ? "bad" : "good"}
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton getText={() => renderText(variants)} label="Copy all" />
                  <DownloadButton getText={() => renderText(variants)} filename="social-captions.txt" mime="text/plain" label="Download .txt" />
                  <DownloadButton getText={() => renderJson(variants)} filename="social-captions.json" mime="application/json" label="Download JSON" />
                  <DownloadButton getText={() => renderMarkdown(variants)} filename="social-captions.md" mime="text/markdown" label="Download MD" />
                  <DownloadButton getText={() => renderCsv(variants)} filename="social-captions.csv" mime="text/csv" label="Download CSV" />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {variants.map((v) => (
              <Card key={v.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">{PLATFORM_LABELS[v.platform]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{TONE_LABELS[v.tone]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{CTA_LABELS[v.cta]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{EMOJI_DENSITY_LABELS[v.emojiDensity]} emoji</Badge>
                      {v.trimmed && <Badge variant="secondary" className="text-[10px]">trimmed</Badge>}
                    </div>
                    <span
                      className={`text-xs font-mono ${
                        v.exceedsLimit
                          ? "text-red-600 dark:text-red-400"
                          : v.exceedsSoftTarget
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {v.charCount}/{v.charLimit}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/30 rounded p-2 border">
                    {v.text}
                  </pre>
                  {v.warnings.length > 0 && (
                    <div className="rounded border border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20 p-2 text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{v.warnings.join("; ")}</span>
                    </div>
                  )}
                  {v.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {v.hashtags.map((h) => (
                        <span key={h} className="text-[11px] text-primary font-mono">{h}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <CopyButton getText={() => v.text} label="Copy" size="sm" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => handleSaveFavorite(v)}
                    >
                      <Star className="h-3.5 w-3.5" /> Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === "thread" && thread.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" /> Thread — {thread.length} tweets
            </h3>
            <div className="space-y-2">
              {thread.map((t) => (
                <div key={t.index} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="secondary" className="text-[10px]">Tweet {t.index}/{thread.length}</Badge>
                    <span className={`font-mono ${t.exceedsLimit ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {t.charCount}/{t.charLimit}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs">{t.text}</pre>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <CopyButton getText={() => thread.map((t) => t.text).join("\n---\n")} label="Copy thread" />
              <DownloadButton getText={() => thread.map((t) => t.text).join("\n---\n")} filename="twitter-thread.txt" mime="text/plain" label="Download .txt" />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "carousel" && carousel.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> Carousel — {carousel.length} slides
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {carousel.map((s, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="secondary" className="text-[10px] mb-1">Slide {i + 1}</Badge>
                  <pre className="whitespace-pre-wrap font-sans text-xs">{s}</pre>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <CopyButton getText={() => carousel.map((s, i) => `Slide ${i + 1}: ${s}`).join("\n\n")} label="Copy carousel" />
              <DownloadButton getText={() => carousel.map((s, i) => `Slide ${i + 1}: ${s}`).join("\n\n")} filename="carousel-captions.txt" mime="text/plain" label="Download .txt" />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "ab" && abPair && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FlaskConical className="h-4 w-4" /> A/B pair
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded border bg-background p-3">
                <Badge variant="secondary" className="text-[10px] mb-1">Control — {TONE_LABELS[abPair.control.tone]}</Badge>
                <pre className="whitespace-pre-wrap font-sans text-xs mt-1">{abPair.control.text}</pre>
                <div className="text-[10px] text-muted-foreground mt-1">{abPair.control.charCount}/{abPair.control.charLimit} chars</div>
              </div>
              <div className="rounded border bg-background p-3">
                <Badge variant="secondary" className="text-[10px] mb-1">Challenger — {TONE_LABELS[abPair.challenger.tone]}</Badge>
                <pre className="whitespace-pre-wrap font-sans text-xs mt-1">{abPair.challenger.text}</pre>
                <div className="text-[10px] text-muted-foreground mt-1">{abPair.challenger.charCount}/{abPair.challenger.charLimit} chars</div>
              </div>
            </div>
            <div className="rounded bg-muted/30 p-2 text-xs">
              <strong>Hypothesis:</strong> {abPair.hypothesis}
            </div>
            <div className="rounded bg-muted/30 p-2 text-xs">
              <strong>What to measure:</strong> {abPair.whatToMeasure}
            </div>
          </CardContent>
        </Card>
      )}

      {(hashtagPool.length > 0 || brandedPool.length > 0) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Hash className="h-4 w-4" /> Hashtag suggestions
            </h3>
            {hashtagPool.length > 0 && (
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Niche tags ({hashtagPool.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {hashtagPool.slice(0, 15).map((h) => (
                    <Badge key={h} variant="outline" className="text-xs font-mono">{h}</Badge>
                  ))}
                </div>
              </div>
            )}
            {brandedPool.length > 0 && (
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">Branded tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {brandedPool.map((h) => (
                    <Badge key={h} variant="secondary" className="text-xs font-mono">{h}</Badge>
                  ))}
                </div>
              </div>
            )}
            {flaggedPool.length > 0 && (
              <div className="rounded border border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                <strong>Shadowban-risk tags (avoid):</strong> {flaggedPool.join(", ")}
              </div>
            )}
            {hashtagPool.length > 0 && (
              <CopyButton getText={() => hashtagPool.join(" ")} label="Copy niche hashtags" size="sm" />
            )}
          </CardContent>
        </Card>
      )}

      {variants.length === 0 && thread.length === 0 && carousel.length === 0 && !abPair && (
        <EmptyState
          title="Generate per-platform social captions"
          hint="Pick a platform, tone, emoji density, and CTA, then enter your topic. Each variant includes a hook, body, CTA, emojis, and a hashtag block tailored to that platform's conventions."
          icon={<PenTool className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <button
            onClick={() => setShowLlm((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline"
          >
            <Key className="h-4 w-4" /> Optional: enhance with your own LLM key
            {showLlm ? " ▾" : " ▸"}
          </button>
          {showLlm && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-muted-foreground">
                Paste an OpenAI or Anthropic API key to get richer, more creative captions. Your key is stored only in localStorage on this device. The only network call goes directly from your browser to the provider you choose.
              </p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
                <Input
                  type="password"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  placeholder="sk-..."
                  className="h-8 text-xs flex-1 min-w-[200px]"
                />
                <Button variant="outline" size="sm" onClick={handleSaveLlmKey}>Save key</Button>
                <RunButton
                  onClick={handleLlmEnhance}
                  loading={llmLoading}
                  label="Enhance with LLM"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {faves.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Star className="h-4 w-4" /> Favorites ({faves.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearFavorites}>Clear</Button>
            </div>
            <div className="space-y-1">
              {faves.slice(0, 10).map((f) => (
                <div key={f.ts} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{PLATFORM_LABELS[f.platform]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{TONE_LABELS[f.tone]}</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(f.ts).toLocaleDateString()}</span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs mt-1">{f.text}</pre>
                  <div className="flex gap-1.5 mt-1">
                    <CopyButton getText={() => f.text} label="Copy" size="sm" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => handleRemoveFavorite(f.ts)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
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
              {history.slice(0, 5).map((h) => (
                <button
                  key={h.ts}
                  onClick={() => {
                    setPlatform(h.platform);
                    setTone(h.tone);
                    setCta(h.cta);
                    setEmojiDensity(h.emojiDensity);
                    setTopic(h.topic);
                    setAccountName(h.accountName);
                    toast.info("Loaded from history — click Generate to re-run");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{PLATFORM_LABELS[h.platform]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{TONE_LABELS[h.tone]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{CTA_LABELS[h.cta]}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{h.variantCount} caps</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {h.topic || "(no topic)"}{h.accountName ? ` · @${h.accountName}` : ""}
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
            <strong className="text-foreground">Privacy:</strong> All caption generation runs locally. History and favorites are stored in localStorage on this device only. The only network call is if you paste your own LLM API key — that request goes directly from your browser to the provider you choose.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            <strong className="text-foreground">Honesty:</strong> The shadowban-risk list ({SHADOWBAN_RISK_TAGS.length} tags) is a dated snapshot — platforms change their lists constantly and we don't track real-time bans. Hashtag counts are guidance, not guarantees. On-device templates are less witty than BYO-key LLM output. Nothing is uploaded or logged by us.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TabBtn({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      className="h-8 text-xs gap-1.5"
      onClick={onClick}
    >
      {icon}
      {label}
    </Button>
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
