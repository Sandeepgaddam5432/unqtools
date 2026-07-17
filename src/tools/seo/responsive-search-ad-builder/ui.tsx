"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  HEADLINE_MAX,
  DESCRIPTION_MAX,
  MAX_HEADLINES,
  MAX_DESCRIPTIONS,
  MIN_HEADLINES,
  MIN_DESCRIPTIONS,
  charCount,
  validateInput,
  estimateStrength,
  buildDesktopPreview,
  buildMobilePreview,
  renderAdText,
  renderCsv,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  GOOGLE_RSA_DOCS_URL,
  type RsaInput,
  type Headline,
  type Description,
  type HistoryEntry,
} from "./logic";
import { History, Megaphone, Monitor, Smartphone, ExternalLink, Plus, X } from "lucide-react";

type HeadlinePin = Headline["pin"];
type DescriptionPin = Description["pin"];

const HEADLINE_PINS: HeadlinePin[] = ["none", "pinned-h1", "pinned-h2", "pinned-h3"];
const DESCRIPTION_PINS: DescriptionPin[] = ["none", "pinned-d1", "pinned-d2"];

const PIN_LABELS: Record<string, string> = {
  "none": "Auto",
  "pinned-h1": "H1",
  "pinned-h2": "H2",
  "pinned-h3": "H3",
  "pinned-d1": "D1",
  "pinned-d2": "D2",
};

const STRENGTH_COLORS: Record<string, string> = {
  poor: "text-red-600 dark:text-red-400",
  average: "text-amber-600 dark:text-amber-400",
  good: "text-emerald-600 dark:text-emerald-400",
  excellent: "text-emerald-600 dark:text-emerald-400",
};

