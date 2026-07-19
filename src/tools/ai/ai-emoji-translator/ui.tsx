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
  EMOJI_DICTIONARY,
  MODE_LABELS,
  DENSITY_LABELS,
  TARGET_LABELS,
  TOPIC_PRESETS,
  textToEmoji,
  emojiToText,
  computeStats,
  renderText,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TranslationMode,
  type Density,
  type OutputTarget,
  type HistoryEntry,
  type TokenMatch,
} from "./logic";
import { Smile, History, ArrowRightLeft, Sparkles } from "lucide-react";

export default function AiEmojiTranslator() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<TranslationMode>("strict");
  const [density, setDensity] = useState<Density>("medium");
  const [target, setTarget] = useState<OutputTarget>("unicode");
  const [direction, setDirection] = useState<"encode" | "decode">("encode");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [altSwap, setAltSwap] = useState<Record<number, number>>({});

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const s = parseShareUrl(window.location.hash);
      if (s.text) setText(s.text);
      if (s.mode) setMode(s.mode);
      if (s.density) setDensity(s.density);
      if (s.target) setTarget(s.target);
      if (s.text) toast.info("Loaded from share link");
    }
  }, []);

  const encodeResult = useMemo(
    () => direction === "encode" ? textToEmoji(text, mode, density, target) : null,
    [direction, text, mode, density, target],
  );
  const decodeResult = useMemo(
    () => direction === "decode" ? emojiToText(text) : null,
    [direction, text],
  );

  const output = useMemo(() => {
    if (direction === "encode" && encodeResult) return encodeResult.output;
    if (direction === "decode" && decodeResult) return decodeResult.output;
    return "";
  }, [direction, encodeResult, decodeResult]);

  const stats = useMemo(() => (encodeResult ? computeStats(encodeResult) : null), [encodeResult]);

  const handleSaveHistory = useCallback(() => {
    if (!output || !text) return;
    saveHistory({
      ts: Date.now(),
      direction,
      input: text,
      output,
      mode,
      density,
      target,
    });
    setHistory(loadHistory());
  }, [direction, text, output, mode, density, target]);

  const toggleDirection = useCallback(() => {
    setDirection((d) => (d === "encode" ? "decode" : "encode"));
    setAltSwap({});
  }, []);

  const handleClear = useCallback(() => {
    setText("");
    setAltSwap({});
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const swapAlternative = (matchIdx: number, altIdx: number) => {
    setAltSwap((prev) => ({ ...prev, [matchIdx]: altIdx }));
  };

  // For encode mode, render tokens with click-to-swap alternatives
  const renderedTokens = useMemo(() => {
    if (!encodeResult) return null;
    return encodeResult.matches.map((m, i) => {
      if (!m.matched || !m.emoji) return <span key={i}>{m.raw}</span>;
      const swapIdx = altSwap[i] ?? 0;
      const alts = [m.emoji, ...m.alternatives];
      const chosen = alts[swapIdx] ?? m.emoji;
      return (
        <span
          key={i}
          className="inline-block cursor-pointer rounded px-0.5 hover:bg-muted"
          title={`"${m.raw}" — click to swap (alt ${swapIdx + 1}/${alts.length})`}
          onClick={() => swapAlternative(i, (swapIdx + 1) % alts.length)}
        >
          {target === "unicode" ? chosen : (m.shortcode ?? chosen)}
        </span>
      );
    });
  }, [encodeResult, altSwap, target]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="aemt-text">
              {direction === "encode" ? "Text to translate" : "Emoji / shortcodes to decode"}
            </Label>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleDirection}
              className="gap-1.5"
              title="Switch direction"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {direction === "encode" ? "Encode →" : "← Decode"}
            </Button>
          </div>
          <Textarea
            id="aemt-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={direction === "encode" ? "I love pizza and coffee on a rainy day" : "I ❤️ 🍕 and ☕"}
            className="min-h-[100px] resize-y"
          />
          <div className="flex flex-wrap gap-1">
            {TOPIC_PRESETS.slice(0, 6).map((p) => (
              <Button
                key={p}
                variant="ghost"
                size="sm"
                className="h-6 text-[11px]"
                onClick={() => setText(p)}
              >{p.length > 28 ? p.slice(0, 28) + "…" : p}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {direction === "encode" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Mode</Label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as TranslationMode)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(MODE_LABELS) as TranslationMode[]).map((m) => (
                    <option key={m} value={m}>{MODE_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Density</Label>
                <select
                  value={density}
                  onChange={(e) => setDensity(e.target.value as Density)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(DENSITY_LABELS) as Density[]).map((d) => (
                    <option key={d} value={d}>{DENSITY_LABELS[d]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Output target</Label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value as OutputTarget)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(TARGET_LABELS) as OutputTarget[]).map((t) => (
                    <option key={t} value={t}>{TARGET_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {output ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Smile className="h-4 w-4" /> Output
              </h3>
              {direction === "encode" && encodeResult ? (
                <div className="rounded border bg-background px-3 py-3 text-base leading-relaxed min-h-[80px]">
                  {renderedTokens}
                </div>
              ) : (
                <div className="rounded border bg-background px-3 py-3 text-sm leading-relaxed min-h-[80px] whitespace-pre-wrap">
                  {output}
                </div>
              )}
              {direction === "encode" && encodeResult && (
                <p className="text-[10px] text-muted-foreground">
                  💡 Click any emoji to swap to an alternative.
                </p>
              )}
            </CardContent>
          </Card>

          {direction === "encode" && stats && encodeResult && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Total words" value={stats.totalWords} />
                  <Stat label="Matched" value={stats.matchedWords} />
                  <Stat label="Unique emojis" value={stats.uniqueEmojis} />
                  <Stat label="Coverage" value={`${(stats.coverage * 100).toFixed(0)}%`} />
                </div>
                {encodeResult.matches.filter((m) => m.matched).length > 0 && (
                  <div className="space-y-1 pt-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Matches</div>
                    <div className="flex flex-wrap gap-1.5">
                      {encodeResult.matches
                        .filter((m: TokenMatch) => m.matched)
                        .slice(0, 24)
                        .map((m, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">
                            {m.raw} → {target === "unicode" ? m.emoji : m.shortcode}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {direction === "decode" && decodeResult && decodeResult.decodedCount > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Emojis decoded" value={decodeResult.decodedCount} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return output; }}
                  label="Copy output"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return output; }}
                  filename="emoji-translation.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                {direction === "encode" && encodeResult && (
                  <>
                    <DownloadButton
                      getText={() => renderMarkdown(encodeResult)}
                      filename="emoji-translation.md"
                      mime="text/markdown"
                      label="Download .md"
                    />
                    <DownloadButton
                      getText={() => renderJson(encodeResult)}
                      filename="emoji-translation.json"
                      mime="application/json"
                      label="Download .json"
                    />
                  </>
                )}
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({ text, mode, density, target });
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title={direction === "encode" ? "Enter text to translate to emoji" : "Enter emoji or :shortcodes: to decode"}
          hint={
            direction === "encode"
              ? "Type a sentence and we'll replace known words with emojis. Adjust mode, density, and output target above. Click any emoji in the output to swap alternatives."
              : "Paste emoji or Discord/Slack :shortcodes: and we'll decode them back to plain English words. Best-effort — many emojis have ambiguous meanings."
          }
          icon={<Sparkles className="h-8 w-8" />}
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
                <button
                  key={i}
                  onClick={() => {
                    setText(h.input);
                    setDirection(h.direction);
                    setMode(h.mode);
                    setDensity(h.density);
                    setTarget(h.target);
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted"
                >
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.direction}</Badge>
                  <span className="text-muted-foreground">{h.input.slice(0, 50)}{h.input.length > 50 ? "…" : ""}</span>
                  <span className="mx-2">→</span>
                  <span className="font-mono">{h.output.slice(0, 50)}{h.output.length > 50 ? "…" : ""}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All lexicon lookups, density control, and shortcode rendering run locally. History is stored in localStorage on this device only. Bundled lexicon: {EMOJI_DICTIONARY.length} words.
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
