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
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  AVAILABILITIES,
  AVAILABILITY_LABELS,
  defaultInput,
  validate,
  buildProductJsonLd,
  generateProductScript,
  generateCombinedHtml,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildScriptTag,
  checkCompliance,
  computeSummaryStats,
  renderTextReport,
  renderCsv,
  buildGoogleRichResultsLink,
  buildSchemaDocsLink,
  buildReviewDocsLink,
  buildGoogleProductReviewDocsLink,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ReviewInput,
  type Currency,
  type Availability,
  type HistoryEntry,
} from "./logic";
import { History, Star, ExternalLink, FileCode, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function ProductReviewSchemaGenerator() {
  const [input, setInput] = useState<ReviewInput>(defaultInput());
  const [includeFaq, setIncludeFaq] = useState(true);
  const [view, setView] = useState<"combined" | "product" | "breadcrumb" | "faq" | "report">("combined");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [submitted, setSubmitted] = useState(false);

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
  const compliance = useMemo(() => checkCompliance(input), [input]);
  const stats = useMemo(() => computeSummaryStats(input), [input]);

  const output = useMemo(() => {
    if (!validation.ok) return "";
    try {
      if (view === "combined") return generateCombinedHtml(input, includeFaq);
      if (view === "product") return generateProductScript(input);
      if (view === "breadcrumb") return buildScriptTag(buildBreadcrumbJsonLd(input));
      if (view === "faq") return includeFaq ? buildScriptTag(buildFaqJsonLd(input)) : "";
      if (view === "report") return renderTextReport(input, includeFaq);
      return "";
    } catch {
      return "";
    }
  }, [input, validation.ok, view, includeFaq]);

  const setField = useCallback(<K extends keyof ReviewInput>(key: K, value: ReviewInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleGenerate = useCallback(() => {
    setSubmitted(true);
    if (validation.ok) {
      saveHistory({
        ts: Date.now(),
        productName: input.productName,
        productBrand: input.productBrand,
        reviewRating: input.reviewRating,
        currency: input.productCurrency,
        hasAggregate: Boolean(input.aggregateRatingCount && input.aggregateRatingValue),
      });
      setHistory(loadHistory());
      toast.success("Schema generated");
    } else {
      toast.error(validation.errors[0] ?? "Validation failed");
    }
  }, [validation, input]);

  const handleClear = useCallback(() => {
    setInput(defaultInput());
    setSubmitted(false);
    setView("combined");
    toast.info("Form cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const jsonDownload = useMemo(() => {
    if (!validation.ok) return "{}";
    try {
      return JSON.stringify(buildProductJsonLd(input), null, 2);
    } catch {
      return "{}";
    }
  }, [input, validation.ok]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Product details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Product name *" value={input.productName} onChange={(v) => setField("productName", v)} placeholder="Wireless Headphones X1" id="pr-name" />
            <Field label="Product brand" value={input.productBrand} onChange={(v) => setField("productBrand", v)} placeholder="AudioPro" id="pr-brand" />
            <Field label="Product image URL" value={input.productImageUrl} onChange={(v) => setField("productImageUrl", v)} placeholder="https://example.com/photo.jpg" id="pr-img" />
            <Field label="Product URL" value={input.productUrl} onChange={(v) => setField("productUrl", v)} placeholder="https://example.com/product" id="pr-url" />
            <Field label="Category" value={input.productCategory} onChange={(v) => setField("productCategory", v)} placeholder="Headphones" id="pr-cat" />
            <Field label="SKU (optional)" value={input.productSku} onChange={(v) => setField("productSku", v)} placeholder="AP-X1-BLK" id="pr-sku" />
            <Field label="GTIN (optional, EAN/UPC)" value={input.productGtin} onChange={(v) => setField("productGtin", v)} placeholder="0123456789012" id="pr-gtin" />
            <Field label="Price" value={input.productPrice} onChange={(v) => setField("productPrice", v)} placeholder="199.99" id="pr-price" />
            <div className="space-y-1.5">
              <Label htmlFor="pr-currency" className="text-xs">Currency</Label>
              <Select value={input.productCurrency} onValueChange={(v) => setField("productCurrency", v as Currency)}>
                <SelectTrigger id="pr-currency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{CURRENCY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-avail" className="text-xs">Availability</Label>
              <Select value={input.productAvailability} onValueChange={(v) => setField("productAvailability", v as Availability)}>
                <SelectTrigger id="pr-avail"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AVAILABILITIES.map((a) => (
                    <SelectItem key={a} value={a}>{AVAILABILITY_LABELS[a]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <FieldArea label="Description" value={input.productDescription} onChange={(v) => setField("productDescription", v)} placeholder="Premium wireless headphones with ANC." id="pr-desc" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Single review</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Review author *" value={input.reviewAuthor} onChange={(v) => setField("reviewAuthor", v)} placeholder="Jane Reviewer" id="pr-author" />
            <Field label="Review rating (1-5) *" value={input.reviewRating} onChange={(v) => setField("reviewRating", v)} placeholder="4.5" id="pr-rating" />
            <Field label="Review date (YYYY-MM-DD)" value={input.reviewDate} onChange={(v) => setField("reviewDate", v)} placeholder="2024-01-15" id="pr-date" type="date" />
          </div>
          <FieldArea label="Review body" value={input.reviewBody} onChange={(v) => setField("reviewBody", v)} placeholder="Detailed review of the product..." id="pr-body" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Aggregate rating (optional)</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total review count" value={input.aggregateRatingCount} onChange={(v) => setField("aggregateRatingCount", v)} placeholder="127" id="pr-count" />
            <Field label="Average rating value" value={input.aggregateRatingValue} onChange={(v) => setField("aggregateRatingValue", v)} placeholder="4.5" id="pr-value" />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={includeFaq}
              onChange={(e) => setIncludeFaq(e.target.checked)}
            />
            Include FAQPage companion schema (3 auto-generated questions)
          </label>
        </CardContent>
      </Card>

      {submitted && !validation.ok && (
        <ErrorBanner message={validation.errors.join("; ")} />
      )}
      {validation.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
          {validation.warnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Star className="h-4 w-4" /> Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Required fields" value={`${stats.requiredProvided}/${stats.requiredTotal}`} highlight={stats.requiredProvided === stats.requiredTotal ? "good" : "bad"} />
            <Stat label="Recommended fields" value={`${stats.recommendedProvided}/${stats.recommendedTotal}`} />
            <Stat label="Validation" value={stats.validationStatus} highlight={stats.validationStatus === "pass" ? "good" : "bad"} />
            <Stat label="Compliance" value={stats.complianceStatus} highlight={stats.complianceStatus === "compliant" ? "good" : "bad"} />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {stats.extras.map((e) => (
              <Badge key={e.label} variant="outline" className="text-[10px]">{e.label}: {e.value}</Badge>
            ))}
          </div>
          {compliance.failed.length > 0 && (
            <div className="text-xs text-red-600 dark:text-red-400 pt-2">
              <div className="font-medium flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Failed checks ({compliance.failed.length})</div>
              <ul className="ml-5 list-disc">
                {compliance.failed.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
          {compliance.recommendations.length > 0 && (
            <div className="text-xs text-amber-700 dark:text-amber-400 pt-1">
              <div className="font-medium">Recommendations ({compliance.recommendations.length})</div>
              <ul className="ml-5 list-disc">
                {compliance.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          {compliance.passed.length > 0 && (
            <div className="text-xs text-emerald-700 dark:text-emerald-400 pt-1">
              <div className="font-medium flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Passed ({compliance.passed.length})</div>
              <ul className="ml-5 list-disc">
                {compliance.passed.slice(0, 5).map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleGenerate} disabled={!validation.ok}>Generate schema</Button>
        <ShareButton getUrl={() => buildShareUrl(input)} />
        <ClearButton onClick={handleClear} />
      </div>

      {output ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileCode className="h-4 w-4" /> Output
              </h3>
              <div className="flex flex-wrap gap-1">
                {(["combined", "product", "breadcrumb", "faq", "report"] as const).map((v) => (
                  <Button
                    key={v}
                    variant={view === v ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs capitalize"
                    onClick={() => setView(v)}
                  >
                    {v === "combined" ? "Combined HTML" : v === "product" ? "Product" : v === "breadcrumb" ? "Breadcrumb" : v === "faq" ? "FAQ" : "Text report"}
                  </Button>
                ))}
              </div>
            </div>
            <pre className="text-xs font-mono bg-muted/40 rounded p-3 overflow-auto max-h-[600px] whitespace-pre-wrap break-all">{output}</pre>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleGenerate(); return output; }} label="Copy" />
              <DownloadButton
                getText={() => jsonDownload}
                filename="product-review.json"
                mime="application/json"
                label="Download .json"
              />
              <DownloadButton
                getText={() => generateCombinedHtml(input, includeFaq)}
                filename="product-review-schema.html"
                mime="text/html"
                label="Download .html"
              />
              <DownloadButton
                getText={() => renderTextReport(input, includeFaq)}
                filename="product-review-report.txt"
                mime="text/plain"
                label="Download report"
              />
              <DownloadButton
                getText={() => renderCsv(input)}
                filename="product-review-fields.csv"
                mime="text/csv"
                label="Download CSV"
              />
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={buildGoogleRichResultsLink()} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Rich Results test
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <a href={buildSchemaDocsLink()} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Product docs
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <a href={buildReviewDocsLink()} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Review docs
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <a href={buildGoogleProductReviewDocsLink()} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Google docs
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Fill in product + review details to generate JSON-LD"
          hint="Required: product name, review author, review rating (1-5). Recommended: brand, image, URL, price."
          icon={<Star className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.reviewRating || "—"}★</Badge>
                  <Badge variant="outline" className="mr-2">{h.currency}</Badge>
                  {h.hasAggregate && <Badge variant="outline" className="mr-2">aggregate</Badge>}
                  <span className="text-foreground">{h.productName || "(unnamed)"}</span>
                  {h.productBrand && <span className="text-muted-foreground"> · {h.productBrand}</span>}
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All JSON-LD generation runs locally in your browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  id,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-xs" />
    </div>
  );
}

function FieldArea({
  label,
  value,
  onChange,
  placeholder,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-h-[80px] resize-y text-xs" />
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
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
    </div>
  );
}
