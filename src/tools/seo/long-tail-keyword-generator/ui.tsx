"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CopyButton, DownloadButton, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseSeeds,
  generate,
  renderCsv,
  renderList,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ModifierOptions,
  type HistoryEntry,
} from "./logic";
import { History, Sprout, ListTree } from "lucide-react";

export default function LongTailKeywordGenerator() {
  const [seedsText, setSeedsText] = useState("");
  const [question, setQuestion] = useState(true);
  const [comparison, setComparison] = useState(true);
  const [location, setLocation] = useState(true);
  const [intent, setIntent] = useState(true);
  const [customLocation, setCustomLocation] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.seeds) {
        setSeedsText(p.seeds);
        setQuestion(!!p.options.question);
        setComparison(!!p.options.comparison);
        setLocation(!!p.options.location);
        setIntent(!!p.options.intent);
        setCustomLocation(p.options.customLocation ?? "");
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const options: ModifierOptions = useMemo(
    () => ({
      question,
      comparison,
      location,
      intent,
      customLocation: customLocation || undefined,
    }),
    [question, comparison, location, intent, customLocation],
  );

  const seeds = useMemo(() => parseSeeds(seedsText), [seedsText]);
  const result = useMemo(() => generate(seeds, options), [seeds, options]);
  const csv = useMemo(() => renderCsv(result), [result]);
  const list = useMemo(() => renderList(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.total > 0) {
      saveHistory({
        ts: Date.now(),
        seedCount: seeds.length,
        total: result.total,
        options,
      });
      setHistory(loadHistory());
    }
  }, [result.total, seeds.length, options]);

  const handleClear = useCallback(() => {
    setSeedsText("");
    setCustomLocation("");
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
            <Label htmlFor="lt-seeds">Seed keywords (one per line or comma-separated)</Label>
            <Textarea
              id="lt-seeds"
              value={seedsText}
              onChange={(e) => setSeedsText(e.target.value)}
              placeholder={"SEO\ncontent marketing\nemail automation"}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Switch id="lt-q" checked={question} onCheckedChange={setQuestion} />
              <Label htmlFor="lt-q" className="text-sm cursor-pointer">Question (7 Ws)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="lt-c" checked={comparison} onCheckedChange={setComparison} />
              <Label htmlFor="lt-c" className="text-sm cursor-pointer">Comparison</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="lt-l" checked={location} onCheckedChange={setLocation} />
              <Label htmlFor="lt-l" className="text-sm cursor-pointer">Location</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="lt-i" checked={intent} onCheckedChange={setIntent} />
              <Label htmlFor="lt-i" className="text-sm cursor-pointer">Intent</Label>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lt-loc">Custom location (overrides defaults)</Label>
            <Input
              id="lt-loc"
              value={customLocation}
              onChange={(e) => setCustomLocation(e.target.value)}
              placeholder="in Tokyo"
            />
          </div>
        </CardContent>
      </Card>

      {result.total > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListTree className="h-4 w-4" /> {result.total} long-tail keywords
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.byCategory).map(([cat, count]) => (
                  <Badge key={cat} variant="outline">{cat}: {count}</Badge>
                ))}
                {result.duplicatesRemoved > 0 && (
                  <Badge variant="secondary">{result.duplicatesRemoved} dupes removed</Badge>
                )}
              </div>
            </div>
            <div className="space-y-1 max-h-[400px] overflow-auto">
              {result.keywords.map((k, i) => (
                <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex-1 font-mono text-foreground">{k.keyword}</div>
                  <Badge variant="outline" className="text-xs">{k.category}</Badge>
                  <span className="text-muted-foreground text-xs">[{k.modifier}]</span>
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
              <DownloadButton getText={() => csv} filename="long-tail-keywords.csv" mime="text/csv" label="Download CSV" />
              <ShareButton
                getUrl={() => {
                  handleSaveHistory();
                  return buildShareUrl({ seeds: seedsText, options });
                }}
              />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Enter seed keywords to generate long-tail variants"
          hint="Question, comparison, location, and intent modifiers expand each seed into many variants."
          icon={<Sprout className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.total} keywords</Badge>
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
            <strong className="text-foreground">Privacy:</strong> keyword generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
