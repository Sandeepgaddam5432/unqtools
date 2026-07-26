"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  createDeck,
  createCard,
  addCard,
  removeCard,
  updateCard,
  searchCards,
  getDueCards,
  reviewCard,
  deckStats,
  exportDeckAsCSV,
  exportDeckAsAnki,
  exportDeckAsJSON,
  validateCard,
  resetProgress,
  tagFrequency,
  forecastReviewLoad,
  buildStudySession,
  type Deck,
} from "./logic";

export default function FlashcardDeckOrganizer() {
  const [deck, setDeck] = useState<Deck>(() => createDeck("My Deck", "Click + to add flashcards."));
  const [front, setFront] = useState<string>("");
  const [back, setBack] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [error, setError] = useState<string>("");

  const stats = useMemo(() => deckStats(deck), [deck]);
  const dueCards = useMemo(() => getDueCards(deck), [deck]);
  const filtered = useMemo(() => searchCards(deck, query), [deck, query]);
  const tagFreq = useMemo(() => tagFrequency(deck), [deck]);
  const forecast = useMemo(() => forecastReviewLoad(deck, 7), [deck]);
  const warnings = useMemo(() => validateCard(front, back), [front, back]);

  const handleAdd = () => {
    if (!front.trim() || !back.trim()) {
      setError("Both front and back are required.");
      return;
    }
    setError("");
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    setDeck((d) => addCard(d, createCard(front, back, tagList)));
    setFront("");
    setBack("");
    setTags("");
  };

  const handleReview = (cardId: string, quality: number) => {
    setDeck((d) => {
      const c = d.cards.find((x) => x.id === cardId);
      if (!c) return d;
      return updateCard(d, cardId, reviewCard(c, quality));
    });
  };

  const handleReset = () => setDeck((d) => resetProgress(d));

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-base font-semibold">{deck.name}</h3>
              <p className="text-xs text-muted-foreground">{deck.description}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <CopyButton getText={() => exportDeckAsAnki(deck)} label="Copy Anki TSV" />
              <DownloadButton getText={() => exportDeckAsCSV(deck)} filename={`${deck.name}.csv`} mime="text/csv" label="CSV" />
              <DownloadButton getText={() => exportDeckAsJSON(deck)} filename={`${deck.name}.json`} mime="application/json" label="JSON" />
              <DownloadButton getText={() => exportDeckAsAnki(deck)} filename={`${deck.name}.txt`} mime="text/tab-separated-values" label="Anki" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Total cards</div>
              <code className="font-mono">{stats.total}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Due today</div>
              <code className="font-mono">{stats.dueToday}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Learned</div>
              <code className="font-mono">{stats.learned}</code>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="text-muted-foreground">Avg ease</div>
              <code className="font-mono">{stats.avgEase.toFixed(2)}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Add a flashcard</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front (question)" className="rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            <input value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back (answer)" className="rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (comma-sep)" className="rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
          </div>
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <button onClick={handleAdd} className="px-4 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90">
            + Add card
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="text-sm font-semibold">Study session ({dueCards.length} due)</Label>
            <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground">
              Reset progress
            </button>
          </div>
          {dueCards.length === 0 ? (
            <p className="text-xs text-muted-foreground">No cards due — come back later or add new cards.</p>
          ) : (
            <div className="space-y-2">
              {buildStudySession(deck, 5).map((c) => (
                <div key={c.id} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{c.front}</span>
                    <span className="text-[10px] text-muted-foreground">ease {c.ease.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.back}</p>
                  <div className="flex flex-wrap gap-1">
                    {["Again", "Hard", "Good", "Easy"].map((label, idx) => (
                      <button
                        key={label}
                        onClick={() => handleReview(c.id, idx)}
                        className="px-2 py-1 text-[10px] rounded border border-border bg-muted/40 hover:bg-muted"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-semibold">All cards</Label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search front/back/tag…"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs"
            />
          </div>
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground">No cards match.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((c) => (
                <div key={c.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start text-xs py-1.5 border-b border-border/40 last:border-0">
                  <span className="font-medium">{c.front}</span>
                  <span className="text-muted-foreground">{c.back}</span>
                  <button onClick={() => setDeck((d) => removeCard(d, c.id))} className="text-red-500 text-[10px] hover:underline">
                    remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1 pt-1">
            {Object.entries(tagFreq).map(([t, n]) => (
              <Badge key={t} variant="outline" className="text-[10px]">
                {t} ×{n}
              </Badge>
            ))}
          </div>
          <div className="flex gap-1 pt-2 text-[10px] text-muted-foreground">
            {forecast.map((n, i) => (
              <span key={i} className="px-2 py-1 rounded border border-border">
                D+{i + 1}: {n}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