export default function ResponsiveSearchAdBuilder() {
  const [input, setInput] = useState<RsaInput>({
    headlines: [
      { id: 1, text: "", pin: "none" },
      { id: 2, text: "", pin: "none" },
      { id: 3, text: "", pin: "none" },
    ],
    descriptions: [
      { id: 1, text: "", pin: "none" },
      { id: 2, text: "", pin: "none" },
    ],
    finalUrl: "",
    displayURL: "",
    path1: "",
    path2: "",
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.finalUrl !== undefined || (parsed.headlines && parsed.headlines.length > 0)) {
        setInput((prev) => ({
          ...prev,
          ...parsed,
          headlines: parsed.headlines && parsed.headlines.length > 0 ? parsed.headlines : prev.headlines,
          descriptions: parsed.descriptions && parsed.descriptions.length > 0 ? parsed.descriptions : prev.descriptions,
        }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validateInput(input), [input]);
  const strength = useMemo(() => estimateStrength(input), [input]);
  const desktopPreview = useMemo(() => buildDesktopPreview(input), [input]);
  const mobilePreview = useMemo(() => buildMobilePreview(input), [input]);
  const adText = useMemo(() => renderAdText(input), [input]);
  const csv = useMemo(() => renderCsv(input), [input]);

  const nonEmptyHeadlines = input.headlines.filter((h) => h.text.trim()).length;
  const nonEmptyDescriptions = input.descriptions.filter((d) => d.text.trim()).length;

  const updateField = useCallback(<K extends keyof RsaInput>(key: K, val: RsaInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: val }));
  }, []);

  const updateHeadline = useCallback((id: number, key: "text" | "pin", val: string) => {
    setInput((prev) => ({
      ...prev,
      headlines: prev.headlines.map((h) =>
        h.id === id ? { ...h, [key]: val } : h,
      ),
    }));
  }, []);

  const updateDescription = useCallback((id: number, key: "text" | "pin", val: string) => {
    setInput((prev) => ({
      ...prev,
      descriptions: prev.descriptions.map((d) =>
        d.id === id ? { ...d, [key]: val } : d,
      ),
    }));
  }, []);

  const addHeadline = useCallback(() => {
    setInput((prev) => {
      if (prev.headlines.length >= MAX_HEADLINES) return prev;
      const nextId = Math.max(0, ...prev.headlines.map((h) => h.id)) + 1;
      return {
        ...prev,
        headlines: [...prev.headlines, { id: nextId, text: "", pin: "none" }],
      };
    });
  }, []);

  const addDescription = useCallback(() => {
    setInput((prev) => {
      if (prev.descriptions.length >= MAX_DESCRIPTIONS) return prev;
      const nextId = Math.max(0, ...prev.descriptions.map((d) => d.id)) + 1;
      return {
        ...prev,
        descriptions: [...prev.descriptions, { id: nextId, text: "", pin: "none" }],
      };
    });
  }, []);

  const removeHeadline = useCallback((id: number) => {
    setInput((prev) => ({
      ...prev,
      headlines: prev.headlines.filter((h) => h.id !== id),
    }));
  }, []);

  const removeDescription = useCallback((id: number) => {
    setInput((prev) => ({
      ...prev,
      descriptions: prev.descriptions.filter((d) => d.id !== id),
    }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (validation.ok) {
      saveHistory({
        ts: Date.now(),
        headlineCount: nonEmptyHeadlines,
        descriptionCount: nonEmptyDescriptions,
        strength: strength.level,
        score: strength.score,
      });
      setHistory(loadHistory());
    }
  }, [validation, nonEmptyHeadlines, nonEmptyDescriptions, strength]);

  const handleClear = useCallback(() => {
    setInput({
      headlines: [
        { id: 1, text: "", pin: "none" },
        { id: 2, text: "", pin: "none" },
        { id: 3, text: "", pin: "none" },
      ],
      descriptions: [
        { id: 1, text: "", pin: "none" },
        { id: 2, text: "", pin: "none" },
      ],
      finalUrl: "",
      displayURL: "",
      path1: "",
      path2: "",
    });
    toast.info("Cleared");
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
          <h3 className="text-sm font-semibold text-foreground">URLs</h3>
          <div className="space-y-1.5">
            <Label htmlFor="rsa-finalurl">Final URL *</Label>
            <Input
              id="rsa-finalurl"
              value={input.finalUrl}
              onChange={(e) => updateField("finalUrl", e.target.value)}
              placeholder="https://example.com/landing-page"
              className="font-mono text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="rsa-displayurl">Display URL (optional)</Label>
              <Input
                id="rsa-displayurl"
                value={input.displayURL || ""}
                onChange={(e) => updateField("displayURL", e.target.value)}
                placeholder="https://example.com"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rsa-path1">Path 1 (max 15 chars)</Label>
              <Input
                id="rsa-path1"
                value={input.path1 || ""}
                onChange={(e) => updateField("path1", e.target.value)}
                placeholder="running"
                className="font-mono text-sm"
              />
              <div className="text-xs text-muted-foreground">{(input.path1 || "").length}/15</div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rsa-path2">Path 2 (max 15 chars)</Label>
              <Input
                id="rsa-path2"
                value={input.path2 || ""}
                onChange={(e) => updateField("path2", e.target.value)}
                placeholder="shoes"
                className="font-mono text-sm"
              />
              <div className="text-xs text-muted-foreground">{(input.path2 || "").length}/15</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Headlines ({nonEmptyHeadlines}/{MAX_HEADLINES})
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={addHeadline}
              disabled={input.headlines.length >= MAX_HEADLINES}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add headline
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Min {MIN_HEADLINES}, max {MAX_HEADLINES}. Each headline max {HEADLINE_MAX} characters.
          </p>
          <div className="space-y-2">
            {input.headlines.map((h) => {
              const cc = charCount(h.text, HEADLINE_MAX);
              return (
                <div key={h.id} className="rounded-md border p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={h.text}
                      onChange={(e) => updateHeadline(h.id, "text", e.target.value)}
                      placeholder={`Headline ${h.id}`}
                      className="text-sm"
                    />
                    <Select value={h.pin} onValueChange={(v) => updateHeadline(h.id, "pin", v)}>
                      <SelectTrigger className="w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HEADLINE_PINS.map((p) => (
                          <SelectItem key={p} value={p}>{PIN_LABELS[p]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeHeadline(h.id)}
                      aria-label="Remove headline"
                      disabled={input.headlines.length <= 1}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className={`text-xs ${cc.isOver ? "text-red-600 dark:text-red-400" : cc.isWarn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                    {cc.length}/{HEADLINE_MAX} chars {cc.isOver ? "(over limit!)" : cc.isWarn ? "(near limit)" : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Descriptions ({nonEmptyDescriptions}/{MAX_DESCRIPTIONS})
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={addDescription}
              disabled={input.descriptions.length >= MAX_DESCRIPTIONS}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add description
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Min {MIN_DESCRIPTIONS}, max {MAX_DESCRIPTIONS}. Each description max {DESCRIPTION_MAX} characters.
          </p>
          <div className="space-y-2">
            {input.descriptions.map((d) => {
              const cc = charCount(d.text, DESCRIPTION_MAX);
              return (
                <div key={d.id} className="rounded-md border p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={d.text}
                      onChange={(e) => updateDescription(d.id, "text", e.target.value)}
                      placeholder={`Description ${d.id}`}
                      className="text-sm"
                    />
                    <Select value={d.pin} onValueChange={(v) => updateDescription(d.id, "pin", v)}>
                      <SelectTrigger className="w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DESCRIPTION_PINS.map((p) => (
                          <SelectItem key={p} value={p}>{PIN_LABELS[p]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeDescription(d.id)}
                      aria-label="Remove description"
                      disabled={input.descriptions.length <= 1}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className={`text-xs ${cc.isOver ? "text-red-600 dark:text-red-400" : cc.isWarn ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                    {cc.length}/{DESCRIPTION_MAX} chars {cc.isOver ? "(over limit!)" : cc.isWarn ? "(near limit)" : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {validation.errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive space-y-1">
          {validation.errors.map((e, i) => (
            <div key={i}>• {e}</div>
          ))}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      )}

      {(nonEmptyHeadlines > 0 || nonEmptyDescriptions > 0) && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Ad strength estimate</h3>
                <div className="text-right">
                  <div className={`text-2xl font-bold capitalize ${STRENGTH_COLORS[strength.level]}`}>
                    {strength.level}
                  </div>
                  <div className="text-xs text-muted-foreground">{strength.score}/100</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{strength.reason}</p>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Monitor className="h-4 w-4" /> Desktop preview
                </h3>
                <div className="rounded border p-3 bg-background space-y-1 text-sm">
                  <div className="text-blue-700 dark:text-blue-400 text-xs font-medium">
                    {desktopPreview.displayUrl || "example.com"}
                  </div>
                  <div className="font-medium text-foreground">
                    {desktopPreview.headlines.join(" | ") || "(no headlines)"}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {desktopPreview.descriptions.join(" ") || "(no descriptions)"}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4" /> Mobile preview
                </h3>
                <div className="rounded border p-3 bg-background space-y-1 text-sm">
                  <div className="text-blue-700 dark:text-blue-400 text-xs font-medium">
                    {mobilePreview.displayUrl || "example.com"}
                  </div>
                  <div className="font-medium text-foreground">
                    {mobilePreview.headlines.join(" | ") || "(no headlines)"}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {mobilePreview.descriptions.join(" ") || "(no descriptions)"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Ad copy text</Label>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return adText; }}
                    label="Copy ad text"
                  />
                  <DownloadButton getText={() => csv} filename="rsa-ad.csv" label="Download CSV" />
                  <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ input }); }} />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs">
                {adText}
              </pre>
            </CardContent>
          </Card>
        </>
      )}

      {nonEmptyHeadlines === 0 && nonEmptyDescriptions === 0 && !input.finalUrl && (
        <EmptyState
          title="Build a Responsive Search Ad"
          hint="Add 3+ headlines (30 chars each), 2+ descriptions (90 chars each), and a final URL. Pin headlines to positions H1/H2/H3 for control. We'll show character counts, ad strength, and desktop/mobile previews."
          icon={<Megaphone className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">RSA specs</h3>
            <a
              href={GOOGLE_RSA_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Google docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Headlines: 3-15, max 30 chars each.</li>
            <li>Descriptions: 2-4, max 90 chars each.</li>
            <li>Path fields: max 15 chars, alphanumeric + hyphens only.</li>
            <li>Pinning: max 3 headlines per position (H1/H2/H3), max 2 descriptions per position (D1/D2).</li>
            <li>Google tests combinations automatically — more headlines = better ad strength.</li>
          </ul>
        </CardContent>
      </Card>

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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mr-2">{h.headlineCount} H · {h.descriptionCount} D</Badge>
                    <span className={`font-medium ${STRENGTH_COLORS[h.strength]}`}>{h.strength}</span>
                    <span className="ml-1 text-muted-foreground">({h.score}/100)</span>
                  </div>
                  <span className="text-muted-foreground/70">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All ad
            building and validation runs locally. We don't post ads to Google.
            History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
