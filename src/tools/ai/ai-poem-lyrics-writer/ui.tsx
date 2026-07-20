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
  FORM_LABELS,
  RHYME_SCHEME_LABELS,
  MOOD_LABELS,
  THEME_PRESETS,
  findRhymes,
  getRhymeEnding,
  countLineSyllables,
  validatePoemInput,
  generatePoem,
  computeStats,
  renderText,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type PoemForm,
  type RhymeScheme,
  type Mood,
  type Poem,
  type SongLyrics,
  type HistoryEntry,
  type ShareState,
} from "./logic";
import {
  Feather, Sparkles, Key, History, ChevronDown, ChevronRight,
  Search, AlertCircle, BookOpen,
} from "lucide-react";

export default function AiPoemLyricsWriter() {
  const [theme, setTheme] = useState("");
  const [form, setForm] = useState<PoemForm>("haiku");
  const [rhymeScheme, setRhymeScheme] = useState<RhymeScheme>("Free");
  const [mood, setMood] = useState<Mood>("contemplative");
  const [acrosticWord, setAcrosticWord] = useState("");
  const [work, setWork] = useState<Poem | SongLyrics | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");
  const [rhymeQuery, setRhymeQuery] = useState("");
  const [showLlm, setShowLlm] = useState(false);
  const [llmKey, setLlmKey] = useState("");
  const [llmProvider, setLlmProvider] = useState<"openai" | "anthropic">("openai");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmExtra, setLlmExtra] = useState<{
    title: string;
    lines: string[];
    syllablesPerLine: number[];
    rhymeLabels: string[];
    validationNotes: string[];
  } | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    const key = typeof localStorage !== "undefined"
      ? localStorage.getItem("unqtools:ai-poem-lyrics:llm-key")
      : null;
    if (key) setLlmKey(key);
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.theme) setTheme(p.theme);
      if (p.form) setForm(p.form);
      if (p.rhymeScheme) setRhymeScheme(p.rhymeScheme);
      if (p.mood) setMood(p.mood);
      if (p.acrosticWord !== undefined) setAcrosticWord(p.acrosticWord);
      if (p.theme) {
        toast.info("Loaded from share link");
        handleGenerate({
          theme: p.theme,
          form: p.form ?? "haiku",
          rhymeScheme: p.rhymeScheme ?? "Free",
          mood: p.mood ?? "contemplative",
          acrosticWord: p.acrosticWord ?? "",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = useCallback(
    (overrides?: {
      theme?: string;
      form?: PoemForm;
      rhymeScheme?: RhymeScheme;
      mood?: Mood;
      acrosticWord?: string;
    }) => {
      const t = (overrides?.theme ?? theme).trim();
      const f = overrides?.form ?? form;
      const r = overrides?.rhymeScheme ?? rhymeScheme;
      const m = overrides?.mood ?? mood;
      const a = overrides?.acrosticWord ?? acrosticWord;

      const err = validatePoemInput({
        theme: t, form: f, rhymeScheme: r, mood: m, acrosticWord: a,
      });
      if (err) {
        setError(err);
        setWork(null);
        toast.error(err);
        return;
      }
      setError("");
      setLlmExtra(null);
      try {
        const out = generatePoem({ theme: t, form: f, rhymeScheme: r, mood: m, acrosticWord: a });
        setWork(out);
        const stats = computeStats(out);
        saveHistory({
          ts: Date.now(),
          theme: t,
          form: f,
          rhymeScheme: r,
          mood: m,
          lineCount: stats.lineCount,
          isSong: f === "song",
        });
        setHistory(loadHistory());
        toast.success(
          `Wrote ${stats.lineCount} lines (${f === "song" ? "song" : "poem"})`,
        );
      } catch (e) {
        const msg = (e as Error).message;
        setError(msg);
        toast.error(msg);
      }
    },
    [theme, form, rhymeScheme, mood, acrosticWord],
  );

  const stats = useMemo(() => (work ? computeStats(work) : null), [work]);

  const rhymeResults = useMemo(() => {
    const q = rhymeQuery.trim();
    if (!q) return { ending: "", rhymes: [] as string[] };
    return {
      ending: getRhymeEnding(q),
      rhymes: findRhymes(q).slice(0, 20),
    };
  }, [rhymeQuery]);

  const handleClear = useCallback(() => {
    setTheme("");
    setAcrosticWord("");
    setWork(null);
    setLlmExtra(null);
    setError("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveLlmKey = () => {
    if (typeof localStorage !== "undefined") {
      if (llmKey) localStorage.setItem("unqtools:ai-poem-lyrics:llm-key", llmKey);
      else localStorage.removeItem("unqtools:ai-poem-lyrics:llm-key");
    }
    toast.success(llmKey ? "API key saved locally" : "API key cleared");
  };

  const handleLlmEnhance = useCallback(async () => {
    if (!llmKey) { toast.error("Please paste your API key first"); return; }
    if (!theme.trim()) { toast.error("Enter a theme first"); return; }
    setLlmLoading(true);
    setError("");
    try {
      const prompt = buildLlmPrompt(theme.trim(), form, rhymeScheme, mood, acrosticWord);
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
            { role: "system", content: "You are a poet who writes original, form-aware verse." },
            { role: "user", content: prompt },
          ],
          temperature: 0.9,
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
      setLlmExtra(parsed.result);
      toast.success(`LLM wrote ${parsed.result.lines.length} lines`);
    } catch (e) {
      setError(`LLM request error: ${(e as Error).message}`);
      toast.error("LLM request error");
    }
    setLlmLoading(false);
  }, [llmKey, llmProvider, theme, form, rhymeScheme, mood, acrosticWord]);

  const shareState: ShareState = { theme, form, rhymeScheme, mood, acrosticWord };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ai-poem-theme">Theme / subject</Label>
            <Textarea
              id="ai-poem-theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder={"e.g., Autumn rain, The sea at dawn, A childhood memory"}
              className="min-h-[60px] resize-y text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {THEME_PRESETS.map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setTheme(p)}
                >+ {p}</Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Form</Label>
              <select
                value={form}
                onChange={(e) => setForm(e.target.value as PoemForm)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(FORM_LABELS) as PoemForm[]).map((f) => (
                  <option key={f} value={f}>{FORM_LABELS[f]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rhyme scheme</Label>
              <select
                value={rhymeScheme}
                onChange={(e) => setRhymeScheme(e.target.value as RhymeScheme)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(RHYME_SCHEME_LABELS) as RhymeScheme[]).map((r) => (
                  <option key={r} value={r}>{RHYME_SCHEME_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mood</Label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value as Mood)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(MOOD_LABELS) as Mood[]).map((m) => (
                  <option key={m} value={m}>{MOOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>

          {form === "acrostic" && (
            <div className="space-y-1">
              <Label htmlFor="ai-poem-acro" className="text-xs">Acrostic word (2-16 letters)</Label>
              <Input
                id="ai-poem-acro"
                value={acrosticWord}
                onChange={(e) => setAcrosticWord(e.target.value)}
                placeholder="e.g., STAR, MEMORY, PEACE"
                className="h-8 text-xs"
                maxLength={16}
              />
              {acrosticWord && (
                <p className="text-[10px] text-muted-foreground">
                  Letters: {acrosticWord.toUpperCase().replace(/[^A-Z]/g, "").split("").join(" · ")}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <RunButton
              onClick={() => handleGenerate()}
              label={form === "song" ? "Write lyrics" : "Write poem"}
              loading={false}
              disabled={!theme.trim()}
            />
            <ShareButton getUrl={() => buildShareUrl(shareState)} disabled={!theme.trim()} />
            <ClearButton onClick={handleClear} disabled={!theme && !work} />
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {work && stats ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> {work.title}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Lines" value={stats.lineCount} />
                <Stat label="Total syllables" value={stats.syllableTotal} />
                <Stat label="Rhyme groups" value={stats.rhymeGroups} />
                <Stat label="Avg syl/line" value={stats.avgSyllablesPerLine} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Feather className="h-4 w-4" />
                  {"sections" in work ? "Lyrics" : "Poem"}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => renderText(work)} label="Copy text" />
                  <DownloadButton
                    getText={() => renderMarkdown(work)}
                    filename={work.id + ".md"}
                    mime="text/markdown"
                    label="Download .md"
                  />
                  <DownloadButton
                    getText={() => renderJson(work)}
                    filename={work.id + ".json"}
                    mime="application/json"
                    label="Download .json"
                  />
                </div>
              </div>

              {"sections" in work ? (
                <div className="space-y-3">
                  {work.sections.map((s, si) => (
                    <div key={si} className="space-y-1">
                      <Badge variant="secondary" className="text-[10px]">{s.label}</Badge>
                      <div className="rounded border bg-background px-3 py-2 text-sm space-y-0.5">
                        {s.lines.map((l, li) => (
                          <div key={li} className="flex items-baseline gap-2">
                            <span className="flex-1 text-foreground italic">{l.text}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {l.syllables}s · {l.rhymeLabel}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {work.lines.map((l, li) => (
                    <div key={li} className="flex items-baseline gap-2 rounded border bg-background px-3 py-1.5 text-sm">
                      {l.acrosticLetter && (
                        <Badge variant="outline" className="text-[10px] font-mono">{l.acrosticLetter}</Badge>
                      )}
                      <span className="flex-1 text-foreground italic">{l.text}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {l.syllables}s · {l.rhymeLabel}
                      </span>
                    </div>
                  ))}
                  <div className="rounded border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs">
                    <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">Form validation</p>
                    <ul className="list-disc ml-4 text-amber-800 dark:text-amber-300 space-y-0.5">
                      {work.validation.notes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Optional LLM enhancement */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <button
                className="flex items-center gap-1.5 text-sm font-semibold text-foreground w-full"
                onClick={() => setShowLlm((v) => !v)}
              >
                {showLlm ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Key className="h-4 w-4" /> Optional: Enhance with LLM (BYO API key)
              </button>
              {showLlm && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Paste your own OpenAI or Anthropic API key. Stored only in localStorage on this device. The tool builds an optimal prompt and parses the JSON response into a fresh poem.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="password"
                      placeholder="sk-... or anthropic key"
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <div className="flex gap-2">
                      <select
                        value={llmProvider}
                        onChange={(e) => setLlmProvider(e.target.value as "openai" | "anthropic")}
                        className="h-8 text-xs rounded border bg-background px-2 flex-1"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                      </select>
                      <Button size="sm" variant="outline" onClick={handleSaveLlmKey} className="h-8">
                        Save key
                      </Button>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleLlmEnhance}
                    disabled={llmLoading || !llmKey || !theme.trim()}
                    className="gap-1.5"
                  >
                    {llmLoading ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {llmLoading ? "Working…" : "Enhance with LLM"}
                  </Button>
                  {llmExtra && (
                    <div className="space-y-2 pt-2 border-t">
                      {llmExtra.title && (
                        <p className="text-sm font-semibold text-foreground">{llmExtra.title}</p>
                      )}
                      <div className="rounded border bg-violet-50 dark:bg-violet-950/30 px-3 py-2 text-sm space-y-0.5">
                        {llmExtra.lines.map((l, i) => (
                          <div key={i} className="flex items-baseline gap-2">
                            <span className="flex-1 italic text-foreground">{l}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {llmExtra.syllablesPerLine[i] ?? "?"}s · {llmExtra.rhymeLabels[i] ?? "?"}
                            </span>
                          </div>
                        ))}
                      </div>
                      {llmExtra.validationNotes.length > 0 && (
                        <div className="text-xs">
                          <p className="font-semibold text-foreground mb-1">LLM validation notes</p>
                          <ul className="list-disc ml-4 text-muted-foreground">
                            {llmExtra.validationNotes.map((n, i) => <li key={i}>{n}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    Output is original; never copy real copyrighted lyrics or published poems. Strict meter is hard for small models; the analyzer flags misses either way.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a theme to write a poem or song"
          hint="Pick a form (haiku, sonnet, free verse, limerick, acrostic, or song), choose a rhyme scheme and mood. We'll write original verse with syllable counts and form validation."
          icon={<Feather className="h-8 w-8" />}
        />
      )}

      {/* Rhyme helper sidebar */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Rhyme helper
          </h3>
          <div className="flex gap-2">
            <Input
              type="text"
              value={rhymeQuery}
              onChange={(e) => setRhymeQuery(e.target.value)}
              placeholder="Type a word to find rhymes…"
              className="h-8 text-xs"
            />
          </div>
          {rhymeQuery.trim() && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground">
                Rhyme ending: <span className="font-mono">{rhymeResults.ending || "(unknown)"}</span>
              </p>
              {rhymeResults.rhymes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {rhymeResults.rhymes.map((r) => (
                    <Badge
                      key={r}
                      variant="outline"
                      className="text-[10px] cursor-pointer"
                      onClick={() => {
                        navigator.clipboard?.writeText(r).then(() => toast.success(`Copied "${r}"`));
                      }}
                    >
                      {r}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  No rhymes found in the 200+ word dictionary for &ldquo;{rhymeQuery}&rdquo;.
                </p>
              )}
            </div>
          )}
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
                <button
                  key={i}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/40 transition"
                  onClick={() => {
                    setTheme(h.theme);
                    setForm(h.form);
                    setRhymeScheme(h.rhymeScheme);
                    setMood(h.mood);
                    handleGenerate({
                      theme: h.theme, form: h.form, rhymeScheme: h.rhymeScheme, mood: h.mood,
                    });
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{FORM_LABELS[h.form].split(" ")[0]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{MOOD_LABELS[h.mood]}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.lineCount} lines</Badge>
                    <span className="font-medium text-foreground">{h.theme}</span>
                    <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
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
            <strong className="text-foreground">Privacy:</strong> All poem generation, syllable counting, and rhyme lookups run locally in your browser. Themes never leave this device. The only network call is if you paste your own LLM API key and click &ldquo;Enhance with LLM&rdquo; — that request goes directly to your chosen provider. Output is original; do not copy real copyrighted lyrics. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

// Suppress unused-import lint
export type _Unused = typeof Search;
