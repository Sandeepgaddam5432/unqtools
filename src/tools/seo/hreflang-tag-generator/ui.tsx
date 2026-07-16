"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CopyButton, DownloadButton, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  LANGUAGE_CODES,
  REGION_CODES,
  isValidHreflangValue,
  isValidUrl,
  validateInput,
  generateTags,
  parseBatch,
  detectDuplicates,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type HreflangEntry,
  type HistoryEntry,
} from "./logic";
import { History, Plus, X, Languages, Globe } from "lucide-react";

export default function HreflangTagGenerator() {
  const [entries, setEntries] = useState<HreflangEntry[]>([
    { hreflang: "en-US", url: "" },
    { hreflang: "fr-FR", url: "" },
  ]);
  const [includeXDefault, setIncludeXDefault] = useState(true);
  const [xDefaultUrl, setXDefaultUrl] = useState("");
  const [batchText, setBatchText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.entries && Array.isArray(parsed.entries) && parsed.entries.length > 0) {
        setEntries(parsed.entries);
        if (parsed.includeXDefault !== undefined) setIncludeXDefault(parsed.includeXDefault);
        if (parsed.xDefaultUrl !== undefined) setXDefaultUrl(parsed.xDefaultUrl);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const input = useMemo(
    () => ({ entries, includeXDefault, xDefaultUrl }),
    [entries, includeXDefault, xDefaultUrl],
  );

  const validation = useMemo(() => validateInput(input), [input]);
  const duplicates = useMemo(() => detectDuplicates(entries), [entries]);
  const output = useMemo(() => {
    try {
      if (entries.length === 0) return "";
      return generateTags(input);
    } catch {
      return "";
    }
  }, [input, entries.length]);

  const addEntry = useCallback(() => {
    setEntries((prev) => [...prev, { hreflang: "en", url: "" }]);
  }, []);
  const removeEntry = useCallback((i: number) => {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
  }, []);
  const updateEntry = useCallback((i: number, key: keyof HreflangEntry, val: string) => {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [key]: val } : e)));
  }, []);

  const importBatch = useCallback(() => {
    const parsed = parseBatch(batchText);
    if (parsed.length === 0) {
      toast.error("No valid entries found in batch");
      return;
    }
    setEntries(parsed);
    toast.success(`Imported ${parsed.length} entries`);
  }, [batchText]);

  const handleCopy = useCallback(() => {
    if (output) {
      saveHistory({ ts: Date.now(), snippet: output.slice(0, 200) });
      setHistory(loadHistory());
    }
  }, [output]);

  const handleClear = useCallback(() => {
    setEntries([{ hreflang: "en", url: "" }]);
    setIncludeXDefault(false);
    setXDefaultUrl("");
    setBatchText("");
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
            <h3 className="text-sm font-semibold text-foreground">Language/Region entries</h3>
            <Button size="sm" variant="outline" onClick={addEntry} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add entry
            </Button>
          </div>
          {entries.map((e, i) => {
            const isValidHl = isValidHreflangValue(e.hreflang);
            const isValidU = !e.url || isValidUrl(e.url);
            const isDup = duplicates.includes(e.hreflang);
            return (
              <div key={i} className="flex items-end gap-2">
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor={`hl-${i}`} className="text-xs">hreflang</Label>
                  <Input
                    id={`hl-${i}`}
                    value={e.hreflang}
                    onChange={(ev) => updateEntry(i, "hreflang", ev.target.value)}
                    placeholder="en-US"
                    className={`font-mono text-xs ${!isValidHl ? "border-red-500" : ""} ${isDup ? "border-amber-500" : ""}`}
                  />
                </div>
                <div className="space-y-1.5 flex-[2]">
                  <Label htmlFor={`url-${i}`} className="text-xs">URL</Label>
                  <Input
                    id={`url-${i}`}
                    value={e.url}
                    onChange={(ev) => updateEntry(i, "url", ev.target.value)}
                    placeholder="https://example.com/en-us"
                    className={`font-mono text-xs ${!isValidU ? "border-red-500" : ""}`}
                  />
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeEntry(i)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <div className="pt-2 border-t flex items-center gap-2">
            <Switch
              id="hl-xdef"
              checked={includeXDefault}
              onCheckedChange={setIncludeXDefault}
            />
            <Label htmlFor="hl-xdef" className="text-sm cursor-pointer">
              Include x-default tag
            </Label>
          </div>
          {includeXDefault && (
            <div className="space-y-1.5">
              <Label htmlFor="hl-xdef-url" className="text-xs">x-default URL</Label>
              <Input
                id="hl-xdef-url"
                value={xDefaultUrl}
                onChange={(e) => setXDefaultUrl(e.target.value)}
                placeholder="https://example.com"
                className="font-mono text-xs"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Quick pickers</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Add by language</Label>
              <Select
                onValueChange={(v) => {
                  setEntries((prev) => [...prev, { hreflang: v, url: "" }]);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Pick a language" /></SelectTrigger>
                <SelectContent>
                  {LANGUAGE_CODES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.code} — {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Add by language + region</Label>
              <Select
                onValueChange={(v) => {
                  const [lang, region] = v.split("|");
                  setEntries((prev) => [...prev, { hreflang: `${lang}-${region}`, url: "" }]);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Pick a combo" /></SelectTrigger>
                <SelectContent>
                  {LANGUAGE_CODES.slice(0, 10).flatMap((l) =>
                    REGION_CODES.slice(0, 8).map((r) => (
                      <SelectItem key={`${l.code}-${r.code}`} value={`${l.code}|${r.code}`}>
                        {l.code}-{r.code} — {l.name} ({r.name})
                      </SelectItem>
                    )),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="hl-batch">Batch import — one entry per line: hreflang|URL</Label>
          <Textarea
            id="hl-batch"
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder={"en-US|https://example.com/en-us\nfr-FR|https://example.com/fr-fr\nx-default|https://example.com"}
            className="min-h-[100px] font-mono text-xs resize-y"
          />
          <Button size="sm" variant="outline" onClick={importBatch} disabled={!batchText.trim()}>
            Import batch
          </Button>
        </CardContent>
      </Card>

      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.map((w, i) => <div key={i}>• {w}</div>)}
        </div>
      )}

      {output ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Generated hreflang tags</Label>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleCopy(); return output; }} />
              <DownloadButton getText={() => output} filename="hreflang-tags.html" mime="text/html" />
              <ShareButton getUrl={() => buildShareUrl(input)} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
            {output}
          </pre>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline" className="text-xs">{entries.length} entries</Badge>
            {duplicates.length > 0 && (
              <Badge variant="outline" className="text-xs text-amber-600">
                {duplicates.length} duplicate(s)
              </Badge>
            )}
          </div>
        </div>
      ) : (
        <EmptyState
          title="Add hreflang entries to generate tags"
          hint="Use the quick pickers or batch import for speed. Each entry needs a valid language-region code and a URL."
          icon={<Languages className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs font-mono break-all">
                  {h.snippet}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> hreflang tag generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
