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
  GENRE_LABELS,
  CULTURE_LABELS,
  GENDER_LABELS,
  FEEL_LABELS,
  ERA_LABELS,
  validateInputs,
  parseCastList,
  generate,
  renderCsv,
  renderMarkdown,
  renderJson,
  honestyNote,
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
  type Genre,
  type Culture,
  type Gender,
  type PhoneticFeel,
  type Era,
  type GeneratedName,
  type HistoryEntry,
  type LlmEnhancement,
} from "./logic";
import {
  Users, Key, History, AlertCircle, Heart, Sparkles, Globe,
  Eye, EyeOff, Wand2, ShieldAlert, Volume2, MapPin, Flag, Quote, RefreshCw,
} from "lucide-react";

const DEFAULT_INPUTS: NameInputs = {
  genre: "fantasy",
  culture: "nordic",
  secondaryCulture: "",
  gender: "female",
  era: "medieval",
  feel: "soft",
  count: 10,
  seed: 42,
  existingCast: [],
};

export default function AiCharacterNameGenerator() {
  const [inputs, setInputs] = useState<NameInputs>(DEFAULT_INPUTS);
  const [castRaw, setCastRaw] = useState("");
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
        if (p.inputs.existingCast && p.inputs.existingCast.length > 0) {
          setCastRaw(p.inputs.existingCast.join("\n"));
        }
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const cast = useMemo(() => parseCastList(castRaw), [castRaw]);
  const effectiveInputs = useMemo<NameInputs>(
    () => ({ ...inputs, existingCast: cast }),
    [inputs, cast],
  );
  const warnings = useMemo(() => validateInputs(effectiveInputs), [effectiveInputs]);

  const handleGenerate = useCallback(() => {
    setError("");
    try {
      const out = generate(effectiveInputs);
      setOutput(out);
      saveHistory({
        ts: Date.now(),
        genre: inputs.genre,
        culture: inputs.culture,
        count: inputs.count,
        seed: inputs.seed,
      });
      setHistory(loadHistory());
      if (out.warnings.length > 0) {
        toast.info(`${out.warnings.length} warning(s) — see below.`);
      } else {
        toast.success(`Generated ${out.count} names`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      toast.error(msg);
    }
  }, [effectiveInputs, inputs]);

  const handleReroll = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 1_000_000);
    setInputs((prev) => ({ ...prev, seed: newSeed }));
    setError("");
    try {
      const out = generate({ ...effectiveInputs, seed: newSeed });
      setOutput(out);
      saveHistory({
        ts: Date.now(),
        genre: inputs.genre,
        culture: inputs.culture,
        count: inputs.count,
        seed: newSeed,
      });
      setHistory(loadHistory());
      toast.success(`Rerolled with seed ${newSeed}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Reroll failed";
      setError(msg);
      toast.error(msg);
    }
  }, [effectiveInputs, inputs]);

  const handleClear = useCallback(() => {
    setInputs(DEFAULT_INPUTS);
    setCastRaw("");
    setOutput(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleToggleFavorite = useCallback((name: string) => {
    const next = toggleFavorite(name);
    setFavorites(next);
    if (next.includes(name)) toast.success(`Saved "${name}"`);
  }, []);

  const handleClearFavorites = useCallback(() => {
    clearFavorites();
    setFavorites([]);
    toast.success("Favorites cleared");
  }, []);

  const handleLlmPolish = useCallback(async () => {
    if (!output || output.names.length === 0) {
      toast.error("Generate names first");
      return;
    }
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      }
      const prompt = buildLlmPrompt(effectiveInputs, output.names);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const res = await fetch(url, {
        method: "POST",
        headers: llmProvider === "openai"
          ? {
              "Content-Type": "application/json",
              Authorization: `Bearer ${llmKey}`,
            }
          : {
              "Content-Type": "application/json",
              "x-api-key": llmKey,
              "anthropic-version": "2023-06-01",
            },
        body: JSON.stringify(
          llmProvider === "openai"
            ? {
                model: "gpt-4o-mini",
                messages: [
                  { role: "system", content: "You are an expert worldbuilding consultant. Always respond with valid JSON." },
                  { role: "user", content: prompt },
                ],
                temperature: 0.7,
              }
            : {
                model: "claude-3-5-haiku-latest",
                max_tokens: 1500,
                system: "You are an expert worldbuilding consultant. Always respond with valid JSON.",
                messages: [{ role: "user", content: prompt }],
              },
        ),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`LLM API ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json();
      const raw = llmProvider === "openai"
        ? (data.choices?.[0]?.message?.content ?? "")
        : (data.content?.[0]?.text ?? "");
      const parsed = renderLlmResult(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      setLlmResult(parsed.result);
      toast.success("LLM polish complete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM polish failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [output, llmKey, llmProvider, effectiveInputs]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Genre">
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={inputs.genre}
                onChange={(e) => setInputs((p) => ({ ...p, genre: e.target.value as Genre }))}
              >
                {(Object.keys(GENRE_LABELS) as Genre[]).map((g) => (
                  <option key={g} value={g}>{GENRE_LABELS[g]}</option>
                ))}
              </select>
            </Field>
            <Field label="Culture (primary)">
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={inputs.culture}
                onChange={(e) => setInputs((p) => ({ ...p, culture: e.target.value as Culture }))}
              >
                {(Object.keys(CULTURE_LABELS) as Culture[]).map((c) => (
                  <option key={c} value={c}>{CULTURE_LABELS[c]}</option>
                ))}
              </select>
            </Field>
            <Field label="Culture (secondary, optional)">
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={inputs.secondaryCulture}
                onChange={(e) => setInputs((p) => ({ ...p, secondaryCulture: e.target.value as Culture | "" }))}
              >
                <option value="">(none)</option>
                {(Object.keys(CULTURE_LABELS) as Culture[]).map((c) => (
                  <option key={c} value={c}>{CULTURE_LABELS[c]}</option>
                ))}
              </select>
            </Field>
            <Field label="Gender">
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={inputs.gender}
                onChange={(e) => setInputs((p) => ({ ...p, gender: e.target.value as Gender }))}
              >
                {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
                  <option key={g} value={g}>{GENDER_LABELS[g]}</option>
                ))}
              </select>
            </Field>
            <Field label="Era">
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={inputs.era}
                onChange={(e) => setInputs((p) => ({ ...p, era: e.target.value as Era }))}
              >
                {(Object.keys(ERA_LABELS) as Era[]).map((e) => (
                  <option key={e} value={e}>{ERA_LABELS[e]}</option>
                ))}
              </select>
            </Field>
            <Field label="Phonetic feel">
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={inputs.feel}
                onChange={(e) => setInputs((p) => ({ ...p, feel: e.target.value as PhoneticFeel }))}
              >
                {(Object.keys(FEEL_LABELS) as PhoneticFeel[]).map((f) => (
                  <option key={f} value={f}>{FEEL_LABELS[f]}</option>
                ))}
              </select>
            </Field>
            <Field label="Count (1–20)">
              <Input
                type="number"
                min={1}
                max={20}
                value={inputs.count}
                onChange={(e) => setInputs((p) => ({ ...p, count: parseInt(e.target.value, 10) || 1 }))}
                className="h-9"
              />
            </Field>
            <Field label="Seed (reproducibility)">
              <Input
                type="number"
                value={inputs.seed}
                onChange={(e) => setInputs((p) => ({ ...p, seed: parseInt(e.target.value, 10) || 0 }))}
                className="h-9"
              />
            </Field>
          </div>
          <Field label="Existing cast (one per line, optional — for clash detection)">
            <Textarea
              value={castRaw}
              onChange={(e) => setCastRaw(e.target.value)}
              placeholder={"Aria&#10;Kael&#10;Thorne"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
          </Field>
        </CardContent>
      </Card>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span className="text-amber-800 dark:text-amber-200">{w}</span>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <RunButton onClick={handleGenerate} label="Generate names" />
            <Button variant="outline" size="sm" onClick={handleReroll} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Reroll (new seed)
            </Button>
            <ShareButton getUrl={() => buildShareUrl(effectiveInputs)} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {output && output.names.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> {output.count} names (seed {output.seed})
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => renderJson(output, effectiveInputs)} label="Copy JSON" />
                  <DownloadButton getText={() => renderCsv(output)} filename="character-names.csv" mime="text/csv" label="CSV" />
                  <DownloadButton getText={() => renderMarkdown(output, effectiveInputs)} filename="character-names.md" mime="text/markdown" label="Markdown" />
                  <DownloadButton getText={() => renderJson(output, effectiveInputs)} filename="character-names.json" mime="application/json" label="JSON" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {output.names.map((n, i) => (
                  <NameCard
                    key={i}
                    name={n}
                    isFavorite={favorites.includes(n.full)}
                    onToggleFavorite={() => handleToggleFavorite(n.full)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLlm((s) => !s)}
                className="gap-1.5"
              >
                <Wand2 className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Show"} optional LLM polish (BYO key)
              </Button>
              {showLlm && (
                <div className="mt-3 space-y-2">
                  <div className="rounded border bg-amber-50 dark:bg-amber-950/30 p-2 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      Optional LLM polish sends your generated names to your chosen LLM provider (OpenAI or Anthropic) using <strong>your own API key</strong>, stored only in this browser. Your character descriptions and existing cast are NOT sent — only the genre/culture/feel and the top candidate names. Skip this if you want 100% offline.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      className="h-9 rounded border bg-background px-2 text-xs"
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                    <Input
                      type="password"
                      placeholder="Paste your API key (sk-... or sk-ant-...)"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      className="h-9 flex-1 min-w-[200px] font-mono text-xs"
                    />
                    <RunButton
                      onClick={handleLlmPolish}
                      loading={llmLoading}
                      label="Polish with LLM"
                    />
                  </div>
                  {llmError && <ErrorBanner message={llmError} />}
                  {llmResult && (
                    <div className="rounded border bg-background p-3 text-xs space-y-2">
                      <div>
                        <strong className="text-foreground">Refined names:</strong>
                        <ul className="mt-1 space-y-1">
                          {llmResult.refinedNames.map((n, i) => (
                            <li key={i}>
                              <Badge variant="secondary" className="text-[10px] mr-2">{n.name}</Badge>
                              <span className="text-muted-foreground">{n.rationale}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {llmResult.worldbuildingNotes.length > 0 && (
                        <div>
                          <strong className="text-foreground">Worldbuilding notes:</strong>
                          <ul className="mt-1 list-disc list-inside text-muted-foreground">
                            {llmResult.worldbuildingNotes.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                      {llmResult.notes.length > 0 && (
                        <div>
                          <strong className="text-foreground">Notes:</strong>
                          <ul className="mt-1 list-disc list-inside text-muted-foreground">
                            {llmResult.notes.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Configure your character and click Generate"
          hint="Pick a genre, culture, gender, and phonetic feel. Each name comes with pronunciation, stylistic meaning, variants, epithet, place name, and faction name."
          icon={<Users className="h-8 w-8" />}
        />
      )}

      {favorites.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Heart className="h-4 w-4" /> Favorites ({favorites.length}/{FAVORITES_MAX})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearFavorites}>Clear</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {favorites.map((f, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{GENRE_LABELS[h.genre]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{CULTURE_LABELS[h.culture]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.count} names</Badge>
                  <Badge variant="outline" className="text-[10px]">seed {h.seed}</Badge>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy + Honesty:</strong> {honestyNote()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function NameCard({
  name,
  isFavorite,
  onToggleFavorite,
}: {
  name: GeneratedName;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="rounded border bg-background p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {name.full}{" "}
            <span className="text-muted-foreground font-normal italic">{name.epithet}</span>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
            <Volume2 className="h-3 w-3" /> {name.pronunciation}
          </div>
        </div>
        <button
          onClick={onToggleFavorite}
          className={`flex-shrink-0 rounded p-1 ${isFavorite ? "text-red-500" : "text-muted-foreground hover:text-foreground"}`}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
        </button>
      </div>
      <div className="text-xs text-foreground">
        <span className="text-muted-foreground">Meaning:</span> {name.meaning}
      </div>
      {name.variants.length > 0 && (
        <div className="text-xs">
          <span className="text-muted-foreground">Variants:</span>{" "}
          {name.variants.map((v, i) => (
            <Badge key={i} variant="outline" className="text-[10px] mr-1">{v}</Badge>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1 text-[11px]">
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3" /> {name.placeName}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Flag className="h-3 w-3" /> {name.factionName}
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex gap-1">
          {name.cultures.map((c, i) => (
            <Badge key={i} variant="secondary" className="text-[10px]">{CULTURE_LABELS[c]}</Badge>
          ))}
        </div>
        <Badge variant={name.fitScore >= 70 ? "default" : name.fitScore >= 50 ? "secondary" : "outline"} className="text-[10px]">
          fit {name.fitScore}
        </Badge>
      </div>
      {name.warnings.length > 0 && (
        <div className="text-[10px] text-amber-700 dark:text-amber-300 flex items-start gap-1">
          <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <span>{name.warnings.join("; ")}</span>
        </div>
      )}
    </div>
  );
}
