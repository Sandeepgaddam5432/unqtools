"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  validateInput,
  parseBulkItems,
  generateBreadcrumbSchema,
  renderPreview,
  buildGoogleRichResultsLink,
  buildSchemaDocsLink,
  moveUp,
  moveDown,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type BreadcrumbItem,
  type BreadcrumbInput,
  type HistoryEntry,
} from "./logic";
import {
  History,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Navigation,
  ExternalLink,
  Upload,
  BookOpen,
} from "lucide-react";

export default function BreadcrumbSchemaGenerator() {
  const [items, setItems] = useState<BreadcrumbItem[]>([
    { name: "Home", url: "https://example.com" },
    { name: "Blog", url: "https://example.com/blog" },
  ]);
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
        setItems(parsed.items);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validateInput({ items }), [items]);
  const output = useMemo(() => {
    try {
      if (items.length === 0) return "";
      return generateBreadcrumbSchema({ items });
    } catch {
      return "";
    }
  }, [items]);
  const preview = useMemo(() => renderPreview({ items }), [items]);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { name: "", url: "" }]);
  }, []);
  const removeItem = useCallback((i: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }, []);
  const updateItem = useCallback(
    (i: number, key: keyof BreadcrumbItem, val: string) => {
      setItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)),
      );
    },
    [],
  );
  const handleUp = useCallback(
    (i: number) => setItems((prev) => moveUp(prev, i)),
    [],
  );
  const handleDown = useCallback(
    (i: number) => setItems((prev) => moveDown(prev, i)),
    [],
  );

  const importBulk = useCallback(() => {
    const parsed = parseBulkItems(bulkText);
    if (parsed.length === 0) {
      toast.error("No valid breadcrumb items found");
      return;
    }
    setItems(parsed);
    setShowBulk(false);
    setBulkText("");
    toast.success(`Imported ${parsed.length} items`);
  }, [bulkText]);

  const handleCopy = useCallback(() => {
    if (output) {
      saveHistory({
        ts: Date.now(),
        itemCount: items.length,
        snippet: output.slice(0, 200),
        preview,
      });
      setHistory(loadHistory());
    }
  }, [output, items.length, preview]);

  const handleClear = useCallback(() => {
    setItems([
      { name: "Home", url: "https://example.com" },
      { name: "Blog", url: "https://example.com/blog" },
    ]);
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
            <h3 className="text-sm font-semibold text-foreground">
              Breadcrumb items ({items.length})
            </h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowBulk((s) => !s)}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" /> Bulk paste
              </Button>
              <Button size="sm" variant="outline" onClick={addItem} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>
          </div>
          {showBulk && (
            <div className="space-y-1.5">
              <Label htmlFor="bc-bulk">
                Bulk paste (Name | URL — one per line)
              </Label>
              <Textarea
                id="bc-bulk"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={
                  "Home | https://example.com\nBlog | https://example.com/blog\nPost | https://example.com/blog/post"
                }
                className="min-h-[120px] font-mono text-xs resize-y"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={importBulk}
                disabled={!bulkText.trim()}
              >
                Import {bulkText ? `(${parseBulkItems(bulkText).length} items)` : ""}
              </Button>
            </div>
          )}
          {items.map((it, i) => (
            <div key={i} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`n-${i}`} className="text-xs">
                  Item #{i + 1}
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleUp(i)}
                    disabled={i === 0}
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDown(i)}
                    disabled={i === items.length - 1}
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeItem(i)}
                    aria-label="Remove item"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Input
                id={`n-${i}`}
                value={it.name}
                onChange={(e) => updateItem(i, "name", e.target.value)}
                placeholder="Item name (e.g. Blog)"
              />
              <Input
                id={`u-${i}`}
                value={it.url}
                onChange={(e) => updateItem(i, "url", e.target.value)}
                placeholder="https://example.com/blog"
                className="font-mono text-xs"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.slice(0, 5).map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
          {validation.warnings.length > 5 && (
            <div>• ...and {validation.warnings.length - 5} more</div>
          )}
        </div>
      )}

      {preview && (
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1">Preview</div>
            <div className="text-sm font-medium text-foreground break-words">
              {preview}
            </div>
          </CardContent>
        </Card>
      )}

      {output ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Generated BreadcrumbList JSON-LD</Label>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleCopy(); return output; }} />
              <DownloadButton
                getText={() => output}
                filename="breadcrumb-schema.jsonld"
                mime="application/ld+json"
              />
              <ShareButton getUrl={() => buildShareUrl({ items } as BreadcrumbInput)} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all max-h-[400px]">
            {output}
          </pre>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a
                href={buildGoogleRichResultsLink("")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Google Rich Results test
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <a
                href={buildSchemaDocsLink()}
                target="_blank"
                rel="noopener noreferrer"
              >
                <BookOpen className="h-3.5 w-3.5" /> Schema.org docs
              </a>
            </Button>
          </div>
        </div>
      ) : (
        <EmptyState
          title="Add at least two breadcrumb items"
          hint="Each item needs a name and a valid http/https URL. Use bulk paste for speed."
          icon={<Navigation className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">
                    {h.itemCount} items
                  </Badge>
                  <span className="text-muted-foreground">{h.preview}</span>
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
            <strong className="text-foreground">Privacy:</strong> Breadcrumb
            schema generation runs locally. History is stored in localStorage on
            this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
