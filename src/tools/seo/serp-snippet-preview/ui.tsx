"use client";
import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { buildSerpPreview, estimatePixelWidth, type SerpInput } from "./logic";
import { Search } from "lucide-react";

export default function SerpSnippetPreview() {
  const [title, setTitle] = useState("Example Page Title — UnQTools");
  const [url, setUrl] = useState("https://unqtools.pages.dev/example");
  const [description, setDescription] = useState("This is an example meta description that will appear in Google search results. Keep it under 160 characters for best results.");
  const [isMobile, setIsMobile] = useState(false);

  const input: SerpInput = { title, url, description };
  const preview = useMemo(() => buildSerpPreview(input, isMobile ? "mobile" : "desktop"), [title, url, description, isMobile]);
  const titlePx = estimatePixelWidth(title);
  const descPx = estimatePixelWidth(description);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <div className="space-y-1.5"><div className="flex items-center justify-between"><Label htmlFor="serp-title" className="text-xs text-muted-foreground">Title ({title.length}/60 chars, {titlePx}px)</Label></div>
          <Input id="serp-title" value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" aria-label="Page title" /></div>
        <div className="space-y-1.5"><Label htmlFor="serp-url" className="text-xs text-muted-foreground">URL</Label>
          <Input id="serp-url" value={url} onChange={(e) => setUrl(e.target.value)} className="text-sm" aria-label="Page URL" /></div>
        <div className="space-y-1.5"><div className="flex items-center justify-between"><Label htmlFor="serp-desc" className="text-xs text-muted-foreground">Description ({description.length}/160 chars, {descPx}px)</Label></div>
          <Textarea id="serp-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px] text-sm" aria-label="Meta description" /></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setIsMobile(false)} className={`px-3 py-1 rounded-md text-xs cursor-pointer ${!isMobile ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Desktop</button>
          <button type="button" onClick={() => setIsMobile(true)} className={`px-3 py-1 rounded-md text-xs cursor-pointer ${isMobile ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Mobile</button>
        </div>
      </CardContent></Card>
      <Card><CardContent className="p-4 space-y-3">
        <Label className="text-sm font-semibold">SERP Preview ({isMobile ? "Mobile" : "Desktop"})</Label>
        <div className="rounded-lg border bg-white p-4" style={{ maxWidth: isMobile ? "411px" : "600px" }}>
          <div className="text-xs text-[#202124] mb-1">{url.replace(/^https?:\/\//, "").split("/")[0]}</div>
          <div className="text-lg text-[#1a0dab] hover:underline cursor-pointer" style={{ fontSize: isMobile ? "16px" : "20px" }}>{preview.truncatedTitle}</div>
          <div className="text-sm text-[#4d5156] mt-1" style={{ fontSize: isMobile ? "14px" : "16px" }}>{preview.truncatedDescription}</div>
        </div>
        {title.length > 60 && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">Title truncated at 60 chars</Badge>}
        {description.length > 160 && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">Description truncated at 160 chars</Badge>}
      </CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all rendering is local.</p></CardContent></Card>
    </div>
  );
}
