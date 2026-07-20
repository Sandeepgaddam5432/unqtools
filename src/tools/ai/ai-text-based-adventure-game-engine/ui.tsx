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
} from "../../_shared";
import { toast } from "sonner";
import {
  GENRE_LABELS,
  DIFFICULTY_LABELS,
  CHARACTER_PRESETS,
  WORLD_TEMPLATES,
  getWorldById,
  listWorlds,
  newGameState,
  currentScene,
  availableChoices,
  applyChoice,
  interpretFreeText,
  hasItem,
  isGameOver,
  isVictory,
  isPlaying,
  summarizeMemory,
  computeWorldStats,
  renderTranscriptText,
  renderTranscriptMarkdown,
  renderTranscriptJson,
  listSaves,
  saveGame,
  loadSave,
  deleteSave,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmRequestBody,
  extractLlmNarration,
  type Genre,
  type Difficulty,
  type GameState,
  type Choice,
  type SaveSlot,
  type HistoryEntry,
} from "./logic";
import {
  Gamepad2, History, Heart, Trophy, Package, Flag, Dice5,
  KeyRound, Loader2, Save, FolderOpen, Trash2, ScrollText,
} from "lucide-react";

const GENRES: Genre[] = ["fantasy", "sci-fi", "mystery", "horror"];
const DIFFICULTIES: Difficulty[] = ["easy", "standard", "hard"];

