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
  SEO_TITLE_MAX,
  META_DESCRIPTION_MAX,
  AVAILABILITY_LABELS,
  CONDITION_LABELS,
  CURRENCY_PRESETS,
  DEFAULT_INPUTS,
  validateInputs,
  normalizeInputs,
  generateAll,
  summarizeStats,
  parseBulkCsv,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ProductInputs,
  type Availability,
  type Condition,
  type HistoryEntry,
} from "./logic";
import { History, ShoppingBag, FileJson, ListTree, Tag, ImageIcon, KeyRound } from "lucide-react";

export default function ECommerceProductSeoOptimizer() {
  const [inputs, setInputs] = useState<ProductInputs>({ ...DEFAULT_INPUTS });
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setInputs((prev) => ({ ...prev, ...p }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const errors = useMemo(() => validateInputs(inputs), [inputs]);
  const hasErrors = Object.keys(errors).length > 0;

  const normInputs = useMemo(() => normalizeInputs(inputs), [inputs]);
  const output = useMemo(() => generateAll(normInputs), [normInputs]);
  const stats = useMemo(() => summarizeStats(normInputs, output), [normInputs, output]);

  const bulkRows = useMemo(() => (showBulk ? parseBulkCsv(bulkText) : []), [bulkText, showBulk]);

  const textReport = useMemo(() => renderTextReport(normInputs, output), [normInputs, output]);
  const csvReport = useMemo(() => renderCsv(normInputs, output), [normInputs, output]);

  const handleSaveHistory = useCallback(() => {
    if (!hasErrors && normInputs.productName) {
      saveHistory({
        ts: Date.now(),
        productName: normInputs.productName,
        brand: normInputs.brand,
        contentScore: output.contentScore.score,
        slug: output.slug,
      });
      setHistory(loadHistory());
    }
  }, [normInputs, output, hasErrors]);

  const handleClear = useCallback(() => {
    setInputs({ ...DEFAULT_INPUTS });
    setBulkText("");
    toast.info("Cleared inputs");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const update = <K extends keyof ProductInputs>(field: K, value: ProductInputs[K]) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreset = (key: "example" | "empty") => {
    if (key === "example") {
      setInputs({
        productName: "Wireless Bluetooth Headphones",
        brand: "Sony",
        category: "Audio > Headphones",
        price: 99.99,
        currency: "USD",
        description:
          "Premium wireless over-ear headphones with active noise cancellation, 30-hour battery life, and crystal-clear audio. Designed for music lovers and professionals.",
        sku: "SONY-WH-1000",
        mpn: "WH1000XM4",
        gtin: "4905524999137",
        availability: "in-stock",
        condition: "new",
        features: "Active noise cancellation\n30-hour battery life\nBluetooth 5.0\nUSB-C fast charging",
        siteName: "AudioPro",
        ratingValue: 0,
        reviewCount: 0,
      });
      toast.info("Loaded example product");
    } else {
      handleClear();
    }
  };

  const titleBarColor = barColorForLength(output.seoTitleLength, SEO_TITLE_MAX);
  const metaBarColor = barColorForLength(output.metaDescriptionLength, META_DESCRIPTION_MAX);
  const scoreBarColor = barColorForScore(output.contentScore.score);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-sm font-semibold">Product details</Label>
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => handlePreset("example")}>+ Example</Button>
              <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={() => setShowBulk((s) => !s)}>
                {showBulk ? "Hide bulk CSV" : "Bulk CSV mode"}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <TextField label="Product name *" value={inputs.productName} onChange={(v) => update("productName", v)} placeholder="Wireless Bluetooth Headphones" />
            <TextField label="Brand" value={inputs.brand} onChange={(v) => update("brand", v)} placeholder="Sony" />
            <TextField label="Category" value={inputs.category} onChange={(v) => update("category", v)} placeholder="Audio > Headphones" />
            <TextField label="Site name (optional)" value={inputs.siteName} onChange={(v) => update("siteName", v)} placeholder="AudioPro" />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Price</Label>
                <Input
                  type="number"
                  value={inputs.price || ""}
                  onChange={(e) => update("price", Number(e.target.value) || 0)}
                  className={`h-8 text-xs ${errors.price ? "border-red-500" : ""}`}
                />
                {errors.price && <p className="text-[10px] text-red-500">{errors.price}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Currency</Label>
                <select
                  value={inputs.currency}
                  onChange={(e) => update("currency", e.target.value)}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  {CURRENCY_PRESETS.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Availability</Label>
                <select
                  value={inputs.availability}
                  onChange={(e) => update("availability", e.target.value as Availability)}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(AVAILABILITY_LABELS) as Availability[]).map((a) => (
                    <option key={a} value={a}>{AVAILABILITY_LABELS[a]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Condition</Label>
                <select
                  value={inputs.condition}
                  onChange={(e) => update("condition", e.target.value as Condition)}
                  className="h-8 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(CONDITION_LABELS) as Condition[]).map((c) => (
                    <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
                  ))}
                </select>
              </div>
            </div>
            <TextField label="SKU" value={inputs.sku} onChange={(v) => update("sku", v)} placeholder="SONY-WH-1000" />
            <TextField label="MPN" value={inputs.mpn} onChange={(v) => update("mpn", v)} placeholder="WH1000XM4" />
            <TextField label="GTIN (EAN/UPC)" value={inputs.gtin} onChange={(v) => update("gtin", v)} placeholder="4905524999137" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="epso-desc" className="text-[11px] text-muted-foreground">Description</Label>
            <Textarea
              id="epso-desc"
              value={inputs.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Long-form product description (aim for 200+ chars)"
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">{inputs.description.length} chars</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="epso-feat" className="text-[11px] text-muted-foreground">Features (one per line)</Label>
            <Textarea
              id="epso-feat"
              value={inputs.features}
              onChange={(e) => update("features", e.target.value)}
              placeholder={"Active noise cancellation\n30-hour battery life\nBluetooth 5.0"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Rating value (optional)</Label>
              <Input
                type="number"
                step="0.1"
                value={inputs.ratingValue || ""}
                onChange={(e) => update("ratingValue", Number(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Review count (optional)</Label>
              <Input
                type="number"
                value={inputs.reviewCount || ""}
                onChange={(e) => update("reviewCount", Number(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {showBulk && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label htmlFor="epso-bulk" className="text-sm font-semibold">Bulk CSV input</Label>
            <p className="text-[11px] text-muted-foreground">
              Columns: productName, brand, category, price, currency, description, sku, mpn, gtin, availability, condition, features (separate features with ;), siteName
            </p>
            <Textarea
              id="epso-bulk"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"productName,brand,category,price,currency,description,sku,mpn,gtin,availability,condition,features,siteName\nPhone1,Apple,Mobile,999,USD,Desc1,sku1,mpn1,gtin1,in-stock,new,feat1;feat2,AppleStore\nPhone2,Samsung,Mobile,799,USD,Desc2,sku2,mpn2,gtin2,in-stock,new,featA;featB,Shop"}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
            {bulkRows.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-medium">{bulkRows.length} products parsed</p>
                <div className="max-h-[300px] overflow-auto space-y-1">
                  {bulkRows.map((row, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{row.output?.contentScore.score ?? 0}/100</Badge>
                        <span className="font-mono text-foreground truncate flex-1">{row.inputs.productName}</span>
                        <span className="text-muted-foreground text-[10px]">{row.output?.slug || "(no slug)"}</span>
                      </div>
                      {row.error && <p className="text-[10px] text-red-500 mt-1">{row.error}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!hasErrors && normInputs.productName ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Content score" value={`${output.contentScore.score}/100`} hint={`${stats.filledFields}/${stats.totalFields} fields`} highlight={output.contentScore.score >= 80 ? "good" : output.contentScore.score < 50 ? "bad" : undefined} />
                <Stat label="Completeness" value={`${stats.completenessPercent}%`} hint={stats.hasStructuredData ? "Schema ready" : "No schema"} />
                <Stat label="Title fit" value={stats.titleFit} hint={`${output.seoTitleLength}/${SEO_TITLE_MAX} chars`} highlight={stats.titleFit === "truncated" ? "bad" : "good"} />
                <Stat label="Meta fit" value={stats.metaFit} hint={`${output.metaDescriptionLength}/${META_DESCRIPTION_MAX} chars`} highlight={stats.metaFit === "truncated" ? "bad" : "good"} />
              </div>
              <ScoreBar label="Content score" score={output.contentScore.score} barClass={scoreBarColor} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Tag className="h-4 w-4" /> SEO title & meta
              </h3>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>SEO title</span>
                    <Badge variant="outline" className="text-[10px]">{output.seoTitleLength}/{SEO_TITLE_MAX}</Badge>
                  </div>
                  <div className="rounded border bg-background px-3 py-2 mt-1 font-mono text-xs">{output.seoTitle}</div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${titleBarColor} transition-all`} style={{ width: `${Math.min(100, (output.seoTitleLength / SEO_TITLE_MAX) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Meta description</span>
                    <Badge variant="outline" className="text-[10px]">{output.metaDescriptionLength}/{META_DESCRIPTION_MAX}</Badge>
                  </div>
                  <div className="rounded border bg-background px-3 py-2 mt-1 font-mono text-xs">{output.metaDescription}</div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${metaBarColor} transition-all`} style={{ width: `${Math.min(100, (output.metaDescriptionLength / META_DESCRIPTION_MAX) * 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">URL slug</div>
                  <div className="rounded border bg-background px-3 py-2 mt-1 font-mono text-xs">/{output.slug || "(empty)"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileJson className="h-4 w-4" /> Product JSON-LD schema
              </h3>
              <Textarea
                readOnly
                value={output.schemaJson}
                className="min-h-[200px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => output.schemaJson} label="Copy JSON-LD" />
                <DownloadButton
                  getText={() => output.schemaJson}
                  filename="product-schema.jsonld"
                  mime="application/ld+json"
                  label="Download JSON-LD"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListTree className="h-4 w-4" /> Heading structure
              </h3>
              <div className="space-y-1">
                {output.headings.map((h, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="outline" className="mr-2 text-[10px]">H{h.level}</Badge>
                    <span className="font-mono text-foreground">{h.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <KeyRound className="h-4 w-4" /> Top keywords
              </h3>
              {output.keywords.length === 0 ? (
                <p className="text-xs text-muted-foreground">No keywords — add description and features.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {output.keywords.map((k) => (
                    <Badge key={k.word} variant="secondary" className="text-[11px]">
                      {k.word} <span className="ml-1 text-[10px] text-muted-foreground">({k.count}x)</span>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" /> Alt-text suggestions
              </h3>
              {output.altTexts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No alt-text — add product name first.</p>
              ) : (
                <div className="space-y-1">
                  {output.altTexts.map((a, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <code className="text-foreground">alt="{a}"</code>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Content score breakdown</h3>
              <div className="space-y-1">
                {output.contentScore.breakdown.map((b) => (
                  <div key={b.field} className="flex items-center gap-2 text-xs rounded border bg-background px-3 py-1.5">
                    <span className={`font-mono text-[10px] w-3 ${b.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {b.ok ? "✓" : "✗"}
                    </span>
                    <span className="flex-1 text-foreground">{b.field}</span>
                    <Badge variant="outline" className="text-[10px]">{b.points}/{b.max}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Export</h3>
              <Textarea
                readOnly
                value={textReport}
                className="min-h-[240px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleSaveHistory(); return textReport; }} label="Copy report" />
                <DownloadButton getText={() => { handleSaveHistory(); return textReport; }} filename="product-seo-report.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csvReport} filename="product-seo-output.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(normInputs); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title={hasErrors ? "Fix input errors to generate SEO output" : "Enter product name to generate SEO"}
          hint="Fill in product details above. Click Example for a sample, or use Bulk CSV mode to optimize multiple products at once."
          icon={<ShoppingBag className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.contentScore}/100</Badge>
                  {h.brand && <Badge variant="outline" className="mr-2">{h.brand}</Badge>}
                  <span className="text-foreground mr-2">{h.productName}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">/{h.slug}</span>
                  <span className="text-muted-foreground ml-2">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All SEO generation runs locally in your browser. History is stored in localStorage on this device only. No product data ever leaves the page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string | number;
  hint?: string;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ScoreBar({ label, score, barClass }: { label: string; score: number; barClass: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{score}/100</span>
      </div>
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${barClass} transition-all`}
          style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
        />
      </div>
    </div>
  );
}

function barColorForLength(len: number, max: number): string {
  const ratio = len / max;
  if (ratio > 1) return "bg-red-500";
  if (ratio > 0.9) return "bg-amber-500";
  if (ratio < 0.4) return "bg-blue-500";
  return "bg-emerald-500";
}

function barColorForScore(score: number): string {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 75) return "bg-lime-500";
  if (score >= 50) return "bg-amber-500";
  if (score >= 25) return "bg-orange-500";
  return "bg-red-500";
}
