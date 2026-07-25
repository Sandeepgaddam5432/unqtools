"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState } from "../../_shared";
import { runGiveaway, parseParticipants, makeCryptoRandomSource, type GiveawayPrize } from "./logic";

export default function SocialMediaGiveaway() {
  const [participantText, setParticipantText] = useState("");
  const [prizes, setPrizes] = useState<GiveawayPrize[]>([
    { label: "T-Shirt", count: 2, value: 20 },
    { label: "Mug", count: 1, value: 10 },
  ]);
  const [result, setResult] = useState<ReturnType<typeof runGiveaway> | null>(null);

  const participants = useMemo(() => parseParticipants(participantText), [participantText]);

  const handleRun = () => setResult(runGiveaway(participants, prizes, makeCryptoRandomSource()));

  const addPrize = () => setPrizes((arr) => [...arr, { label: `Prize ${arr.length + 1}`, count: 1, value: 10 }]);
  const updatePrize = (i: number, patch: Partial<GiveawayPrize>) => setPrizes((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const removePrize = (i: number) => setPrizes((arr) => arr.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="participants" className="text-xs text-muted-foreground">Participants (name,entries per line)</Label>
            <Textarea
              id="participants"
              placeholder={"Alice,1\nBob,3\nCarol,2"}
              value={participantText}
              onChange={(e) => setParticipantText(e.target.value)}
              className="font-mono text-sm min-h-[120px]"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Prizes</Label>
              <button type="button" onClick={addPrize} className="px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground cursor-pointer">+ Add prize</button>
            </div>
            {prizes.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_70px_40px] gap-2 items-center">
                <Input value={p.label} onChange={(e) => updatePrize(i, { label: e.target.value })} className="text-sm h-8" placeholder="Prize" />
                <Input type="number" min={1} value={p.count} onChange={(e) => updatePrize(i, { count: parseInt(e.target.value, 10) || 0 })} className="text-sm h-8 font-mono" />
                <Input type="number" min={0} value={p.value} onChange={(e) => updatePrize(i, { value: parseFloat(e.target.value) || 0 })} className="text-sm h-8 font-mono" />
                <button type="button" onClick={() => removePrize(i)} className="text-xs text-red-600 hover:underline cursor-pointer" aria-label="Remove">✕</button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{participants.length} participants</Badge>
            <Badge variant="outline" className="text-xs">{participants.reduce((s, p) => s + p.entries, 0)} tickets</Badge>
            <Badge variant="outline" className="text-xs">{prizes.reduce((s, p) => s + p.count, 0)} prizes</Badge>
            <button
              type="button"
              onClick={handleRun}
              disabled={participants.length === 0 || prizes.length === 0}
              className="ml-auto px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50 cursor-pointer"
            >
              Run giveaway
            </button>
          </div>
        </CardContent>
      </Card>

      {result && !result.isValid && <ErrorBanner message={result.error ?? "Could not run giveaway"} />}

      {result?.isValid && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{result.assignments.length} winners</Badge>
              <Badge variant="outline" className="text-xs">Total value: ${result.totalPrizeValue}</Badge>
              {result.unassigned.length > 0 && (
                <Badge variant="outline" className="text-xs">{result.unassigned.length} not selected</Badge>
              )}
            </div>
            <div className="space-y-1">
              {result.assignments.map((a, i) => (
                <div key={i} className="grid grid-cols-[40px_1fr_120px_80px] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground">#{i + 1}</span>
                  <code className="font-mono">{a.participant.name}</code>
                  <Badge variant="outline" className="text-[10px]">{a.prize.label}</Badge>
                  <span className="text-muted-foreground">${a.prize.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!result && (
        <EmptyState
          title="Set up your giveaway"
          hint="Add participants with optional entry weights and define prizes with counts and values. Cryptographic randomness, all in-browser."
        />
      )}
    </div>
  );
}
