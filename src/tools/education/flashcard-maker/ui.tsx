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
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  DECK_PRESETS,
  parseCards,
  validateDeck,
  shuffleCards,
  nextIndex,
  prevIndex,
  sm2Update,
  markCard,
  computeSessionStats,
  computeSummaryStats,
  renderText,
  renderCsv,
  renderJson,
  renderSource,
  filterCards,
  reverseCards,
  addTag,
  removeTag,
  setDifficulty,
  getDeckPreset,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Card as CardType,
  type Deck as DeckType,
  type StudyMode,
  type Difficulty,
  type HistoryEntry,
} from "./logic";
import {
  Layers, Shuffle, ChevronLeft, ChevronRight, Check, X,
  History, Eye, EyeOff, Search, RotateCcw, Tag,
} from "lucide-react";

export default function FlashcardMaker() {
  const [deckName, setDeckName] = useState("");
  const [cardsText, setCardsText] = useState("");
  const [studyMode, setStudyMode] = useState<StudyMode>("sequential");
  const [studyOrder, setStudyOrder] = useState<number[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [cards, setCards] = useState<CardType[]>([]);
  const [reverseMode, setReverseMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newTag, setNewTag] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Load share URL on mount
  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.deckName) setDeckName(p.deckName);
      if (p.cardsText) setCardsText(p.cardsText);
      if (p.studyMode) setStudyMode(p.studyMode);
      if (p.deckName || p.cardsText) toast.info("Loaded from share link");
    }
  }, []);

  // Parse cards when text changes
  const parsedCards = useMemo(() => parseCards(cardsText), [cardsText]);

  // Apply reverse mode + search filter for display (but study uses full deck)
  const displayCards = useMemo(() => {
    const base = reverseMode ? reverseCards(parsedCards) : parsedCards;
    return base;
  }, [parsedCards, reverseMode]);

  const deck: DeckType = useMemo(
    () => ({ name: deckName || "Untitled Deck", cards: displayCards }),
    [deckName, displayCards],
  );

  const validation = useMemo(() => validateDeck(deck), [deck]);

  // Initialize study session when deck changes
  const startSession = useCallback(() => {
    if (parsedCards.length === 0) return;
    let order: number[];
    if (studyMode === "shuffled") {
      const indices = parsedCards.map((_, i) => i);
      order = shuffleCards(indices);
    } else {
      order = parsedCards.map((_, i) => i);
    }
    setStudyOrder(order);
    setCurrentIdx(0);
    setFlipped(false);
    // Reset card states
    setCards(parsedCards.map((c) => ({
      ...c,
      tags: [...c.tags],
      seen: false,
      known: null,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
    })));
  }, [parsedCards, studyMode]);

  // Auto-start when deck first becomes valid
  useEffect(() => {
    if (validation.ok && cards.length === 0) {
      startSession();
    }
    if (!validation.ok && cards.length > 0) {
      setCards([]);
      setStudyOrder([]);
    }
  }, [validation.ok, cards.length, startSession]);

  // When study mode changes mid-session, restart
  useEffect(() => {
    if (cards.length > 0) startSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyMode]);

  const sessionStats = useMemo(() => computeSessionStats(cards), [cards]);
  const summaryStats = useMemo(() => computeSummaryStats(cards), [cards]);

  const filteredCards = useMemo(
    () => filterCards(displayCards, searchQuery),
    [displayCards, searchQuery],
  );

  const currentCard = studyOrder.length > 0 ? cards[studyOrder[currentIdx]] : undefined;
  const totalInSession = studyOrder.length;
  const progressNum = totalInSession > 0 ? Math.min(currentIdx + 1, totalInSession) : 0;

  const handleFlip = useCallback(() => setFlipped((f) => !f), []);

  const handleNext = useCallback(() => {
    setFlipped(false);
    setCurrentIdx((i) => nextIndex(i, totalInSession));
  }, [totalInSession]);

  const handlePrev = useCallback(() => {
    setFlipped(false);
    setCurrentIdx((i) => prevIndex(i, totalInSession));
  }, [totalInSession]);

  const handleAnswer = useCallback((known: boolean) => {
    if (!currentCard) return;
    setCards((prev) => prev.map((c, i) => {
      if (i !== studyOrder[currentIdx]) return c;
      return sm2Update(c, known);
    }));
    // Auto-advance after a short delay
    setTimeout(() => {
      setFlipped(false);
      setCurrentIdx((i) => nextIndex(i, totalInSession));
    }, 200);
  }, [currentCard, studyOrder, currentIdx, totalInSession]);

  const handleShuffleNow = useCallback(() => {
    setStudyOrder((prev) => shuffleCards(prev));
    setCurrentIdx(0);
    setFlipped(false);
    toast.success("Shuffled");
  }, []);

  const handleRestart = useCallback(() => {
    startSession();
    toast.info("Session restarted");
  }, [startSession]);

  const handleLoadPreset = useCallback((presetId: string) => {
    const preset = getDeckPreset(presetId);
    if (!preset) return;
    setDeckName(preset.name);
    setCardsText(preset.cardsText);
    setStudyMode("sequential");
    setCards([]);
    toast.success(`Loaded preset: ${preset.name}`);
  }, []);

  const handleAddTagToCurrent = useCallback(() => {
    if (!currentCard || !newTag.trim()) return;
    setCards((prev) => prev.map((c, i) =>
      i === studyOrder[currentIdx] ? addTag(c, newTag.trim()) : c,
    ));
    setNewTag("");
  }, [currentCard, newTag, studyOrder, currentIdx]);

  const handleSetDifficulty = useCallback((diff: Difficulty) => {
    if (!currentCard) return;
    setCards((prev) => prev.map((c, i) =>
      i === studyOrder[currentIdx] ? setDifficulty(c, diff) : c,
    ));
  }, [currentCard, studyOrder, currentIdx]);

  const handleRemoveTagFromCurrent = useCallback((tag: string) => {
    if (!currentCard) return;
    setCards((prev) => prev.map((c, i) =>
      i === studyOrder[currentIdx] ? removeTag(c, tag) : c,
    ));
  }, [currentCard, studyOrder, currentIdx]);

  const handleClear = useCallback(() => {
    setDeckName("");
    setCardsText("");
    setCards([]);
    setStudyOrder([]);
    setCurrentIdx(0);
    setFlipped(false);
    setSearchQuery("");
    setReverseMode(false);
    toast.info("Cleared");
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (parsedCards.length > 0) {
      saveHistory({
        ts: Date.now(),
        deckName: deckName || "Untitled",
        cardCount: parsedCards.length,
        studyMode,
        accuracy: sessionStats.accuracy,
      });
      setHistory(loadHistory());
    }
  }, [parsedCards.length, deckName, studyMode, sessionStats.accuracy]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const text = useMemo(() => renderText(displayCards), [displayCards]);
  const csv = useMemo(() => renderCsv(displayCards), [displayCards]);
  const json = useMemo(() => renderJson(deck), [deck]);
  const source = useMemo(() => renderSource(displayCards), [displayCards]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fc-deck-name">Deck name</Label>
              <Input
                id="fc-deck-name"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="Spanish Vocabulary"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fc-study-mode">Study mode</Label>
              <select
                id="fc-study-mode"
                value={studyMode}
                onChange={(e) => setStudyMode(e.target.value as StudyMode)}
                className="w-full h-9 rounded border bg-background px-3 text-sm"
              >
                {STUDY_MODES.map((m) => (
                  <option key={m} value={m}>{STUDY_MODE_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fc-cards">Cards (one per line: term|definition[|tags|difficulty])</Label>
            <Textarea
              id="fc-cards"
              value={cardsText}
              onChange={(e) => setCardsText(e.target.value)}
              placeholder={"hola|hello|greeting,basic|easy\ngracias|thank you|greeting|easy\n# Lines starting with # are comments"}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Formats: <code>term|definition</code> (pipe) · <code>term\tdefinition</code> (tab) · <code>term,definition</code> (comma) · JSON array of <code>{"{term,definition,tags?,difficulty?}"}</code>. Lines starting with <code>#</code> are skipped.
            </p>
            <div className="flex flex-wrap gap-1">
              {DECK_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => handleLoadPreset(p.id)}
                  title={p.description}
                >+ {p.name}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {parsedCards.length === 0 ? (
        <EmptyState
          title="Add cards to start studying"
          hint="Enter term|definition pairs above (or pick a preset). Click a card to flip it, mark known/unknown, and track your progress."
          icon={<Layers className="h-8 w-8" />}
        />
      ) : (
        <>
          {!validation.ok && (
            <Card>
              <CardContent className="p-3 text-xs text-destructive">
                {validation.errors.map((e, i) => (
                  <div key={i}>• {e}</div>
                ))}
              </CardContent>
            </Card>
          )}

          {validation.ok && currentCard && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{deck.name}</span>
                  <span>{progressNum} / {totalInSession}</span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${totalInSession > 0 ? (progressNum / totalInSession) * 100 : 0}%` }}
                  />
                </div>

                {/* Flip card */}
                <button
                  onClick={handleFlip}
                  className="w-full text-left"
                  aria-label="Click to flip card"
                >
                  <div
                    className="relative min-h-[180px] rounded-lg border-2 border-border bg-card p-6 flex flex-col items-center justify-center text-center transition-transform"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                      transition: "transform 0.4s",
                    }}
                  >
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center p-6"
                      style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                    >
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                        {reverseMode ? "Definition (guess the term)" : "Term"}
                      </div>
                      <div className="text-2xl font-semibold text-foreground break-words">
                        {reverseMode ? currentCard.definition : currentCard.term}
                      </div>
                      <div className="mt-3 text-[10px] text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" /> Click to flip
                      </div>
                    </div>
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center p-6"
                      style={{
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                    >
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                        {reverseMode ? "Term" : "Definition"}
                      </div>
                      <div className="text-xl text-foreground break-words">
                        {reverseMode ? currentCard.term : currentCard.definition}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1 justify-center">
                        {currentCard.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                      <div className="mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {DIFFICULTY_LABELS[currentCard.difficulty]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Difficulty selector */}
                <div className="flex items-center gap-1 justify-center">
                  <span className="text-[11px] text-muted-foreground mr-1">Difficulty:</span>
                  {DIFFICULTIES.map((d) => (
                    <Button
                      key={d}
                      size="sm"
                      variant={currentCard.difficulty === d ? "default" : "outline"}
                      className="h-6 text-[11px]"
                      onClick={() => handleSetDifficulty(d)}
                    >{DIFFICULTY_LABELS[d]}</Button>
                  ))}
                </div>

                {/* Tag editor */}
                <div className="flex items-center gap-2 text-xs">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddTagToCurrent(); }}
                    placeholder="Add tag…"
                    className="h-7 max-w-[140px] text-xs"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={handleAddTagToCurrent}
                  >Add</Button>
                  {currentCard.tags.map((t) => (
                    <button
                      key={t}
                      onClick={() => handleRemoveTagFromCurrent(t)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-destructive hover:text-destructive-foreground"
                    >{t} ×</button>
                  ))}
                </div>

                {/* Navigation */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrev} className="gap-1.5">
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </Button>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAnswer(false)}
                      className="gap-1.5 text-red-600 dark:text-red-400"
                    ><X className="h-3.5 w-3.5" /> Unknown</Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAnswer(true)}
                      className="gap-1.5 text-emerald-600 dark:text-emerald-400"
                    ><Check className="h-3.5 w-3.5" /> Known</Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleNext} className="gap-1.5">
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Session controls */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={handleShuffleNow} className="gap-1.5">
                    <Shuffle className="h-3.5 w-3.5" /> Shuffle
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRestart} className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Restart
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReverseMode((r) => !r)}
                    className="gap-1.5"
                  >
                    {reverseMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {reverseMode ? "Reverse: ON" : "Reverse: OFF"}
                  </Button>
                </div>

                {/* Session stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2">
                  <Stat label="Seen" value={`${sessionStats.seenCards}/${sessionStats.totalCards}`} />
                  <Stat label="Known" value={sessionStats.knownCount} highlight="good" />
                  <Stat label="Unknown" value={sessionStats.unknownCount} highlight="bad" />
                  <Stat label="Accuracy" value={`${sessionStats.accuracy}%`} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deck list with search */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4" /> Deck ({filteredCards.length}/{displayCards.length})
                </h3>
                <div className="flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search term/definition…"
                    className="h-7 max-w-[220px] text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {filteredCards.map((c, i) => (
                  <div key={c.id || i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-start gap-2">
                    <span className="font-mono font-medium text-foreground flex-1 break-words">{c.term}</span>
                    <span className="text-muted-foreground flex-1 break-words">— {c.definition}</span>
                    {c.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {c.tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                        ))}
                      </div>
                    )}
                    <Badge variant="secondary" className="text-[10px]">{DIFFICULTY_LABELS[c.difficulty]}</Badge>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total cards" value={summaryStats.totalCards} />
                <Stat label="Studied" value={summaryStats.totalStudied} />
                <Stat label="Known" value={summaryStats.knownCount} highlight="good" />
                <Stat label="Accuracy" value={`${summaryStats.accuracy}%`} />
              </div>
              <div className="flex flex-wrap gap-1 text-[11px]">
                <span className="text-muted-foreground">By difficulty:</span>
                {DIFFICULTIES.map((d) => (
                  <Badge key={d} variant="outline" className="text-[10px]">
                    {DIFFICULTY_LABELS[d]}: {summaryStats.byDifficulty[d]}
                  </Badge>
                ))}
                <Badge variant="outline" className="text-[10px]">
                  Tags: {summaryStats.uniqueTags} unique ({summaryStats.tagsCount} total)
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return text; }} label="Copy text" />
                <DownloadButton getText={() => text} filename={`${deck.name || "deck"}.txt`} mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csv} filename={`${deck.name || "deck"}.csv`} mime="text/csv" label="Download CSV" />
                <DownloadButton getText={() => json} filename={`${deck.name || "deck"}.json`} mime="application/json" label="Download JSON" />
                <CopyButton getText={() => source} label="Copy source" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(deckName, cardsText, studyMode); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.cardCount} cards</Badge>
                  <Badge variant="outline" className="text-[10px]">{STUDY_MODE_LABELS[h.studyMode]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.accuracy}% accuracy</Badge>
                  <span className="text-muted-foreground">{h.deckName}</span>
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
            <strong className="text-foreground">Privacy:</strong> All parsing, shuffling, SM-2 updates and rendering run locally in your browser. History is stored in localStorage on this device only.
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
