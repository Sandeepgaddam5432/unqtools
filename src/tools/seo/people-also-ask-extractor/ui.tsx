"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  ALL_WORDS,
  ALL_TEMPLATE_NAMES,
  extract,
  renderCsv,
  renderMarkdown,
  renderList,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type QuestionWord,
  type HistoryEntry,
} from "./logic";
import { History, HelpCircle, ListChecks } from "lucide-react";

export default function PeopleAlsoAskExtractor() {
  const [seedsText, setSeedsText] = useState("");
  const [enabledWords, setEnabledWords] = useState<Set<QuestionWord>>(new Set(ALL_WORDS));
  const [enabledTemplates, setEnabledTemplates] = useState<Set<string>>(new Set(ALL_TEMPLATE_NAMES));
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.seeds) {
        setSeedsText(p.seeds);
        if (p.words.length > 0) setEnabledWords(new Set(p.words));
        if (p.templates.length > 0) setEnabledTemplates(new Set(p.templates));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const seeds = useMemo(
    () =>
      seedsText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [seedsText],
  );
  const result = useMemo(
    () =>
      extract(seeds, {
        words: Array.from(enabledWords),
        templates: Array.from(enabledTemplates),
      }),
    [seeds, enabledWords, enabledTemplates],
  );
  const csv = useMemo(() => renderCsv(result), [result]);
  const md = useMemo(() => renderMarkdown(result), [result]);
  const list = useMemo(() => renderList(result), [result]);

  const toggleWord = useCallback((w: QuestionWord) => {
    setEnabledWords((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  }, []);

  const toggleTemplate = useCallback((t: string) => {
    setEnabledTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (result.total > 0) {
      saveHistory({
        ts: Date.now(),
        seedCount: seeds.length,
        total: result.total,
      });
      setHistory(loadHistory());
    }
  }, [result.total, seeds.length]);

  const handleClear = useCallback(() => {
    setSeedsText("");
    toast.info("Form cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="paa-seeds">Seed topics / keywords (one per line or comma-separated)</Label>
            <Textarea
              id="paa-seeds"
              value={seedsText}
              onChange={(e) => setSeedsText(e.target.value)}
              placeholder={"SEO\ncontent marketing\nemail automation"}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Question words</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_WORDS.map((w) => (
                <button
                  key={w}
                  onClick={() => toggleWord(w)}
                  className={`rounded border px-2 py-1 text-xs cursor-pointer transition-colors ${
                    enabledWords.has(w)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted/50"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Templates</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TEMPLATE_NAMES.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTemplate(t)}
                  className={`rounded border px-2 py-1 text-xs cursor-pointer transition-colors ${
                    enabledTemplates.has(t)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {result.total > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" /> {result.total} questions
              </h3>
              <div className="flex flex-wrap gap-2">
                {ALL_WORDS.filter((w) => result.byWord[w] > 0).map((w) => (
                  <Badge key={w} variant="outline">{w}: {result.byWord[w]}</Badge>
                ))}
                {result.duplicatesRemoved > 0 && (
                  <Badge variant="secondary">{result.duplicatesRemoved} dupes</Badge>
                )}
              </div>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-auto">
              {ALL_WORDS.filter((w) => result.byWord[w] > 0).map((word) => (
                <div key={word} className="space-y-1">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">{word}</div>
                  {result.questions
                    .filter((q) => q.word === word)
                    .map((q, i) => (
                      <div
                        key={i}
                        className="rounded border bg-background px-3 py-1.5 text-xs"
                      >
                        <span className="text-foreground">{q.question}</span>
                      </div>
                    ))}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <CopyButton
                getText={() => {
                  handleSaveHistory();
                  return list;
                }}
                label="Copy list"
              />
              <CopyButton getText={() => md} label="Copy MD" />
              <DownloadButton getText={() => csv} filename="paa-questions.csv" mime="text/csv" label="CSV" />
              <DownloadButton getText={() => md} filename="paa-questions.md" mime="text/markdown" label="MD" />
              <ShareButton
                getUrl={() => {
                  handleSaveHistory();
                  return buildShareUrl({
                    seeds: seedsText,
                    words: Array.from(enabledWords),
                    templates: Array.from(enabledTemplates),
                  });
                }}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Enter a topic to extract PAA questions"
          hint="Choose question words and templates — we'll generate dozens of PAA-style questions for FAQ schema or content briefs."
          icon={<HelpCircle className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.seedCount} seeds</Badge>
                  <Badge variant="outline" className="mr-2">{h.total} questions</Badge>
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> question generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
