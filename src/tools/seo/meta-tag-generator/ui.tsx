"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { generateMetaTags, generateHreflang, type MetaInput } from "./logic";

export default function MetaTagGenerator() {
  const [input, setInput] = useState<MetaInput>({
    title: "UnQTools — 610+ Private, Offline Browser Tools",
    description: "UnQTools is a 100% static, privacy-first, offline-capable PWA of 610+ fast browser-based tools. No uploads, no tracking, no accounts.",
    url: "https://unqtools.pages.dev",
    siteName: "UnQTools",
    image: "https://unqtools.pages.dev/logo.svg",
    imageAlt: "UnQTools logo",
    author: "Sandeep Gaddam",
    keywords: ["online tools", "browser tools", "privacy"],
    ogType: "website",
    twitterCard: "summary",
    twitterSite: "@unqtools",
    canonical: "https://unqtools.pages.dev",
    locale: "en_US",
    themeColor: "#0a0a0a",
    favicon: "/favicon.ico",
    appleTouchIcon: "/apple-touch-icon.png",
    manifest: "/manifest.json",
  });
  const [result, setResult] = useState<ReturnType<typeof generateMetaTags> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((patch: Partial<MetaInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const generate = useCallback(() => {
    const r = generateMetaTags(input);
    if ("error" in r) { setError(r.error); setResult(null); } else { setResult(r); setError(null); }
  }, [input]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Title ({input.title.length} chars)</Label>
              <Input value={input.title} onChange={(e) => update({ title: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Description ({input.description.length} chars)</Label>
              <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]" value={input.description} onChange={(e) => update({ description: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">URL</Label><Input value={input.url ?? ""} onChange={(e) => update({ url: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Site name</Label><Input value={input.siteName ?? ""} onChange={(e) => update({ siteName: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Image URL</Label><Input value={input.image ?? ""} onChange={(e) => update({ image: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Image alt</Label><Input value={input.imageAlt ?? ""} onChange={(e) => update({ imageAlt: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Author</Label><Input value={input.author ?? ""} onChange={(e) => update({ author: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Keywords (comma-separated)</Label>
              <Input
                value={(input.keywords ?? []).join(", ")}
                onChange={(e) => update({ keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Canonical URL</Label><Input value={input.canonical ?? ""} onChange={(e) => update({ canonical: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">OG type</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={input.ogType ?? "website"} onChange={(e) => update({ ogType: e.target.value as MetaInput["ogType"] })}>
                <option value="website">website</option>
                <option value="article">article</option>
                <option value="product">product</option>
                <option value="profile">profile</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Twitter card</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={input.twitterCard ?? "summary"} onChange={(e) => update({ twitterCard: e.target.value as MetaInput["twitterCard"] })}>
                <option value="summary">summary</option>
                <option value="summary_large_image">summary_large_image</option>
                <option value="player">player</option>
                <option value="app">app</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Twitter @site</Label><Input value={input.twitterSite ?? ""} onChange={(e) => update({ twitterSite: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Twitter @creator</Label><Input value={input.twitterCreator ?? ""} onChange={(e) => update({ twitterCreator: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Theme color</Label><Input value={input.themeColor ?? ""} onChange={(e) => update({ themeColor: e.target.value })} placeholder="#ffffff" /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Locale</Label><Input value={input.locale ?? ""} onChange={(e) => update({ locale: e.target.value })} placeholder="en_US" /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Favicon path</Label><Input value={input.favicon ?? ""} onChange={(e) => update({ favicon: e.target.value })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Manifest path</Label><Input value={input.manifest ?? ""} onChange={(e) => update({ manifest: e.target.value })} /></div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={input.robots?.index === false} onChange={(e) => update({ robots: { ...input.robots, index: !e.target.checked } })} />
                <span>noindex</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={input.robots?.follow === false} onChange={(e) => update({ robots: { ...input.robots, follow: !e.target.checked } })} />
                <span>nofollow</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={generate}>Generate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput({ ...input, title: "", description: "" }); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <>
          {result.warnings.length > 0 && (
            <Card><CardContent className="p-4 space-y-1">
              {result.warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
            </CardContent></Card>
          )}

          {/* SERP preview */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Google SERP preview</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="bg-white dark:bg-[#1a1a1a] p-3 rounded-md">
                <p className="text-[#202124] dark:text-[#e8eaed] text-lg leading-tight">{result.serpPreview.title}</p>
                <p className="text-[#006621] dark:text-[#5f965f] text-xs mt-0.5">{result.serpPreview.url}</p>
                <p className="text-[#4d5156] dark:text-[#bdc1c6] text-sm mt-0.5">{result.serpPreview.description}</p>
              </div>
              <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                <Badge variant="outline">Title: {input.title.length} chars / {result.titlePixelWidth}px</Badge>
                <Badge variant="outline">Desc: {input.description.length} chars / {result.descriptionPixelWidth}px</Badge>
              </div>
            </CardContent>
          </Card>

          {[
            { title: "Basic meta tags", content: result.basic },
            { title: "Open Graph", content: result.openGraph },
            { title: "Twitter Card", content: result.twitter },
            { title: "Extras (theme, favicon, hreflang, refresh, rating)", content: result.extras },
            { title: "JSON-LD schema", content: result.jsonLd ?? "" },
          ].filter((s) => s.content).map((section) => (
            <Card key={section.title}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{section.title}</CardTitle>
                  <CopyButton getText={() => section.content} label="Copy" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <pre className="text-xs overflow-x-auto p-4 bg-muted/40 rounded-b-lg"><code>{section.content}</code></pre>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">Complete HTML head block:</p>
              <div className="flex gap-2">
                <CopyButton getText={() => result.fullHtml} label="Copy full block" />
                <DownloadButton getText={() => result.fullHtml} filename="meta-tags.html" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <pre className="text-xs overflow-x-auto"><code>{result.fullHtml}</code></pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all generation runs locally. No data leaves your browser.</p></CardContent></Card>
    </div>
  );
}
