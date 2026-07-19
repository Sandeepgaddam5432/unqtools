"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  RunButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  CARD_TYPE_LABELS,
  CARD_TYPE_DESCRIPTIONS,
  ALL_CARD_TYPES,
  DIFFICULTY_LABELS,
  SM2_GRADE_LABELS,
  SM2_DEFAULT_STATE,
  DEFAULT_OPTIONS,
  splitSentences,
  extractKeyTerms,
  generateAllCards,
  generateDeck,
  sm2Update,
  sm2NextReview,
  isCardDue,
  computeStudyStats,
  gradeCard,
  sortForStudy,
  shuffleDeck,
  focusWeakCards,
  renderAnkiCsv,
  renderQuizletCsv,
  renderJson,
  parseJsonDeck,
  renderText,
  renderMarkdown,
  mergeDecks,
  updateCard,
  deleteCard,
  addCard,
  countByType,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  makeId,
  type Card as CardData,
  type CardType,
  type Deck,
  type Difficulty,
  type Sm2Grade,
  type GenerationOptions,
  type HistoryEntry,
} from "./logic";
import {
  Layers, History, Plus, Trash2, BookOpen, RotateCcw,
  CheckCircle2, XCircle, Brain, Sparkles, Shuffle,
} from "lucide-react";

