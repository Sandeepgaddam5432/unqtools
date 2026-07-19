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
  CURRENCY_PRESETS,
  VALIDITY_PRESETS,
  parseLineItems,
  computeGrandTotal,
  formatCurrency,
  suggestQuoteNumber,
  calculateValidUntil,
  validityDays,
  quoteToInvoice,
  renderText,
  renderCsv,
  renderHtml,
  generatePdf,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  summaryStats,
  type QuoteInput,
  type CurrencySymbol,
  type QuoteHistoryEntry,
} from "./logic";
import { History, Receipt, Calculator, Download, FileText, ArrowRightLeft } from "lucide-react";

const DEFAULT_INPUT: QuoteInput = {
  fromName: "",
  fromEmail: "",
  fromAddress: "",
  toName: "",
  toEmail: "",
  toAddress: "",
  quoteNumber: "",
  quoteDate: new Date().toISOString().slice(0, 10),
  validUntil: "",
  lineItemsText: "Web design,10,75.00\nHosting,1,120.00",
  discountPercent: 0,
  currencySymbol: "$",
  termsAndConditions: "50% deposit due on acceptance. Balance due on completion.",
  notes: "",
};

export default function QuoteGenerator() {
  const [input, setInput] = useState<QuoteInput>(DEFAULT_INPUT);
  const [history, setHistory] = useState<QuoteHistoryEntry[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [invoiceJson, setInvoiceJson] = useState("");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed }));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parseLineItems(input.lineItemsText), [input.lineItemsText]);
  const totals = useMemo(() => computeGrandTotal(input), [input]);
  const stats = useMemo(
    () => summaryStats(totals, input.quoteDate, input.validUntil),
    [totals, input.quoteDate, input.validUntil],
  );
  const text = useMemo(() => renderText(input, totals), [input, totals]);
  const csv = useMemo(() => renderCsv(input, totals), [input, totals]);
  const html = useMemo(() => renderHtml(input, totals), [input, totals]);

  const update = useCallback((patch: Partial<QuoteInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (totals.itemCount > 0) {
      saveHistory({
        ts: Date.now(),
        quoteNumber: input.quoteNumber || "(draft)",
        total: totals.total,
        currencySymbol: input.currencySymbol,
        itemCount: totals.itemCount,
      });
      setHistory(loadHistory());
    }
  }, [totals, input]);

  const handleDownloadPdf = useCallback(async () => {
    if (totals.itemCount === 0) {
      toast.error("Add at least one line item");
      return;
    }
    setPdfBusy(true);
    try {
      const bytes = await generatePdf(input, totals);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${input.quoteNumber || "quote"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      handleSaveHistory();
      toast.success("PDF downloaded");
    } catch {
      toast.error("Could not generate PDF");
    } finally {
      setPdfBusy(false);
    }
  }, [input, totals, handleSaveHistory]);

  const handleDownloadHtml = useCallback(() => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${input.quoteNumber || "quote"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    handleSaveHistory();
    toast.success("HTML downloaded");
  }, [html, input.quoteNumber, handleSaveHistory]);

  const handleSuggestQuote = useCallback(() => {
    const seq = history.length + 1;
    update({ quoteNumber: suggestQuoteNumber(input.quoteDate, seq) });
    toast.success("Quote number suggested");
  }, [history.length, input.quoteDate, update]);

  const handleValidity = useCallback(
    (days: number) => {
      const valid = calculateValidUntil(input.quoteDate, days);
      if (valid) {
        update({ validUntil: valid });
        toast.success(`Valid until set (${days} days)`);
      }
    },
    [input.quoteDate, update],
  );

  const handleConvertToInvoice = useCallback(() => {
    const payload = quoteToInvoice(input, { taxRate: 0, dueDays: 30 });
    setInvoiceJson(JSON.stringify(payload, null, 2));
    toast.success("Converted to invoice payload — copy & paste into the Invoice Generator");
  }, [input]);

  const handleClear = useCallback(() => {
    setInput({ ...DEFAULT_INPUT, quoteDate: new Date().toISOString().slice(0, 10) });
    setInvoiceJson("");
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
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">From (Your Business)</Label>
              <Input
                placeholder="Business name"
                value={input.fromName}
                onChange={(e) => update({ fromName: e.target.value })}
              />
              <Input
                placeholder="email@example.com"
                value={input.fromEmail}
                onChange={(e) => update({ fromEmail: e.target.value })}
              />
              <Textarea
                placeholder="Address"
                value={input.fromAddress}
                onChange={(e) => update({ fromAddress: e.target.value })}
                className="min-h-[60px] resize-y text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prepared For (Prospect)</Label>
              <Input
                placeholder="Customer name"
                value={input.toName}
                onChange={(e) => update({ toName: e.target.value })}
              />
              <Input
                placeholder="customer@example.com"
                value={input.toEmail}
                onChange={(e) => update({ toEmail: e.target.value })}
              />
              <Textarea
                placeholder="Address"
                value={input.toAddress}
                onChange={(e) => update({ toAddress: e.target.value })}
                className="min-h-[60px] resize-y text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qg-quo">Quote #</Label>
              <div className="flex gap-1">
                <Input
                  id="qg-quo"
                  value={input.quoteNumber}
                  onChange={(e) => update({ quoteNumber: e.target.value })}
                  placeholder="QUO-2026-001"
                />
                <Button variant="outline" size="sm" onClick={handleSuggestQuote} title="Auto-suggest">↻</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qg-date">Quote date</Label>
              <Input
                id="qg-date"
                type="date"
                value={input.quoteDate}
                onChange={(e) => update({ quoteDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qg-valid">Valid until</Label>
              <Input
                id="qg-valid"
                type="date"
                value={input.validUntil}
                onChange={(e) => update({ validUntil: e.target.value })}
              />
              <div className="flex flex-wrap gap-1">
                {VALIDITY_PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => handleValidity(p.days)}
                  >{p.label}</Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qg-items">Line items — one per line: <code className="font-mono text-[11px]">description,qty,unit_price</code></Label>
            <Textarea
              id="qg-items"
              value={input.lineItemsText}
              onChange={(e) => update({ lineItemsText: e.target.value })}
              placeholder={"Web design,10,75.00\nHosting,1,120.00"}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
            {parsed.errors.length > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                {parsed.errors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
              </div>
            )}
            {parsed.items.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                {parsed.items.length} valid item(s) · total qty {stats.totalQty}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qg-disc">Discount (%)</Label>
              <Input
                id="qg-disc"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={input.discountPercent}
                onChange={(e) => update({ discountPercent: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qg-cur">Currency</Label>
              <select
                id="qg-cur"
                value={input.currencySymbol}
                onChange={(e) => update({ currencySymbol: e.target.value as CurrencySymbol })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CURRENCY_PRESETS.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qg-terms">Terms &amp; Conditions</Label>
            <Textarea
              id="qg-terms"
              value={input.termsAndConditions}
              onChange={(e) => update({ termsAndConditions: e.target.value })}
              placeholder="50% deposit due on acceptance. Balance due on completion."
              className="min-h-[60px] resize-y text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qg-notes">Notes (optional)</Label>
            <Textarea
              id="qg-notes"
              value={input.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Thank-you note, scope clarifications…"
              className="min-h-[50px] resize-y text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {totals.itemCount > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Calculator className="h-4 w-4" /> Summary
                {stats.isExpired && (
                  <Badge variant="destructive" className="text-[10px] ml-2">Expired</Badge>
                )}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Items" value={String(stats.itemCount)} />
                <Stat label="Subtotal" value={formatCurrency(stats.subtotal, input.currencySymbol)} />
                <Stat label="Discount" value={`-${formatCurrency(stats.discountAmount, input.currencySymbol)}`} />
                <Stat label="Validity" value={stats.validityDays !== null ? `${stats.validityDays} days` : "—"} />
                <Stat label="Total Qty" value={String(stats.totalQty)} />
                <Stat label="Avg Line" value={formatCurrency(stats.avgLineTotal, input.currencySymbol)} />
                <Stat label="Max Line" value={formatCurrency(stats.maxLineTotal, input.currencySymbol)} />
                <Stat label="TOTAL" value={formatCurrency(stats.total, input.currencySymbol)} highlight="good" />
              </div>

              <div className="rounded border bg-background">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-left">
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium text-right">Qty</th>
                      <th className="px-3 py-2 font-medium text-right">Unit</th>
                      <th className="px-3 py-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.lineItems.map((it, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5">{it.description}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{it.qty}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(it.unitPrice, input.currencySymbol)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(it.total, input.currencySymbol)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Text Preview
              </h3>
              <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[300px] whitespace-pre-wrap">
                {text}
              </pre>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return text; }}
                  label="Copy text"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDownloadPdf()}
                  disabled={pdfBusy}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  {pdfBusy ? "Generating…" : "Download PDF"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadHtml}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> Download HTML
                </Button>
                <DownloadButton
                  getText={() => { handleSaveHistory(); return csv; }}
                  filename={`${input.quoteNumber || "quote"}.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConvertToInvoice}
                  className="gap-1.5"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" /> To Invoice
                </Button>
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {invoiceJson && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ArrowRightLeft className="h-4 w-4" /> Invoice Payload (JSON)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Copy this JSON and paste it into the Invoice Generator&apos;s share-URL or a future &quot;Load from JSON&quot; importer.
                  Default tax rate is 0% and due date is Net 30 from the quote date — adjust as needed after import.
                </p>
                <pre className="rounded border bg-muted/20 p-3 text-[11px] font-mono overflow-auto max-h-[260px] whitespace-pre-wrap">
                  {invoiceJson}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => invoiceJson} label="Copy JSON" />
                  <DownloadButton
                    getText={() => invoiceJson}
                    filename={`${input.quoteNumber || "quote"}-to-invoice.json`}
                    mime="application/json"
                    label="Download JSON"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Enter at least one line item to generate the quote"
          hint="Use the format: description,qty,unit_price — one per line. Quotes exclude tax by default."
          icon={<Receipt className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono">{h.quoteNumber}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{formatCurrency(h.total, h.currencySymbol)}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.itemCount} items</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All quote generation, calculation and PDF creation happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
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
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
