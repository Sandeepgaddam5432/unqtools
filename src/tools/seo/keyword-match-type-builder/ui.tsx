"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  convertKeywords,
  filterByType,
  renderCsv,
  renderPlainText,
  MATCH_TYPE_REFERENCE,
  GOOGLE_ADS_MATCH_TYPE_DOCS_URL,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type MatchType,
  type HistoryEntry,
} from "./logic";
import { History, Tags, ExternalLink, Copy } from "lucide-react";

const TYPE_LABELS: Record<MatchType, string> = {
  broad: "Broad",
  phrase: "Phrase",
  exact: "Exact",
  negative: "Negative",
};

const TYPE_SYMBOLS: Record<MatchType, string> = {
  broad: "(none)",
  phrase: '"..."',
  exact: "[...]",
  negative: "-keyword",
};

export default function KeywordMatchTypeBuilder() {
  const [text, setText] = useState("");
  const [types, setTypes] = useState<MatchType[]>(["broad", "phrase", "exact"]);
  const [dedup, setDedup] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.text !== undefined) {
        setText(parsed.text);
        if (parsed.types && parsed.types.length > 0) setTypes(parsed.types);
        if (parsed.dedup !== undefined) setDedup(parsed.dedup);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(
    () => convertKeywords(text, { types, dedup }),
    [text, types, dedup],
  );

  const toggleType = useCallback((t: MatchType) => {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (result.stats.total > 0) {
      saveHistory({
        ts: Date.now(),
        keywordCount: text.split(/\n+/).filter((s) => s.trim()).length,
        types,
        snippet: text.slice(0, 80),
      });
      setHistory(loadHistory());
    }
  }, [result, text, types]);

  const handleClear = useCallback(() => {
    setText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const allTypes: MatchType[] = ["broad", "phrase", "exact", "negative"];

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="kmtb-keywords">Keywords (one per line)</Label>
            <Textarea
              id="kmtb-keywords"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"running shoes\nbest sneakers\nmarathon training"}
              className="min-h-[150px] font-mono text-xs resize-y"
            />
          </div>
          <div className="space-y-2">
            <Label>Match types to generate</Label>
            <div className="flex flex-wrap gap-2">
              {allTypes.map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={types.includes(t) ? "default" : "outline"}
                  onClick={() => toggleType(t)}
                >
                  {TYPE_LABELS[t]} <span className="text-xs opacity-70 ml-1">{TYPE_SYMBOLS[t]}</span>
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="kmtb-dedup" className="cursor-pointer">
              Dedup keywords (case-insensitive per type)
            </Label>
            <Switch id="kmtb-dedup" checked={dedup} onCheckedChange={setDedup} />
          </div>
        </CardContent>
      </Card>

      {result.stats.total > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Stats</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-lg font-semibold">{result.stats.total}</div>
                </div>
                {allTypes.map((t) => (
                  <div key={t} className="rounded-md border bg-background/50 p-2">
                    <div className="text-xs text-muted-foreground">{TYPE_LABELS[t]}</div>
                    <div className="text-lg font-semibold">
                      {result.stats[t]}
                    </div>
                  </div>
                ))}
              </div>
              {result.stats.duplicatesRemoved > 0 && (
                <p className="text-xs text-muted-foreground">
                  {result.stats.duplicatesRemoved} duplicates removed.
                </p>
              )}
            </CardContent>
          </Card>

          {result.errors.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
              {result.errors.slice(0, 10).map((e, i) => (
                <div key={i} className="text-xs">• {e}</div>
              ))}
            </div>
          )}

          {types.map((t) => {
            const typeEntries = filterByType(result.entries, t);
            if (typeEntries.length === 0) return null;
            const plain = renderPlainText(typeEntries);
            return (
              <Card key={t}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{TYPE_LABELS[t]}</Badge>
                      <Badge variant="outline" className="text-xs">{TYPE_SYMBOLS[t]}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {typeEntries.length} keywords
                      </span>
                    </div>
                    <CopyButton
                      getText={() => { handleSaveHistory(); return plain; }}
                      label="Copy"
                      size="icon-sm"
                    />
                  </div>
                  <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs max-h-[200px]">
                    {plain}
                  </pre>
                </CardContent>
              </Card>
            );
          })}

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return renderPlainText(result.entries); }} label="Copy all" />
            <DownloadButton
              getText={() => renderCsv(result)}
              filename="keyword-match-types.csv"
              label="Download CSV"
            />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ text, types, dedup }); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      ) : (
        <EmptyState
          title="Enter keywords and pick match types"
          hint="Paste a list of keywords (one per line). Pick which match types to generate. We'll format each one and provide stats."
          icon={<Tags className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Match type reference</h3>
            <a
              href={GOOGLE_ADS_MATCH_TYPE_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Google docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="space-y-2">
            {MATCH_TYPE_REFERENCE.map((m) => (
              <div key={m.type} className="rounded-md border p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{TYPE_LABELS[m.type]}</Badge>
                    <code className="text-foreground">{m.symbol}</code>
                  </div>
                  <code className="text-muted-foreground">{m.example}</code>
                </div>
                <div className="text-muted-foreground">{m.description}</div>
                <div>
                  <span className="font-medium text-foreground">When to use:</span>{" "}
                  <span className="text-muted-foreground">{m.whenToUse}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {h.types.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">{TYPE_LABELS[t]}</Badge>
                    ))}
                  </div>
                  <span className="text-muted-foreground">{h.keywordCount} keywords</span>
                  <div className="text-muted-foreground/70 mt-1">{new Date(h.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Match type
            formatting is pure string manipulation. History is stored in
            localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
