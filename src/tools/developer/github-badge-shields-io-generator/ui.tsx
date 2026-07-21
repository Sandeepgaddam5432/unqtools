"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, BadgeCheck, ExternalLink, Search, Image as ImageIcon,
} from "lucide-react";
import {
  STYLES,
  STYLE_LABELS,
  NAMED_COLORS,
  BADGE_TYPES,
  BADGE_TYPE_LABELS,
  BRAND_PRESETS,
  defaultConfig,
  defaultDynamicConfig,
  generateBadge,
  renderMarkdown,
  renderHtml,
  renderRst,
  renderAsciiDoc,
  presetToConfig,
  findPreset,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateConfig,
  type BadgeConfig,
  type BadgeType,
  type HistoryEntry,
} from "./logic";

const EMBED_LABELS = [
  { key: "markdown", label: "Markdown" },
  { key: "html", label: "HTML" },
  { key: "rst", label: "reStructuredText" },
  { key: "asciidoc", label: "AsciiDoc" },
] as const;

type EmbedKey = typeof EMBED_LABELS[number]["key"];

export default function GithubBadgeShieldsIoGenerator() {
  const [config, setConfig] = useState<BadgeConfig>(() => defaultConfig());
  const [embedFormat, setEmbedFormat] = useState<EmbedKey>("markdown");
  const [presetSearch, setPresetSearch] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      setConfig(parsed);
      toast.info("Loaded from share link");
    }
  }, []);

  const issues = useMemo(() => validateConfig(config), [config]);
  const errors = issues.filter((i) => i.severity === "error");
  const badge = useMemo(() => generateBadge(config), [config]);

  const embedText = useMemo(() => {
    switch (embedFormat) {
      case "markdown": return renderMarkdown(badge);
      case "html": return renderHtml(badge);
      case "rst": return renderRst(badge);
      case "asciidoc": return renderAsciiDoc(badge);
      default: return renderMarkdown(badge);
    }
  }, [badge, embedFormat]);

  const filteredPresets = useMemo(() => {
    const q = presetSearch.trim().toLowerCase();
    if (!q) return BRAND_PRESETS;
    return BRAND_PRESETS.filter((p) =>
      p.label.toLowerCase().includes(q) || p.slug.includes(q),
    );
  }, [presetSearch]);

  const update = useCallback((patch: Partial<BadgeConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleTypeChange = useCallback((type: BadgeType) => {
    setConfig((prev) => {
      // Switch to dynamic defaults when changing to a dynamic type
      if (type !== "static") {
        return { ...defaultDynamicConfig(type), style: prev.style, link: prev.link };
      }
      return { ...defaultConfig(), style: prev.style, link: prev.link };
    });
  }, []);

  const handlePresetClick = useCallback((slug: string) => {
    const preset = findPreset(slug);
    if (!preset) return;
    setConfig(presetToConfig(preset));
    toast.success(`Loaded preset: ${preset.label}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (errors.length === 0) {
      saveHistory({
        ts: Date.now(),
        type: config.type,
        url: badge.url,
        altText: badge.altText,
      });
      setHistory(loadHistory());
    }
  }, [config, badge, errors]);

  const handleClear = useCallback(() => {
    setConfig(defaultConfig());
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const isDynamic = config.type !== "static" && config.type !== "license";
  const needsRepo = config.type.startsWith("github-") ||
    config.type === "build-circleci" ||
    config.type === "build-github-actions" ||
    config.type === "coverage-codecov" ||
    config.type === "dependencies-david";
  const needsNpm = config.type.startsWith("npm-") || config.type === "license";
  const needsWorkflow = config.type === "build-github-actions";
  const needsLicense = config.type === "license";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gb-type">Badge type</Label>
            <select
              id="gb-type"
              value={config.type}
              onChange={(e) => handleTypeChange(e.target.value as BadgeType)}
              className="h-9 w-full rounded border bg-background px-2 text-sm"
            >
              {BADGE_TYPES.map((t) => (
                <option key={t} value={t}>{BADGE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Static badge fields */}
          {(config.type === "static") && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="gb-label" className="text-xs">Label</Label>
                <Input id="gb-label" value={config.label}
                  onChange={(e) => update({ label: e.target.value })}
                  placeholder="build" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gb-message" className="text-xs">Message</Label>
                <Input id="gb-message" value={config.message}
                  onChange={(e) => update({ message: e.target.value })}
                  placeholder="passing" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gb-color" className="text-xs">Color (named or #hex)</Label>
                <Input id="gb-color" value={config.color}
                  onChange={(e) => update({ color: e.target.value })}
                  placeholder="brightgreen / #ff6f00" className="h-9 text-sm" />
              </div>
            </div>
          )}

          {/* Dynamic fields */}
          {needsRepo && (
            <div className="space-y-1">
              <Label htmlFor="gb-repo" className="text-xs">GitHub repo (owner/name)</Label>
              <Input id="gb-repo" value={config.repo ?? ""}
                onChange={(e) => update({ repo: e.target.value })}
                placeholder="microsoft/typescript" className="h-9 text-sm" />
            </div>
          )}
          {needsNpm && (
            <div className="space-y-1">
              <Label htmlFor="gb-pkg" className="text-xs">npm package name</Label>
              <Input id="gb-pkg" value={config.npmPackage ?? ""}
                onChange={(e) => update({ npmPackage: e.target.value })}
                placeholder="react" className="h-9 text-sm" />
            </div>
          )}
          {needsWorkflow && (
            <div className="space-y-1">
              <Label htmlFor="gb-wf" className="text-xs">Workflow name (without .yml)</Label>
              <Input id="gb-wf" value={config.workflow ?? ""}
                onChange={(e) => update({ workflow: e.target.value })}
                placeholder="ci" className="h-9 text-sm" />
            </div>
          )}
          {needsLicense && (
            <div className="space-y-1">
              <Label htmlFor="gb-lic" className="text-xs">License type</Label>
              <select
                id="gb-lic"
                value={config.license ?? "MIT"}
                onChange={(e) => update({ license: e.target.value })}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                <option value="MIT">MIT</option>
                <option value="Apache-2.0">Apache-2.0</option>
                <option value="GPL-3.0">GPL-3.0</option>
                <option value="BSD-2-Clause">BSD-2-Clause</option>
                <option value="BSD-3-Clause">BSD-3-Clause</option>
                <option value="MPL-2.0">MPL-2.0</option>
                <option value="Unlicense">Unlicense</option>
              </select>
            </div>
          )}

          {/* Style + extras */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label htmlFor="gb-style" className="text-xs">Style</Label>
              <select id="gb-style" value={config.style}
                onChange={(e) => update({ style: e.target.value as BadgeConfig["style"] })}
                className="h-9 w-full rounded border bg-background px-2 text-sm">
                {STYLES.map((s) => <option key={s} value={s}>{STYLE_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="gb-logo" className="text-xs">Logo (simple-icons slug)</Label>
              <Input id="gb-logo" value={config.logo ?? ""}
                onChange={(e) => update({ logo: e.target.value })}
                placeholder="github" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gb-logocolor" className="text-xs">Logo color (#hex)</Label>
              <Input id="gb-logocolor" value={config.logoColor ?? ""}
                onChange={(e) => update({ logoColor: e.target.value })}
                placeholder="ffffff" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gb-link" className="text-xs">Link URL (optional)</Label>
              <Input id="gb-link" value={config.link ?? ""}
                onChange={(e) => update({ link: e.target.value })}
                placeholder="https://github.com/..." className="h-9 text-sm" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Quick colors</Label>
            <div className="flex flex-wrap gap-1 pt-1">
              {NAMED_COLORS.slice(0, 12).map((c) => (
                <Button key={c} variant="ghost" size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => update({ color: c })}>+ {c}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive space-y-1">
          {errors.map((i, idx) => (
            <div key={idx}><strong>{i.field}:</strong> {i.message}</div>
          ))}
        </div>
      )}

      {errors.length === 0 ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4" /> Live preview
            </h3>
            <div className="rounded border bg-background p-4 flex items-center justify-center min-h-[60px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={badge.url} alt={badge.altText}
                className="max-w-full h-auto" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Badge URL</Label>
              <div className="rounded border bg-muted/30 p-2 font-mono text-[11px] break-all text-muted-foreground">
                {badge.url}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs">Embed code</Label>
                <div className="flex flex-wrap gap-1">
                  {EMBED_LABELS.map((e) => (
                    <Button key={e.key} variant={embedFormat === e.key ? "default" : "outline"} size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setEmbedFormat(e.key)}>{e.label}</Button>
                  ))}
                </div>
              </div>
              <Textarea readOnly value={embedText}
                className="min-h-[80px] resize-y font-mono text-xs" />
            </div>

            <div className="flex flex-wrap gap-2">
              <CopyButton
                getText={() => { handleSaveHistory(); return embedText; }}
                label={`Copy ${embedFormat}`}
              />
              <CopyButton
                getText={() => badge.url}
                label="Copy URL"
              />
              <a href={badge.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> Open
                </Button>
              </a>
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(config); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Fix the errors above to generate the badge"
          hint="Static badges need a label and message; dynamic badges need the right repo or package."
          icon={<BadgeCheck className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Search className="h-4 w-4" /> Brand preset gallery ({filteredPresets.length})
            </h3>
            <Input
              value={presetSearch}
              onChange={(e) => setPresetSearch(e.target.value)}
              placeholder="Filter..."
              className="h-8 w-40 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {filteredPresets.map((p) => (
              <button key={p.slug} type="button"
                onClick={() => handlePresetClick(p.slug)}
                className="rounded border bg-background p-2 text-left hover:bg-accent hover:border-primary transition-colors">
                <div className="flex items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.shields.io/static/v1?label=${encodeURIComponent(p.label)}&message=${encodeURIComponent(p.label)}&color=${p.color}&logo=${p.logo}&style=flat`}
                    alt={p.label}
                    className="max-w-full h-auto"
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">{p.slug}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

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
                  <Badge variant="outline" className="text-[10px]">{BADGE_TYPE_LABELS[h.type]}</Badge>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={h.url} alt={h.altText} className="h-5" />
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
            <strong className="text-foreground">Privacy:</strong> All badge URL generation runs locally.
            The badge image itself is loaded from <code>img.shields.io</code> when you preview it —
            no other data leaves your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
