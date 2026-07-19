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
  Globe, Key, History, AlertCircle, Lightbulb, Star, AtSign,
  Quote, Eye, EyeOff, Wand2, ExternalLink, ShieldAlert, Search,
} from "lucide-react";

const DEFAULT_INPUTS: NameInputs = {
  keywords: [],
  style: "modern",
  minLength: 4,
  maxLength: 12,
  maxSyllables: 4,
  noHyphen: true,
  noNumber: true,
};

const SAMPLE_KEYWORDS = "ledger, books, honest";

export default function AiDomainNameGenerator() {
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
          style: effectiveInputs.style,
          topName: top.name,
          topScore: top.score.total,
          topDomain: top.domainSuggestions[0]?.domain ?? "",
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
    setInputs((prev) => ({ ...prev, style: "modern" }));
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
            <Label htmlFor="dng-keywords" className="text-xs">
              Keywords
              <span className="ml-2 text-muted-foreground font-normal">— {FIELD_HINTS.keywords.hint}</span>
            </Label>
            <Textarea
              id="dng-keywords"
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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="dng-min" className="text-[11px]">Min length</Label>
              <Input
                id="dng-min"
                type="number"
                min={3}
                max={20}
                value={inputs.minLength}
                onChange={(e) => setInputs((prev) => ({ ...prev, minLength: parseInt(e.target.value || "0", 10) }))}
                className="text-sm h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dng-max" className="text-[11px]">Max length</Label>
              <Input
                id="dng-max"
                type="number"
                min={3}
                max={24}
                value={inputs.maxLength}
                onChange={(e) => setInputs((prev) => ({ ...prev, maxLength: parseInt(e.target.value || "0", 10) }))}
                className="text-sm h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dng-syl" className="text-[11px]">Max syllables</Label>
              <Input
                id="dng-syl"
                type="number"
                min={1}
                max={6}
                value={inputs.maxSyllables}
                onChange={(e) => setInputs((prev) => ({ ...prev, maxSyllables: parseInt(e.target.value || "0", 10) }))}
                className="text-sm h-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.noHyphen}
                onChange={(e) => setInputs((prev) => ({ ...prev, noHyphen: e.target.checked }))}
              />
              No hyphens
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={inputs.noNumber}
                onChange={(e) => setInputs((prev) => ({ ...prev, noNumber: e.target.checked }))}
              />
              No numbers
            </label>
          </div>

          {liveWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
              {liveWarnings.map((w, i) => <div key={i}>• {w}</div>)}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <RunButton onClick={handleGenerate} label="Generate names" disabled={parsedKeywords.length === 0} />
            <Button variant="ghost" size="sm" onClick={handleLoadSample} className="gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" /> Sample
            </Button>
            <ClearButton onClick={handleClear} />
            <div className="flex-1" />
            <ShareButton getUrl={() => buildShareUrl(effectiveInputs)} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {output && output.candidates.length > 0 && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Globe className="h-4 w-4" />
                {output.candidates.length} brandable names (scored, top 80 shown)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Candidates" value={output.candidates.length} />
                <Stat label="Unique names" value={output.uniqueCount} />
                <Stat label="Top score" value={output.candidates[0].score.total} highlight="good" />
                <Stat label="TLDs per name" value={TLDS.length + 1} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Search className="h-4 w-4" /> Top candidates
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => output.candidates.map((c) => c.name).join("\n")}
                    label="Copy names"
                  />
                  <DownloadButton
                    getText={() => renderCsv(output)}
                    filename="domain-names.csv"
                    mime="text/csv"
                    label="CSV"
                  />
                  <DownloadButton
                    getText={() => renderMarkdown(output, effectiveInputs)}
                    filename="domain-names.md"
                    label="Markdown"
                  />
                  <DownloadButton
                    getText={() => renderJson(output, effectiveInputs)}
                    filename="domain-names.json"
                    mime="application/json"
                    label="JSON"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-auto">
                {output.candidates.map((c, i) => (
                  <CandidateRow
                    key={`${c.slug}-${i}`}
                    candidate={c}
                    isFavorite={favorites.includes(c.slug)}
                    onToggleFav={() => handleToggleFav(c.name)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {output && output.candidates.length === 0 && (
        <EmptyState
          title="No names matched your filters"
          hint="Try widening the length range, increasing max syllables, or toggling off the no-hyphen / no-number filters."
          icon={<Globe className="h-8 w-8" />}
        />
      )}

      {!output && (
        <EmptyState
          title="Enter keywords to generate brandable domain names"
          hint="1–5 keywords separated by commas. The tool combines them with prefixes, suffixes, blends, and coined words, scores each for brandability, and suggests TLD patterns with registrar-neutral search links."
          icon={<Globe className="h-8 w-8" />}
        />
      )}

      {/* LLM polish */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <button
            type="button"
            onClick={() => setShowLlm((s) => !s)}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline"
          >
            <Wand2 className="h-4 w-4" /> Optional: polish with LLM (BYO API key)
          </button>
          {showLlm && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Paste your own OpenAI or Anthropic API key. The key is stored only in this browser's localStorage
                and is sent directly to the provider you choose — never to UnQTools.
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                  className="h-9 text-xs rounded border bg-background px-2"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
                <Input
                  type="password"
                  value={llmKey}
                  onChange={(e) => setLlmKey(e.target.value)}
                  placeholder="sk-… / anthropic key"
                  className="h-9 text-xs max-w-[260px]"
                />
                <Button variant="outline" size="sm" onClick={handleSaveKey} className="gap-1.5">
                  <Key className="h-3.5 w-3.5" /> Save key
                </Button>
                <RunButton
                  onClick={handleLlm}
                  label="Polish with LLM"
                  loading={llmLoading}
                  disabled={!llmKey || !output || output.candidates.length === 0}
                />
              </div>
              {llmError && <ErrorBanner message={llmError} />}
              {llmResult && (
                <div className="rounded-lg border bg-background p-3 text-xs space-y-2">
                  <div className="font-semibold">Refined names ({llmResult.refinedNames.length})</div>
                  <ul className="space-y-1">
                    {llmResult.refinedNames.map((n, i) => (
                      <li key={i}>
                        <span className="font-mono font-medium">{n.name}</span>
                        {n.rationale && <span className="text-muted-foreground"> — {n.rationale}</span>}
                      </li>
                    ))}
                  </ul>
                  {llmResult.taglineSuggestions.length > 0 && (
                    <div>
                      <div className="font-semibold">Tagline suggestions</div>
                      <ul className="list-disc list-inside text-muted-foreground">
                        {llmResult.taglineSuggestions.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                  {llmResult.notes.length > 0 && (
                    <div>
                      <div className="font-semibold">Notes</div>
                      <ul className="list-disc list-inside text-muted-foreground">
                        {llmResult.notes.map((t, i) => <li key={i}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Favorites */}
      {favorites.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Star className="h-4 w-4" /> Favorites ({favorites.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearFavorites}>Clear</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {favorites.slice(0, FAVORITES_MAX).map((f) => (
                <Badge key={f} variant="secondary" className="text-[11px]">{f}</Badge>
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
                <History className="h-4 w-4" /> Recent (last {HISTORY_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.topScore}/100</Badge>
                    <span className="font-mono font-medium text-foreground">{h.topName}</span>
                    <span className="text-muted-foreground">→ {h.topDomain}</span>
                  </div>
                  <div className="text-muted-foreground mt-0.5">
                    {h.keywords.join(", ")} · {STYLE_LABELS[h.style]} · {new Date(h.ts).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong className="text-foreground">Honesty:</strong> {trademarkCaution()}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CandidateRow({
  candidate,
  isFavorite,
  onToggleFav,
}: {
  candidate: NameCandidate;
  isFavorite: boolean;
  onToggleFav: () => void;
}) {
  const s = candidate.score;
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleFav}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          className="flex-shrink-0"
        >
          <Star
            className={`h-4 w-4 ${isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground hover:text-foreground"}`}
          />
        </button>
        <span className="font-mono font-semibold text-foreground text-sm">{candidate.name}</span>
        <Badge variant="outline" className="text-[10px]">{TECHNIQUE_LABELS[candidate.technique]}</Badge>
        <Badge variant="secondary" className="text-[10px]">{s.total}/100</Badge>
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          L{s.lengthScore} · S{s.syllableScore} · P{s.pronounceabilityScore} · M{s.memorabilityScore} · U{s.uniquenessScore}
        </span>
      </div>
      {s.notes.length > 0 && (
        <div className="text-[10px] text-muted-foreground pl-6">
          {s.notes.join(" · ")}
        </div>
      )}
      <div className="pl-6 text-[11px] text-muted-foreground italic flex items-start gap-1">
        <Quote className="h-3 w-3 mt-0.5 flex-shrink-0" />
        <span>{candidate.tagline}</span>
      </div>
      <div className="pl-6 flex flex-wrap gap-1.5">
        {candidate.domainSuggestions.map((d) => (
          <div key={d.domain} className="flex items-center gap-0.5">
            <span className="font-mono text-[10px] text-foreground/80">{d.domain}</span>
            <a
              href={d.namecheapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-blue-600 hover:underline dark:text-blue-400"
              title={`Check ${d.domain} on Namecheap`}
            >
              NC
              <ExternalLink className="h-2 w-2 inline ml-0.5" />
            </a>
            <a
              href={d.googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-blue-600 hover:underline dark:text-blue-400"
              title={`Check ${d.domain} on Google Domains`}
            >
              G
              <ExternalLink className="h-2 w-2 inline ml-0.5" />
            </a>
          </div>
        ))}
      </div>
      <div className="pl-6 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
        <AtSign className="h-3 w-3" />
        {candidate.socialHandles.slice(0, 3).map((h) => (
          <span key={h} className="font-mono">{h}</span>
        ))}
      </div>
      <div className="pl-6 flex flex-wrap gap-1.5 text-[10px]">
        {trademarkSearchUrls(candidate.name).map((u) => (
          <a
            key={u.label}
            href={u.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400 flex items-center gap-0.5"
          >
            {u.label} <ExternalLink className="h-2 w-2" />
          </a>
        ))}
      </div>
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
