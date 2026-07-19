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
  STUDY_MODES,
  STUDY_MODE_LABELS,
  VOCAB_PRESETS,
  PRESET_LABELS,
  parseWords,
  validateWords,
  filterWords,
  sortAlphabetical,
  buildFlashcardDeck,
  currentCard,
  nextCard,
  prevCard,
  buildMatchRound,
  validateMatch,
  renderText,
  renderCsv,
  renderJson,
  computeSummaryStats,
  computeWordFrequency,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type WordEntry,
  type StudyMode,
  type HistoryEntry,
  type FlashcardDeck,
  type MatchRound,
} from "./logic";
import {
  BookOpen, Search, History, Layers, Grid3x3, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, RotateCcw, CheckCircle2, XCircle,
} from "lucide-react";

export default function VocabularyBuilder() {
  const [listName, setListName] = useState("");
  const [wordsText, setWordsText] = useState("");
  const [studyMode, setStudyMode] = useState<StudyMode>("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deck, setDeck] = useState<FlashcardDeck | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [matchRound, setMatchRound] = useState<MatchRound | null>(null);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [matchScore, setMatchScore] = useState({ correct: 0, incorrect: 0 });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.listName) setListName(p.listName);
      if (p.words) setWordsText(p.words);
      if (p.studyMode) setStudyMode(p.studyMode);
      if (p.listName || p.words || p.studyMode !== "browse") {
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const words = useMemo(() => parseWords(wordsText), [wordsText]);
  const validation = useMemo(() => validateWords(words), [words]);
  const filteredWords = useMemo(
    () => sortAlphabetical(filterWords(words, searchQuery)),
    [words, searchQuery],
  );
  const stats = useMemo(() => computeSummaryStats(words), [words]);
  const wordFreq = useMemo(() => computeWordFrequency(words, 10), [words]);
  const text = useMemo(() => renderText(listName, words), [listName, words]);
  const csv = useMemo(() => renderCsv(words), [words]);
  const json = useMemo(() => renderJson(listName, words), [listName, words]);

  const handleSaveHistory = useCallback(() => {
    if (words.length > 0) {
      saveHistory({
        ts: Date.now(),
        listName: listName || "Untitled",
        wordCount: words.length,
        studyMode,
      });
      setHistory(loadHistory());
    }
  }, [words, listName, studyMode]);

  const handleClear = useCallback(() => {
    setListName("");
    setWordsText("");
    setStudyMode("browse");
    setSearchQuery("");
    setExpandedId(null);
    setDeck(null);
    setFlipped(false);
    setMatchRound(null);
    setMatchedPairs(new Set());
    setMatchScore({ correct: 0, incorrect: 0 });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadPreset = useCallback((key: keyof typeof VOCAB_PRESETS) => {
    const preset = VOCAB_PRESETS[key];
    // Convert presets back to pipe-separated source for the textarea
    const text = preset
      .map((w) => [w.word, w.definition, w.example, w.synonyms.join(","), w.antonyms.join(",")].join("|"))
      .join("\n");
    setWordsText(text);
    setListName(PRESET_LABELS[key].replace(/\s*\(\d+\)\s*$/, ""));
    toast.success(`Loaded ${PRESET_LABELS[key]}`);
  }, []);

  const startFlashcards = useCallback(() => {
    if (words.length === 0) {
      toast.error("Add words first");
      return;
    }
    setDeck(buildFlashcardDeck(listName || "Untitled", words, true));
    setFlipped(false);
  }, [words, listName]);

  const startMatchGame = useCallback(() => {
    if (words.length < 4) {
      toast.error("Need at least 4 words for match game");
      return;
    }
    setMatchRound(buildMatchRound(words, Math.min(6, words.length)));
    setSelectedWordId(null);
    setMatchedPairs(new Set());
    setMatchScore({ correct: 0, incorrect: 0 });
  }, [words]);

  const handleDefinitionClick = useCallback(
    (pairWordId: string) => {
      if (!matchRound || !selectedWordId) return;
      const result = validateMatch(matchRound, selectedWordId, pairWordId);
      if (result.correct && result.matchedPairId) {
        const next = new Set(matchedPairs);
        next.add(result.matchedPairId);
        setMatchedPairs(next);
        setMatchScore((s) => ({ ...s, correct: s.correct + 1 }));
        setSelectedWordId(null);
        if (next.size === matchRound.pairs.length) {
          toast.success(`Match game complete! ${next.size}/${matchRound.pairs.length} correct`);
        }
      } else {
        setMatchScore((s) => ({ ...s, incorrect: s.incorrect + 1 }));
        setSelectedWordId(null);
      }
    },
    [matchRound, selectedWordId, matchedPairs],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vb-name">List name</Label>
              <Input
                id="vb-name"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="SAT Vocabulary"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vb-mode">Study mode</Label>
              <select
                id="vb-mode"
                value={studyMode}
                onChange={(e) => setStudyMode(e.target.value as StudyMode)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {STUDY_MODES.map((m) => (
                  <option key={m} value={m}>{STUDY_MODE_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vb-words">
              Words (one per line: <code className="text-[10px]">word|definition|example|synonyms|antonyms</code>)
            </Label>
            <Textarea
              id="vb-words"
              value={wordsText}
              onChange={(e) => setWordsText(e.target.value)}
              placeholder={"happy|feeling pleasure|She felt happy.|joyful,glad|sad,unhappy\nbig|large in size|a big house.|huge,enormous|small,tiny"}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {(Object.keys(VOCAB_PRESETS) as Array<keyof typeof VOCAB_PRESETS>).map((key) => (
                <Button
                  key={key}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => loadPreset(key)}
                >
                  + {PRESET_LABELS[key]}
                </Button>
              ))}
            </div>
          </div>
          {validation.errors.length > 0 && (
            <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive space-y-0.5">
              {validation.errors.slice(0, 5).map((e, i) => (
                <div key={i}>• {e}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {words.length > 0 ? (
        <>
          {/* Summary stats */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> {words.length} words
                <Badge variant="secondary" className="text-[10px] ml-1">{studyMode}</Badge>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total words" value={stats.totalWords} />
                <Stat label="Avg synonyms" value={stats.avgSynonymsPerWord} />
                <Stat label="Avg antonyms" value={stats.avgAntonymsPerWord} />
                <Stat label="With examples" value={stats.withExamples} />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {([1, 2, 3, 4, 5] as const).map((d) => (
                  <Badge key={d} variant="outline" className="text-[10px]">
                    Diff {d}: {stats.byDifficulty[d]}
                  </Badge>
                ))}
              </div>
              {wordFreq.length > 0 && (
                <div className="pt-2 space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Top 10 words in definitions/examples
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {wordFreq.map((w) => (
                      <Badge key={w.word} variant="secondary" className="text-[10px]">
                        {w.word} ({w.count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Browse mode */}
          {studyMode === "browse" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Search className="h-4 w-4" /> Browse ({filteredWords.length})
                  </h3>
                  <div className="relative">
                    <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter…"
                      className="h-8 pl-7 text-xs w-40 sm:w-56"
                    />
                  </div>
                </div>
                <div className="space-y-1 max-h-[500px] overflow-auto">
                  {filteredWords.map((w) => {
                    const expanded = expandedId === w.id;
                    return (
                      <button
                        key={w.id}
                        onClick={() => setExpandedId(expanded ? null : w.id)}
                        className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-semibold text-foreground truncate">{w.word}</span>
                            <Badge variant="outline" className="text-[10px] flex-shrink-0">D{w.difficulty}</Badge>
                            {w.synonyms.length > 0 && (
                              <span className="text-muted-foreground text-[10px] truncate">
                                {w.synonyms.slice(0, 2).join(", ")}{w.synonyms.length > 2 ? "…" : ""}
                              </span>
                            )}
                          </div>
                          {expanded ? <ChevronUp className="h-3 w-3 flex-shrink-0" /> : <ChevronDown className="h-3 w-3 flex-shrink-0" />}
                        </div>
                        <div className="text-muted-foreground mt-0.5 truncate">{w.definition}</div>
                        {expanded && (
                          <div className="mt-2 space-y-1.5 pt-2 border-t">
                            {w.example && (
                              <div>
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Example: </span>
                                <span className="italic">{w.example}</span>
                              </div>
                            )}
                            {w.synonyms.length > 0 && (
                              <div>
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Synonyms: </span>
                                <span className="text-emerald-600 dark:text-emerald-400">{w.synonyms.join(", ")}</span>
                              </div>
                            )}
                            {w.antonyms.length > 0 && (
                              <div>
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Antonyms: </span>
                                <span className="text-red-600 dark:text-red-400">{w.antonyms.join(", ")}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton getText={() => { handleSaveHistory(); return text; }} label="Copy .txt" />
                  <DownloadButton getText={() => text} filename="vocabulary.txt" mime="text/plain" label="Download .txt" />
                  <DownloadButton getText={() => csv} filename="vocabulary.csv" mime="text/csv" label="Download CSV" />
                  <DownloadButton getText={() => json} filename="vocabulary.json" mime="application/json" label="Download JSON" />
                  <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ listName, words: wordsText, studyMode }); }} />
                  <ClearButton onClick={handleClear} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Flashcard mode */}
          {studyMode === "flashcard" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="h-4 w-4" /> Flashcards
                  </h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={startFlashcards}>
                      {deck ? "Shuffle new deck" : "Start deck"}
                    </Button>
                  </div>
                </div>
                {deck && currentCard(deck) ? (
                  <>
                    <div className="text-[10px] text-muted-foreground">
                      Card {deck.currentIndex + 1} of {deck.cards.length}
                    </div>
                    <div
                      className="relative h-48 cursor-pointer select-none"
                      style={{ perspective: "1000px" }}
                      onClick={() => setFlipped((f) => !f)}
                    >
                      <div
                        className="absolute inset-0 transition-transform duration-500"
                        style={{
                          transformStyle: "preserve-3d",
                          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                        }}
                      >
                        {/* Front (word) */}
                        <div
                          className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border-2 bg-background p-4 text-center"
                          style={{ backfaceVisibility: "hidden" }}
                        >
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Word</div>
                          <div className="text-2xl font-semibold font-mono mt-2">{currentCard(deck)!.word}</div>
                          <div className="text-[10px] text-muted-foreground mt-2">Click to flip</div>
                        </div>
                        {/* Back (definition + example) */}
                        <div
                          className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border-2 bg-accent/30 p-4 text-center overflow-auto"
                          style={{
                            backfaceVisibility: "hidden",
                            transform: "rotateY(180deg)",
                          }}
                        >
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Definition</div>
                          <div className="text-sm font-medium mt-2">{currentCard(deck)!.definition}</div>
                          {currentCard(deck)!.example && (
                            <div className="text-xs italic text-muted-foreground mt-2">{currentCard(deck)!.example}</div>
                          )}
                          {currentCard(deck)!.synonyms.length > 0 && (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2">
                              Syn: {currentCard(deck)!.synonyms.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setDeck(prevCard(deck)); setFlipped(false); }}>
                        <ChevronLeft className="h-3.5 w-3.5" /> Prev
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setFlipped((f) => !f)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Flip
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setDeck(nextCard(deck)); setFlipped(false); }}>
                        Next <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title={`Click "Start deck" to begin flashcards`}
                    hint="Cards are shuffled. Click the card to flip between word and definition. Use Prev/Next to navigate."
                    icon={<Layers className="h-8 w-8" />}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Match game mode */}
          {studyMode === "match-game" && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Grid3x3 className="h-4 w-4" /> Match game
                  </h3>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> {matchScore.correct}
                    </Badge>
                    <Badge variant="outline" className="text-red-600 dark:text-red-400">
                      <XCircle className="h-3 w-3 mr-1" /> {matchScore.incorrect}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={startMatchGame}>
                      {matchRound ? "New round" : "Start"}
                    </Button>
                  </div>
                </div>
                {matchRound ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Words</div>
                      {matchRound.pairs.map((p) => {
                        const isMatched = matchedPairs.has(p.wordId);
                        const isSelected = selectedWordId === p.wordId;
                        return (
                          <button
                            key={p.wordId}
                            disabled={isMatched}
                            onClick={() => setSelectedWordId(p.wordId)}
                            className={`w-full text-left rounded border px-2 py-1.5 text-xs font-mono transition-colors ${
                              isMatched
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 line-through"
                                : isSelected
                                  ? "bg-primary/10 border-primary"
                                  : "bg-background hover:bg-accent/50"
                            }`}
                          >
                            {p.word}
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Definitions</div>
                      {matchRound.definitionOrder.map((p, i) => {
                        const isMatched = matchedPairs.has(p.wordId);
                        return (
                          <button
                            key={`${p.wordId}-${i}`}
                            disabled={isMatched}
                            onClick={() => handleDefinitionClick(p.wordId)}
                            className={`w-full text-left rounded border px-2 py-1.5 text-xs transition-colors ${
                              isMatched
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 line-through"
                                : "bg-background hover:bg-accent/50"
                            }`}
                          >
                            {p.definition}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title={`Click "Start" to begin a match round`}
                    hint="4-6 word/definition pairs per round. Click a word, then click its matching definition. Match all pairs to win."
                    icon={<Grid3x3 className="h-8 w-8" />}
                  />
                )}
                {matchRound && matchedPairs.size === matchRound.pairs.length && (
                  <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 text-center">
                    Round complete! Score: {matchScore.correct} correct, {matchScore.incorrect} incorrect.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Enter vocabulary words to begin"
          hint="One word per line, pipe-separated: word|definition|example|synonyms|antonyms. Click a preset (SAT, GRE, TOEFL, elementary) to load sample data."
          icon={<BookOpen className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.wordCount} words</Badge>
                  <Badge variant="outline" className="mr-2">{h.studyMode}</Badge>
                  <span className="font-mono">{h.listName}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All parsing, validation, game logic, and rendering run locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
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
