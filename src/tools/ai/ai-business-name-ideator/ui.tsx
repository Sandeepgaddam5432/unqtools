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
  FAVORITES_MAX,
  LLM_KEY_STORAGE,
  STYLE_LABELS,
  TECHNIQUE_LABELS,
  FIELD_HINTS,
  TLDS,
  validateInputs,
  parseKeywords,
  slugify,
  generate,
  suggestDomains,
  suggestSocialHandles,
  trademarkCaution,
  trademarkSearchUrls,
  renderCsv,
  renderMarkdown,
  renderJson,
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
  type NameInputs,
  type Style,
  type NameCandidate,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  Sparkles, Key, History, AlertCircle, Lightbulb, Star, Globe,
  AtSign, Quote, Eye, EyeOff, Wand2, ExternalLink, ShieldAlert,
  Search,
} from "lucide-react";

const DEFAULT_INPUTS: NameInputs = {
  keywords: [],
  industry: "",
  style: "modern",
  minLength: 4,
  maxLength: 12,
  maxSyllables: 4,
};

const SAMPLE_KEYWORDS = "ledger, books, honest";
const SAMPLE_INDUSTRY = "accounting software";

export default function AiBusinessNameIdeator() {
  const [keywordsRaw, setKeywordsRaw] = useState("");
  const [inputs, setInputs] = useState<NameInputs>(DEFAULT_INPUTS);
  const [output, setOutput] = useState<ReturnType<typeof generate> | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    setFavorites(loadFavorites());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem(LLM_KEY_STORAGE)
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.inputs && Object.keys(p.inputs).length > 0) {
        setInputs((prev) => ({ ...prev, ...p.inputs }));
        if (p.inputs.keywords && p.inputs.keywords.length > 0) {
          setKeywordsRaw(p.inputs.keywords.join(", "));
        }
        toast.info("Loaded from share link");
      }
    }
  }, []);

  // Keep keywords in sync with the raw input field.
  const parsedKeywords = useMemo(() => parseKeywords(keywordsRaw), [keywordsRaw]);
  const effectiveInputs = useMemo<NameInputs>(
    () => ({ ...inputs, keywords: parsedKeywords }),
    [inputs, parsedKeywords],
  );

  const liveWarnings = useMemo(() => validateInputs(effectiveInputs), [effectiveInputs]);

  const handleGenerate = useCallback(() => {
    setError("");
    try {
      const out = generate(effectiveInputs);
      setOutput(out);
      setLlmResult(null);
      if (out.candidates.length > 0) {
        const top = out.candidates[0];
        saveHistory({
          ts: Date.now(),
          keywords: effectiveInputs.keywords,
          industry: effectiveInputs.industry,
          style: effectiveInputs.style,
          topName: top.name,
          topScore: top.score.total,
        });
        setHistory(loadHistory());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
  }, [effectiveInputs]);

  const handleClear = useCallback(() => {
    setKeywordsRaw("");
    setInputs(DEFAULT_INPUTS);
    setOutput(null);
    setLlmResult(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleClearFavorites = useCallback(() => {
    clearFavorites();
    setFavorites([]);
    toast.success("Favorites cleared");
  }, []);

  const handleLoadSample = useCallback(() => {
    setKeywordsRaw(SAMPLE_KEYWORDS);
    setInputs((prev) => ({ ...prev, industry: SAMPLE_INDUSTRY, style: "modern" }));
    toast.info("Sample inputs loaded");
  }, []);

  const handleToggleFav = useCallback((name: string) => {
    const next = toggleFavorite(name);
    setFavorites(next);
  }, []);

  const handleSaveKey = useCallback(() => {
    if (typeof localStorage !== "undefined") {
      try {
        if (llmKey) localStorage.setItem(LLM_KEY_STORAGE, llmKey);
        else localStorage.removeItem(LLM_KEY_STORAGE);
        toast.success(llmKey ? "API key saved on this device" : "API key removed");
      } catch {
        toast.error("Could not save key");
      }
    }
  }, [llmKey]);

  const handleLlm = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your API key first");
      return;
    }
    if (!output || output.candidates.length === 0) {
      toast.error("Generate names first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      const sample = output.candidates.slice(0, 10).map((c) => c.name);
      const prompt = buildLlmPrompt(effectiveInputs, sample);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let body: string;
      if (llmProvider === "openai") {
        headers["Authorization"] = `Bearer ${llmKey}`;
        body = JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a JSON-only API. Respond with valid JSON only, no prose." },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
        });
      } else {
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
        body = JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 2048,
          system: "You are a JSON-only API. Respond with valid JSON only, no prose.",
          messages: [{ role: "user", content: prompt }],
        });
      }
      const res = await fetch(url, { method: "POST", headers, body });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API error ${res.status}: ${txt.slice(0, 200)}`);
      }
      const data = await res.json();
      const raw = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      setLlmResult(parsed.result);
      toast.success("LLM refinement applied");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM call failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, output, effectiveInputs]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bni-keywords" className="text-xs">
              Keywords
              <span className="ml-2 text-muted-foreground font-normal">— {FIELD_HINTS.keywords.hint}</span>
            </Label>
            <Textarea
              id="bni-keywords"
              value={keywordsRaw}
              onChange={(e) => setKeywordsRaw(e.target.value)}
              placeholder={`e.g. ${FIELD_HINTS.keywords.sample}`}
              className="min-h-[60px] resize-y text-sm"
            />
            {parsedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {parsedKeywords.map((k) => (
                  <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bni-industry" className="text-xs">
              Industry
              <span className="ml-2 text-muted-foreground font-normal">— {FIELD_HINTS.industry.hint}</span>
            </Label>
            <Input
              id="bni-industry"
              value={inputs.industry}
              onChange={(e) => setInputs((prev) => ({ ...prev, industry: e.target.value }))}
              placeholder={`e.g. ${FIELD_HINTS.industry.sample}`}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Style
              <span className="ml-2 text-muted-foreground font-normal">— {FIELD_HINTS.style.hint}</span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STYLE_LABELS) as Style[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInputs((prev) => ({ ...prev, style: s }))}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    inputs.style === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  {STYLE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center justify-between">
                <span>Min length</span>
                <span className="text-muted-foreground font-mono text-[11px]">{inputs.minLength}</span>
              </Label>
              <input
                type="range" min={3} max={12} step={1}
                value={inputs.minLength}
                onChange={(e) => setInputs((prev) => ({ ...prev, minLength: parseInt(e.target.value, 10) }))}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center justify-between">
                <span>Max length</span>
                <span className="text-muted-foreground font-mono text-[11px]">{inputs.maxLength}</span>
              </Label>
              <input
                type="range" min={5} max={20} step={1}
                value={inputs.maxLength}
                onChange={(e) => setInputs((prev) => ({ ...prev, maxLength: parseInt(e.target.value, 10) }))}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center justify-between">
                <span>Max syllables</span>
                <span className="text-muted-foreground font-mono text-[11px]">{inputs.maxSyllables}</span>
              </Label>
              <input
                type="range" min={2} max={6} step={1}
                value={inputs.maxSyllables}
                onChange={(e) => setInputs((prev) => ({ ...prev, maxSyllables: parseInt(e.target.value, 10) }))}
                className="w-full"
              />
            </div>
          </div>

          {liveWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300 mb-1">
                <AlertCircle className="h-3.5 w-3.5" /> {liveWarnings.length} warning{liveWarnings.length === 1 ? "" : "s"}
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-amber-700 dark:text-amber-300">
                {liveWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <RunButton
              onClick={handleGenerate}
              disabled={parsedKeywords.length === 0}
              label="Generate names"
            />
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={handleLoadSample}>
              Load sample
            </Button>
            <DownloadButton
              getText={() => output ? renderCsv(output) : ""}
              filename="business-names.csv"
              mime="text/csv"
              label="Download CSV"
              disabled={!output}
            />
            <DownloadButton
              getText={() => output ? renderMarkdown(output, effectiveInputs) : ""}
              filename="business-names.md"
              mime="text/markdown"
              label="Download .md"
              disabled={!output}
            />
            <DownloadButton
              getText={() => output ? renderJson(output, effectiveInputs) : ""}
              filename="business-names.json"
              mime="application/json"
              label="Download JSON"
              disabled={!output}
            />
            <ShareButton
              getUrl={() => buildShareUrl(effectiveInputs)}
              disabled={parsedKeywords.length === 0}
            />
            <ClearButton
              onClick={handleClear}
              disabled={!keywordsRaw && !inputs.industry && !output}
            />
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      {output && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> {output.candidates.length} name ideas
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  {output.uniqueCount} unique generated · top {output.candidates.length} shown
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {output.candidates.map((c, i) => (
                  <NameCard
                    key={`${c.name}-${i}`}
                    candidate={c}
                    isFavorite={favorites.includes(slugify(c.name))}
                    onToggleFav={handleToggleFav}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2 border-l-4 border-l-amber-500">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" /> Trademark caution
              </h3>
              <p className="text-xs text-muted-foreground">{trademarkCaution()}</p>
              {output.candidates[0] && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {trademarkSearchUrls(output.candidates[0].name).map((u) => (
                    <a
                      key={u.label}
                      href={u.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border bg-background hover:bg-muted"
                    >
                      <Search className="h-3 w-3" /> {u.label}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {llmResult && (
            <Card>
              <CardContent className="p-4 space-y-3 border-l-4 border-l-primary">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> LLM refinement
                </h3>
                {llmResult.refinedNames.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Refined names</div>
                    <ul className="text-xs space-y-1.5 list-disc pl-5">
                      {llmResult.refinedNames.map((n, i) => (
                        <li key={i}>
                          <strong>{n.name}</strong>
                          {n.rationale && <span className="text-muted-foreground"> — {n.rationale}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {llmResult.taglineSuggestions.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Tagline suggestions</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">
                      {llmResult.taglineSuggestions.map((t, i) => <li key={i}>{t}</li>)}
                    </ul>
                  </div>
                )}
                {llmResult.notes.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Notes</div>
                    <ul className="text-xs space-y-0.5 list-disc pl-5">
                      {llmResult.notes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowLlm((v) => !v)}
              >
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-4 w-4" /> Optional: refine with your LLM API key
                </h3>
                {showLlm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              {showLlm && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    For sharper, more idiomatic name suggestions than the templates produce. Your key is stored only in localStorage on this device. The request goes directly from your browser to the provider.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                      className="h-8 text-xs rounded border bg-background px-2"
                    >
                      <option value="openai">OpenAI (gpt-4o-mini)</option>
                      <option value="anthropic">Anthropic (claude-3-5-haiku)</option>
                    </select>
                    <Input
                      type="password"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      placeholder={llmProvider === "openai" ? "sk-…" : "sk-ant-…"}
                      className="h-8 text-xs flex-1 min-w-[200px]"
                    />
                    <Button size="sm" variant="outline" onClick={handleSaveKey}>Save key</Button>
                  </div>
                  <RunButton onClick={handleLlm} loading={llmLoading} label="Refine with LLM" />
                  {llmError && <ErrorBanner message={llmError} />}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!output && (
        <EmptyState
          title="Add keywords + industry, then generate"
          hint="Four styles (modern, classic, playful, techy) × six techniques (compound, portmanteau, invented, prefix, suffix, alliterative). Brandability score, domain patterns, social handles, trademark links, favorites, CSV export — all 100% client-side."
          icon={<Sparkles className="h-8 w-8" />}
        />
      )}

      {favorites.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Star className="h-4 w-4" /> Favorites ({favorites.length}/{FAVORITES_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearFavorites}>Clear</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {favorites.map((f) => (
                <Badge key={f} variant="default" className="text-[11px]">{f}</Badge>
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
                <History className="h-4 w-4" /> Recent ({history.length}/{HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mr-2 text-[10px]">{STYLE_LABELS[h.style]}</Badge>
                    <span className="font-medium">{h.topName}</span>
                    <span className="text-muted-foreground ml-2">· {h.industry}</span>
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    score {h.topScore} · {new Date(h.ts).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Honesty:</strong> The brandability score is an <em>indicator</em>, not a guarantee — your market testing is the real test. Name generation never leaves your browser. Trademark caution: this tool does NOT clear names legally; always run a formal USPTO / WIPO trademark search before launching a brand. Domain "suggestions" are URL patterns plus one-click registrar links — actual availability must be verified at the registrar. The only network paths are (1) clicking an external registrar / trademark-search link, (2) the optional BYO-key LLM refinement, both of which go directly from your browser to the destination.
          </p>
        </CardContent>
      </Card>

      {/* Suppress unused-import lint for constants used by reference */}
      <span className="hidden" aria-hidden="true">{TLDS.length}{FIELD_HINTS.style.sample.length}</span>
    </div>
  );
}

// ---------- NameCard sub-component ----------

function NameCard({
  candidate,
  isFavorite,
  onToggleFav,
}: {
  candidate: NameCandidate;
  isFavorite: boolean;
  onToggleFav: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = candidate.score;
  const scoreColor =
    s.total >= 80 ? "text-emerald-600 dark:text-emerald-400"
    : s.total >= 60 ? "text-amber-600 dark:text-amber-400"
    : "text-muted-foreground";
  return (
    <div className="rounded border bg-background p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{candidate.name}</div>
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            <Badge variant="outline" className="text-[9px]">{TECHNIQUE_LABELS[candidate.technique]}</Badge>
            <span className={`text-[11px] font-mono ${scoreColor}`}>{s.total}/100</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggleFav(candidate.name)}
          className="p-1 rounded hover:bg-muted"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star
            className={`h-4 w-4 ${isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
          />
        </button>
      </div>

      {/* Score breakdown bar */}
      <div className="flex gap-0.5 h-1.5 rounded overflow-hidden bg-muted">
        <div className="bg-emerald-500" style={{ width: `${s.lengthScore / 25 * 25}%` }} title={`Length: ${s.lengthScore}/25`} />
        <div className="bg-blue-500" style={{ width: `${s.syllableScore / 25 * 25}%` }} title={`Syllables: ${s.syllableScore}/25`} />
        <div className="bg-purple-500" style={{ width: `${s.pronounceabilityScore / 25 * 25}%` }} title={`Pronounceability: ${s.pronounceabilityScore}/25`} />
        <div className="bg-amber-500" style={{ width: `${s.uniquenessScore / 25 * 25}%` }} title={`Uniqueness: ${s.uniquenessScore}/25`} />
      </div>

      {s.notes.length > 0 && (
        <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc pl-4">
          {s.notes.slice(0, 2).map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <CopyButton getText={() => candidate.name} label="Copy" size="icon-sm" />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] px-2"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide" : "Details"}
        </Button>
      </div>

      {expanded && (
        <div className="pt-1 space-y-2 border-t border-border">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
              <Globe className="h-3 w-3" /> Domain patterns
            </div>
            <div className="flex flex-wrap gap-1">
              {candidate.domainSuggestions.map((d) => (
                <a
                  key={d.domain}
                  href={d.registrarSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-border bg-background hover:bg-muted"
                  title={`Check ${d.domain} at Namecheap`}
                >
                  {d.domain} <ExternalLink className="h-2.5 w-2.5" />
                </a>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
              <AtSign className="h-3 w-3" /> Social handles
            </div>
            <div className="flex flex-wrap gap-1">
              {candidate.socialHandles.map((h) => (
                <Badge key={h} variant="outline" className="text-[10px]">{h}</Badge>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
              <Quote className="h-3 w-3" /> Tagline
            </div>
            <p className="text-[11px] text-foreground">{candidate.tagline}</p>
          </div>
        </div>
      )}
    </div>
  );
}
