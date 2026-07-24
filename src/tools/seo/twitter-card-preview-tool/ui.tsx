"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner } from "../../_shared";
import { validateCard, generateTwitterTags, parseTwitterTagsFromHtml, CARD_DIMENSIONS, saveHistory, loadHistory, clearHistory, type TwitterCardInput, type CardType } from "./logic";

export default function TwitterCardPreviewTool() {
  const [input, setInput] = useState<TwitterCardInput>({
    cardType: "summary_large_image",
    site: "@unqtools",
    creator: "@sandeep",
    title: "Your Compelling Title Here",
    description: "A description that supports the title and shows what your page is about.",
    imageUrl: "https://unqtools.pages.dev/logo.svg",
    imageAlt: "UnQTools logo",
    url: "https://unqtools.pages.dev",
  });
  const [rawHtml, setRawHtml] = useState("");
  const [showMeta, setShowMeta] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [history, setHistory] = useState<(TwitterCardInput & { ts: number })[]>([]);

  const validation = validateCard(input);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const update = useCallback((patch: Partial<TwitterCardInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const parseHtml = useCallback(() => {
    try {
      const parsed = parseTwitterTagsFromHtml(rawHtml);
      setInput((prev) => ({ ...prev, ...parsed }));
    } catch (e) { /* ignore */ }
  }, [rawHtml]);

  const savePreview = useCallback(() => {
    saveHistory(input);
    setHistory(loadHistory());
  }, [input]);

  const metaTags = generateTwitterTags(input);
  const dims = CARD_DIMENSIONS[input.cardType];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Card type</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={input.cardType} onChange={(e) => update({ cardType: e.target.value as CardType })}>
                <option value="summary">summary (small square image)</option>
                <option value="summary_large_image">summary_large_image (large 2:1 image)</option>
                <option value="player">player (video/audio embed)</option>
                <option value="app">app (mobile deep-link)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Site @handle</Label><Input value={input.site ?? ""} onChange={(e) => update({ site: e.target.value })} placeholder="@mysite" /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Creator @handle</Label><Input value={input.creator ?? ""} onChange={(e) => update({ creator: e.target.value })} placeholder="@me" /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">URL</Label><Input value={input.url ?? ""} onChange={(e) => update({ url: e.target.value })} placeholder="https://example.com" /></div>
            <div className="flex flex-col gap-1.5 sm:col-span-2"><Label className="text-xs text-muted-foreground">Title ({input.title.length}/70 chars, {validation.titlePixelWidth}px)</Label><Input value={input.title} onChange={(e) => update({ title: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5 sm:col-span-2"><Label className="text-xs text-muted-foreground">Description ({input.description.length}/200 chars, {validation.descriptionPixelWidth}px)</Label><Input value={input.description} onChange={(e) => update({ description: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Image URL</Label><Input value={input.imageUrl ?? ""} onChange={(e) => update({ imageUrl: e.target.value })} placeholder="https://..." /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Image alt</Label><Input value={input.imageAlt ?? ""} onChange={(e) => update({ imageAlt: e.target.value })} /></div>
          </div>

          {input.cardType === "player" && (
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs text-muted-foreground">Player URL</Label><Input value={input.playerUrl ?? ""} onChange={(e) => update({ playerUrl: e.target.value })} /></div>
              <div><Label className="text-xs text-muted-foreground">Width</Label><Input type="number" value={input.playerWidth ?? ""} onChange={(e) => update({ playerWidth: Number(e.target.value) })} /></div>
              <div><Label className="text-xs text-muted-foreground">Height</Label><Input type="number" value={input.playerHeight ?? ""} onChange={(e) => update({ playerHeight: Number(e.target.value) })} /></div>
            </div>
          )}

          {input.cardType === "app" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><Label className="text-xs text-muted-foreground">iPhone ID</Label><Input value={input.appIphoneId ?? ""} onChange={(e) => update({ appIphoneId: e.target.value })} /></div>
              <div><Label className="text-xs text-muted-foreground">iPad ID</Label><Input value={input.appIpadId ?? ""} onChange={(e) => update({ appIpadId: e.target.value })} /></div>
              <div><Label className="text-xs text-muted-foreground">Google Play ID</Label><Input value={input.appGoogleplayId ?? ""} onChange={(e) => update({ appGoogleplayId: e.target.value })} /></div>
              <div><Label className="text-xs text-muted-foreground">App country</Label><Input value={input.appCountry ?? ""} onChange={(e) => update({ appCountry: e.target.value })} /></div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setShowMeta(!showMeta)}>Toggle meta tags</Button>
            <Button size="sm" variant="outline" onClick={savePreview}>Save to history</Button>
            <Button size="sm" variant="ghost" onClick={() => setDarkMode(!darkMode)}>Toggle {darkMode ? "light" : "dark"} preview</Button>
            <Button size="sm" variant="ghost" onClick={() => { clearHistory(); setHistory([]); }}>Clear history</Button>
          </div>
        </CardContent>
      </Card>

      {validation.errors.length > 0 && (
        <Card><CardContent className="p-3 space-y-1">
          {validation.errors.map((e, i) => <p key={i} className="text-xs text-red-700 dark:text-red-400">❌ {e}</p>)}
        </CardContent></Card>
      )}
      {validation.warnings.length > 0 && (
        <Card><CardContent className="p-3 space-y-1">
          {validation.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
        </CardContent></Card>
      )}

      {/* Twitter preview mock */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Twitter preview mock</CardTitle></CardHeader>
        <CardContent className="p-4">
          <div className={`p-4 rounded-lg ${darkMode ? "bg-[#15202b]" : "bg-white border"}`}>
            <div className="flex gap-3">
              <div className={`w-12 h-12 rounded-full ${darkMode ? "bg-gray-700" : "bg-gray-200"}`} />
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <span className={`text-sm font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>Your Name</span>
                  <span className={darkMode ? "text-gray-500" : "text-gray-500"}>@{input.creator?.replace("@", "") ?? "handle"} · 2h</span>
                </div>
                <p className={`text-sm ${darkMode ? "text-gray-300" : "text-gray-700"} mb-2`}>Check out this page!</p>
                <div className={`rounded-xl overflow-hidden border ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
                  {input.cardType === "summary_large_image" && input.imageUrl && (
                    <div className="aspect-[1.91/1] bg-gray-300 flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={input.imageUrl} alt={input.imageAlt ?? ""} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className={`p-3 ${darkMode ? "bg-[#192734]" : "bg-gray-50"}`}>
                    {input.cardType === "summary" && input.imageUrl && (
                      <div className="flex gap-3">
                        <div className="w-32 h-32 rounded bg-gray-300 overflow-hidden flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={input.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-500"} mb-1`}>{input.url?.replace(/^https?:\/\//, "").split("/")[0]}</p>
                          <p className={`text-sm font-bold ${darkMode ? "text-white" : "text-gray-900"} truncate`}>{input.title}</p>
                          <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"} line-clamp-2`}>{input.description}</p>
                        </div>
                      </div>
                    )}
                    {input.cardType !== "summary" && (
                      <>
                        <p className={`text-xs ${darkMode ? "text-gray-500" : "text-gray-500"} mb-1`}>{input.url?.replace(/^https?:\/\//, "").split("/")[0]}</p>
                        <p className={`text-sm font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>{input.title}</p>
                        <p className={`text-xs ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{input.description}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Recommended image: {dims.recommendedWidth}×{dims.recommendedHeight} ({dims.ratio}). Min: {dims.minWidth}×{dims.minHeight}.</p>
        </CardContent>
      </Card>

      {/* Parse HTML */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Parse from raw HTML</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono" value={rawHtml} onChange={(e) => setRawHtml(e.target.value)} placeholder="<meta name='twitter:card' content='...' />" />
          <Button size="sm" onClick={parseHtml} disabled={!rawHtml}>Parse HTML → fill form</Button>
        </CardContent>
      </Card>

      {showMeta && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Generated Twitter meta tags</CardTitle>
              <CopyButton getText={() => metaTags} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-xs overflow-x-auto p-4 bg-muted/40 rounded-b-lg"><code>{metaTags}</code></pre>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">History (last 10)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="text-xs divide-y divide-border/50">
              {history.map((h, i) => (
                <li key={i} className="p-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  <span className="flex-1 truncate">{h.title}</span>
                  <Badge variant="outline">{h.cardType}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all parsing + rendering runs locally. No URL is fetched. History stored only in your browser.</p></CardContent></Card>
    </div>
  );
}
