"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { newCard, schedule, dueCards, stats, type Flashcard, type Quality } from "./logic";

export default function VocabularyTrainer() {
  const [cards, setCards] = useState<Flashcard[]>([
    newCard("serendipity", "a happy accident"),
    newCard("ephemeral", "lasting a very short time"),
    newCard("ubiquitous", "present everywhere"),
  ]);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const due = useMemo(() => dueCards(cards), [cards]);
  const current = due[0] ?? null;
  const s = useMemo(() => stats(cards), [cards]);

  const addCard = useCallback(() => {
    setError(null);
    if (!front.trim() || !back.trim()) { setError("Both front and back are required"); return; }
    setCards((prev) => [...prev, newCard(front.trim(), back.trim())]);
    setFront(""); setBack("");
  }, [front, back]);

  const review = useCallback((q: Quality) => {
    if (!current) return;
    setCards((prev) => prev.map((c) => c.id === current.id ? schedule(c, q) : c));
    setRevealed(false);
  }, [current]);

  const exportCards = useMemo(() => cards.map((c) => `${c.front}\t${c.back}\t${c.repetitions}\t${c.interval}\t${c.ease}\t${c.nextReview}`).join("\n"), [cards]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Cell label="Total" value={String(s.total)} />
            <Cell label="Due" value={String(s.due)} />
            <Cell label="Learned" value={String(s.learned)} />
            <Cell label="Avg ease" value={String(s.avgEase)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Add a card</p>
            <div className="flex gap-2">
              <CopyButton getText={() => exportCards} label="Copy" />
              <DownloadButton getText={() => exportCards} filename="vocab.tsv" mime="text/tab-separated-values" label="Export" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input placeholder="Front (word)" value={front} onChange={(e) => setFront(e.target.value)} className="h-8 text-xs" />
            <Input placeholder="Back (definition)" value={back} onChange={(e) => setBack(e.target.value)} className="h-8 text-xs" />
          </div>
          <Button size="sm" onClick={addCard}>Add card</Button>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold">Review ({due.length} due)</p>
          {current ? (
            <div className="space-y-3">
              <div className="rounded border bg-background p-6 text-center min-h-[120px] flex flex-col justify-center">
                <p className="text-[10px] uppercase text-muted-foreground">Front</p>
                <p className="text-xl font-semibold">{current.front}</p>
                {revealed && (
                  <>
                    <p className="text-[10px] uppercase text-muted-foreground mt-3">Back</p>
                    <p className="text-base">{current.back}</p>
                  </>
                )}
              </div>
              {!revealed ? (
                <Button size="sm" onClick={() => setRevealed(true)} className="w-full">Reveal answer</Button>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  <Button size="sm" variant="destructive" onClick={() => review(0)}>Again</Button>
                  <Button size="sm" variant="outline" onClick={() => review(3)}>Hard</Button>
                  <Button size="sm" variant="outline" onClick={() => review(4)}>Good</Button>
                  <Button size="sm" onClick={() => review(5)}>Easy</Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground text-center">Ease: {current.ease} · Reps: {current.repetitions} · Next: {current.nextReview}</p>
            </div>
          ) : (
            <div className="rounded border border-dashed p-6 text-center text-xs text-muted-foreground">
              No cards due. Add more cards or come back later.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">All cards ({cards.length})</p>
          <div className="space-y-1 max-h-[200px] overflow-auto">
            {cards.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs rounded border bg-background px-2 py-1">
                <span className="font-mono font-semibold">{c.front}</span>
                <span className="text-muted-foreground">— {c.back}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">due {c.nextReview}</Badge>
                <Button size="icon-sm" variant="ghost" onClick={() => setCards((prev) => prev.filter((x) => x.id !== c.id))}>×</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all review scheduling runs locally.</p></CardContent></Card>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
