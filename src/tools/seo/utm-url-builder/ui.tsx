"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { CopyButton, DownloadButton, ErrorBanner, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  SOURCE_MEDIUM_PRESETS,
  CAMPAIGN_TEMPLATES,
  validateUtmInput,
  buildUtmUrl,
  buildBulkUtmUrls,
  parseUtmUrl,
  buildQrDataUrl,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type UtmInput,
  type HistoryEntry,
} from "./logic";
import { History, QrCode, Layers } from "lucide-react";

export default function UtmUrlBuilder() {
  const [input, setInput] = useState<UtmInput>({
    baseUrl: "",
    source: "",
    medium: "",
    campaign: "",
    term: "",
    content: "",
  });
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed } as UtmInput));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validateUtmInput(input), [input]);

  const finalUrl = useMemo(() => {
    try {
      return buildUtmUrl(input);
    } catch {
      return "";
    }
  }, [input]);

  const bulkResults = useMemo(() => {
    if (!bulkMode) return [];
    const urls = bulkUrls.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (urls.length === 0) return [];
    return buildBulkUtmUrls(urls, {
      source: input.source,
      medium: input.medium,
      campaign: input.campaign,
      term: input.term,
      content: input.content,
    });
  }, [bulkMode, bulkUrls, input]);

  const qrDataUrl = useMemo(() => (finalUrl ? buildQrDataUrl(finalUrl) : ""), [finalUrl]);

  const update = useCallback(<K extends keyof UtmInput>(key: K, val: string) => {
    setInput((prev) => ({ ...prev, [key]: val }));
  }, []);

  const applyPreset = useCallback((presetValue: string) => {
    const preset = SOURCE_MEDIUM_PRESETS.find((p) => p.label === presetValue);
    if (preset) {
      setInput((prev) => ({ ...prev, source: preset.source, medium: preset.medium }));
    }
  }, []);

  const applyCampaignTemplate = useCallback((label: string) => {
    const tmpl = CAMPAIGN_TEMPLATES.find((c) => c.label === label);
    if (tmpl) {
      setInput((prev) => ({ ...prev, campaign: tmpl.campaign }));
    }
  }, []);

  const loadFromUrl = useCallback(() => {
    if (!input.baseUrl) return;
    const parsed = parseUtmUrl(input.baseUrl);
    setInput((prev) => ({
      ...prev,
      source: parsed.source || prev.source,
      medium: parsed.medium || prev.medium,
      campaign: parsed.campaign || prev.campaign,
      term: parsed.term || prev.term,
      content: parsed.content || prev.content,
    }));
    toast.info("UTMs extracted from URL");
  }, [input.baseUrl]);

  const handleCopy = useCallback(() => {
    if (finalUrl) {
      saveHistory({
        ts: Date.now(),
        url: finalUrl,
        source: input.source,
        campaign: input.campaign,
      });
      setHistory(loadHistory());
    }
  }, [finalUrl, input.source, input.campaign]);

  const handleClear = useCallback(() => {
    setInput({ baseUrl: "", source: "", medium: "", campaign: "", term: "", content: "" });
    setBulkUrls("");
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
            <h3 className="text-sm font-semibold text-foreground">UTM parameters</h3>
            <Button
              size="sm"
              variant={bulkMode ? "default" : "outline"}
              onClick={() => setBulkMode((m) => !m)}
            >
              {bulkMode ? "Single URL mode" : "Bulk mode"}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="utm-base">Base URL</Label>
            <div className="flex gap-2">
              <Input
                id="utm-base"
                value={input.baseUrl}
                onChange={(e) => update("baseUrl", e.target.value)}
                placeholder="https://example.com/landing-page"
              />
              <Button variant="ghost" size="sm" onClick={loadFromUrl} disabled={!input.baseUrl}>
                Extract UTMs
              </Button>
            </div>
          </div>
          {!bulkMode && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="utm-source">utm_source *</Label>
                <Input
                  id="utm-source"
                  value={input.source}
                  onChange={(e) => update("source", e.target.value)}
                  placeholder="google, facebook, newsletter"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="utm-medium">utm_medium *</Label>
                <Input
                  id="utm-medium"
                  value={input.medium}
                  onChange={(e) => update("medium", e.target.value)}
                  placeholder="cpc, social, email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="utm-campaign">utm_campaign *</Label>
                <Input
                  id="utm-campaign"
                  value={input.campaign}
                  onChange={(e) => update("campaign", e.target.value)}
                  placeholder="summer_sale_2026"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="utm-term">utm_term (optional)</Label>
                <Input
                  id="utm-term"
                  value={input.term}
                  onChange={(e) => update("term", e.target.value)}
                  placeholder="running+shoes"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="utm-content">utm_content (optional)</Label>
                <Input
                  id="utm-content"
                  value={input.content}
                  onChange={(e) => update("content", e.target.value)}
                  placeholder="banner_ad, text_link"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Presets</h3>
          <div className="flex flex-wrap gap-2">
            <Select onValueChange={applyPreset}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Source / medium preset" /></SelectTrigger>
              <SelectContent>
                {SOURCE_MEDIUM_PRESETS.map((p) => (
                  <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={applyCampaignTemplate}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Campaign template" /></SelectTrigger>
              <SelectContent>
                {CAMPAIGN_TEMPLATES.map((c) => (
                  <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {bulkMode && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label htmlFor="utm-bulk">Bulk URLs (one per line)</Label>
            <Textarea
              id="utm-bulk"
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              placeholder={"https://example.com/page1\nhttps://example.com/page2\nhttps://example.com/page3"}
              className="min-h-[120px] font-mono text-xs resize-y"
            />
            {bulkResults.length > 0 && (
              <div className="space-y-1 mt-2">
                {bulkResults.map((r, i) => (
                  <div key={i} className="text-xs">
                    {r.result ? (
                      <span className="font-mono break-all">{r.result}</span>
                    ) : (
                      <span className="text-destructive">{r.url}: {r.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.map((w, i) => <div key={i}>• {w}</div>)}
        </div>
      )}

      {finalUrl ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Final UTM URL</Label>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleCopy(); return finalUrl; }} />
                <DownloadButton getText={() => finalUrl} filename="utm-urls.txt" />
                <ShareButton getUrl={() => buildShareUrl(input)} />
                <ClearButton onClick={handleClear} />
              </div>
            </div>
            <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
              {finalUrl}
            </pre>
          </div>
          {qrDataUrl && (
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR code of final URL" className="h-32 w-32" />
                <div className="space-y-1">
                  <div className="text-sm font-semibold flex items-center gap-1.5">
                    <QrCode className="h-4 w-4" /> QR code
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scan to open the URL on a phone. Note: for production QR codes use a real QR library — this is a deterministic placeholder pattern.
                  </p>
                  <p className="text-xs text-muted-foreground pt-2">
                    <strong className="text-foreground">Tip:</strong> use a URL shortener (bit.ly, your branded domain) after building the UTM URL — long URLs make QR codes dense and harder to scan.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">GA4 note:</strong> GA4 collects utm_source, utm_medium, utm_campaign, utm_term, utm_content automatically when present. Google Ads auto-tagging (gclid) does not require UTMs.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState
          title="Enter a base URL and UTM parameters"
          hint="All fields marked * are required. Presets help you fill common source/medium and campaign name combinations."
          icon={<Layers className="h-8 w-8" />}
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
                <button
                  key={i}
                  onClick={() => {
                    navigator.clipboard?.writeText(h.url);
                    toast.success("Copied from history");
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer break-all"
                >
                  <Badge variant="outline" className="text-xs mr-2">{h.source}</Badge>
                  <span className="font-mono">{h.url.slice(0, 80)}…</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> UTM URL building is pure string manipulation. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
