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
  TITLE_LIMITS,
  DESCRIPTION_LIMITS,
  analyze,
  parseBatch,
  analyzeBatch,
  sortResults,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Field,
  type Device,
  type SortField,
  type SortDir,
  type HistoryEntry,
} from "./logic";
import { History, Ruler, ArrowDownUp, TrendingUp, TrendingDown } from "lucide-react";

export default function TitleMetaPixelChecker() {
  const [text, setText] = useState("");
  const [field, setField] = useState<Field>("title");
  const [device, setDevice] = useState<Device>("desktop");
  const [sortField, setSortField] = useState<SortField>("pixelWidth");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.field) setField(p.field);
      if (p.device) setDevice(p.device);
      if (p.text) {
        setText(p.text);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const lines = useMemo(() => parseBatch(text), [text]);
  const batch = useMemo(() => analyzeBatch(lines, field, device), [lines, field, device]);
  const sorted = useMemo(
    () => sortResults(batch.results, sortField, sortDir),
    [batch.results, sortField, sortDir],
  );
  const csv = useMemo(() => renderCsv(batch), [batch]);

  const singlePreview = useMemo(() => {
    const firstLine = lines[0] ?? "";
    return analyze(firstLine, field, device);
  }, [lines, field, device]);

  const handleSaveHistory = useCallback(() => {
    if (batch.total > 0) {
      saveHistory({
        ts: Date.now(),
        field,
        device,
        count: batch.total,
        overLimit: batch.overLimitCount,
      });
      setHistory(loadHistory());
    }
  }, [batch.total, batch.overLimitCount, field, device]);

  const handleClear = useCallback(() => {
    setText("");
    toast.info("Form cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const limitPx = field === "title" ? TITLE_LIMITS[device].px : DESCRIPTION_LIMITS[device].px;
  const limitChars = field === "title" ? TITLE_LIMITS[device].chars : DESCRIPTION_LIMITS[device].chars;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1">
              {(["title", "description"] as Field[]).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={field === f ? "default" : "outline"}
                  onClick={() => setField(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
            <div className="flex gap-1">
              {(["desktop", "mobile"] as Device[]).map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={device === d ? "default" : "outline"}
                  onClick={() => setDevice(d)}
                >
                  {d}
                </Button>
              ))}
            </div>
            <Badge variant="outline" className="ml-auto">limit: {limitPx}px / {limitChars} chars</Badge>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tmp-text">
              {field === "title" ? "Titles" : "Descriptions"} (one per line for batch)
            </Label>
            <Textarea
              id="tmp-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={field === "title" ? "Best SEO Tools for 2026\nHow to Do Keyword Research" : "Discover the top 10 SEO tools...\nLearn how to do keyword research..."}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {batch.total > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Ruler className="h-4 w-4" /> Summary
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{batch.total} entries</Badge>
                <Badge variant="outline">avg width: {batch.averagePixelWidth}px</Badge>
                {batch.overLimitCount > 0 && (
                  <Badge variant="destructive">{batch.overLimitCount} over limit</Badge>
                )}
                {batch.overLimitCount === 0 && (
                  <Badge variant="secondary">all under limit</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">SERP preview (first entry)</h3>
              </div>
              <div className="rounded-md border bg-white p-3 text-black">
                <div className="text-[18px] leading-tight" style={{ maxWidth: "600px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {singlePreview.truncatedText || "(empty)"}
                </div>
                <div className="text-[13px] text-green-700 mt-0.5">example.com › path</div>
                <div className="text-[13px] text-gray-700 mt-0.5" style={{ maxWidth: "600px" }}>
                  {field === "description" ? singlePreview.truncatedText : "Meta description preview appears here when field is description."}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Per-entry breakdown</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <ArrowDownUp className="h-3 w-3" /> Sort:
                  </span>
                  {(["pixelWidth", "charCount", "wordCount", "text"] as SortField[]).map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={sortField === f ? "default" : "outline"}
                      onClick={() => setSortField(f)}
                      className="h-7 text-xs"
                    >
                      {f}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className="h-7 text-xs gap-1"
                  >
                    {sortDir === "asc" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {sortDir}
                  </Button>
                </div>
              </div>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {sorted.map((r, i) => {
                  const pct = Math.min(100, (r.pixelWidth / r.limitPx) * 100);
                  return (
                    <div key={i} className="rounded border bg-background p-2 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 font-mono text-foreground truncate" title={r.text}>{r.text || "(empty)"}</div>
                        <Badge variant={r.isOverLimit ? "destructive" : r.isWarn ? "secondary" : "outline"}>
                          {r.pixelWidth}px / {r.limitPx}px
                        </Badge>
                      </div>
                      <div className="h-1.5 bg-muted rounded overflow-hidden">
                        <div
                          className={`h-full ${r.isOverLimit ? "bg-red-500" : r.isWarn ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${pct}%` }}
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex justify-between text-muted-foreground text-[10px]">
                        <span>{r.charCount} chars · {r.wordCount} words</span>
                        <span>{r.isOverLimit ? "OVER LIMIT — will truncate" : r.isWarn ? "near limit" : "OK"}</span>
                      </div>
                      {r.isOverLimit && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-400">
                          Truncated: <code className="text-foreground">{r.truncatedText}</code>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => {
                    handleSaveHistory();
                    return csv;
                  }}
                  label="Copy CSV"
                />
                <DownloadButton
                  getText={() => {
                    handleSaveHistory();
                    return csv;
                  }}
                  filename="title-pixel-check.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl({ field, device, text });
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste titles or descriptions to check pixel width"
          hint="Switch between title and description limits, and desktop vs mobile SERP widths."
          icon={<Ruler className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.field}</Badge>
                  <Badge variant="outline" className="mr-2">{h.device}</Badge>
                  <Badge variant="outline" className="mr-2">{h.count} entries</Badge>
                  {h.overLimit > 0 && <Badge variant="destructive" className="mr-2">{h.overLimit} over</Badge>}
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
            <strong className="text-foreground">Privacy:</strong> Pixel
            estimation runs locally. History is stored in localStorage on this
            device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
