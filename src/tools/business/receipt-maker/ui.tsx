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
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  CURRENCY_PRESETS,
  parseItems,
  computeTotals,
  formatCurrency,
  suggestReceiptNumber,
  validateReference,
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
  type ReceiptInput,
  type PaymentMethod,
  type CurrencySymbol,
  type ReceiptHistoryEntry,
} from "./logic";
import { History, Receipt as ReceiptIcon, Calculator, Download, CheckCircle2, AlertTriangle } from "lucide-react";

const DEFAULT_INPUT: ReceiptInput = {
  receiptNumber: "",
  receiptDate: new Date().toISOString().slice(0, 10),
  paymentMethod: "cash",
  payerName: "",
  payerEmail: "",
  payeeName: "",
  payeeAddress: "",
  itemsText: "Web design,750.00\nHosting,120.00",
  paymentAmount: 0,
  currencySymbol: "$",
  referenceNumber: "",
  notes: "",
};

export default function ReceiptMaker() {
  const [input, setInput] = useState<ReceiptInput>(DEFAULT_INPUT);
  const [history, setHistory] = useState<ReceiptHistoryEntry[]>([]);
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

  const parsed = useMemo(() => parseItems(input.itemsText), [input.itemsText]);
  const totals = useMemo(() => computeTotals(input), [input]);
  const stats = useMemo(() => summaryStats(totals, input.paymentMethod), [totals, input.paymentMethod]);
  const text = useMemo(() => renderText(input, totals), [input, totals]);
  const csv = useMemo(() => renderCsv(input, totals), [input, totals]);
  const html = useMemo(() => renderHtml(input, totals), [input, totals]);

  const update = useCallback((patch: Partial<ReceiptInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (totals.itemCount > 0) {
      saveHistory({
        ts: Date.now(),
        receiptNumber: input.receiptNumber || "(draft)",
        total: totals.total,
        currencySymbol: input.currencySymbol,
        paymentMethod: input.paymentMethod,
        status: totals.payment.status,
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
      a.download = `${input.receiptNumber || "receipt"}.pdf`;
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
    a.download = `${input.receiptNumber || "receipt"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    handleSaveHistory();
    toast.success("HTML downloaded");
  }, [html, input.receiptNumber, handleSaveHistory]);

  const handleSuggestReceipt = useCallback(() => {
    const seq = history.length + 1;
    update({ receiptNumber: suggestReceiptNumber(input.receiptDate, seq) });
    toast.success("Receipt number suggested");
  }, [history.length, input.receiptDate, update]);

  const handleClear = useCallback(() => {
    setInput({ ...DEFAULT_INPUT, receiptDate: new Date().toISOString().slice(0, 10) });
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const statusColor =
    stats.status === "matched"
      ? "text-emerald-600 dark:text-emerald-400"
      : stats.status === "unpaid"
        ? "text-red-600 dark:text-red-400"
        : "text-amber-600 dark:text-amber-400";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Received From (Payer)</Label>
              <Input
                placeholder="Payer name"
                value={input.payerName}
                onChange={(e) => update({ payerName: e.target.value })}
              />
              <Input
                placeholder="payer@example.com"
                value={input.payerEmail}
                onChange={(e) => update({ payerEmail: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paid To (Payee)</Label>
              <Input
                placeholder="Payee / business name"
                value={input.payeeName}
                onChange={(e) => update({ payeeName: e.target.value })}
              />
              <Textarea
                placeholder="Address"
                value={input.payeeAddress}
                onChange={(e) => update({ payeeAddress: e.target.value })}
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
              <Label htmlFor="rm-num">Receipt #</Label>
              <div className="flex gap-1">
                <Input
                  id="rm-num"
                  value={input.receiptNumber}
                  onChange={(e) => update({ receiptNumber: e.target.value })}
                  placeholder="RCT-2026-001"
                />
                <Button variant="outline" size="sm" onClick={handleSuggestReceipt} title="Auto-suggest">↻</Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rm-date">Receipt date</Label>
              <Input
                id="rm-date"
                type="date"
                value={input.receiptDate}
                onChange={(e) => update({ receiptDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rm-method">Payment method</Label>
              <select
                id="rm-method"
                value={input.paymentMethod}
                onChange={(e) => update({ paymentMethod: e.target.value as PaymentMethod })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rm-amt">Payment amount</Label>
              <Input
                id="rm-amt"
                type="number"
                step="0.01"
                min="0"
                value={input.paymentAmount}
                onChange={(e) => update({ paymentAmount: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rm-cur">Currency</Label>
              <select
                id="rm-cur"
                value={input.currencySymbol}
                onChange={(e) => update({ currencySymbol: e.target.value as CurrencySymbol })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CURRENCY_PRESETS.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rm-ref">Reference # (optional)</Label>
              <Input
                id="rm-ref"
                value={input.referenceNumber}
                onChange={(e) => update({ referenceNumber: e.target.value })}
                placeholder={input.paymentMethod === "credit-card" || input.paymentMethod === "debit-card"
                  ? "Last 4 digits"
                  : input.paymentMethod === "check"
                    ? "Check #"
                    : input.paymentMethod === "stripe"
                      ? "ch_xxx / pi_xxx"
                      : "Transaction ID"}
              />
              {input.referenceNumber && !totals.referenceValid && totals.referenceError && (
                <div className="text-xs text-red-600 dark:text-red-400">⚠ {totals.referenceError}</div>
              )}
              {input.referenceNumber && totals.referenceValid && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Valid reference format
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rm-items">Line items — one per line: <code className="font-mono text-[11px]">description,amount</code></Label>
            <Textarea
              id="rm-items"
              value={input.itemsText}
              onChange={(e) => update({ itemsText: e.target.value })}
              placeholder={"Web design,750.00\nHosting,120.00"}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
            {parsed.errors.length > 0 && (
              <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                {parsed.errors.map((e, i) => (<div key={i}>⚠ {e}</div>))}
              </div>
            )}
            {parsed.items.length > 0 && (
              <div className="text-[11px] text-muted-foreground">
                {parsed.items.length} valid item(s) · total {formatCurrency(totals.total, input.currencySymbol)}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rm-notes">Notes (optional)</Label>
            <Textarea
              id="rm-notes"
              value={input.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Thank-you note, payment terms, references…"
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
                <Stat label="Total" value={formatCurrency(stats.total, input.currencySymbol)} />
                <Stat label="Payment" value={formatCurrency(stats.payment, input.currencySymbol)} />
                <Stat
                  label="Difference"
                  value={formatCurrency(stats.difference, input.currencySymbol)}
                  highlight={stats.difference === 0 ? "good" : "bad"}
                />
                <Stat label="Avg Item" value={formatCurrency(stats.avgItemAmount, input.currencySymbol)} />
                <Stat label="Max Item" value={formatCurrency(stats.maxItemAmount, input.currencySymbol)} />
                <Stat label="Min Item" value={formatCurrency(stats.minItemAmount, input.currencySymbol)} />
                <Stat label="Status" value={stats.status.toUpperCase()} highlight={stats.status === "matched" ? "good" : "bad"} />
              </div>

              {totals.payment.warning && (
                <div className="flex items-start gap-2 rounded border border-amber-300/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{totals.payment.warning}</span>
                </div>
              )}

              <div className="rounded border bg-background">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 text-left">
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.items.map((it, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5">{it.description}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(it.amount, input.currencySymbol)}</td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/20">
                      <td className="px-3 py-2 font-semibold">TOTAL</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(totals.total, input.currencySymbol)}</td>
                    </tr>
                    <tr className="border-t">
                      <td className="px-3 py-1.5">Payment received</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatCurrency(totals.payment.payment, input.currencySymbol)}</td>
                    </tr>
                    {totals.payment.difference !== 0 && (
                      <tr className="border-t">
                        <td className="px-3 py-1.5">Balance due</td>
                        <td className={`px-3 py-1.5 text-right font-mono ${statusColor}`}>
                          {formatCurrency(totals.payment.difference, input.currencySymbol)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ReceiptIcon className="h-4 w-4" /> Text Preview
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
                  filename={`${input.receiptNumber || "receipt"}.csv`}
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
          title="Enter at least one line item to generate the receipt"
          hint="Use the format: description,amount — one per line. Then enter the payment amount and method."
          icon={<ReceiptIcon className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px] font-mono">{h.receiptNumber}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{formatCurrency(h.total, h.currencySymbol)}</Badge>
                  <Badge variant="outline" className="text-[10px]">{PAYMENT_METHOD_LABELS[h.paymentMethod]}</Badge>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${h.status === "matched" ? "text-emerald-600 dark:text-emerald-400" : h.status === "unpaid" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}
                  >
                    {h.status}
                  </Badge>
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
            <strong className="text-foreground">Privacy:</strong> All receipt generation, calculation, validation and PDF creation happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.
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
