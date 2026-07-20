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
  POWER_WORDS,
  STYLES,
  STYLE_LABELS,
  TONES,
  TONE_LABELS,
  generateSlogans,
  generateAbPairs,
  sortByScore,
  scoreOverall,
  renderText,
  renderCsv,
  parseKeywords,
  loadHistory,
  saveHistory,
  clearHistory,
  loadFavorites,
  toggleFavorite,
  clearFavorites,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  LLM_KEY_STORAGE,
  type Tone,
  type SloganStyle,
  type Slogan,
  type AbPair,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  Sparkles, Key, History, Star, Wand2, Megaphone, Shuffle, Award,
} from "lucide-react";

type Tab = "grid" | "ab" | "favorites";

export default function AiSloganTaglineGenerator() {
  const [brand, setBrand] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [tone, setTone] = useState<Tone>("bold");
  const [selectedStyles, setSelectedStyles] = useState<SloganStyle[]>([]);
  const [avoidCliches, setAvoidCliches] = useState(true);
  const [brandFit, setBrandFit] = useState(true);
  const [alliteration, setAlliteration] = useState(false);
  const [rhyme, setRhyme] = useState(false);
  const [maxWords, setMaxWords] = useState(10);

  const [slogans, setSlogans] = useState<Slogan[]>([]);
  const [pairs, setPairs] = useState<AbPair[]>([]);
  const [tab, setTab] = useState<Tab>("grid");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    setFavorites(loadFavorites());
    const key = typeof localStorage !== "undefined" ? localStorage.getItem(LLM_KEY_STORAGE) : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.brand) {
        setBrand(p.brand);
        setKeywordsText(p.keywords);
        setTone(p.tone);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const keywords = useMemo(() => parseKeywords(keywordsText), [keywordsText]);
  const sortedSlogans = useMemo(() => sortByScore(slogans), [slogans]);

  const handleGenerate = useCallback(() => {
    if (!brand.trim()) {
      toast.error("Enter a brand name first");
      return;
    }
    const out = generateSlogans(brand, keywords, {
      tone,
      styles: selectedStyles.length > 0 ? selectedStyles : undefined,
      avoidCliches,
      brandFit,
      alliteration,
      rhyme,
      maxWords,
      limit: 30,
    });
    setSlogans(out);
    setTab("grid");
    saveHistory({
      ts: Date.now(),
      brand: brand.trim(),
      keywords,
      tone,
      count: out.length,
    });
    setHistory(loadHistory());
    toast.success(`${out.length} slogans generated`);
  }, [brand, keywords, tone, selectedStyles, avoidCliches, brandFit, alliteration, rhyme, maxWords]);

  const handleAbPairs = useCallback(() => {
    if (!brand.trim()) {
      toast.error("Enter a brand name first");
      return;
    }
    const p = generateAbPairs(brand, keywords, {
      tone,
      styles: selectedStyles.length > 0 ? selectedStyles : undefined,
      avoidCliches,
      brandFit,
      alliteration,
      rhyme,
      maxWords,
    }, 5);
    setPairs(p);
    setTab("ab");
    toast.success(`${p.length} A/B pairs generated`);
  }, [brand, keywords, tone, selectedStyles, avoidCliches, brandFit, alliteration, rhyme, maxWords]);

  const handleToggleFav = useCallback((text: string) => {
    const next = toggleFavorite(text);
    setFavorites(next);
    toast.success(next.includes(text) ? "Added to favorites" : "Removed from favorites");
  }, []);

  const handleClear = useCallback(() => {
    setSlogans([]);
    setPairs([]);
    setLlmResult(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleClearFavs = useCallback(() => {
    clearFavorites();
    setFavorites([]);
    toast.success("Favorites cleared");
  }, []);

  const toggleStyle = (s: SloganStyle) => {
    setSelectedStyles((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  // ---- LLM polish (BYO key) ----
  const handleLlm = useCallback(async () => {
    if (!llmKey) { toast.error("Paste your LLM API key first"); return; }
    if (!brand.trim()) { toast.error("Enter a brand name first"); return; }
    setLlmLoading(true); setLlmError("");
    try {
      const prompt = buildLlmPrompt(brand, keywords, tone);
      const out = await callLlm(llmProvider, llmKey, prompt);
      const r = renderLlmResult(out);
      setLlmResult(r);
      if (r.slogans.length > 0) {
        const llmSlogans: Slogan[] = r.slogans.map((text) => ({
          text,
          style: "benefit" as SloganStyle,
          tone,
          score: scoreOverall(text, { avoidCliches, alliteration, rhyme }),
        }));
        // Merge LLM slogans with the existing deterministic ones (LLM first),
        // then sort by overall score.
        const merged = sortByScore([...llmSlogans, ...slogans]).slice(0, 30);
        setSlogans(merged);
        toast.success(`LLM polish applied (${r.slogans.length} new slogans)`);
      }
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : "LLM call failed");
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, brand, keywords, tone, slogans]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sg-brand" className="flex items-center gap-1.5">
                <Megaphone className="h-3.5 w-3.5" /> Brand name
              </Label>
              <Input
                id="sg-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Acme"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sg-kw">Keywords (comma or newline separated)</Label>
              <Textarea
                id="sg-kw"
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder={"widgets\nfast, reliable"}
                className="min-h-[40px] resize-y font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tone</div>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="bg-transparent text-sm font-semibold w-full"
              >
                {TONES.map((t) => <option key={t} value={t}>{TONE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Max words</div>
              <select
                value={maxWords}
                onChange={(e) => setMaxWords(parseInt(e.target.value, 10))}
                className="bg-transparent text-sm font-semibold w-full"
              >
                {[4, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Avoid clichés</div>
              <label className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer">
                <input type="checkbox" checked={avoidCliches} onChange={(e) => setAvoidCliches(e.target.checked)} />
                {avoidCliches ? "On" : "Off"}
              </label>
            </div>
            <div className="rounded border bg-background px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Brand-fit</div>
              <label className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer">
                <input type="checkbox" checked={brandFit} onChange={(e) => setBrandFit(e.target.checked)} />
                {brandFit ? "On" : "Off"}
              </label>
            </div>
          </div>

          <div>
            <Label className="text-xs">Styles (optional — leave empty for all)</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {STYLES.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedStyles.includes(s)}
                    onChange={() => toggleStyle(s)}
                  />
                  {STYLE_LABELS[s]}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={alliteration} onChange={(e) => setAlliteration(e.target.checked)} />
              Boost alliteration
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={rhyme} onChange={(e) => setRhyme(e.target.checked)} />
              Boost rhyme
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate slogans" />
            <Button variant="outline" size="sm" onClick={handleAbPairs} className="gap-1.5">
              <Shuffle className="h-3.5 w-3.5" /> A/B pairs
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowLlm((v) => !v)} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Show"} LLM polish
            </Button>
          </div>
        </CardContent>
      </Card>

      {showLlm && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Key className="h-4 w-4" /> Bring your own key (optional)
            </h3>
            <p className="text-xs text-muted-foreground">
              Optional — paste your own OpenAI or Anthropic API key. The key is stored only in this browser&apos;s localStorage; the request goes directly to the provider.
            </p>
            <div className="flex flex-wrap items-center gap-2">
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
                placeholder="sk-…"
                value={llmKey}
                onChange={(e) => {
                  setLlmKey(e.target.value);
                  if (typeof localStorage !== "undefined") {
                    try { localStorage.setItem(LLM_KEY_STORAGE, e.target.value); } catch { /* ignore */ }
                  }
                }}
                className="h-8 font-mono text-xs max-w-xs"
              />
              <RunButton onClick={handleLlm} label="Polish with LLM" loading={llmLoading} />
            </div>
            {llmError && <ErrorBanner message={llmError} />}
            {llmResult && (
              <div className="rounded border bg-background p-3 text-xs space-y-2">
                {llmResult.explanation && (
                  <div><strong>Explanation:</strong> {llmResult.explanation}</div>
                )}
                {llmResult.warnings.length > 0 && (
                  <div className="text-amber-700 dark:text-amber-400"><strong>Warnings:</strong> {llmResult.warnings.join("; ")}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(slogans.length > 0 || pairs.length > 0 || favorites.length > 0) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Award className="h-4 w-4" /> Slogans
              </h3>
              <div className="flex gap-1">
                {(["grid", "ab", "favorites"] as Tab[]).map((t) => (
                  <Button
                    key={t}
                    variant={tab === t ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setTab(t)}
                  >
                    {t === "grid" ? `Grid (${slogans.length})` : t === "ab" ? `A/B (${pairs.length})` : `Favs (${favorites.length})`}
                  </Button>
                ))}
              </div>
            </div>

            {tab === "grid" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[500px] overflow-auto">
                {sortedSlogans.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No slogans yet. Click Generate.</p>
                ) : (
                  sortedSlogans.map((s, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{STYLE_LABELS[s.style]}</Badge>
                          <Badge variant="outline" className="text-[10px]">{TONE_LABELS[s.tone]}</Badge>
                          <Badge variant="secondary" className="text-[10px]">Score {s.score.overall}</Badge>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleFav(s.text)}
                          className={favorites.includes(s.text) ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"}
                          aria-label="Toggle favorite"
                        >
                          <Star className="h-3.5 w-3.5" fill={favorites.includes(s.text) ? "currentColor" : "none"} />
                        </button>
                      </div>
                      <div className="font-medium text-foreground mt-1.5">{s.text}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        L:{s.score.length} · M:{s.score.memorability} · I:{s.score.impact}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <CopyButton getText={() => s.text} label="Copy" size="sm" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "ab" && (
              <div className="space-y-2 max-h-[500px] overflow-auto">
                {pairs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No A/B pairs yet. Click &quot;A/B pairs&quot;.</p>
                ) : (
                  pairs.map((p, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2">
                      {[p.a, p.b].map((s, j) => (
                        <div key={j} className="rounded border bg-background px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className="text-[10px]">{STYLE_LABELS[s.style]}</Badge>
                            <Badge variant="secondary" className="text-[10px]">{s.score.overall}</Badge>
                          </div>
                          <div className="font-medium text-foreground mt-1.5">{s.text}</div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <CopyButton getText={() => s.text} label="Copy" size="sm" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "favorites" && (
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {favorites.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No favorites yet. Click the star next to a slogan.</p>
                ) : (
                  favorites.map((f, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-2">
                      <Star className="h-3.5 w-3.5 text-amber-500" fill="currentColor" />
                      <span className="flex-1 text-foreground">{f}</span>
                      <CopyButton getText={() => f} label="Copy" size="sm" />
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => handleToggleFav(f)}>Remove</Button>
                    </div>
                  ))
                )}
                {favorites.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleClearFavs}>Clear favorites</Button>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => renderText(sortedSlogans)}
                label="Copy all"
                disabled={sortedSlogans.length === 0}
              />
              <DownloadButton
                getText={() => renderText(sortedSlogans)}
                filename="slogans.txt"
                label="Download .txt"
                disabled={sortedSlogans.length === 0}
              />
              <DownloadButton
                getText={() => renderCsv(sortedSlogans)}
                filename="slogans.csv"
                mime="text/csv"
                label="Download CSV"
                disabled={sortedSlogans.length === 0}
              />
              <ShareButton
                getUrl={() => buildShareUrl({ brand, keywords: keywordsText, tone })}
                disabled={!brand}
              />
              <ClearButton onClick={handleClear} disabled={slogans.length === 0 && pairs.length === 0} />
            </div>
          </CardContent>
        </Card>
      )}

      {slogans.length === 0 && pairs.length === 0 && favorites.length === 0 && (
        <EmptyState
          title="Enter a brand and keywords to generate slogans"
          hint={`Pick a tone, choose styles (or leave empty for all), and click Generate. ${POWER_WORDS.length}+ power words and ${STYLES.length} style families power the generator. Everything runs locally — nothing is uploaded.`}
          icon={<Sparkles className="h-8 w-8" />}
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
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setBrand(h.brand);
                    setKeywordsText(h.keywords.join("\n"));
                    setTone(h.tone);
                    toast.info(`Loaded: ${h.brand}`);
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:border-primary"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{TONE_LABELS[h.tone]}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.count} slogans</Badge>
                  <span className="text-foreground">{h.brand}</span>
                  {h.keywords.length > 0 && (
                    <span className="text-muted-foreground ml-2">· {h.keywords.join(", ")}</span>
                  )}
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy & honesty:</strong> All generation, scoring, alliteration/rhyme detection, cliché filtering, and A/B pairing run locally in your browser. Scores are heuristics (syllable counts, phonetic devices, power-word density) — useful for ranking, not a substitute for human judgement. The cliché list is bundled and dated; it is NOT a trademark clearance check. Nothing is uploaded or logged by us.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- LLM fetch helper (touches network — kept out of logic.ts) ----------

async function callLlm(provider: "openai" | "anthropic", key: string, prompt: string): Promise<string> {
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a brand copywriter who returns raw JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
}