export default function AiFlashcardQaGenerator() {
  const [text, setText] = useState("");
  const [deckName, setDeckName] = useState("My Deck");
  const [includeTypes, setIncludeTypes] = useState<CardType[]>(DEFAULT_OPTIONS.includeTypes);
  const [maxCards, setMaxCards] = useState(DEFAULT_OPTIONS.maxCards);
  const [defaultDifficulty, setDefaultDifficulty] = useState<Difficulty>(DEFAULT_OPTIONS.defaultDifficulty);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [studyMode, setStudyMode] = useState(false);
  const [studyIdx, setStudyIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [focusWeak, setFocusWeak] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const s = parseShareUrl(window.location.hash);
      if (s) {
        setDeckName(s.deckName);
        setText(s.text);
        setIncludeTypes(s.options.includeTypes);
        setMaxCards(s.options.maxCards);
        setDefaultDifficulty(s.options.defaultDifficulty);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const sentences = useMemo(() => splitSentences(text), [text]);
  const keyTerms = useMemo(() => (text ? extractKeyTerms(text, 20) : []), [text]);

  const options: GenerationOptions = useMemo(
    () => ({ includeTypes, maxCards, defaultDifficulty }),
    [includeTypes, maxCards, defaultDifficulty],
  );

  const handleGenerate = useCallback(() => {
    if (!text.trim()) {
      toast.error("Paste some notes first");
      return;
    }
    const d = generateDeck(text, deckName, options);
    if (d.cards.length === 0) {
      toast.error("No cards could be generated — try longer or more structured notes");
      return;
    }
    setDeck(d);
    setStudyMode(false);
    setStudyIdx(0);
    setShowAnswer(false);
    saveHistory({
      ts: Date.now(),
      deckName: d.name,
      cardCount: d.cards.length,
      types: countByType(d.cards),
    });
    setHistory(loadHistory());
    toast.success(`Generated ${d.cards.length} cards`);
  }, [text, deckName, options]);

  const handleClear = useCallback(() => {
    setText("");
    setDeck(null);
    setStudyMode(false);
    setStudyIdx(0);
    setShowAnswer(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const toggleType = useCallback((t: CardType) => {
    setIncludeTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }, []);

  const studyList = useMemo(() => {
    if (!deck) return [] as CardData[];
    let list = deck.cards;
    if (focusWeak) list = focusWeakCards(list);
    if (shuffled) list = shuffleDeck(list, Date.now() % 100000);
    else list = sortForStudy(list);
    return list;
  }, [deck, focusWeak, shuffled]);

  const currentCard = studyList[studyIdx];
  const stats = useMemo(() => (deck ? computeStudyStats(deck.cards) : null), [deck]);

  const handleGrade = useCallback((grade: Sm2Grade) => {
    if (!deck || !currentCard) return;
    const updated = gradeCard(currentCard, grade);
    const newDeck = updateCard(deck, currentCard.id, { sm2: updated.sm2 });
    setDeck(newDeck);
    setShowAnswer(false);
    setStudyIdx((i) => Math.min(i + 1, studyList.length - 1));
    toast.success(`Graded: ${SM2_GRADE_LABELS[grade]}`);
  }, [deck, currentCard, studyList.length]);

  const handleRestartStudy = useCallback(() => {
    setStudyIdx(0);
    setShowAnswer(false);
  }, []);

  const handleUpdateCard = useCallback((cardId: string, patch: Partial<CardData>) => {
    if (!deck) return;
    setDeck(updateCard(deck, cardId, patch));
  }, [deck]);

  const handleDeleteCard = useCallback((cardId: string) => {
    if (!deck) return;
    setDeck(deleteCard(deck, cardId));
    toast.info("Card deleted");
  }, [deck]);

  const handleAddBlankCard = useCallback(() => {
    if (!deck) return;
    const newCard: CardData = {
      id: makeId("card"),
      type: "definition",
      question: "New question?",
      answer: "New answer.",
      grounded: false,
      difficulty: defaultDifficulty,
      tags: [],
      sm2: { ...SM2_DEFAULT_STATE },
    };
    setDeck(addCard(deck, newCard));
    toast.success("Card added");
  }, [deck, defaultDifficulty]);

  const handleImportJson = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseJsonDeck(String(reader.result));
      if (parsed) {
        setDeck(parsed);
        setDeckName(parsed.name);
        toast.success(`Imported ${parsed.cards.length} cards`);
      } else {
        toast.error("Invalid deck JSON");
      }
    };
    reader.readAsText(file);
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fcg-deck-name" className="text-xs">Deck name</Label>
            <Input
              id="fcg-deck-name"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              className="h-9 text-sm"
              placeholder="Biology 101"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fcg-text" className="text-xs">
              Notes / source text ({sentences.length} sentences, {keyTerms.length} key terms detected)
            </Label>
            <Textarea
              id="fcg-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your notes here. The tool will extract key terms and sentences to generate Q&A flashcards."
              className="min-h-[180px] resize-y font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Card types to generate</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_CARD_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeTypes.includes(t)}
                    onChange={() => toggleType(t)}
                  />
                  {CARD_TYPE_LABELS[t]}
                </label>
              ))}
            </div>
            {includeTypes.length > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {includeTypes.map((t) => CARD_TYPE_DESCRIPTIONS[t]).join(" ")}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="fcg-max" className="text-xs">Max cards</Label>
              <Input
                id="fcg-max"
                type="number"
                min="1"
                max="200"
                value={maxCards}
                onChange={(e) => setMaxCards(Number(e.target.value) || 1)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fcg-diff" className="text-xs">Default difficulty</Label>
              <select
                id="fcg-diff"
                value={defaultDifficulty}
                onChange={(e) => setDefaultDifficulty(e.target.value as Difficulty)}
                className="h-9 w-full text-sm rounded border bg-background px-2"
              >
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                  <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <RunButton onClick={handleGenerate} label="Generate deck" disabled={!text.trim()} />
            {deck && (
              <>
                <Button
                  variant={studyMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setStudyMode(!studyMode); setStudyIdx(0); setShowAnswer(false); }}
                  className="gap-1"
                >
                  <Brain className="h-3.5 w-3.5" /> {studyMode ? "Exit study" : "Study mode"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleAddBlankCard} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add card
                </Button>
              </>
            )}
            <CopyButton
              getText={() => deck ? renderText(deck) : ""}
              label="Copy text"
              disabled={!deck}
            />
            <DownloadButton
              getText={() => deck ? renderAnkiCsv(deck) : ""}
              filename={`${deck?.name ?? "deck"}.txt`}
              mime="text/plain"
              label="Anki TSV"
              disabled={!deck}
            />
            <DownloadButton
              getText={() => deck ? renderQuizletCsv(deck) : ""}
              filename={`${deck?.name ?? "deck"}-quizlet.csv`}
              mime="text/csv"
              label="Quizlet CSV"
              disabled={!deck}
            />
            <DownloadButton
              getText={() => deck ? renderMarkdown(deck) : ""}
              filename={`${deck?.name ?? "deck"}.md`}
              mime="text/markdown"
              label="Markdown"
              disabled={!deck}
            />
            <DownloadButton
              getText={() => deck ? renderJson(deck) : ""}
              filename={`${deck?.name ?? "deck"}.json`}
              mime="application/json"
              label="JSON"
              disabled={!deck}
            />
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" className="gap-1 pointer-events-none">
                <Layers className="h-3.5 w-3.5" /> Import JSON
              </Button>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportJson(f);
                  e.target.value = "";
                }}
              />
            </label>
            <ShareButton
              getUrl={() => buildShareUrl({ deckName, text, options })}
              disabled={!text.trim()}
            />
            <ClearButton onClick={handleClear} disabled={!text && !deck} />
          </div>
        </CardContent>
      </Card>

      {deck && stats && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-4 w-4" /> {deck.name}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total cards" value={stats.total} />
              <Stat label="Due now" value={stats.due} highlight={stats.due > 0 ? "bad" : "good"} />
              <Stat label="Learned" value={stats.learned} highlight="good" />
              <Stat label="Avg easiness" value={stats.avgEasiness.toFixed(2)} />
            </div>
            <div className="flex flex-wrap gap-1 pt-2">
              {(Object.keys(CARD_TYPE_LABELS) as CardType[]).map((t) => {
                const counts = countByType(deck.cards);
                if (counts[t] === 0) return null;
                return (
                  <Badge key={t} variant="outline" className="text-[10px]">
                    {CARD_TYPE_LABELS[t]}: {counts[t]}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {deck && studyMode ? (
        <StudyView
          cards={studyList}
          idx={studyIdx}
          showAnswer={showAnswer}
          onShowAnswer={() => setShowAnswer(true)}
          onGrade={handleGrade}
          onRestart={handleRestartStudy}
          onPrev={() => setStudyIdx((i) => Math.max(0, i - 1))}
          onNext={() => setStudyIdx((i) => Math.min(studyList.length - 1, i + 1))}
          focusWeak={focusWeak}
          shuffled={shuffled}
          onToggleWeak={() => { setFocusWeak(!focusWeak); setStudyIdx(0); setShowAnswer(false); }}
          onToggleShuffle={() => { setShuffled(!shuffled); setStudyIdx(0); setShowAnswer(false); }}
        />
      ) : deck && deck.cards.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Cards ({deck.cards.length})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-auto">
              {deck.cards.map((c, i) => (
                <CardRow
                  key={c.id}
                  card={c}
                  idx={i}
                  isEditing={editingCardId === c.id}
                  onEdit={() => setEditingCardId(editingCardId === c.id ? null : c.id)}
                  onUpdate={(patch) => handleUpdateCard(c.id, patch)}
                  onDelete={() => handleDeleteCard(c.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Paste notes to generate flashcards"
          hint="The tool extracts key terms and sentences, then generates Q&A, true/false, fill-in-the-blank, multiple-choice, and cloze cards. All editable, with SM-2 spaced repetition study mode."
          icon={<Layers className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.cardCount} cards</Badge>
                  <span className="text-foreground font-medium">{h.deckName}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All parsing, generation, scheduling, and export run locally. Notes never leave this device. Decks and progress live in this device's localStorage.
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            <strong>Honesty:</strong> AI-generated cards may contain errors. Review before relying on them for exams.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StudyView({
  cards,
  idx,
  showAnswer,
  onShowAnswer,
  onGrade,
  onRestart,
  onPrev,
  onNext,
  focusWeak,
  shuffled,
  onToggleWeak,
  onToggleShuffle,
}: {
  cards: CardData[];
  idx: number;
  showAnswer: boolean;
  onShowAnswer: () => void;
  onGrade: (g: Sm2Grade) => void;
  onRestart: () => void;
  onPrev: () => void;
  onNext: () => void;
  focusWeak: boolean;
  shuffled: boolean;
  onToggleWeak: () => void;
  onToggleShuffle: () => void;
}) {
  const card = cards[idx];
  if (!card) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
          <p className="text-sm font-medium">All caught up — no cards to study.</p>
          <Button variant="outline" size="sm" onClick={onRestart} className="gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> Restart
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Brain className="h-4 w-4" /> Card {idx + 1} / {cards.length}
          </h3>
          <div className="flex gap-1">
            <Button
              variant={focusWeak ? "default" : "outline"}
              size="sm"
              onClick={onToggleWeak}
              className="gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" /> Weak
            </Button>
            <Button
              variant={shuffled ? "default" : "outline"}
              size="sm"
              onClick={onToggleShuffle}
              className="gap-1"
            >
              <Shuffle className="h-3.5 w-3.5" /> Shuffle
            </Button>
            <Button variant="ghost" size="sm" onClick={onRestart} className="gap-1">
              <RotateCcw className="h-3.5 w-3.5" /> Restart
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-[10px]">{CARD_TYPE_LABELS[card.type]}</Badge>
          <Badge variant="outline" className="text-[10px]">Easiness: {card.sm2.easiness.toFixed(2)}</Badge>
          <Badge variant="outline" className="text-[10px]">Reps: {card.sm2.repetitions}</Badge>
          <Badge variant="outline" className="text-[10px]">Interval: {card.sm2.interval}d</Badge>
          {card.sm2.lastReviewed && (
            <Badge variant="outline" className="text-[10px]">
              Next: {sm2NextReview(card.sm2)}d
            </Badge>
          )}
        </div>
        <div className="rounded border bg-background p-4 min-h-[120px]">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Question</div>
          {card.type === "cloze" && card.cloze ? (
            <div className="text-sm font-mono">{showAnswer ? card.cloze.replace(/\{\{c1::(.+?)\}\}/, "$1") : card.cloze.replace(/\{\{c1::(.+?)\}\}/, "[...]")}</div>
          ) : card.type === "multiple-choice" && card.options ? (
            <div className="text-sm space-y-1">
              <div>{card.question}</div>
              <div className="space-y-1 pt-1">
                {card.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold">{["A", "B", "C", "D"][i]}.</span>
                    <span>
                      {showAnswer && i === card.correctIndex ? (
                        <strong className="text-emerald-600 dark:text-emerald-400">{opt}</strong>
                      ) : opt}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm">{card.question}</div>
          )}
        </div>
        {showAnswer && (
          <div className="rounded border bg-emerald-50 dark:bg-emerald-950/30 p-4">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Answer</div>
            <div className="text-sm font-medium text-foreground">{card.answer}</div>
            {card.source && (
              <div className="text-[10px] text-muted-foreground mt-2 italic">Source: {card.source}</div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2 items-center">
          {!showAnswer ? (
            <Button onClick={onShowAnswer} size="sm" className="gap-1">
              <BookOpen className="h-3.5 w-3.5" /> Show answer
            </Button>
          ) : (
            (["again", "hard", "good", "easy"] as Sm2Grade[]).map((g) => (
              <Button
                key={g}
                variant={g === "again" ? "destructive" : g === "easy" ? "default" : "outline"}
                size="sm"
                onClick={() => onGrade(g)}
              >
                {SM2_GRADE_LABELS[g]}
              </Button>
            ))
          )}
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="sm" onClick={onPrev} disabled={idx === 0}>← Prev</Button>
            <Button variant="ghost" size="sm" onClick={onNext} disabled={idx === cards.length - 1}>Next →</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CardRow({
  card,
  idx,
  isEditing,
  onEdit,
  onUpdate,
  onDelete,
}: {
  card: CardData;
  idx: number;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (patch: Partial<CardData>) => void;
  onDelete: () => void;
}) {
  const [question, setQuestion] = useState(card.question);
  const [answer, setAnswer] = useState(card.answer);
  const [tags, setTags] = useState(card.tags.join(", "));

  useEffect(() => {
    setQuestion(card.question);
    setAnswer(card.answer);
    setTags(card.tags.join(", "));
  }, [card.question, card.answer, card.tags, isEditing]);

  const handleSave = () => {
    onUpdate({
      question,
      answer,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    onEdit();
    toast.success("Card saved");
  };

  return (
    <div className="rounded border bg-background p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Badge variant="secondary" className="text-[10px] mt-0.5">#{idx + 1}</Badge>
        <Badge variant="outline" className="text-[10px] mt-0.5">{CARD_TYPE_LABELS[card.type]}</Badge>
        {!card.grounded && (
          <Badge variant="outline" className="text-[10px] mt-0.5 text-amber-600 dark:text-amber-400">⚠ not grounded</Badge>
        )}
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 text-[11px]">
            {isEditing ? "Cancel" : "Edit"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="min-h-[60px] text-xs"
            placeholder="Question"
          />
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="min-h-[40px] text-xs"
            placeholder="Answer"
          />
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="h-7 text-xs"
            placeholder="Tags (comma-separated)"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}>Save</Button>
            <select
              value={card.difficulty}
              onChange={(e) => onUpdate({ difficulty: e.target.value as Difficulty })}
              className="h-8 text-xs rounded border bg-background px-2"
            >
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="text-xs">
            <span className="text-muted-foreground">Q: </span>
            <span className="text-foreground">{card.question}</span>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">A: </span>
            <span className="text-foreground font-medium">{card.answer}</span>
          </div>
          {card.tags.length > 0 && (
            <div className="text-[10px] text-muted-foreground">Tags: {card.tags.join(", ")}</div>
          )}
          {card.sm2.lastReviewed && (
            <div className="text-[10px] text-muted-foreground">
              Last reviewed: {new Date(card.sm2.lastReviewed).toLocaleDateString()} · Next: {sm2NextReview(card.sm2)}d
            </div>
          )}
        </div>
      )}
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

// Re-export to satisfy isolatedModules for type-only imports if needed.
export type _Unused = HistoryEntry;
