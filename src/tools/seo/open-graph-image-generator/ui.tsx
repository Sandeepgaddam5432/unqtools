"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  WIDTH,
  HEIGHT,
  defaultInput,
  validate,
  generate,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type OgImageInput,
  type Template,
  type TextAlign,
  type HistoryEntry,
} from "./logic";
import { History, Image as ImageIcon } from "lucide-react";

export default function OpenGraphImageGenerator() {
  const [input, setInput] = useState<OgImageInput>(defaultInput());
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setInput((prev) => ({ ...prev, ...p }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validate(input), [input]);
  const svg = useMemo(() => {
    if (!validation.ok) return "";
    try {
      return generate(input);
    } catch {
      return "";
    }
  }, [input, validation.ok]);

  const setField = useCallback(<K extends keyof OgImageInput>(key: K, value: OgImageInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (validation.ok && input.title) {
      saveHistory({
        ts: Date.now(),
        title: input.title,
        template: input.template,
        bgColor: input.bgColor,
      });
      setHistory(loadHistory());
    }
  }, [validation.ok, input.title, input.template, input.bgColor]);

  const handleClear = useCallback(() => {
    setInput(defaultInput());
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
            <Label htmlFor="og-title">Title</Label>
            <Input
              id="og-title"
              value={input.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="My Awesome Blog Post"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="og-sub">Subtitle (optional)</Label>
            <Input
              id="og-sub"
              value={input.subtitle ?? ""}
              onChange={(e) => setField("subtitle", e.target.value)}
              placeholder="A deep dive into..."
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="og-bg" className="text-xs">Background</Label>
              <Input
                id="og-bg"
                type="color"
                value={input.bgColor}
                onChange={(e) => setField("bgColor", e.target.value)}
                className="h-9 p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="og-bg2" className="text-xs">Gradient 2nd color</Label>
              <Input
                id="og-bg2"
                type="color"
                value={input.bgColor2 ?? input.bgColor}
                onChange={(e) => setField("bgColor2", e.target.value)}
                className="h-9 p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="og-fg" className="text-xs">Text color</Label>
              <Input
                id="og-fg"
                type="color"
                value={input.textColor}
                onChange={(e) => setField("textColor", e.target.value)}
                className="h-9 p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="og-tmpl" className="text-xs">Template</Label>
              <select
                id="og-tmpl"
                value={input.template}
                onChange={(e) => setField("template", e.target.value as Template)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="solid">Solid</option>
                <option value="gradient">Gradient</option>
                <option value="pattern">Pattern (dots)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="og-fs" className="text-xs">Title font size: {input.fontSize}px</Label>
            <Slider
              id="og-fs"
              min={20}
              max={120}
              step={2}
              value={[input.fontSize]}
              onValueChange={(v) => setField("fontSize", v[0])}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Text alignment</Label>
            <div className="flex gap-2">
              {(["left", "center", "right"] as TextAlign[]).map((a) => (
                <Button
                  key={a}
                  size="sm"
                  variant={input.textAlign === a ? "default" : "outline"}
                  onClick={() => setField("textAlign", a)}
                >
                  {a}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="og-logo" className="text-xs">Logo URL (optional, top-left)</Label>
            <Input
              id="og-logo"
              value={input.logoUrl ?? ""}
              onChange={(e) => setField("logoUrl", e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>

          {!validation.ok && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              {validation.errors.join("; ")}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <ShareButton
              getUrl={() => {
                handleSaveHistory();
                return buildShareUrl(input);
              }}
              disabled={!validation.ok}
            />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {svg ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" /> Preview ({WIDTH}×{HEIGHT})
              </h3>
              <Badge variant="outline">{input.template}</Badge>
            </div>
            <div className="rounded-md overflow-hidden border bg-muted/30">
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
                alt="OG preview"
                className="w-full h-auto"
                style={{ aspectRatio: `${WIDTH}/${HEIGHT}` }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => svg} label="Copy SVG" />
              <DownloadButton
                getText={() => {
                  handleSaveHistory();
                  return svg;
                }}
                filename="og-image.svg"
                mime="image/svg+xml"
                label="Download SVG"
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Add a title to preview your OG image"
          hint="Customize colors, font size, template, and alignment. Download as SVG when ready."
          icon={<ImageIcon className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-2">
                  <div className="w-4 h-4 rounded border" style={{ backgroundColor: h.bgColor }} aria-hidden="true" />
                  <Badge variant="outline">{h.template}</Badge>
                  <span className="font-mono text-foreground truncate">{h.title}</span>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> SVG
            generation runs locally. History is stored in localStorage on this
            device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
