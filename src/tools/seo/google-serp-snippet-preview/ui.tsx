"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  buildSerpPreview,
  segmentsForBold,
  importFromHtml,
  encodePreset,
  decodePreset,
  SERP_LIMITS,
  type SerpInput,
  type SerpPreview,
} from "./logic";

const DEFAULT_INPUT: SerpInput = {
  title: "Best Running Shoes 2026 — Reviews & Buying Guide | RunFit",
  url: "https://example.com/best-running-shoes",
  description: "We tested 47 running shoes for 200+ miles each. See our top picks for road, trail, and racing in 2026 — with fit, weight, and price compared.",
  query: "best running shoes",
  breadcrumb: ["RunFit", "Gear", "Shoes"],
  date: "Jan 5, 2026",
  rating: { value: 4.7, count: 1280 },
  sitelinks: ["Best Road Shoes", "Best Trail Shoes", "Buying Guide", "About RunFit"],
  faq: [
    { q: "How do I choose running shoes?", a: "Match the shoe to your gait, terrain, and weekly mileage." },
    { q: "When should I replace running shoes?", a: "Every 300–500 miles, or when the midsole feels flat." },
  ],
  favicon: true,
  darkMode: false,
};

/** Render a single SERP preview card. */
function SerpCard({ preview, darkMode }: { preview: SerpPreview; darkMode: boolean }) {
  const titleSegments = segmentsForBold(
    preview.title,
    preview.boldRanges.filter((r) => r.field === "title").map(({ start, end }) => ({ start, end }))
  );
  const descSegments = segmentsForBold(
    preview.description,
    preview.boldRanges.filter((r) => r.field === "description").map(({ start, end }) => ({ start, end }))
  );
  const rating = preview === preview ? preview : null;
  void rating;

  return (
    <div
      className="rounded-md p-4"
      style={{
        background: darkMode ? "#1a1a1a" : "#ffffff",
        color: darkMode ? "#e8eaed" : "#202124",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div className="flex items-start gap-2">
        {preview.breadcrumbPath && (
          <div className="flex items-center gap-2 mb-1">
            <div
              className="rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ width: 22, height: 22, background: "#4285f4", color: "#fff" }}
            >
              R
            </div>
            <div className="text-xs" style={{ color: darkMode ? "#bdc1c6" : "#4d5156" }}>
              {preview.breadcrumbPath}
            </div>
          </div>
        )}
      </div>
      <p className="text-xl leading-tight" style={{ color: darkMode ? "#8ab4f8" : "#1a0dab", textDecoration: "none" }}>
        {titleSegments.map((s, i) => (
          <span key={i} style={{ fontWeight: s.bold ? 700 : 400 }}>
            {s.text}
          </span>
        ))}
      </p>
      <p className="text-xs mt-0.5" style={{ color: darkMode ? "#bdc1c6" : "#4d5156" }}>
        {preview.url}
      </p>
      <p className="text-sm mt-1 leading-snug">
        {descSegments.map((s, i) => (
          <span key={i} style={{ fontWeight: s.bold ? 700 : 400 }}>
            {s.text}
          </span>
        ))}
      </p>
    </div>
  );
}

export default function GoogleSerpSnippetPreview() {
  const [input, setInput] = useState<SerpInput>(DEFAULT_INPUT);
  const [presetStr, setPresetStr] = useState("");
  const [importHtml, setImportHtml] = useState("");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const r = buildSerpPreview(input);
    if ("error" in r) { setError(r.error); return null; }
    setError(null);
    return r;
  }, [input]);

  const update = useCallback((patch: Partial<SerpInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const doImport = useCallback(() => {
    const r = importFromHtml(importHtml);
    setInput((prev) => ({ ...prev, title: r.title || prev.title, description: r.description || prev.description, url: r.url ?? prev.url }));
  }, [importHtml]);

  const applyPreset = useCallback(() => {
    const decoded = decodePreset(presetStr);
    if ("error" in decoded) { setError(decoded.error); return; }
    setInput(decoded);
    setError(null);
  }, [presetStr]);

  const sharePreset = useCallback(() => {
    setPresetStr(encodePreset(input));
  }, [input]);

  const titlePx = result?.titlePixelWidth ?? 0;
  const descPx = result?.descriptionPixelWidth ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Title ({input.title.length} chars, ~{titlePx}px)</Label>
              <Input value={input.title} onChange={(e) => update({ title: e.target.value })} />
              <div className="h-1.5 rounded bg-muted overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(100, (titlePx / SERP_LIMITS.titleDesktopPx) * 100)}%`,
                    background: titlePx > SERP_LIMITS.titleDesktopPx ? "#ef4444" : "#22c55e",
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Description ({input.description.length} chars, ~{descPx}px)</Label>
              <Textarea value={input.description} onChange={(e) => update({ description: e.target.value })} rows={3} />
              <div className="h-1.5 rounded bg-muted overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(100, (descPx / SERP_LIMITS.descriptionDesktopPx) * 100)}%`,
                    background: descPx > SERP_LIMITS.descriptionDesktopPx ? "#ef4444" : "#22c55e",
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">URL</Label><Input value={input.url} onChange={(e) => update({ url: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Query (for bolding)</Label><Input value={input.query ?? ""} onChange={(e) => update({ query: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Breadcrumb (comma-separated)</Label>
              <Input value={(input.breadcrumb ?? []).join(", ")} onChange={(e) => update({ breadcrumb: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Date (display string)</Label><Input value={input.date ?? ""} onChange={(e) => update({ date: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Rating value (0–5)</Label><Input type="number" step="0.1" min="0" max="5" value={input.rating?.value ?? ""} onChange={(e) => update({ rating: { value: Number(e.target.value), count: input.rating?.count ?? 0 } })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Rating count</Label><Input type="number" min="0" value={input.rating?.count ?? ""} onChange={(e) => update({ rating: { value: input.rating?.value ?? 0, count: Number(e.target.value) } })} /></div>
            <div className="flex flex-col gap-1.5 sm:col-span-2"><Label className="text-xs text-muted-foreground">Sitelinks (comma-separated)</Label>
              <Input value={(input.sitelinks ?? []).join(", ")} onChange={(e) => update({ sitelinks: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </div>
            <div className="flex items-center gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!input.favicon} onChange={(e) => update({ favicon: e.target.checked })} /><span>Show favicon</span></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!input.darkMode} onChange={(e) => update({ darkMode: e.target.checked })} /><span>Dark mode SERP</span></label>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          {result.warnings.length > 0 && (
            <Card><CardContent className="p-4 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">{"⚠️ "}{w}</p>
              ))}
            </CardContent></Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Desktop SERP preview</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0"><SerpCard preview={result.desktop} darkMode={!!input.darkMode} /></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Mobile SERP preview</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0"><SerpCard preview={result.mobile} darkMode={!!input.darkMode} /></CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 flex flex-wrap gap-2">
              <Badge variant="outline">Title {titlePx}px / {SERP_LIMITS.titleDesktopPx}px desktop</Badge>
              <Badge variant="outline">Title {SERP_LIMITS.titleMobilePx}px mobile</Badge>
              <Badge variant="outline">Desc {descPx}px / {SERP_LIMITS.descriptionDesktopPx}px desktop</Badge>
              <Badge variant="outline">Desc {SERP_LIMITS.descriptionMobilePx}px mobile</Badge>
              {result.richElements.hasBreadcrumb && <Badge variant="secondary">Breadcrumb</Badge>}
              {result.richElements.hasDate && <Badge variant="secondary">Date</Badge>}
              {result.richElements.hasRating && <Badge variant="secondary">Rating</Badge>}
              {result.richElements.hasSitelinks && <Badge variant="secondary">Sitelinks</Badge>}
              {result.richElements.hasFaq && <Badge variant="secondary">FAQ</Badge>}
              {result.richElements.hasFavicon && <Badge variant="secondary">Favicon</Badge>}
            </CardContent>
          </Card>

          {input.faq && input.faq.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">FAQ rich result preview</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {input.faq.map((f, i) => (
                  <div key={i} className="text-sm">
                    <p style={{ color: input.darkMode ? "#8ab4f8" : "#1a0dab" }}>{f.q}</p>
                    <p style={{ color: input.darkMode ? "#bdc1c6" : "#4d5156" }}>{f.a}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Import from HTML</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <Textarea value={importHtml} onChange={(e) => setImportHtml(e.target.value)} rows={3} placeholder="<head><title>...</title><meta name='description' content='...'></head>" />
              <Button size="sm" onClick={doImport}>Import title + description</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Shareable preset</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <div className="flex gap-2">
                <Button size="sm" onClick={sharePreset}>Generate preset</Button>
                <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(presetStr)}>Copy</Button>
              </div>
              <Input value={presetStr} onChange={(e) => setPresetStr(e.target.value)} placeholder="Paste a preset string here" />
              <Button size="sm" variant="outline" onClick={applyPreset}>Apply preset</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex flex-wrap gap-2 justify-end">
              <CopyButton getText={() => input.title} label="Copy title" />
              <CopyButton getText={() => input.description} label="Copy description" />
              <DownloadButton getText={() => JSON.stringify(input, null, 2)} filename="serp-preset.json" />
            </CardContent>
          </Card>

          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground"><strong className="text-foreground">Honest note:</strong> Google often rewrites titles and descriptions. Pixel cutoffs are versioned (Jun 2026). All processing is local.</p>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
