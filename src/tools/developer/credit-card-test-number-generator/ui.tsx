"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  BRAND_SPECS,
  BRAND_LIST,
  PROCESSOR_TEST_CARDS,
  HONESTY_BANNER,
  generateBundleBulk,
  formatCard,
  formatBundleLine,
  detectBrand,
  luhnValidate,
  cardsByProcessor,
  bundlesToJson,
  bundlesToCsv,
  bundlesToText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CardBrand,
  type CardFormat,
  type CardBundle,
  type ProcessorTestCard,
  type HistoryEntry,
} from "./logic";
import {
  CreditCard,
  History,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  Database,
} from "lucide-react";

type ExportFormat = "json" | "csv" | "text";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  json: "JSON",
  csv: "CSV",
  text: "Text",
};

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  json: "json",
  csv: "csv",
  text: "txt",
};

const FORMAT_MIMES: Record<ExportFormat, string> = {
  json: "application/json",
  csv: "text/csv",
  text: "text/plain",
};

const CARD_FORMATS: CardFormat[] = ["plain", "spaced", "dashed", "grouped"];

const PROCESSORS: ProcessorTestCard["processor"][] = ["stripe", "adyen", "braintree", "paypal"];

export default function CreditCardTestNumberGenerator() {
  const [seed, setSeed] = useState("test-seed");
  const [count, setCount] = useState(10);
  const [selectedBrands, setSelectedBrands] = useState<CardBrand[]>(["visa"]);
  const [cardFormat, setCardFormat] = useState<CardFormat>("grouped");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [detectorInput, setDetectorInput] = useState("");
  const [activeProcessor, setActiveProcessor] = useState<ProcessorTestCard["processor"]>("stripe");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.seed) setSeed(p.seed);
      if (p.count) setCount(p.count);
      if (p.format) setCardFormat(p.format);
      if (p.brands.length > 0) setSelectedBrands(p.brands);
      if (p.seed || p.brands.length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const bundles = useMemo(
    () => generateBundleBulk({
      count,
      seed: seed || "default",
      brands: selectedBrands.length > 0 ? selectedBrands : undefined,
    }),
    [count, seed, selectedBrands],
  );

  const output = useMemo(() => {
    if (bundles.length === 0) return "";
    switch (exportFormat) {
      case "json": return bundlesToJson(bundles);
      case "csv": return bundlesToCsv(bundles);
      case "text": return bundlesToText(bundles, cardFormat);
      default: return bundlesToJson(bundles);
    }
  }, [bundles, exportFormat, cardFormat]);

  const detectorResult = useMemo(() => {
    const trimmed = detectorInput.trim();
    if (!trimmed) return null;
    const brand = detectBrand(trimmed);
    const valid = luhnValidate(trimmed);
    return { brand, valid };
  }, [detectorInput]);

  const processorCards = useMemo(
    () => cardsByProcessor(activeProcessor),
    [activeProcessor],
  );

  const toggleBrand = (b: CardBrand) => {
    setSelectedBrands((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b],
    );
  };

  const handleRandomSeed = useCallback(() => {
    const s = Math.random().toString(36).slice(2, 10);
    setSeed(s);
    toast.success(`New seed: ${s}`);
  }, []);

  const handleSaveHistory = useCallback(() => {
    saveHistory({
      ts: Date.now(),
      seed,
      count,
      brands: selectedBrands,
      format: cardFormat,
    });
    setHistory(loadHistory());
  }, [seed, count, selectedBrands, cardFormat]);

  const handleCopyOrDownload = useCallback(() => {
    handleSaveHistory();
  }, [handleSaveHistory]);

  const handleClear = useCallback(() => {
    setSeed("test-seed");
    setCount(10);
    setSelectedBrands(["visa"]);
    setCardFormat("grouped");
    setExportFormat("json");
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareUrl = useMemo(
    () => buildShareUrl(seed, count, cardFormat, selectedBrands),
    [seed, count, cardFormat, selectedBrands],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Honesty banner — first thing the user sees */}
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
      >
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span className="text-xs">{HONESTY_BANNER}</span>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-seed" className="text-xs">Seed (deterministic)</Label>
              <div className="flex gap-1">
                <Input
                  id="cc-seed"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="font-mono text-xs"
                  placeholder="my-seed"
                />
                <Button variant="outline" size="sm" onClick={handleRandomSeed} title="Random seed">
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-count" className="text-xs">Count (max 10,000)</Label>
              <Input
                id="cc-count"
                type="number"
                min={1}
                max={10000}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-fmt" className="text-xs">Card number format</Label>
              <select
                id="cc-fmt"
                value={cardFormat}
                onChange={(e) => setCardFormat(e.target.value as CardFormat)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {CARD_FORMATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Brands (pick at least one — empty = random across all)</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {BRAND_LIST.map((b) => (
                <label key={b} className="flex items-center gap-1.5 text-xs cursor-pointer rounded border px-2 py-1 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={selectedBrands.includes(b)}
                    onChange={() => toggleBrand(b)}
                  />
                  {BRAND_SPECS[b].label}
                  <Badge variant="outline" className="text-[9px]">{BRAND_SPECS[b].lengths[0]} digits</Badge>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {bundles.length > 0 && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CreditCard className="h-4 w-4" /> Generated test cards ({bundles.length})
              </h3>
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {bundles.slice(0, 100).map((b, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{BRAND_SPECS[b.brand].label}</Badge>
                      <span className="font-mono text-foreground">{formatCard(b.number, cardFormat)}</span>
                      <span className="font-mono text-muted-foreground">{b.expiryMonth}/{b.expiryYear}</span>
                      <span className="font-mono text-muted-foreground">CVV {b.cvv}</span>
                      <span className="text-muted-foreground ml-auto">{b.cardholder}</span>
                    </div>
                  </div>
                ))}
                {bundles.length > 100 && (
                  <div className="text-[11px] text-muted-foreground text-center pt-1">
                    Showing first 100 of {bundles.length.toLocaleString()} — see export below for full output.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="h-4 w-4" /> Export ({FORMAT_LABELS[exportFormat]})
                </h3>
                <div className="flex items-center gap-2">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
                      <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                    ))}
                  </select>
                  <Badge variant="outline" className="text-[10px]">{output.length.toLocaleString()} bytes</Badge>
                </div>
              </div>
              <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
                {output}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleCopyOrDownload(); return output; }} label="Copy output" />
                <DownloadButton
                  getText={() => { handleCopyOrDownload(); return output; }}
                  filename={`test-cards.${FORMAT_EXTENSIONS[exportFormat]}`}
                  mime={FORMAT_MIMES[exportFormat]}
                  label={`Download .${FORMAT_EXTENSIONS[exportFormat]}`}
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return shareUrl; }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Validate / detect a card number
          </h3>
          <Input
            value={detectorInput}
            onChange={(e) => setDetectorInput(e.target.value)}
            placeholder="Paste a number to check Luhn + detect brand"
            className="font-mono text-sm"
          />
          {detectorResult && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={detectorResult.valid ? "default" : "destructive"}>
                {detectorResult.valid ? "Luhn-valid" : "Luhn-invalid"}
              </Badge>
              <Badge variant="outline">
                {detectorResult.brand ? BRAND_SPECS[detectorResult.brand].label : "Unknown brand"}
              </Badge>
              <span className="text-muted-foreground">
                {detectorInput.replace(/\D/g, "").length} digits
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Database className="h-4 w-4" /> Processor sandbox library ({PROCESSOR_TEST_CARDS.length} official cards)
            </h3>
            <div className="flex flex-wrap gap-1">
              {PROCESSORS.map((p) => (
                <Button
                  key={p}
                  variant={activeProcessor === p ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[11px] capitalize"
                  onClick={() => setActiveProcessor(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1 max-h-[400px] overflow-auto">
            {processorCards.map((c, i) => (
              <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{BRAND_SPECS[c.brand].label}</Badge>
                  <Badge variant="outline" className="text-[10px]">{c.scenario}</Badge>
                  <span className="font-mono text-foreground">{formatCard(c.number, "grouped")}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{c.description}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <CopyButton getText={() => bundlesToText(processorCards.map((c) => ({
              brand: c.brand,
              number: c.number,
              expiryMonth: "12",
              expiryYear: "30",
              cvv: "123",
              cardholder: "TEST USER",
            })), "grouped")} label="Copy processor cards" />
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
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.count} cards</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.format}</Badge>
                  <span className="font-mono text-muted-foreground">seed: {h.seed}</span>
                  <span className="text-muted-foreground">{h.brands.map((b) => BRAND_SPECS[b].label).join(", ") || "all brands"}</span>
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
            <strong className="text-foreground">Sandbox only:</strong> Every number here is Luhn-valid but UNASSIGNED — generated locally via a seeded mulberry32 PRNG. They cannot be used for real payments. History stored in localStorage (max 20).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
