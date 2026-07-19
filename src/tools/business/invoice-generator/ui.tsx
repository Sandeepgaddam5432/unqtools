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
  TAX_PRESETS,
  DUE_DATE_PRESETS,
  parseLineItems,
  computeGrandTotal,
  formatCurrency,
  suggestInvoiceNumber,
  calculateDueDate,
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
  type InvoiceInput,
  type CurrencySymbol,
  type InvoiceHistoryEntry,
} from "./logic";
import { History, FileText, Calculator, Download } from "lucide-react";

const DEFAULT_INPUT: InvoiceInput = {
  fromName: "",
  fromEmail: "",
  fromAddress: "",
  toName: "",
  toEmail: "",
  toAddress: "",
  invoiceNumber: "",
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  lineItemsText: "Web design,10,75.00\nHosting,1,120.00",
  taxRate: 0,
  discountPercent: 0,
  currencySymbol: "$",
  notes: "",
};

export default function InvoiceGenerator() {
  const [input, setInput] = useState<InvoiceInput>(DEFAULT_INPUT);
  const [history, setHistory] = useState<InvoiceHistoryEntry[]>([]);
  const [pdfBusy, setPdfBusy] = useState(false);

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
  const totals = useMemo(
    () => computeGrandTotal(input),
    [input],
  );
  const stats = useMemo(() => summaryStats(totals), [totals]);
  const text = useMemo(() => renderText(input, totals), [input, totals]);
  const csv = useMemo(() => renderCsv(input, totals), [input, totals]);
  const html = useMemo(() => renderHtml(input, totals), [input, totals]);

  const update = useCallback((patch: Partial<InvoiceInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (totals.itemCount > 0) {
      saveHistory({
        ts: Date.now(),
        invoiceNumber: input.invoiceNumber || "(draft)",
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
      a.download = `${input.invoiceNumber || "invoice"}.pdf`;
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
    a.download = `${input.invoiceNumber || "invoice"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    handleSaveHistory();
    toast.success("HTML downloaded");
  }, [html, input.invoiceNumber, handleSaveHistory]);

  const handleSuggestInvoice = useCallback(() => {
    const seq = history.length + 1;
    update({ invoiceNumber: suggestInvoiceNumber(input.invoiceDate, seq) });
    toast.success("Invoice number suggested");
  }, [history.length, input.invoiceDate, update]);

  const handleNet = useCallback(
    (days: number) => {
      const due = calculateDueDate(input.invoiceDate, days);
      if (due) {
        update({ dueDate: due });
        toast.success(`Due date set (${days} days)`);
      }
    },
    [input.invoiceDate, update],
  );

  const handleClear = useCallback(() => {
    setInput({ ...DEFAULT_INPUT, invoiceDate: new Date().toISOString().slice(0, 10) });
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
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill To (Customer)</Label>
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
              <Label htmlFor="ig-inv">Invoice #</Label>
              <div className="flex gap-1">
                <Input
                  id="ig-inv"
                  value={input.invoiceNumber}
                  onChange={(e) => update({ invoiceNumber: e.target.value })}
                  placeholder="INV-2026-001"
                />
                <Button variant="outline" size="sm" onClick={handleSuggestInvoice} title="Auto-suggest">↻</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ig-date">Invoice date</Label>
              <Input
                id="ig-date"
                type="date"
                value={input.invoiceDate}
                onChange={(e) => update({ invoiceDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ig-due">Due date</Label>
              <Input
                id="ig-due"
                type="date"
                value={input.dueDate}
                onChange={(e) => update({ dueDate: e.target.value })}
              />
              <div className="flex gap-1">
                {DUE_DATE_PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => handleNet(p.days)}
                  >{p.label}</Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ig-items">Line items — one per line: <code className="font-mono text-[11px]">description,qty,unit_price</code></Label>
            <Textarea
              id="ig-items"
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

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ig-tax">Tax rate (%)</Label>
              <Input
                id="ig-tax"
                type="number"
                step="0.1"
                min="0"
                value={input.taxRate}
                onChange={(e) => update({ taxRate: Number(e.target.value) })}
              />
              <div className="flex flex-wrap gap-1">
                {TAX_PRESETS.map((t) => (
                  <Button
                    key={t}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => update({ taxRate: t })}
                  >{t}%</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ig-disc">Discount (%)</Label>
              <Input
                id="ig-disc"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={input.discountPercent}
                onChange={(e) => update({ discountPercent: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ig-cur">Currency</Label>
              <select
                id="ig-cur"
                value={input.currencySymbol}
                onChange={(e) => update({ currencySymbol: e.target.value as CurrencySymbol })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CURRENCY_PRESETS.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ig-notes">Notes (optional)</Label>
            <Textarea
              id="ig-notes"
              value={input.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Payment instructions, terms, thank-you note…"
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
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Items" value={String(stats.itemCount)} />
                <Stat label="Subtotal" value={formatCurrency(stats.subtotal, input.currencySymbol)} />
                <Stat label="Discount" value={`-${formatCurrency(stats.discountAmount, input.currencySymbol)}`} />
                <Stat label="Tax" value={formatCurrency(stats.taxAmount, input.currencySymbol)} />
                <Stat label="Total Qty" value={String(stats.totalQty)} />
                <Stat label="Avg Line" value={formatCurrency(stats.avgLineTotal, input.currencySymbol)} />
                <Stat label="Max Line" value={formatCurrency(stats.maxLineTotal, input.currencySymbol)} />
                <Stat label="TOTAL DUE" value={formatCurrency(stats.total, input.currencySymbol)} highlight="good" />
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
                  filename={`${input.invoiceNumber || "invoice"}.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter at least one line item to generate the invoice"
          hint="Use the format: description,qty,unit_price — one per line."
          icon={<FileText className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px] font-mono">{h.invoiceNumber}</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All invoice generation, calculation and PDF creation happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.
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
