"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  computeTopKeywords,
  formatReadingTime,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type HistoryEntry,
} from "./logic";
import { History, FileText, Clock, CheckCircle2, XCircle } from "lucide-react";

export default function ContentWordCount() {
  const [text, setText] = useState("");
  const [excludeStopWords, setExcludeStopWords] = useState(true);
  const [customExclude, setCustomExclude] = useState("");
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
  const { stats, topKeywords, sentenceLengthBuckets, paragraphStats, seoScore } = analysis;

  const customExcludeList = useMemo(
    () =>
      customExclude
        .split(/[,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [customExclude],
  );

  const filteredKeywords = useMemo(() => {
    if (!text) return [];
    return computeTopKeywords(text, 10, excludeStopWords, customExcludeList);
  }, [text, excludeStopWords, customExcludeList]);

  const handleSaveHistory = useCallback(() => {
    if (text.trim()) {
      saveHistory({
        ts: Date.now(),
        wordCount: stats.words,
        seoScore: seoScore.score,
        snippet: text.slice(0, 100),
      });
      setHistory(loadHistory());
    }
  }, [text, stats.words, seoScore.score]);

  const handleClear = useCallback(() => {
    setText("");
    setCustomExclude("");
    toast.info("Text cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const exportStats = useCallback((): string => {
    const lines: string[] = [
      "Content Word Count & SEO Report",
      "================================",
      "",
      "Counts",
      "------",
      `Words: ${stats.words}`,
      `Unique words: ${stats.uniqueWords}`,
      `Characters (with spaces): ${stats.characters}`,
      `Characters (no spaces): ${stats.charactersNoSpaces}`,
      `Sentences: ${stats.sentences}`,
      `Paragraphs: ${stats.paragraphs}`,
      `Lines: ${stats.lines}`,
      "",
      "Averages",
      "--------",
      `Avg word length: ${stats.averageWordLength.toFixed(2)} chars`,
      `Avg sentence length: ${stats.averageSentenceLength.toFixed(1)} words`,
      `Longest word: ${stats.longestWord}`,
      `Longest sentence: ${stats.longestSentenceWordCount} words`,
      "",
      "Timing",
      "------",
      `Reading time @200 WPM: ${formatReadingTime(stats.readingTimeMinutes)}`,
      `Reading time @250 WPM: ${formatReadingTime(stats.readingTimeMinutes250)}`,
      `Speaking time @130 WPM: ${formatReadingTime(stats.speakingTimeMinutes)}`,
      "",
      "Paragraph Stats",
      "---------------",
      `Paragraph count: ${paragraphStats.count}`,
      `Avg sentences/paragraph: ${paragraphStats.averageSentencesPerParagraph.toFixed(1)}`,
      `Avg words/paragraph: ${paragraphStats.averageWordsPerParagraph.toFixed(1)}`,
      `Longest paragraph: ${paragraphStats.longestParagraphWords} words`,
      "",
      "Top 10 Keywords",
      "---------------",
      ...filteredKeywords.map(
        (k, i) => `${i + 1}. ${k.word} — ${k.count}x (${k.density.toFixed(2)}%)`,
      ),
      "",
      "Sentence Length Distribution",
      "---------------------------",
      ...sentenceLengthBuckets.map((b) => `${b.range} words: ${b.count}`),
      "",
      `SEO Score: ${seoScore.score}/100 (${seoScore.label})`,
      "Checks:",
      ...seoScore.checks.map(
        (c) => `  [${c.passed ? "x" : " "}] ${c.name} — ${c.hint}`,
      ),
      "",
      "---",
      "Analyzed with UnQTools Content Word Count & SEO Analyzer",
    ];
    return lines.join("\n");
  }, [stats, paragraphStats, filteredKeywords, sentenceLengthBuckets, seoScore]);

  const scoreColor =
    seoScore.score >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : seoScore.score >= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="cwc-text">Paste your content</Label>
            <div className="flex gap-2">
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(text); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <Textarea
            id="cwc-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your article, blog post, or any text here. Counts update in real time."
            className="min-h-[200px] resize-y"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded-md border bg-background/50 p-2">
              <div className="text-xs text-muted-foreground">Words</div>
              <div className="text-lg font-semibold">{stats.words}</div>
            </div>
            <div className="rounded-md border bg-background/50 p-2">
              <div className="text-xs text-muted-foreground">Characters</div>
              <div className="text-lg font-semibold">{stats.characters}</div>
            </div>
            <div className="rounded-md border bg-background/50 p-2">
              <div className="text-xs text-muted-foreground">Sentences</div>
              <div className="text-lg font-semibold">{stats.sentences}</div>
            </div>
            <div className="rounded-md border bg-background/50 p-2">
              <div className="text-xs text-muted-foreground">Paragraphs</div>
              <div className="text-lg font-semibold">{stats.paragraphs}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> Read: {formatReadingTime(stats.readingTimeMinutes)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> Read @250: {formatReadingTime(stats.readingTimeMinutes250)}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" /> Speak: {formatReadingTime(stats.speakingTimeMinutes)}
            </Badge>
            <Badge variant="outline">Unique: {stats.uniqueWords}</Badge>
            <Badge variant="outline">Lines: {stats.lines}</Badge>
          </div>
        </CardContent>
      </Card>

      {text.trim() ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">SEO Score</h3>
                <div className={`text-2xl font-bold ${scoreColor}`}>
                  {seoScore.score}/100
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    {seoScore.label}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                {seoScore.checks.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs"
                  >
                    {c.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground ml-1">— {c.hint}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-foreground">Top 10 keywords</h3>
                <div className="flex items-center gap-2">
                  <Label htmlFor="cwc-stop" className="text-xs">Exclude stop words</Label>
                  <Switch
                    id="cwc-stop"
                    checked={excludeStopWords}
                    onCheckedChange={setExcludeStopWords}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="cwc-exclude" className="text-xs">
                  Custom exclude words (comma-separated)
                </Label>
                <Input
                  id="cwc-exclude"
                  value={customExclude}
                  onChange={(e) => setCustomExclude(e.target.value)}
                  placeholder="example, sample, test"
                  className="mt-1 text-xs"
                />
              </div>
              {filteredKeywords.length > 0 ? (
                <div className="space-y-1">
                  {filteredKeywords.map((k, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded border bg-background px-3 py-1.5 text-xs"
                    >
                      <span className="font-medium">{i + 1}. {k.word}</span>
                      <span className="text-muted-foreground">
                        {k.count}× · {k.density.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No keywords yet — keep writing.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Sentence length distribution</h3>
              <div className="space-y-1.5">
                {sentenceLengthBuckets.map((b) => {
                  const maxCount = Math.max(
                    1,
                    ...sentenceLengthBuckets.map((x) => x.count),
                  );
                  const pct = (b.count / maxCount) * 100;
                  return (
                    <div key={b.range} className="flex items-center gap-2 text-xs">
                      <div className="w-16 text-muted-foreground">{b.range} words</div>
                      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-primary/60"
                          style={{ width: `${pct}%` }}
                          aria-label={`${b.count} sentences`}
                        />
                      </div>
                      <div className="w-8 text-right">{b.count}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Paragraph stats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Count</div>
                  <div className="font-medium">{paragraphStats.count}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avg sentences/para</div>
                  <div className="font-medium">{paragraphStats.averageSentencesPerParagraph.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avg words/para</div>
                  <div className="font-medium">{paragraphStats.averageWordsPerParagraph.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Longest para</div>
                  <div className="font-medium">{paragraphStats.longestParagraphWords} words</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {stats.longestSentenceWordCount > 25 && stats.longestSentence && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Longest sentence ({stats.longestSentenceWordCount} words)
                </h3>
                <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                  {stats.longestSentence}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return exportStats(); }} label="Copy report" />
            <DownloadButton
              getText={() => exportStats()}
              filename="word-count-report.txt"
              label="Download report"
            />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste text to analyze"
          hint="Real-time word, character, sentence, and paragraph counting. Plus reading time, keyword density, and an SEO score."
          icon={<FileText className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">SEO {h.seoScore}</Badge>
                  <span className="text-muted-foreground">{h.snippet.slice(0, 60)}…</span>
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
            <strong className="text-foreground">Privacy:</strong> All counting
            and analysis runs locally. History is stored in localStorage on this
            device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
