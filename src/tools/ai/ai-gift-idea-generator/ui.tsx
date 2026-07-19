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
  RECIPIENT_LABELS,
  OCCASION_LABELS,
  INTEREST_LABELS,
  BUDGET_LABELS,
  GIFT_DATABASE,
  HONESTY_NOTE,
  LLM_KEY_STORAGE,
  normalizeString,
  parseList,
  validateProfile,
  generatePlan,
  groupByTier,
  buildShoppingUrl,
  renderText,
  renderMarkdown,
  renderJson,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  loadProfiles,
  saveProfile,
  removeProfile,
  clearProfiles,
  buildShareUrl,
  parseShareUrl,
  makeId,
  buildLlmPrompt,
  parseLlmResult,
  renderLlmResult,
  type RecipientType,
  type Occasion,
  type Interest,
  type BudgetTier,
  type RecipientProfile,
  type GiftPlan,
  type HistoryEntry,
  type SavedProfile,
  type LlmEnhancement,
} from "./logic";
import {
  Gift, History, Heart, Sparkles, ExternalLink,
  Search, ShieldAlert, Trash2, Key, Wand2,
} from "lucide-react";

const DEFAULT_PROFILE: RecipientProfile = {
  name: "",
  recipient: "partner",
  age: 30,
  interests: [],
  occasion: "birthday",
  budget: "mid",
  avoid: [],
  preferExperience: false,
  diyMode: false,
};

