"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  formatCitation, planBibliography, renderBibliographyText,
  renderReport, renderBatchCsv, getBibliographyPresets,
  type Source, type CitationStyle, type SourceType,
} from "./logic";

const STYLES: CitationStyle[] = ["apa", "mla", "chicago", "harvard"];
const TYPES: SourceType[] = ["book", "journal", "website", "newspaper", "magazine"];

const EMPTY: Source = {
  type: "book", authors: [{ first: "", last: "" }], year: "", title: "",
};

export default function BibliographyGenerator() {
  const [style, setStyle] = useState<CitationStyle>("apa");
  const [sources, setSources] = useState<Source[]>([{ ...EMPTY, authors: [{ first: "John", last: "Smith" }], year: "2023", title: "Test Book", publisher: "Pub" }]);
  const [error, setError] = useState("");

  const result = useMemo(() => {
    try {
      return planBibliography({ style, sources });
    } catch (e) {
      queueMicrotask(() => setError(e instanceof Error ? e.message : "Failed"));
      return null;
    }
  }, [style, sources]);

  const bibText = useMemo(() => (result ? renderBibliographyText(result) : ""), [result]);
  const report = useMemo(() => (result ? renderReport(result) : ""), [result]);

  const updateSource = (i: number, patch: Partial<Source>) => {
    setSources((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const updateAuthor = (i: number, ai: number, patch: Partial<{ first: string; last: string }>) => {
    setSources((prev) => prev.map((s, idx) => {
      if (idx !== i) return s;
      const authors = s.authors.map((a, j) => (j === ai ? { ...a, ...patch } : a));
      return { ...s, authors };
    }));
  };
  const addSource = () => setSources((p) => [...p, { ...EMPTY, authors: [{ first: "", last: "" }] }]);
  const removeSource = (i: number) => setSources((p) => p.filter((_, idx) => idx !== i));
  const loadPreset = (preset: { source: Source }) => setSources([preset.source]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs text-muted-foreground">Citation style:</Label>
            {STYLES.map((s) => (
              <button key={s} type="button"
                onClick={() => setStyle(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${style === s ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>
                {s.toUpperCase()}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              <CopyButton getText={() => bibText} label="Copy bibliography" />
              <DownloadButton getText={() => bibText} filename={`bibliography-${style}.txt`} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
            <span className="text-xs text-muted-foreground">Presets:</span>
            {getBibliographyPresets().map((p) => (
              <button key={p.id} type="button"
                onClick={() => loadPreset(p)}
                className="px-2 py-0.5 rounded-md text-[11px] border bg-background hover:bg-muted cursor-pointer">
                {p.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Sources ({sources.length})</Label>
          {sources.map((src, i) => (
            <div key={i} className="rounded border p-3 space-y-2 bg-background">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                <select value={src.type}
                  onChange={(e) => updateSource(i, { type: e.target.value as SourceType })}
                  className="h-7 text-xs rounded border bg-background px-2 cursor-pointer">
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button type="button" onClick={() => removeSource(i)}
                  className="ml-auto text-[11px] text-destructive hover:underline cursor-pointer">
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input placeholder="Year" value={src.year}
                  onChange={(e) => updateSource(i, { year: e.target.value })} className="text-xs h-8" />
                <Input placeholder="Title" value={src.title}
                  onChange={(e) => updateSource(i, { title: e.target.value })} className="text-xs h-8 sm:col-span-2" />
              </div>
              <div className="space-y-1.5">
                {src.authors.map((a, ai) => (
                  <div key={ai} className="grid grid-cols-2 gap-2">
                    <Input placeholder="First name" value={a.first}
                      onChange={(e) => updateAuthor(i, ai, { first: e.target.value })} className="text-xs h-8" />
                    <Input placeholder="Last name" value={a.last}
                      onChange={(e) => updateAuthor(i, ai, { last: e.target.value })} className="text-xs h-8" />
                  </div>
                ))}
              </div>
              {(src.type === "book" || src.type === "newspaper" || src.type === "magazine") && (
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Publisher" value={src.publisher || ""}
                    onChange={(e) => updateSource(i, { publisher: e.target.value })} className="text-xs h-8" />
                  <Input placeholder="Edition" value={src.edition || ""}
                    onChange={(e) => updateSource(i, { edition: e.target.value })} className="text-xs h-8" />
                </div>
              )}
              {(src.type === "journal" || src.type === "newspaper" || src.type === "magazine") && (
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Journal" value={src.journal || ""}
                    onChange={(e) => updateSource(i, { journal: e.target.value })} className="text-xs h-8" />
                  <Input placeholder="Volume" value={src.volume || ""}
                    onChange={(e) => updateSource(i, { volume: e.target.value })} className="text-xs h-8" />
                  <Input placeholder="Pages" value={src.pages || ""}
                    onChange={(e) => updateSource(i, { pages: e.target.value })} className="text-xs h-8" />
                </div>
              )}
              {src.type === "website" && (
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="URL" value={src.url || ""}
                    onChange={(e) => updateSource(i, { url: e.target.value })} className="text-xs h-8" />
                  <Input placeholder="Site name" value={src.siteName || ""}
                    onChange={(e) => updateSource(i, { siteName: e.target.value })} className="text-xs h-8" />
                </div>
              )}
            </div>
          ))}
          <button type="button" onClick={addSource}
            className="w-full text-xs py-2 rounded-md border border-dashed hover:bg-muted cursor-pointer">
            + Add source
          </button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[11px]">{style.toUpperCase()}</Badge>
              <Badge variant="outline" className="text-[11px]">{result.entries.length} entries</Badge>
              {result.warnings.length > 0 && (
                <Badge variant="outline" className="text-[11px] text-yellow-700 dark:text-yellow-300">{result.warnings.length} warnings</Badge>
              )}
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => report} label="Copy report" />
                <DownloadButton getText={() => renderBatchCsv([result])} filename="bibliography.csv" mime="text/csv" />
              </div>
            </div>
            <div className="space-y-3">
              {result.entries.map((e, i) => (
                <div key={i} className="rounded border p-2.5 bg-muted/30">
                  <div className="text-[10px] text-muted-foreground mb-1">#{i + 1} — In-text: <code className="font-mono">{e.inText}</code></div>
                  <p className="text-xs leading-relaxed">{e.reference}</p>
                  {e.warnings.length > 0 && (
                    <p className="text-[10px] text-yellow-700 dark:text-yellow-300 mt-1">{e.warnings.join(" ")}</p>
                  )}
                </div>
              ))}
            </div>
            {result.notes.length > 0 && (
              <div className="text-[11px] text-muted-foreground border-t pt-2">
                {result.notes.map((n, i) => <div key={i}>• {n}</div>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> citation data is processed
            locally. Nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
