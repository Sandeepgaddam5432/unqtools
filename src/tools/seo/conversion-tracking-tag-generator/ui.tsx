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
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  PLATFORM_INFO,
  validateConfig,
  generateFullSnippet,
  getSnippet,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type TrackingConfig,
  type Platform,
  type HistoryEntry,
} from "./logic";
import { History, Target, ExternalLink, Code2 } from "lucide-react";

const PLATFORM_LABELS: Record<Platform, string> = {
  "google-ads": "Google Ads",
  "facebook-pixel": "Facebook Pixel",
  "linkedin-insight": "LinkedIn Insight",
  "twitter-pixel": "Twitter Pixel",
};

export default function ConversionTrackingTagGenerator() {
  const [config, setConfig] = useState<TrackingConfig>({
    platform: "google-ads",
    conversionId: "",
    conversionLabel: "",
    conversionValue: undefined,
    currency: "USD",
    transactionId: "",
    pixelId: "",
    partnerId: "",
    eventName: "",
    eventValue: undefined,
    eventCurrency: "USD",
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.platform) {
        setConfig((prev) => ({ ...prev, ...parsed }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const validation = useMemo(() => validateConfig(config), [config]);
  const activePlatform = useMemo(
    () => PLATFORM_INFO.find((p) => p.id === config.platform),
    [config.platform],
  );

  const baseSnippet = useMemo(() => {
    try { return getSnippet(config, "base"); } catch (e) { return `// Error: ${(e as Error).message}`; }
  }, [config]);
  const eventSnippet = useMemo(() => {
    try { return getSnippet(config, "event"); } catch (e) { return `// Error: ${(e as Error).message}`; }
  }, [config]);
  const fullSnippet = useMemo(() => {
    try { return generateFullSnippet(config); } catch (e) { return `// Error: ${(e as Error).message}`; }
  }, [config]);

  const update = useCallback(<K extends keyof TrackingConfig>(key: K, val: TrackingConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: val }));
  }, []);

  const setPlatform = useCallback((p: string) => {
    setConfig((prev) => ({ ...prev, platform: p as Platform }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (validation.ok) {
      saveHistory({
        ts: Date.now(),
        platform: config.platform,
        snippetLength: fullSnippet.length,
      });
      setHistory(loadHistory());
    }
  }, [validation, config, fullSnippet]);

  const handleClear = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      conversionId: "",
      conversionLabel: "",
      conversionValue: undefined,
      transactionId: "",
      pixelId: "",
      partnerId: "",
      eventName: "",
      eventValue: undefined,
    }));
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const showField = (field: string): boolean => {
    if (!activePlatform) return false;
    return (
      activePlatform.requiredFields.includes(field) ||
      ["eventName", "eventValue", "eventCurrency", "conversionValue", "currency", "transactionId"].includes(field)
    );
  };

  const showGoogleAdsFields = config.platform === "google-ads";
  const showFacebookFields = config.platform === "facebook-pixel" || config.platform === "twitter-pixel";
  const showLinkedInFields = config.platform === "linkedin-insight";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_INFO.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={config.platform === p.id ? "default" : "outline"}
                  onClick={() => setPlatform(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          {activePlatform && (
            <p className="text-xs text-muted-foreground">{activePlatform.description}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Configuration</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {showGoogleAdsFields && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="cttg-conversionid">Conversion ID *</Label>
                  <Input
                    id="cttg-conversionid"
                    value={config.conversionId || ""}
                    onChange={(e) => update("conversionId", e.target.value)}
                    placeholder="AW-123456789"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cttg-conversionlabel">Conversion Label *</Label>
                  <Input
                    id="cttg-conversionlabel"
                    value={config.conversionLabel || ""}
                    onChange={(e) => update("conversionLabel", e.target.value)}
                    placeholder="abcDEFghi"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cttg-value">Conversion value (optional)</Label>
                  <Input
                    id="cttg-value"
                    type="number"
                    value={config.conversionValue ?? ""}
                    onChange={(e) => update("conversionValue", e.target.value === "" ? undefined : Number(e.target.value))}
                    placeholder="99.99"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cttg-currency">Currency</Label>
                  <Input
                    id="cttg-currency"
                    value={config.currency || ""}
                    onChange={(e) => update("currency", e.target.value)}
                    placeholder="USD"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cttg-txn">Transaction ID (optional)</Label>
                  <Input
                    id="cttg-txn"
                    value={config.transactionId || ""}
                    onChange={(e) => update("transactionId", e.target.value)}
                    placeholder="T-12345"
                    className="font-mono text-sm"
                  />
                </div>
              </>
            )}
            {showFacebookFields && (
              <>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cttg-pixelid">
                    {config.platform === "facebook-pixel" ? "Pixel ID" : "Pixel ID"} *
                  </Label>
                  <Input
                    id="cttg-pixelid"
                    value={config.pixelId || ""}
                    onChange={(e) => update("pixelId", e.target.value)}
                    placeholder={config.platform === "facebook-pixel" ? "123456789012345" : "abc123"}
                    className="font-mono text-sm"
                  />
                </div>
              </>
            )}
            {showLinkedInFields && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cttg-partnerid">Partner ID *</Label>
                <Input
                  id="cttg-partnerid"
                  value={config.partnerId || ""}
                  onChange={(e) => update("partnerId", e.target.value)}
                  placeholder="1234567"
                  className="font-mono text-sm"
                />
              </div>
            )}
            {(showFacebookFields || showLinkedInFields || (showGoogleAdsFields && config.eventName)) && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="cttg-eventname">Event name (optional)</Label>
                  <Input
                    id="cttg-eventname"
                    value={config.eventName || ""}
                    onChange={(e) => update("eventName", e.target.value)}
                    placeholder={config.platform === "facebook-pixel" ? "Purchase" : "conversion"}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cttg-eventvalue">Event value (optional)</Label>
                  <Input
                    id="cttg-eventvalue"
                    type="number"
                    value={config.eventValue ?? ""}
                    onChange={(e) => update("eventValue", e.target.value === "" ? undefined : Number(e.target.value))}
                    placeholder="99.99"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cttg-eventcurrency">Event currency</Label>
                  <Input
                    id="cttg-eventcurrency"
                    value={config.eventCurrency || ""}
                    onChange={(e) => update("eventCurrency", e.target.value)}
                    placeholder="USD"
                  />
                </div>
              </>
            )}
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

      {validation.ok ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5" /> Base tag (paste in &lt;head&gt;)
                </Label>
                <CopyButton getText={() => baseSnippet} label="Copy" size="icon-sm" />
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs max-h-[300px]">
                {baseSnippet}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-1.5">
                  <Code2 className="h-3.5 w-3.5" /> Event tag (fire on conversion)
                </Label>
                <CopyButton getText={() => eventSnippet} label="Copy" size="icon-sm" />
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs max-h-[300px]">
                {eventSnippet}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Full snippet (base + event combined)</Label>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => { handleSaveHistory(); return fullSnippet; }}
                    label="Copy all"
                  />
                  <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ config }); }} />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs max-h-[400px]">
                {fullSnippet}
              </pre>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Fill in the required fields for your platform"
          hint="Pick a platform above, then enter your conversion ID / pixel ID / partner ID. We'll generate the base tag, event tag, and a combined snippet ready to paste."
          icon={<Target className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Platform reference</h3>
          <div className="space-y-2">
            {PLATFORM_INFO.map((p) => (
              <div key={p.id} className="rounded-md border p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{p.label}</span>
                  <a
                    href={p.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Docs <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <p className="text-muted-foreground">{p.description}</p>
                <div className="text-muted-foreground">
                  <strong>Required:</strong> {p.requiredFields.join(", ")}
                </div>
              </div>
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
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                Clear
              </Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  onClick={() => setPlatform(h.platform)}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <Badge variant="outline" className="mr-2">{PLATFORM_LABELS[h.platform]}</Badge>
                  <span className="text-muted-foreground">{h.snippetLength} chars</span>
                  <div className="text-muted-foreground/70 mt-1">{new Date(h.ts).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Tag
            generation is pure string manipulation. We don't send your
            conversion IDs anywhere. History is stored in localStorage on
            this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