export default function AiGiftIdeaGenerator() {
  const [profile, setProfile] = useState<RecipientProfile>(DEFAULT_PROFILE);
  const [interestsText, setInterestsText] = useState("");
  const [avoidText, setAvoidText] = useState("");
  const [plan, setPlan] = useState<GiftPlan | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [error, setError] = useState("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [llmResult, setLlmResult] = useState<LlmEnhancement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    setSavedProfiles(loadProfiles());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem(LLM_KEY_STORAGE)
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const s = parseShareUrl(window.location.hash);
      if (s) {
        setProfile({
          name: s.name,
          recipient: s.recipient,
          age: s.age,
          interests: s.interests,
          occasion: s.occasion,
          budget: s.budget,
          avoid: s.avoid,
          preferExperience: s.preferExperience,
          diyMode: s.diyMode,
        });
        setInterestsText(s.interests.join("\n"));
        setAvoidText(s.avoid.join("\n"));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const effectiveProfile = useMemo<RecipientProfile>(() => ({
    ...profile,
    interests: parseList(interestsText) as Interest[],
    avoid: parseList(avoidText),
  }), [profile, interestsText, avoidText]);

  const warnings = useMemo(() => validateProfile(effectiveProfile), [effectiveProfile]);

  const handleGenerate = useCallback(() => {
    setError("");
    try {
      const next = generatePlan(effectiveProfile, 12);
      setPlan(next);
      saveHistory({
        ts: Date.now(),
        recipientName: effectiveProfile.name || "Unnamed",
        recipient: effectiveProfile.recipient,
        occasion: effectiveProfile.occasion,
        budget: effectiveProfile.budget,
        count: next.count,
      });
      setHistory(loadHistory());
      toast.success(`Generated ${next.count} gift ideas`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      toast.error(msg);
    }
  }, [effectiveProfile]);

  const handleClear = useCallback(() => {
    setProfile(DEFAULT_PROFILE);
    setInterestsText("");
    setAvoidText("");
    setPlan(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleSaveProfile = useCallback(() => {
    if (!effectiveProfile.name.trim()) {
      toast.error("Add a recipient name to save this profile");
      return;
    }
    const next = saveProfile(effectiveProfile);
    setSavedProfiles(next);
    toast.success(`Saved profile for ${effectiveProfile.name}`);
  }, [effectiveProfile]);

  const handleLoadProfile = useCallback((p: RecipientProfile) => {
    setProfile(p);
    setInterestsText(p.interests.join("\n"));
    setAvoidText(p.avoid.join("\n"));
    toast.info(`Loaded profile for ${p.name}`);
  }, []);

  const handleRemoveProfile = useCallback((id: string) => {
    const next = removeProfile(id);
    setSavedProfiles(next);
    toast.info("Removed profile");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleClearProfiles = useCallback(() => {
    clearProfiles();
    setSavedProfiles([]);
    toast.success("Saved profiles cleared");
  }, []);

  const handleLlmPolish = useCallback(async () => {
    if (!llmKey) {
      toast.error("Paste your LLM API key first");
      return;
    }
    if (!plan || plan.suggestions.length === 0) {
      toast.error("Generate ideas first, then polish with LLM");
      return;
    }
    setLlmLoading(true);
    setLlmError("");
    setLlmResult(null);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(LLM_KEY_STORAGE, llmKey);
      }
      const prompt = buildLlmPrompt(effectiveProfile, plan.suggestions);
      const url = llmProvider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages";
      const res = await fetch(url, {
        method: "POST",
        headers: llmProvider === "openai"
          ? { "Content-Type": "application/json", Authorization: `Bearer ${llmKey}` }
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
                  { role: "system", content: "You are a thoughtful gift advisor. Respond with a numbered list of 5 fresh gift ideas, each with name, price range, why it fits, and a neutral search term." },
                  { role: "user", content: prompt },
                ],
                temperature: 0.7,
              }
            : {
                model: "claude-3-5-haiku-latest",
                max_tokens: 1500,
                system: "You are a thoughtful gift advisor. Respond with a numbered list of 5 fresh gift ideas, each with name, price range, why it fits, and a neutral search term.",
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
      const model = llmProvider === "openai" ? "gpt-4o-mini" : "claude-3-5-haiku-latest";
      const parsed = parseLlmResult(raw, model);
      setLlmResult(parsed);
      toast.success("LLM polish complete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "LLM polish failed";
      setLlmError(msg);
      toast.error(msg);
    } finally {
      setLlmLoading(false);
    }
  }, [llmKey, llmProvider, plan, effectiveProfile]);

  const grouped = useMemo(() => plan ? groupByTier(plan.suggestions) : null, [plan]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gig-name">Recipient name</Label>
              <Input
                id="gig-name"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                placeholder="Sam"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gig-age">Age</Label>
              <Input
                id="gig-age"
                type="number"
                min={1}
                max={120}
                value={profile.age}
                onChange={(e) => setProfile((p) => ({ ...p, age: Number(e.target.value) || 0 }))}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Relationship</Label>
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={profile.recipient}
                onChange={(e) => setProfile((p) => ({ ...p, recipient: e.target.value as RecipientType }))}
              >
                {(Object.keys(RECIPIENT_LABELS) as RecipientType[]).map((r) => (
                  <option key={r} value={r}>{RECIPIENT_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Occasion</Label>
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={profile.occasion}
                onChange={(e) => setProfile((p) => ({ ...p, occasion: e.target.value as Occasion }))}
              >
                {(Object.keys(OCCASION_LABELS) as Occasion[]).map((o) => (
                  <option key={o} value={o}>{OCCASION_LABELS[o]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Budget tier</Label>
              <select
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                value={profile.budget}
                onChange={(e) => setProfile((p) => ({ ...p, budget: e.target.value as BudgetTier }))}
              >
                {(Object.keys(BUDGET_LABELS) as BudgetTier[]).map((b) => (
                  <option key={b} value={b}>{BUDGET_LABELS[b]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gig-interests">Interests (one per line or comma-separated)</Label>
            <Textarea
              id="gig-interests"
              value={interestsText}
              onChange={(e) => setInterestsText(e.target.value)}
              placeholder={"books\ntravel"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {(Object.keys(INTEREST_LABELS) as Interest[]).map((i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setInterestsText((prev) => (prev ? `${prev}\n${i}` : i))}
                >+ {INTEREST_LABELS[i]}</Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gig-avoid">Gifts to avoid (anti-repeat — one per line)</Label>
            <Textarea
              id="gig-avoid"
              value={avoidText}
              onChange={(e) => setAvoidText(e.target.value)}
              placeholder={"mug\nlast year's sweater"}
              className="min-h-[60px] resize-y font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={profile.preferExperience}
                onChange={(e) => setProfile((p) => ({ ...p, preferExperience: e.target.checked }))}
              />
              Prefer experiences over objects
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={profile.diyMode}
                onChange={(e) => setProfile((p) => ({ ...p, diyMode: e.target.checked }))}
              />
              DIY-friendly ideas
            </label>
          </div>

          {warnings.length > 0 && (
            <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-300">
              {warnings.map((w, i) => (<div key={i}>• {w}</div>))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <RunButton onClick={handleGenerate} label="Generate ideas" />
            <ClearButton onClick={handleClear} />
            <Button variant="outline" size="sm" onClick={handleSaveProfile} className="gap-1.5">
              <Heart className="h-3.5 w-3.5" /> Save profile
            </Button>
            <ShareButton
              getUrl={() => buildShareUrl({
                name: effectiveProfile.name,
                recipient: effectiveProfile.recipient,
                age: effectiveProfile.age,
                interests: effectiveProfile.interests,
                occasion: effectiveProfile.occasion,
                budget: effectiveProfile.budget,
                avoid: effectiveProfile.avoid,
                preferExperience: effectiveProfile.preferExperience,
                diyMode: effectiveProfile.diyMode,
              })}
              disabled={!effectiveProfile.name && effectiveProfile.interests.length === 0}
            />
          </div>
        </CardContent>
      </Card>

      {savedProfiles.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Heart className="h-4 w-4" /> Saved profiles ({savedProfiles.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearProfiles}>Clear all</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {savedProfiles.map((sp) => (
                <div key={sp.id} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                  <Badge variant="outline" className="text-[10px]">{RECIPIENT_LABELS[sp.profile.recipient]}</Badge>
                  <span className="font-medium text-foreground">{sp.profile.name || "Unnamed"}</span>
                  <span className="text-muted-foreground">· {OCCASION_LABELS[sp.profile.occasion]} · {BUDGET_LABELS[sp.profile.budget]}</span>
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => handleLoadProfile(sp.profile)}>Load</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => handleRemoveProfile(sp.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {plan && plan.suggestions.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Gift className="h-4 w-4" /> {plan.count} gift ideas for {plan.profile.name || "your recipient"}
                </h3>
                <div className="text-xs text-muted-foreground">
                  {GIFT_DATABASE.length}-gift database · {RECIPIENT_LABELS[plan.profile.recipient]} · {OCCASION_LABELS[plan.profile.occasion]} · {BUDGET_LABELS[plan.profile.budget]}
                </div>
              </div>
              {plan.warnings.length > 0 && (
                <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-300">
                  {plan.warnings.map((w, i) => (<div key={i}>• {w}</div>))}
                </div>
              )}
            </CardContent>
          </Card>

          {grouped && (
            <Card>
              <CardContent className="p-4 space-y-3">
                {(["splurge", "mid", "low"] as BudgetTier[]).map((tier) => (
                  grouped[tier].length > 0 && (
                    <div key={tier} className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {BUDGET_LABELS[tier]} ({grouped[tier].length})
                      </div>
                      {grouped[tier].map((s, idx) => (
                        <div key={`${s.id}-${idx}`} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground text-sm">{s.name}</span>
                            <Badge variant="secondary" className="text-[10px]">{s.priceRange}</Badge>
                            {s.isExperience && <Badge variant="outline" className="text-[10px]">experience</Badge>}
                            {s.isDiy && <Badge variant="outline" className="text-[10px]">DIY</Badge>}
                          </div>
                          <div className="text-muted-foreground">
                            <span className="font-medium">{s.category}</span> · Why this fits: {s.why}
                          </div>
                          <div className="flex items-center gap-2 pt-0.5">
                            <Search className="h-3 w-3 text-muted-foreground" />
                            <a
                              href={buildShoppingUrl(s.searchTerm)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[11px] text-primary hover:underline flex items-center gap-1"
                            >
                              {s.searchTerm}
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ))}
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton getText={() => renderText(plan)} label="Copy text" />
                  <DownloadButton getText={() => renderMarkdown(plan)} filename="gift-ideas.md" mime="text/markdown" label="Download .md" />
                  <DownloadButton getText={() => renderText(plan)} filename="gift-ideas.txt" label="Download .txt" />
                  <DownloadButton getText={() => renderCsv(plan)} filename="gift-ideas.csv" mime="text/csv" label="Download CSV" />
                  <DownloadButton getText={() => renderJson(plan)} filename="gift-ideas.json" mime="application/json" label="Download JSON" />
                  <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowLlm((v) => !v)} className="gap-1.5">
                    <Wand2 className="h-3.5 w-3.5" /> {showLlm ? "Hide" : "Show"} LLM polish
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {showLlm && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="h-4 w-4" /> BYO-key LLM polish (optional, never uploads via our servers)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    className="h-9 rounded border bg-background px-2 text-sm"
                    value={llmProvider}
                    onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                  >
                    <option value="openai">OpenAI (gpt-4o-mini)</option>
                    <option value="anthropic">Anthropic (claude-3-5-haiku)</option>
                  </select>
                  <Input
                    type="password"
                    placeholder="Paste API key (stored only in this browser)"
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <RunButton
                    onClick={handleLlmPolish}
                    loading={llmLoading}
                    label="Polish with LLM"
                  />
                  {llmKey && (
                    <Button variant="ghost" size="sm" onClick={() => {
                      setLlmKey("");
                      if (typeof localStorage !== "undefined") localStorage.removeItem(LLM_KEY_STORAGE);
                      toast.info("API key cleared");
                    }}>
                      Clear key
                    </Button>
                  )}
                </div>
                {llmError && <ErrorBanner message={llmError} />}
                {llmResult && (
                  <div className="rounded border bg-background p-3 text-xs space-y-1">
                    <div className="font-semibold text-foreground">{renderLlmResult(llmResult).split("\n")[0]}</div>
                    {llmResult.suggestions.map((s, i) => (
                      <div key={i} className="space-y-0.5">
                        <div className="font-medium">{i + 1}. {s.name} {s.priceRange && `[${s.priceRange}]`}</div>
                        {s.why && <div className="text-muted-foreground">Why: {s.why}</div>}
                        {s.searchTerm && (
                          <a href={buildShoppingUrl(s.searchTerm)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono text-[11px] inline-flex items-center gap-1">
                            {s.searchTerm} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Describe your recipient to get personalized gift ideas"
          hint="Fill in the recipient profile above and click Generate. We'll match against a 60+ gift database, rank by fit, and show price tiers plus neutral shopping hints (no affiliate links)."
          icon={<Gift className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.count} ideas</Badge>
                  <span className="font-medium text-foreground">{h.recipientName}</span>
                  <span className="text-muted-foreground ml-2">· {RECIPIENT_LABELS[h.recipient]} · {OCCASION_LABELS[h.occasion]} · {BUDGET_LABELS[h.budget]}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span><strong className="text-foreground">Honesty:</strong> {HONESTY_NOTE}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
