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
  LANGUAGES,
  LANGUAGE_LABELS,
  CATEGORIES,
  CATEGORY_LABELS,
  PRACTICE_MODES,
  PRACTICE_MODE_LABELS,
  DIFFICULTY_LABELS,
  CONJUGATIONS,
  CONJUGATION_VERBS,
  TENSES,
  TENSE_LABELS,
  PRONOUNS,
  PHRASES,
  buildFlashcards,
  buildNumberTable,
  buildShareUrl,
  clearHistory,
  computeStats,
  filterPhrases,
  getPhrasePronunciation,
  getPhraseText,
  loadHistory,
  lookupReverse,
  lookupTranslation,
  parseShareUrl,
  renderCsv,
  renderText,
  saveHistory,
  shuffleCards,
  translateNumber,
  type HistoryEntry,
  type LanguageCode,
  type Phrase,
  type PhraseCategory,
  type PracticeMode,
} from "./logic";
import {
  Languages, Search, History, BookOpen, Layers, RotateCcw,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  Table, Hash,
} from "lucide-react";

const LANGUAGE_OPTIONS = LANGUAGES;
const CATEGORY_OPTIONS: Array<PhraseCategory | ""> = ["", ...CATEGORIES];

export default function LanguageTranslatorHelper() {
  // ---- Inputs ----
  const [source, setSource] = useState<LanguageCode>("english");
  const [target, setTarget] = useState<LanguageCode>("spanish");
  const [category, setCategory] = useState<PhraseCategory | "">("");
  const [mode, setMode] = useState<PracticeMode>("browse");
  const [search, setSearch] = useState("");

  // ---- Lookup tool ----
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResult, setLookupResult] = useState<{
    phrase: Phrase;
    result: string;
    pronunciation?: string;
  } | null>(null);
  const [reverseMode, setReverseMode] = useState(false);

  // ---- Flashcard state ----
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // ---- Reverse-translation state ----
  const [reverseAnswer, setReverseAnswer] = useState("");
  const [reverseFeedback, setReverseFeedback] = useState<"none" | "correct" | "incorrect">("none");

  // ---- Conjugation / number tabs ----
  const [tab, setTab] = useState<"phrases" | "conjugations" | "numbers">("phrases");
  const [selectedVerb, setSelectedVerb] = useState<string>(CONJUGATION_VERBS[0]);
  const [numLang, setNumLang] = useState<LanguageCode>("spanish");
  const [numValue, setNumValue] = useState<number>(42);

  // ---- History ----
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.source) setSource(p.source);
      if (p.target) setTarget(p.target);
      if (p.category) setCategory(p.category);
      if (p.mode) setMode(p.mode);
      if (p.search) setSearch(p.search);
      const hasAny = p.source !== "english" || p.target !== "spanish" || p.category || p.mode !== "browse" || p.search;
      if (hasAny) toast.info("Loaded from share link");
    }
  }, []);

  const filtered = useMemo(
    () => filterPhrases(category, source, target, search),
    [category, source, target, search],
  );
  const stats = useMemo(
    () => computeStats(filtered, source, target),
    [filtered, source, target],
  );
  const cards = useMemo(
    () => shuffleCards(buildFlashcards(filtered, source, target)),
    [filtered, source, target],
  );
  const currentCard = cards[cardIndex] ?? null;

  const textReport = useMemo(
    () => renderText(filtered, source, target),
    [filtered, source, target],
  );
  const csvReport = useMemo(
    () => renderCsv(filtered, source, target),
    [filtered, source, target],
  );

  const numberTable = useMemo(() => buildNumberTable(), []);
  const selectedConjugation = useMemo(
    () => CONJUGATIONS.find((c) => c.verb === selectedVerb) ?? CONJUGATIONS[0],
    [selectedVerb],
  );

  // ---- Handlers ----
  const handleLookup = useCallback(() => {
    if (!lookupQuery.trim()) {
      toast.error("Enter a phrase to look up");
      return;
    }
    const result = reverseMode
      ? lookupReverse(source, target, lookupQuery)
      : lookupTranslation(source, target, lookupQuery);
    if (!result) {
      toast.error("Phrase not found in the built-in dictionary");
      setLookupResult(null);
      return;
    }
    setLookupResult(result);
    toast.success("Found");
  }, [lookupQuery, source, target, reverseMode]);

  const swapLanguages = useCallback(() => {
    setSource(target);
    setTarget(source);
    setLookupResult(null);
  }, [source, target]);

  const handleClear = useCallback(() => {
    setSource("english");
    setTarget("spanish");
    setCategory("");
    setMode("browse");
    setSearch("");
    setLookupQuery("");
    setLookupResult(null);
    setCardIndex(0);
    setFlipped(false);
    setReverseAnswer("");
    setReverseFeedback("none");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (filtered.length > 0) {
      saveHistory({
        ts: Date.now(),
        sourceLanguage: source,
        targetLanguage: target,
        category: (category || "greetings") as PhraseCategory,
        mode,
        phraseCount: filtered.length,
      });
      setHistory(loadHistory());
    }
  }, [filtered, source, target, category, mode]);

  const nextCard = useCallback(() => {
    setFlipped(false);
    setCardIndex((i) => (i + 1) % Math.max(1, cards.length));
  }, [cards.length]);
  const prevCard = useCallback(() => {
    setFlipped(false);
    setCardIndex((i) => (i - 1 + cards.length) % Math.max(1, cards.length));
  }, [cards.length]);

  const checkReverse = useCallback(() => {
    if (!currentCard) return;
    const correct = currentCard.back.toLowerCase().trim();
    const user = reverseAnswer.toLowerCase().trim();
    if (!user) {
      toast.error("Type your answer first");
      return;
    }
    if (user === correct) {
      setReverseFeedback("correct");
      toast.success("Correct!");
    } else {
      setReverseFeedback("incorrect");
      toast.error(`Incorrect — correct answer: ${currentCard.back}`);
    }
  }, [currentCard, reverseAnswer]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Source language</Label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as LanguageCode)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target language</Label>
              <div className="flex gap-1">
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value as LanguageCode)}
                  className="h-8 flex-1 text-xs rounded border bg-background px-2"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={swapLanguages}
                  title="Swap languages"
                  className="h-8 w-8"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PhraseCategory | "")}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c || "all"} value={c}>
                    {c ? CATEGORY_LABELS[c] : "All categories"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Practice mode</Label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as PracticeMode)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {PRACTICE_MODES.map((m) => (
                  <option key={m} value={m}>{PRACTICE_MODE_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="lth-search">Search phrases (optional)</Label>
            <Input
              id="lth-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. hello, water, where…"
              className="h-8 text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <ShareButton getUrl={() => buildShareUrl({ source, target, category, mode, search })} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardContent className="p-2">
          <div className="flex flex-wrap gap-1">
            <TabButton active={tab === "phrases"} onClick={() => setTab("phrases")} icon={<BookOpen className="h-3.5 w-3.5" />}>
              Phrases ({PHRASES.length})
            </TabButton>
            <TabButton active={tab === "conjugations"} onClick={() => setTab("conjugations")} icon={<Table className="h-3.5 w-3.5" />}>
              Conjugations ({CONJUGATIONS.length} verbs)
            </TabButton>
            <TabButton active={tab === "numbers"} onClick={() => setTab("numbers")} icon={<Hash className="h-3.5 w-3.5" />}>
              Numbers (1-100)
            </TabButton>
          </div>
        </CardContent>
      </Card>

      {tab === "phrases" && (
        <>
          {/* Translation lookup tool */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Search className="h-4 w-4" /> Translation lookup
                </h3>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reverseMode}
                    onChange={(e) => {
                      setReverseMode(e.target.checked);
                      setLookupResult(null);
                    }}
                  />
                  {"Reverse (target → source)"}
                </label>
              </div>
              <div className="flex gap-2">
                <Input
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  placeholder={reverseMode
                    ? `Enter ${LANGUAGE_LABELS[target]} phrase to find ${LANGUAGE_LABELS[source]}…`
                    : `Enter ${LANGUAGE_LABELS[source]} phrase to find ${LANGUAGE_LABELS[target]}…`
                  }
                  className="text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") handleLookup(); }}
                />
                <Button onClick={handleLookup} size="sm">Look up</Button>
              </div>
              {lookupResult && (
                <div className="rounded border bg-muted/40 px-3 py-2 text-sm space-y-1">
                  <div>
                    <span className="text-muted-foreground text-xs">{LANGUAGE_LABELS[source]}: </span>
                    <span className="font-mono text-foreground">
                      {getPhraseText(lookupResult.phrase, source)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">{LANGUAGE_LABELS[target]}: </span>
                    <span className="font-mono text-foreground">{lookupResult.result}</span>
                  </div>
                  {lookupResult.pronunciation && (
                    <div>
                      <span className="text-muted-foreground text-xs">Pronunciation: </span>
                      <span className="font-mono text-foreground italic">{lookupResult.pronunciation}</span>
                    </div>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {CATEGORY_LABELS[lookupResult.phrase.category]}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] ml-1">
                    {DIFFICULTY_LABELS[lookupResult.phrase.difficulty]}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Languages className="h-4 w-4" />
                {filtered.length} phrases · {LANGUAGE_LABELS[source]} → {LANGUAGE_LABELS[target]}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total phrases" value={stats.totalPhrases} />
                <Stat label="Languages" value={LANGUAGES.length} />
                <Stat label="Categories" value={CATEGORIES.length} />
                <Stat label="Verbs conjugated" value={CONJUGATIONS.length} />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {CATEGORIES.map((c) => (
                  <Badge key={c} variant="outline" className="text-[10px]">
                    {CATEGORY_LABELS[c]}: {stats.byCategory[c]}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Mode-specific UI */}
          {mode === "browse" && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" /> Phrasebook
                  </h3>
                  <div className="flex gap-2">
                    <CopyButton getText={() => { handleSaveHistory(); return textReport; }} label="Copy report" />
                    <DownloadButton getText={() => textReport} filename="phrasebook.txt" mime="text/plain" label="Download .txt" />
                    <DownloadButton getText={() => csvReport} filename="phrasebook.csv" mime="text/csv" label="Download CSV" />
                  </div>
                </div>
                {filtered.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No phrases match the current filter.</p>
                ) : (
                  <div className="space-y-1 max-h-[500px] overflow-auto">
                    {filtered.map((p) => (
                      <div key={p.id} className="rounded border bg-background px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[p.category]}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{DIFFICULTY_LABELS[p.difficulty]}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[10px] text-muted-foreground">{LANGUAGE_LABELS[source]}</div>
                            <div className="font-mono text-foreground">{getPhraseText(p, source)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-muted-foreground">{LANGUAGE_LABELS[target]}</div>
                            <div className="font-mono text-foreground">{getPhraseText(p, target)}</div>
                            {getPhrasePronunciation(p, target) && (
                              <div className="text-[10px] text-muted-foreground italic">
                                /{getPhrasePronunciation(p, target)}/
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {mode === "flashcard" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="h-4 w-4" /> Flashcard
                  </h3>
                  <Badge variant="outline" className="text-[10px]">
                    Card {cardIndex + 1} / {cards.length}
                  </Badge>
                </div>
                {currentCard ? (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setFlipped((v) => !v)}
                      className="w-full min-h-[160px] rounded-lg border-2 border-dashed border-primary/30 bg-muted/40 p-6 text-center hover:bg-muted/60 transition"
                    >
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
                        {LANGUAGE_LABELS[source]}
                      </div>
                      <div className="font-mono text-2xl text-foreground">
                        {currentCard.front}
                      </div>
                      {flipped && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
                            {LANGUAGE_LABELS[target]}
                          </div>
                          <div className="font-mono text-2xl text-primary">
                            {currentCard.back}
                          </div>
                          {currentCard.pronunciation && (
                            <div className="mt-2 text-xs italic text-muted-foreground">
                              /{currentCard.pronunciation}/
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                    <div className="text-center text-[10px] text-muted-foreground">
                      Click the card to flip · {CATEGORY_LABELS[currentCard.category]}
                    </div>
                    <div className="flex justify-between gap-2">
                      <Button onClick={prevCard} variant="outline" size="sm" className="gap-1.5">
                        <ChevronLeft className="h-3.5 w-3.5" /> Prev
                      </Button>
                      <Button onClick={() => setFlipped((v) => !v)} variant="outline" size="sm">
                        Flip
                      </Button>
                      <Button onClick={nextCard} variant="outline" size="sm" className="gap-1.5">
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No cards in this filter — adjust languages or category.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {mode === "reverse-translation" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <RotateCcw className="h-4 w-4" /> Reverse translation
                  </h3>
                  <Badge variant="outline" className="text-[10px]">
                    {cardIndex + 1} / {cards.length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Translate this {LANGUAGE_LABELS[target]} phrase into {LANGUAGE_LABELS[source]}:
                </p>
                {currentCard ? (
                  <div className="space-y-2">
                    <div className="rounded border bg-muted/40 px-3 py-3 text-center font-mono text-lg text-foreground">
                      {currentCard.back}
                    </div>
                    {currentCard.pronunciation && (
                      <p className="text-center text-xs italic text-muted-foreground">
                        /{currentCard.pronunciation}/
                      </p>
                    )}
                    <Input
                      value={reverseAnswer}
                      onChange={(e) => {
                        setReverseAnswer(e.target.value);
                        setReverseFeedback("none");
                      }}
                      placeholder={`Type in ${LANGUAGE_LABELS[source]}…`}
                      className="font-mono"
                      onKeyDown={(e) => { if (e.key === "Enter") checkReverse(); }}
                    />
                    {reverseFeedback === "correct" && (
                      <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" /> Correct!
                      </div>
                    )}
                    {reverseFeedback === "incorrect" && (
                      <div className="flex items-center gap-2 rounded border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                        <XCircle className="h-4 w-4" />
                        Correct: {currentCard.back}
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <Button onClick={prevCard} variant="outline" size="sm" className="gap-1.5">
                        <ChevronLeft className="h-3.5 w-3.5" /> Prev
                      </Button>
                      <Button onClick={checkReverse} size="sm" className="gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Check
                      </Button>
                      <Button onClick={() => { nextCard(); setReverseAnswer(""); setReverseFeedback("none"); }} variant="outline" size="sm" className="gap-1.5">
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No phrases in this filter — adjust languages or category.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "conjugations" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs">Verb:</Label>
              <select
                value={selectedVerb}
                onChange={(e) => setSelectedVerb(e.target.value)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {CONJUGATION_VERBS.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Language</th>
                    <th className="text-left p-2">Tense</th>
                    {PRONOUNS.map((p) => (
                      <th key={p} className="text-left p-2">{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LANGUAGES.filter((l) => selectedConjugation.byLanguage[l]).map((lang) => {
                    const tenses = selectedConjugation.byLanguage[lang]!;
                    return TENSES.map((t, ti) => (
                      <tr key={`${lang}-${t}`} className="border-b">
                        {ti === 0 && (
                          <td rowSpan={TENSES.length} className="p-2 align-top font-medium text-foreground">
                            {LANGUAGE_LABELS[lang]}
                          </td>
                        )}
                        <td className="p-2 text-muted-foreground">{TENSE_LABELS[t]}</td>
                        {tenses[t].map((val, i) => (
                          <td key={i} className="p-2 font-mono text-foreground">{val}</td>
                        ))}
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "numbers" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs">Language:</Label>
              <select
                value={numLang}
                onChange={(e) => setNumLang(e.target.value as LanguageCode)}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <option key={l} value={l}>{LANGUAGE_LABELS[l]}</option>
                ))}
              </select>
              <Label className="text-xs ml-2">Number:</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={numValue}
                onChange={(e) => setNumValue(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                className="h-8 w-20 text-xs"
              />
              <Badge variant="secondary" className="text-xs font-mono">
                {translateNumber(numValue, numLang)}
              </Badge>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">{LANGUAGE_LABELS[numLang]}</th>
                    <th className="text-left p-2">English</th>
                  </tr>
                </thead>
                <tbody>
                  {numberTable.map((row) => (
                    <tr key={row.num} className="border-b hover:bg-muted/30">
                      <td className="p-2 font-mono text-muted-foreground">{row.num}</td>
                      <td className="p-2 font-mono text-foreground">{row.byLanguage[numLang]}</td>
                      <td className="p-2 font-mono text-foreground">{row.byLanguage.english}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent sessions ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">
                    {LANGUAGE_LABELS[h.sourceLanguage]} → {LANGUAGE_LABELS[h.targetLanguage]}
                  </Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">
                    {h.category ? CATEGORY_LABELS[h.category] : "All"}
                  </Badge>
                  <Badge variant="secondary" className="mr-2 text-[10px]">{PRACTICE_MODE_LABELS[h.mode]}</Badge>
                  <span className="text-muted-foreground">
                    {h.phraseCount} phrases · {new Date(h.ts).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All translations, conjugations, and number lookups come from a built-in client-side dataset. No translation API is called. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant={active ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      className="gap-1.5 text-xs"
    >
      {icon}
      {children}
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
