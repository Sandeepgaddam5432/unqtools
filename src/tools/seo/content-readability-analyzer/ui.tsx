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
  analyze,
  formatReadingTime,
  fleschToLevel,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type HistoryEntry,
} from "./logic";
import { History, BookOpen, BarChart3, Clock } from "lucide-react";

interface ScoreRow {
  label: string;
  value: number;
  suffix: string;
  hint: string;
}

export default function ContentReadabilityAnalyzer() {
  const [text, setText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.text) {
        setText(parsed.text);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const analysis = useMemo(() => analyze(text), [text]);
  const { stats, scores, complexWordList, longSentences, passiveVoicePhrases } = analysis;

  const scoreRows: ScoreRow[] = useMemo(() => [
    {
      label: "Flesch Reading Ease",
      value: scores.fleschReadingEase,
      suffix: "/100",
      hint: fleschToLevel(scores.fleschReadingEase),
    },
    {
      label: "Flesch-Kincaid Grade",
      value: scores.fleschKincaidGrade,
      suffix: "",
      hint: "U.S. grade level",
    },
    {
      label: "Gunning Fog",
      value: scores.gunningFog,
      suffix: "",
      hint: "Years of education needed",
    },
    {
      label: "SMOG Index",
      value: scores.smog,
      suffix: "",
      hint: "Grade level (best for health content)",
    },
    {
      label: "Coleman-Liau",
      value: scores.colemanLiau,
      suffix: "",
      hint: "Character-based grade level",
    },
    {
      label: "Automated Readability (ARI)",
      value: scores.ari,
      suffix: "",
      hint: "Character-based grade level",
    },
  ], [scores]);

  const handleSaveHistory = useCallback(() => {
    if (text.trim()) {
      saveHistory({
        ts: Date.now(),
        wordCount: stats.words,
        fleschScore: scores.fleschReadingEase,
        consensusLevel: scores.consensusLevel,
        snippet: text.slice(0, 100),
      });
      setHistory(loadHistory());
    }
  }, [text, stats.words, scores.fleschReadingEase, scores.consensusLevel]);

  const handleClear = useCallback(() => {
    setText("");
    toast.info("Text cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const exportReport = useCallback((): string => {
    const lines: string[] = [
      "Content Readability Report",
      "==========================",
      "",
      `Words: ${stats.words}`,
      `Sentences: ${stats.sentences}`,
      `Paragraphs: ${stats.paragraphs}`,
      `Syllables: ${stats.syllables}`,
      `Characters (no spaces): ${stats.characters}`,
      `Complex words: ${stats.complexWords}`,
      `Polysyllabic words: ${stats.polysyllabicWords}`,
      `Average words/sentence: ${stats.averageWordsPerSentence.toFixed(1)}`,
      `Average syllables/word: ${stats.averageSyllablesPerWord.toFixed(2)}`,
      `Longest sentence: ${stats.longestSentenceWords} words`,
      `Passive voice hits: ${stats.passiveVoiceHits}`,
      `Reading time (@200 WPM): ${formatReadingTime(stats.readingTimeMinutes)}`,
      `Speaking time (@130 WPM): ${formatReadingTime(stats.speakingTimeMinutes)}`,
      "",
      "Readability Scores",
      "------------------",
      `Flesch Reading Ease: ${scores.fleschReadingEase.toFixed(1)} / 100 (${fleschToLevel(scores.fleschReadingEase)})`,
      `Flesch-Kincaid Grade: ${scores.fleschKincaidGrade.toFixed(1)}`,
      `Gunning Fog: ${scores.gunningFog.toFixed(1)}`,
      `SMOG: ${scores.smog.toFixed(1)}`,
      `Coleman-Liau: ${scores.colemanLiau.toFixed(1)}`,
      `Automated Readability: ${scores.ari.toFixed(1)}`,
      `Average Grade: ${scores.averageGrade.toFixed(1)} (${scores.consensusLevel})`,
      "",
      `Long sentences (>25 words): ${longSentences.length}`,
      `Complex words found: ${complexWordList.length}`,
      `Passive voice phrases: ${passiveVoicePhrases.length}`,
      "",
      "---",
      "Analyzed with UnQTools Content Readability Analyzer",
    ];
    return lines.join("\n");
  }, [stats, scores, longSentences.length, complexWordList.length, passiveVoicePhrases.length]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="cra-text">Paste your content</Label>
            <div className="flex gap-2">
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(text); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <Textarea
            id="cra-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your article, blog post, or any text here. The analysis updates in real time."
            className="min-h-[200px] resize-y"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{stats.words} words</Badge>
            <Badge variant="outline">{stats.sentences} sentences</Badge>
            <Badge variant="outline">{stats.paragraphs} paragraphs</Badge>
            <Badge variant="outline">{stats.characters} chars</Badge>
            <Badge variant="outline">{stats.syllables} syllables</Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> {formatReadingTime(stats.readingTimeMinutes)} read
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> {formatReadingTime(stats.speakingTimeMinutes)} speak
            </Badge>
          </div>
        </CardContent>
      </Card>

      {text.trim() ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Readability Scores
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {scoreRows.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-md border bg-background/50 p-3 space-y-1"
                  >
                    <div className="text-xs text-muted-foreground">{row.label}</div>
                    <div className="text-xl font-semibold text-foreground">
                      {row.value.toFixed(1)}
                      <span className="text-sm text-muted-foreground ml-1">{row.suffix}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{row.hint}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="text-xs text-muted-foreground mb-1">Consensus</div>
                <div className="text-lg font-semibold text-foreground">
                  Grade {scores.averageGrade.toFixed(1)} — {scores.consensusLevel}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Stats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Avg words/sentence</div>
                  <div className="font-medium">{stats.averageWordsPerSentence.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avg syllables/word</div>
                  <div className="font-medium">{stats.averageSyllablesPerWord.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Complex words</div>
                  <div className="font-medium">{stats.complexWords}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Longest sentence</div>
                  <div className="font-medium">{stats.longestSentenceWords} words</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {longSentences.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Long sentences ({longSentences.length})
                </h3>
                <div className="text-xs text-muted-foreground">
                  Sentences over 25 words may be hard to read. Consider splitting.
                </div>
                <div className="space-y-2">
                  {longSentences.slice(0, 5).map((s, i) => (
                    <div
                      key={i}
                      className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs"
                    >
                      {s}
                    </div>
                  ))}
                  {longSentences.length > 5 && (
                    <div className="text-xs text-muted-foreground">
                      ...and {longSentences.length - 5} more
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {passiveVoicePhrases.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Passive voice hits ({passiveVoicePhrases.length})
                </h3>
                <div className="text-xs text-muted-foreground">
                  Consider rewriting in active voice for clearer, more direct prose.
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {passiveVoicePhrases.slice(0, 20).map((p, i) => (
                    <Badge key={i} variant="outline" className="font-mono text-xs">
                      {p}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {complexWordList.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Complex words (3+ syllables) — first {Math.min(complexWordList.length, 50)}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {complexWordList.map((w, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {w}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return exportReport(); }} label="Copy report" />
            <DownloadButton
              getText={() => exportReport()}
              filename="readability-report.txt"
              label="Download report"
            />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste text to analyze readability"
          hint="The tool computes 6 formulas — Flesch, Flesch-Kincaid, Gunning Fog, SMOG, Coleman-Liau, and ARI — plus stats and passive voice detection."
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
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                Clear
              </Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div
                  key={i}
                  className="rounded border bg-background px-3 py-2 text-xs"
                >
                  <Badge variant="outline" className="mr-2">{h.wordCount} words</Badge>
                  <Badge variant="outline" className="mr-2">
                    FRE {h.fleschScore.toFixed(0)}
                  </Badge>
                  <span className="text-muted-foreground">{h.consensusLevel}</span>
                  <div className="text-muted-foreground/70 mt-1">
                    {new Date(h.ts).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Readability
            analysis runs locally. History is stored in localStorage on this
            device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
