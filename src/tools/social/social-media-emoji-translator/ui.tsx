"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  TRANSLATION_MODES,
  MODE_LABELS,
  DENSITY_OPTIONS,
  DENSITY_LABELS,
  CATEGORY_LABELS,
  TONE_LABELS,
  EMOJI_ART_TEMPLATES,
  ZWJ_SEQUENCES,
  translateTextToEmoji,
  translateEmojiToText,
  generateEmojiArt,
  generateMixed,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TranslationMode,
  type EmojiDensity,
  type HistoryEntry,
  type TranslationResult,
  type EmojiCategory,
} from "./logic";
import { History, Languages, Sparkles, Wand2, Eye } from "lucide-react";

export default function SocialMediaEmojiTranslator() {
  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState<TranslationMode>("text-to-emoji");
  const [density, setDensity] = useState<EmojiDensity>("dense");
  const [preserveOriginal, setPreserveOriginal] = useState(true);
  const [artName, setArtName] = useState<string>("heart");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) setInputText(p.input);
      if (p.mode) setMode(p.mode);
      if (p.density) setDensity(p.density);
      setPreserveOriginal(p.preserveOriginal);
      if (p.input || p.mode) toast.info("Loaded from share link");
    }
  }, []);

  const result: TranslationResult | null = useMemo(() => {
    if (mode === "emoji-art") return null; // handled separately
    const text = inputText.trim();
    if (!text) return null;
    if (mode === "text-to-emoji") return translateTextToEmoji(text, density, preserveOriginal);
    if (mode === "emoji-to-text") return translateEmojiToText(text);
    if (mode === "mixed") return generateMixed(text, density);
    return null;
  }, [inputText, mode, density, preserveOriginal]);

  const artOutput = useMemo(() => {
    if (mode !== "emoji-art") return "";
    return generateEmojiArt(artName);
  }, [mode, artName]);

  const outputText = useMemo(() => {
    if (mode === "emoji-art") return artOutput;
    return result ? result.output : "";
  }, [mode, result, artOutput]);

  const textExport = useMemo(() => {
    if (mode === "emoji-art") return artOutput;
    return result ? renderText(result) : "";
  }, [mode, result, artOutput]);

  const csvExport = useMemo(() => {
    if (mode === "emoji-art" || !result) return "";
    return renderCsv(result);
  }, [mode, result]);

  const handleSaveHistory = useCallback(() => {
    if (outputText) {
      saveHistory({
        ts: Date.now(),
        mode,
        density,
        inputPreview: inputText.slice(0, 60),
        outputPreview: outputText.slice(0, 60),
      });
      setHistory(loadHistory());
    }
  }, [inputText, outputText, mode, density]);

  const handleClear = useCallback(() => {
    setInputText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const hasOutput = outputText.length > 0;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emt-mode">Translation mode</Label>
              <select
                id="emt-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as TranslationMode)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {TRANSLATION_MODES.map((m) => (
                  <option key={m} value={m}>{MODE_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emt-density">Emoji density</Label>
              <select
                id="emt-density"
                value={density}
                onChange={(e) => setDensity(e.target.value as EmojiDensity)}
                disabled={mode === "emoji-art" || mode === "emoji-to-text"}
                className="h-9 w-full rounded border bg-background px-2 text-sm disabled:opacity-50"
              >
                {DENSITY_OPTIONS.map((d) => (
                  <option key={d} value={d}>{DENSITY_LABELS[d]}</option>
                ))}
              </select>
            </div>
          </div>

          {mode === "emoji-art" ? (
            <div className="space-y-1.5">
              <Label htmlFor="emt-art">Emoji art template</Label>
              <select
                id="emt-art"
                value={artName}
                onChange={(e) => setArtName(e.target.value)}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {Object.keys(EMOJI_ART_TEMPLATES).map((n) => (
                  <option key={n} value={n}>{n.replace(/-/g, " ")}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="emt-input">Input text</Label>
              <Textarea
                id="emt-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  mode === "emoji-to-text"
                    ? "Paste emojis here to translate back to text..."
                    : "Type text to translate to emojis (e.g. 'good morning everyone, happy birthday!')"
                }
                className="min-h-[100px] resize-y text-sm"
              />
              {(mode === "text-to-emoji" || mode === "mixed") && (
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preserveOriginal}
                    onChange={(e) => setPreserveOriginal(e.target.checked)}
                  />
                  Preserve original text (show alongside emojis)
                </label>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {hasOutput ? (
        <>
          {result && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Total words" value={result.stats.totalWords} />
                  <Stat label="Total emojis" value={result.stats.totalEmojis} />
                  <Stat label="Coverage" value={`${result.stats.coveragePct}%`} highlight={result.stats.coveragePct >= 50 ? "good" : "bad"} />
                  <Stat label="Avg / word" value={result.stats.avgEmojisPerWord.toFixed(2)} />
                </div>
                <div className="flex flex-wrap gap-2 pt-1 text-xs">
                  <Badge variant="outline">Tone: {TONE_LABELS[result.tone]}</Badge>
                  {(Object.entries(result.categoryCounts) as [EmojiCategory, number][])
                    .filter(([, c]) => c > 0)
                    .map(([cat, count]) => (
                      <Badge key={cat} variant="secondary" className="text-[10px]">
                        {CATEGORY_LABELS[cat]}: {count}
                      </Badge>
                    ))}
                </div>
                {result.coverage.uncovered.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Words without emoji ({result.coverage.uncovered.length})
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {result.coverage.uncovered.slice(0, 20).join(", ")}
                      {result.coverage.uncovered.length > 20 ? "…" : ""}
                    </div>
                  </div>
                )}
                {result.suggestions.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Suggested emojis for unmapped words
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                      {result.suggestions.slice(0, 6).map((s, i) => (
                        <div key={i} className="rounded border bg-background px-2 py-1 text-[11px] flex items-center gap-2">
                          <span className="font-mono text-foreground">{s.word}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-base">{s.alternatives.join(" ")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Languages className="h-4 w-4" /> Output
              </h3>
              {result?.original && (
                <div className="rounded border bg-muted/30 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Original</div>
                  <div className="text-xs font-mono whitespace-pre-wrap">{result.original}</div>
                </div>
              )}
              <div className="rounded border bg-background px-3 py-2 max-h-[400px] overflow-auto">
                <pre className="text-sm whitespace-pre-wrap font-mono break-words">{outputText}</pre>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton
                  getText={() => { handleSaveHistory(); return outputText; }}
                  label="Copy output"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textExport; }}
                  filename="emoji-translation.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                {result && mode !== "emoji-art" && (
                  <DownloadButton
                    getText={() => csvExport}
                    filename="emoji-translation.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                )}
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(inputText, mode, density, preserveOriginal); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {mode === "emoji-art" && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Wand2 className="h-4 w-4" /> ZWJ Combinations
                </h3>
                <p className="text-xs text-muted-foreground">Compound emojis from multiple components.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {ZWJ_SEQUENCES.slice(0, 12).map((z, i) => (
                    <div key={i} className="rounded border bg-background px-2 py-1.5">
                      <div className="text-base">{z.result}</div>
                      <div className="text-[10px] text-muted-foreground">{z.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{z.components.join(" + ")}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title={mode === "emoji-art" ? "Pick an art template above" : "Enter text to translate"}
          hint={
            mode === "emoji-to-text"
              ? "Paste emojis and we'll convert them back to their most common word meanings using reverse lookup."
              : "Try: 'good morning', 'happy birthday', 'I love cats and dogs'. Phrases are matched first, then words by density."
          }
          icon={<Eye className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{MODE_LABELS[h.mode]}</Badge>
                  <Badge variant="outline" className="mr-2">{DENSITY_LABELS[h.density]}</Badge>
                  <span className="text-muted-foreground font-mono">{h.inputPreview}</span>
                  <span className="text-muted-foreground mx-1">→</span>
                  <span className="text-foreground font-mono">{h.outputPreview}</span>
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
            <strong className="text-foreground">Privacy:</strong> All translation runs locally. History is stored in localStorage on this device only.
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
