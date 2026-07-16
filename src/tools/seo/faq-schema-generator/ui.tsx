"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  validateInput,
  parseBulkPairs,
  generateFaqSchema,
  countChars,
  buildGoogleRichResultsLink,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  QUESTION_MAX,
  ANSWER_MAX,
  type FaqPair,
  type HistoryEntry,
} from "./logic";
import { History, Plus, X, HelpCircle, ExternalLink, Upload } from "lucide-react";

function CharCounter({ value, max }: { value: string; max: number }) {
  const c = countChars(value, max);
  const color = c.isOver
    ? "text-red-600 dark:text-red-400"
    : c.isWarn
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";
  return <div className={`text-xs ${color}`}>{c.value}/{max}</div>;
}

export default function FaqSchemaGenerator() {
  const [pairs, setPairs] = useState<FaqPair[]>([
    { question: "", answer: "" },
  ]);
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.pairs && Array.isArray(parsed.pairs) && parsed.pairs.length > 0) {
        setPairs(parsed.pairs);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validateInput({ pairs }), [pairs]);
  const output = useMemo(() => {
    try {
      if (pairs.length === 0) return "";
      return generateFaqSchema({ pairs });
    } catch {
      return "";
    }
  }, [pairs]);

  const addPair = useCallback(() => {
    setPairs((prev) => [...prev, { question: "", answer: "" }]);
  }, []);
  const removePair = useCallback((i: number) => {
    setPairs((prev) => prev.filter((_, idx) => idx !== i));
  }, []);
  const updatePair = useCallback((i: number, key: keyof FaqPair, val: string) => {
    setPairs((prev) => prev.map((p, idx) => (idx === i ? { ...p, [key]: val } : p)));
  }, []);

  const importBulk = useCallback(() => {
    const parsed = parseBulkPairs(bulkText);
    if (parsed.length === 0) {
      toast.error("No valid Q&A pairs found");
      return;
    }
    setPairs(parsed);
    setShowBulk(false);
    setBulkText("");
    toast.success(`Imported ${parsed.length} pairs`);
  }, [bulkText]);

  const handleCopy = useCallback(() => {
    if (output) {
      saveHistory({ ts: Date.now(), pairCount: pairs.length, snippet: output.slice(0, 200) });
      setHistory(loadHistory());
    }
  }, [output, pairs.length]);

  const handleClear = useCallback(() => {
    setPairs([{ question: "", answer: "" }]);
    setBulkText("");
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Q&amp;A pairs ({pairs.length})</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowBulk((s) => !s)} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Bulk paste
              </Button>
              <Button size="sm" variant="outline" onClick={addPair} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add pair
              </Button>
            </div>
          </div>
          {showBulk && (
            <div className="space-y-1.5">
              <Label htmlFor="faq-bulk">Bulk paste (Q: ... A: ... per question, blank line between pairs)</Label>
              <Textarea
                id="faq-bulk"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Q: What is this tool?\nA: A FAQ schema generator.\n\nQ: Is it free?\nA: Yes, 100% free."}
                className="min-h-[120px] font-mono text-xs resize-y"
              />
              <Button size="sm" variant="outline" onClick={importBulk} disabled={!bulkText.trim()}>
                Import {bulkText ? `(${parseBulkPairs(bulkText).length} pairs)` : ""}
              </Button>
            </div>
          )}
          {pairs.map((p, i) => (
            <div key={i} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`q-${i}`} className="text-xs">Question #{i + 1}</Label>
                <div className="flex items-center gap-2">
                  <CharCounter value={p.question} max={QUESTION_MAX} />
                  <Button size="icon" variant="ghost" onClick={() => removePair(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Input
                id={`q-${i}`}
                value={p.question}
                onChange={(e) => updatePair(i, "question", e.target.value)}
                placeholder="What is X?"
              />
              <div className="flex items-center justify-between">
                <Label htmlFor={`a-${i}`} className="text-xs">Answer #{i + 1}</Label>
                <CharCounter value={p.answer} max={ANSWER_MAX} />
              </div>
              <Textarea
                id={`a-${i}`}
                value={p.answer}
                onChange={(e) => updatePair(i, "answer", e.target.value)}
                placeholder="X is..."
                className="min-h-[80px] resize-y"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.slice(0, 5).map((w, i) => <div key={i}>• {w}</div>)}
          {validation.warnings.length > 5 && <div>• ...and {validation.warnings.length - 5} more</div>}
        </div>
      )}

      {output ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Generated FAQPage JSON-LD</Label>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleCopy(); return output; }} />
              <DownloadButton getText={() => output} filename="faq-schema.jsonld" mime="application/ld+json" />
              <ShareButton getUrl={() => buildShareUrl({ pairs })} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all max-h-[400px]">
            {output}
          </pre>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={buildGoogleRichResultsLink("")} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Google Rich Results test
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <EmptyState
          title="Add at least one Q&A pair"
          hint="Each pair needs a question (ending with '?') and an answer. Use bulk paste for speed."
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
                  <Badge variant="outline" className="mr-2">{h.pairCount} pairs</Badge>
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
            <strong className="text-foreground">Privacy:</strong> FAQ schema generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
