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
  CHAR_LIMIT,
  ACCOUNT_TYPE_LABELS,
  TONE_LABELS,
  CTA_LABELS,
  NICHE_PRESETS,
  clean,
  countChars,
  trimBio,
  suggestHashtags,
  suggestHandles,
  generateBios,
  generateAbPair,
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
  type AccountType,
  type Tone,
  type Cta,
  type BioVariant,
  type AbPair,
  type HistoryEntry,
  type FavoriteEntry,
  type ShareState,
} from "./logic";
import {
  Instagram, Sparkles, Key, History, AtSign, Hash, FlaskConical,
  AlertCircle, Star, Trash2, Wand2, Link as LinkIcon,
} from "lucide-react";

export default function AiInstagramBioGenerator() {
  const [accountType, setAccountType] = useState<AccountType>("creator");
  const [tone, setTone] = useState<Tone>("aesthetic");
  const [cta, setCta] = useState<Cta>("link-in-bio");
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [variants, setVariants] = useState<BioVariant[]>([]);
  const [abPair, setAbPair] = useState<AbPair | null>(null);
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
      ? localStorage.getItem("unqtools:ai-ig-bio:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.accountType) setAccountType(p.accountType);
      if (p.tone) setTone(p.tone);
      if (p.cta) setCta(p.cta);
      if (p.name) setName(p.name);
      if (p.niche) setNiche(p.niche);
      if (p.name || p.niche) toast.info("Loaded from share link");
    }
  }, []);

  const handleGenerate = useCallback(() => {
    const nm = clean(name);
    const ni = clean(niche);
    if (!nm && !ni) {
      setError("Enter a name or niche to generate bios.");
      toast.error("Enter a name or niche first");
      return;
    }
    setError("");
    const out = generateBios(accountType, tone, cta, nm, ni, 6).map((b) =>
      b.exceedsLimit ? trimBio(b) : b,
    );
    setVariants(out);
    setAbPair(generateAbPair(accountType, nm || "Your Name", ni || "your niche"));
    saveHistory({
      ts: Date.now(),
      accountType, tone, cta, name: nm, niche: ni,
      variantCount: out.length,
    });
    setHistory(loadHistory());
    toast.success(`Generated ${out.length} bios`);
  }, [accountType, tone, cta, name, niche]);

  const stats = useMemo(() => computeStats(variants), [variants]);
  const hashtags = useMemo(
    () => suggestHashtags(niche, 8),
    [niche],
  );
  const handleIdeas = useMemo(
    () => suggestHandles(name, niche, 8),
    [name, niche],
  );
  const shareState: ShareState = { accountType, tone, cta, name, niche };

  const handleClear = useCallback(() => {
    setVariants([]);
    setAbPair(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveFavorite = useCallback((v: BioVariant) => {
    saveFavorite({
      ts: Date.now(),
      text: v.text,
      accountType: v.accountType,
      tone: v.tone,
      cta: v.cta,
    });
    setFaves(loadFavorites());
    toast.success("Saved to favorites");
  }, []);

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
      if (llmKey) localStorage.setItem("unqtools:ai-ig-bio:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-ig-bio:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) {
      toast.error("Please paste your API key first");
      return;
    }
    if (!clean(name) && !clean(niche)) {
      toast.error("Enter a name or niche first");
      return;
    }
    setLlmLoading(true);
    setError("");
    try {
      const prompt = buildLlmPrompt(accountType, tone, cta, clean(name), clean(niche));
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
            { role: "system", content: "You are an expert social media copywriter who writes scroll-stopping Instagram bios." },
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
      const extra: BioVariant[] = parsed.variants.map((v, i) => {
        const charCount = countChars(v.text);
        const base: BioVariant = {
          id: `llm-${Date.now()}-${i}`,
          text: v.text,
          accountType,
          tone,
          cta,
          charCount,
          charLimit: CHAR_LIMIT,
          exceedsLimit: charCount > CHAR_LIMIT,
          lines: v.text.split("\n"),
          hashtags: v.hashtags.slice(0, 5),
          trimmed: false,
        };
        return base.exceedsLimit ? trimBio(base) : base;
      });
      setVariants((prev) => [...extra, ...prev]);
      toast.success(`LLM added ${extra.length} bios`);
    } catch (err) {
      setError(`LLM error: ${err instanceof Error ? err.message : String(err)}`);
      toast.error("LLM enhancement failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, accountType, tone, cta, name, niche]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Account type</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((at) => (
                <Button
                  key={at}
                  variant={accountType === at ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setAccountType(at)}
                >{ACCOUNT_TYPE_LABELS[at]}</Button>
              ))}
            </div>
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
              <Label htmlFor="ig-name">Name / brand</Label>
              <Input
                id="ig-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ig-niche">Niche</Label>
              <Input
                id="ig-niche"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="fitness coach"
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
                onClick={() => setNiche(n)}
              >+ {n}</Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton onClick={handleGenerate} label="Generate bios" />
            <CopyButton
              getText={() => renderText(variants)}
              label="Copy all"
              disabled={variants.length === 0}
            />
            <DownloadButton
              getText={() => renderText(variants)}
              filename="instagram-bios.txt"
              mime="text/plain"
              label="Download .txt"
              disabled={variants.length === 0}
            />
            <DownloadButton
              getText={() => renderJson(variants)}
              filename="instagram-bios.json"
              mime="application/json"
              label="Download JSON"
              disabled={variants.length === 0}
            />
            <DownloadButton
              getText={() => renderMarkdown(variants)}
              filename="instagram-bios.md"
              mime="text/markdown"
              label="Download MD"
              disabled={variants.length === 0}
            />
            <DownloadButton
              getText={() => renderCsv(variants)}
              filename="instagram-bios.csv"
              mime="text/csv"
              label="Download CSV"
              disabled={variants.length === 0}
            />
            <ShareButton getUrl={() => buildShareUrl(shareState)} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {variants.length > 0 ? (
        <>
          {stats.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> {variants.length} bios · avg {stats[0]?.avgChars ?? 0} chars
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Variants" value={variants.length} />
                  <Stat label="Char limit" value={CHAR_LIMIT} />
                  <Stat
                    label="Over limit"
                    value={variants.filter((v) => v.exceedsLimit).length}
                    highlight={variants.some((v) => v.exceedsLimit) ? "bad" : "good"}
                  />
                  <Stat label="Trimmed" value={variants.filter((v) => v.trimmed).length} />
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
                      <Badge variant="outline" className="text-[10px]">{ACCOUNT_TYPE_LABELS[v.accountType]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{TONE_LABELS[v.tone]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{CTA_LABELS[v.cta]}</Badge>
                      {v.trimmed && <Badge variant="secondary" className="text-[10px]">trimmed</Badge>}
                    </div>
                    <span
                      className={`text-xs font-mono ${
                        v.exceedsLimit
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {v.charCount}/{v.charLimit}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/30 rounded p-2 border">
                    {v.text}
                  </pre>
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

          {abPair && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4" /> A/B pair
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded border bg-background p-3">
                    <Badge variant="secondary" className="text-[10px] mb-1">Control — {TONE_LABELS[abPair.control.tone]}</Badge>
                    <pre className="whitespace-pre-wrap font-sans text-xs mt-1">{abPair.control.text}</pre>
                    <div className="text-[10px] text-muted-foreground mt-1">{abPair.control.charCount}/{CHAR_LIMIT} chars</div>
                  </div>
                  <div className="rounded border bg-background p-3">
                    <Badge variant="secondary" className="text-[10px] mb-1">Challenger — {TONE_LABELS[abPair.challenger.tone]}</Badge>
                    <pre className="whitespace-pre-wrap font-sans text-xs mt-1">{abPair.challenger.text}</pre>
                    <div className="text-[10px] text-muted-foreground mt-1">{abPair.challenger.charCount}/{CHAR_LIMIT} chars</div>
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

          {hashtags.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Hash className="h-4 w-4" /> Hashtag suggestions
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((h) => (
                    <Badge key={h} variant="outline" className="text-xs font-mono">{h}</Badge>
                  ))}
                </div>
                <CopyButton getText={() => hashtags.join(" ")} label="Copy hashtags" size="sm" />
              </CardContent>
            </Card>
          )}

          {handleIdeas.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AtSign className="h-4 w-4" /> Handle ideas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {handleIdeas.map((h) => (
                    <div key={h.handle} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-foreground">{h.handle}</span>
                      <span className="text-muted-foreground">— {h.note}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Generate Instagram bios within the 150-char limit"
          hint="Pick an account type, tone, and CTA, then enter your name and niche. Each variant includes emojis, line breaks, hashtags, and a call-to-action."
          icon={<Instagram className="h-8 w-8" />}
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
                Paste an OpenAI or Anthropic API key to get richer, more creative bios. Your key is stored only in localStorage on this device. The only network call goes directly from your browser to the provider you choose.
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
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{ACCOUNT_TYPE_LABELS[f.accountType]}</Badge>
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
                    setAccountType(h.accountType);
                    setTone(h.tone);
                    setCta(h.cta);
                    setName(h.name);
                    setNiche(h.niche);
                    toast.info("Loaded from history — click Generate to re-run");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{ACCOUNT_TYPE_LABELS[h.accountType]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{TONE_LABELS[h.tone]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{CTA_LABELS[h.cta]}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{h.variantCount} bios</Badge>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {h.name || "(no name)"} · {h.niche || "(no niche)"}
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
            <strong className="text-foreground">Privacy:</strong> All bio generation runs locally. History and favorites are stored in localStorage on this device only. The only network call is if you paste your own LLM API key — that request goes directly from your browser to the provider you choose.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            <strong className="text-foreground">Honesty:</strong> Searchable keywords in your bio can help discovery, but they don't guarantee reach. On-device templates are less witty than BYO-key LLM bios. Nothing is uploaded or logged by us.
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