export default function AiTextBasedAdventureGameEngine() {
  const [worldId, setWorldId] = useState<string>(WORLD_TEMPLATES[0].id);
  const [heroName, setHeroName] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [state, setState] = useState<GameState | null>(null);
  const [freeText, setFreeText] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmNarration, setLlmNarration] = useState("");
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saveLabel, setSaveLabel] = useState("");

  useEffect(() => {
    setSaves(listSaves());
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.worldId) setWorldId(p.worldId);
      if (p.heroName) setHeroName(p.heroName);
      if (p.difficulty) setDifficulty(p.difficulty);
      if (p.worldId || p.heroName) toast.info("Loaded from share link");
    }
  }, []);

  const world = useMemo(() => getWorldById(worldId), [worldId]);
  const scene = useMemo(() => (state ? currentScene(state) : undefined), [state]);
  const choices = useMemo(() => (state ? availableChoices(state) : []), [state]);
  const worldStats = useMemo(() => (world ? computeWorldStats(world) : null), [world]);

  const handleStart = useCallback(() => {
    if (!world) {
      toast.error("Pick a world first");
      return;
    }
    const s = newGameState(world, heroName, difficulty, Date.now() ^ Math.floor(Math.random() * 1e9));
    setState(s);
    setLlmNarration("");
    setFreeText("");
    toast.success(`Adventure begins: ${world.name}`);
  }, [world, heroName, difficulty]);

  const handleChoice = useCallback((choice: Choice) => {
    setState((prev) => {
      if (!prev) return prev;
      const res = applyChoice(prev, choice.id);
      // record transcript
      const next = { ...res.state, transcript: [...prev.transcript, res.transcriptEntry] };
      // If ended, push to history
      if ((isVictory(next) || isGameOver(next))) {
        saveHistory({
          ts: Date.now(),
          worldId: next.worldId,
          genre: next.genre,
          heroName: next.heroName,
          status: next.status as "victory" | "game-over",
          score: next.stat.score,
          turns: next.transcript.length,
        });
        setHistory(loadHistory());
        if (isVictory(next)) toast.success(`Victory! Final score: ${next.stat.score}`);
        else toast.error(`Game over. Final score: ${next.stat.score}`);
      }
      return next;
    });
    setLlmNarration("");
  }, []);

  const handleFreeText = useCallback(() => {
    if (!state || !freeText.trim()) return;
    const interp = interpretFreeText(freeText, state);
    toast.info(interp.response);
    setFreeText("");
  }, [state, freeText]);

  const handleSave = useCallback(() => {
    if (!state) {
      toast.error("No active game to save");
      return;
    }
    const label = saveLabel || `${state.heroName} — turn ${state.transcript.length}`;
    const next = saveGame(label, state);
    setSaves(next);
    setSaveLabel("");
    toast.success(`Saved: ${label}`);
  }, [state, saveLabel]);

  const handleLoad = useCallback((slot: SaveSlot) => {
    const loaded = loadSave(slot.id);
    if (!loaded) {
      toast.error("Save not found");
      return;
    }
    setState(loaded.state);
    setWorldId(loaded.state.worldId);
    setHeroName(loaded.state.heroName);
    setDifficulty(loaded.state.difficulty);
    toast.success(`Loaded: ${loaded.label}`);
  }, []);

  const handleDeleteSave = useCallback((id: string) => {
    setSaves(deleteSave(id));
    toast.info("Save deleted");
  }, []);

  const handleClear = useCallback(() => {
    setState(null);
    setFreeText("");
    setLlmNarration("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleEnhanceLlm = useCallback(async () => {
    if (!apiKey) {
      toast.error("Paste your API key first");
      return;
    }
    if (!state) {
      toast.error("Start the game first");
      return;
    }
    setLlmLoading(true);
    setLlmNarration("");
    try {
      const body = buildLlmRequestBody(state, freeText || "continue the story");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        toast.error(`API error ${res.status}: ${txt.slice(0, 200)}`);
        return;
      }
      const json = await res.json();
      const out = extractLlmNarration(json);
      if (out) {
        setLlmNarration(out);
        toast.success("LLM narration ready");
      } else {
        toast.error("No content in LLM response");
      }
    } catch (e) {
      toast.error(`Could not reach API: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLlmLoading(false);
    }
  }, [apiKey, state, freeText]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {!state ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Gamepad2 className="h-4 w-4" /> Begin a New Adventure
            </h3>
            <div className="space-y-1">
              <Label className="text-xs">Choose a world</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {listWorlds().map((w) => (
                  <button
                    key={w.id}
                    onClick={() => setWorldId(w.id)}
                    className={`text-left rounded border p-2 transition ${
                      worldId === w.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{GENRE_LABELS[w.genre]}</Badge>
                      <span className="text-sm font-medium text-foreground">{w.name}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{w.blurb}</p>
                    {worldStats && w.id === worldId && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {worldStats.sceneCount} scenes · {worldStats.choiceCount} choices · {worldStats.victoryScenes} win path(s)
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="adv-hero" className="text-xs">Hero name</Label>
              <Input
                id="adv-hero"
                value={heroName}
                onChange={(e) => setHeroName(e.target.value)}
                placeholder="e.g. Aria Brightblade"
                className="h-9"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {CHARACTER_PRESETS.filter((p) => !world || p.genre === world.genre).slice(0, 4).map((p) => (
                  <Button
                    key={p.name}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    onClick={() => setHeroName(p.name)}
                  >+ {p.name}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Difficulty</Label>
              <div className="flex gap-2">
                {DIFFICULTIES.map((d) => (
                  <Button
                    key={d}
                    variant={difficulty === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDifficulty(d)}
                  >{DIFFICULTY_LABELS[d]}</Button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <RunButton onClick={handleStart} label="Start adventure" />
              <ShareButton getUrl={() => buildShareUrl({ worldId, heroName, difficulty })} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Health" value={`${state.stat.health}/${state.stat.maxHealth}`} icon={<Heart className="h-3 w-3" />} />
                <Stat label="Score" value={state.stat.score} icon={<Trophy className="h-3 w-3" />} />
                <Stat label="Inventory" value={state.inventory.length} icon={<Package className="h-3 w-3" />} />
                <Stat label="Turns" value={state.transcript.length} icon={<ScrollText className="h-3 w-3" />} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{scene?.title ?? "(unknown scene)"}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {state.heroName} · {GENRE_LABELS[state.genre]} · {DIFFICULTY_LABELS[state.difficulty]}
                  </p>
                </div>
                <Badge variant={isVictory(state) ? "default" : isGameOver(state) ? "destructive" : "secondary"}>
                  {state.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-foreground whitespace-pre-line">{scene?.narration ?? ""}</p>
              {llmNarration && (
                <div className="rounded border border-primary/30 bg-primary/5 p-3 space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-primary flex items-center gap-1">
                    <SparklesIcon /> LLM narration
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-line">{llmNarration}</p>
                </div>
              )}
              {isPlaying(state) && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Choices</div>
                  <div className="grid grid-cols-1 gap-2">
                    {choices.map((c, i) => (
                      <button
                        key={c.id}
                        onClick={() => handleChoice(c)}
                        className="text-left rounded border bg-background px-3 py-2 text-sm hover:bg-muted transition flex items-start gap-2"
                      >
                        <span className="text-primary font-mono text-xs mt-0.5">{i + 1}.</span>
                        <span className="text-foreground">{c.label}</span>
                      </button>
                    ))}
                    {choices.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No choices available — the scene must end on its own.</p>
                    )}
                  </div>
                  <div className="space-y-1 pt-1">
                    <Label htmlFor="adv-free" className="text-xs">Free-text action (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="adv-free"
                        value={freeText}
                        onChange={(e) => setFreeText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleFreeText(); }}
                        placeholder="e.g. examine the body"
                        className="h-9 text-sm"
                      />
                      <Button size="sm" variant="outline" onClick={handleFreeText}>Try</Button>
                    </div>
                  </div>
                </div>
              )}
              {(isVictory(state) || isGameOver(state)) && (
                <div className="rounded border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">
                    {isVictory(state) ? "🏆 Your tale ends in triumph." : "💀 Your tale ends here."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Final score: {state.stat.score} · Turns: {state.transcript.length}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton getText={() => renderTranscriptText(state)} label="Copy transcript" />
                <DownloadButton
                  getText={() => renderTranscriptMarkdown(state)}
                  filename="adventure-transcript.md"
                  mime="text/markdown"
                  label="Download .md"
                />
                <DownloadButton
                  getText={() => renderTranscriptJson(state)}
                  filename="adventure-save.json"
                  mime="application/json"
                  label="Download .json"
                />
                <Button variant="outline" size="sm" onClick={handleSave} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save game
                </Button>
                <ClearButton onClick={handleClear} />
              </div>
              {state.memory.length > 0 && (
                <div className="pt-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Memory</div>
                  <p className="text-[11px] text-muted-foreground italic">{summarizeMemory(state)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                <h4 className="text-sm font-semibold text-foreground">Optional: Enhance narration with LLM (BYO key)</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Paste your own OpenAI API key to get richer, AI-generated narration for the next scene. The key stays in your browser; requests go directly to OpenAI.
              </p>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="h-9 text-sm font-mono"
              />
              <Button size="sm" onClick={handleEnhanceLlm} disabled={llmLoading} className="gap-1.5">
                {llmLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SparklesIcon />}
                {llmLoading ? "Asking LLM…" : "Enhance narration"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {saves.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FolderOpen className="h-4 w-4" /> Saves ({saves.length})
              </h3>
            </div>
            <div className="flex gap-2">
              <Input
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
                placeholder="Save label (optional)"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              {saves.slice(0, 10).map((s) => (
                <div key={s.id} className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground">{s.label}</span>
                  <Badge variant="outline" className="text-[10px]">{GENRE_LABELS[s.state.genre]}</Badge>
                  <Badge variant="outline" className="text-[10px]">Turn {s.state.transcript.length}</Badge>
                  <span className="text-muted-foreground">{new Date(s.savedAt).toLocaleString()}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px] ml-auto" onClick={() => handleLoad(s)}>
                    <FolderOpen className="h-3 w-3 mr-1" /> Load
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => handleDeleteSave(s.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
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
                <History className="h-4 w-4" /> Past Runs ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-2 flex-wrap">
                  <Badge variant={h.status === "victory" ? "default" : "destructive"} className="text-[10px]">{h.status}</Badge>
                  <Badge variant="outline" className="text-[10px]">{GENRE_LABELS[h.genre]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.score} pts</Badge>
                  <span className="text-muted-foreground">{h.heroName}</span>
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
            <strong className="text-foreground">Honesty:</strong> On-device narration is template-based (four hand-authored worlds) — playable but simpler than AI Dungeon. Optional BYO-key LLM gives richer storytelling. All play is local — nothing uploaded or logged by us. Save slots live in localStorage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SparklesIcon() {
  return <span className="text-primary">✦</span>;
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
