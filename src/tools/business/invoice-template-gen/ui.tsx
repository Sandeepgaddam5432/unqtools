"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  createInvoice,
  addItem,
  removeItem,
  lineTotal,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  amountDue,
  formatCurrency,
  exportInvoiceCSV,
  exportInvoiceText,
  validateInvoice,
  daysUntilDue,
  markPaid,
  type Invoice,
  type InvoiceParty,
  type TaxMode,
} from "./logic";

export default function InvoiceTemplateGen() {
  const [invoice, setInvoice] = useState<Invoice>(() => {
    let inv = createInvoice(
      { name: "Acme Co", email: "billing@acme.co", address: "1 Main St, San Francisco" },
      { name: "Client Inc", email: "ap@client.com", address: "2 Market St, New York" },
      "INV-001",
    );
    inv = addItem(inv, "Consulting hours", 10, 100);
    inv = addItem(inv, "Software licence", 1, 500);
    return inv;
  });
  const [desc, setDesc] = useState<string>("");
  const [qty, setQty] = useState<string>("1");
  const [price, setPrice] = useState<string>("100");
  const [error, setError] = useState<string>("");

  const warnings = useMemo(() => validateInvoice(invoice), [invoice]);
  const sub = subtotal(invoice);
  const disc = discountAmount(invoice);
  const tax = taxAmount(invoice);
  const tot = total(invoice);
  const due = amountDue(invoice);
  const days = daysUntilDue(invoice);

  const updateParty = (who: "issuer" | "client", field: keyof InvoiceParty, value: string) => {
    setInvoice((inv) => ({ ...inv, [who]: { ...inv[who], [field]: value } }));
  };

  const handleAdd = () => {
    if (!desc.trim()) {
      setError("Description required.");
      return;
    }
    setError("");
    setInvoice((inv) => addItem(inv, desc, Number(qty) || 0, Number(price) || 0));
    setDesc("");
    setQty("1");
    setPrice("100");
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold">Invoice {invoice.number}</h3>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px]">{invoice.status}</Badge>
              <Badge variant="outline" className="text-[10px]">{days > 0 ? `${days}d until due` : `${Math.abs(days)}d overdue`}</Badge>
              <button onClick={() => setInvoice((inv) => markPaid(inv))} className="px-2 py-0.5 text-[10px] rounded border border-border bg-muted/40 hover:bg-muted">Mark paid</button>
              <CopyButton getText={() => exportInvoiceText(invoice)} label="Copy text" />
              <DownloadButton getText={() => exportInvoiceCSV(invoice)} filename={`${invoice.number}.csv`} mime="text/csv" label="CSV" />
              <DownloadButton getText={() => exportInvoiceText(invoice)} filename={`${invoice.number}.txt`} label="TXT" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Issuer</Label>
              <input value={invoice.issuer.name} onChange={(e) => updateParty("issuer", "name", e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
              <input value={invoice.issuer.email} onChange={(e) => updateParty("issuer", "email", e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
              <input value={invoice.issuer.address} onChange={(e) => updateParty("issuer", "address", e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Client</Label>
              <input value={invoice.client.name} onChange={(e) => updateParty("client", "name", e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
              <input value={invoice.client.email} onChange={(e) => updateParty("client", "email", e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
              <input value={invoice.client.address} onChange={(e) => updateParty("client", "address", e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Number</Label>
              <input value={invoice.number} onChange={(e) => setInvoice((inv) => ({ ...inv, number: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <input value={invoice.currency} onChange={(e) => setInvoice((inv) => ({ ...inv, currency: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tax mode</Label>
              <select value={invoice.taxMode} onChange={(e) => setInvoice((inv) => ({ ...inv, taxMode: e.target.value as TaxMode }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs">
                <option value="none">None</option>
                <option value="flat">Flat %</option>
                <option value="bracket">Bracket</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Discount %</Label>
              <input type="number" step="0.01" value={invoice.discountRate * 100} onChange={(e) => setInvoice((inv) => ({ ...inv, discountRate: (Number(e.target.value) || 0) / 100 }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          {invoice.taxMode === "flat" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Flat tax rate %</Label>
              <input type="number" step="0.01" value={invoice.flatTaxRate * 100} onChange={(e) => setInvoice((inv) => ({ ...inv, flatTaxRate: (Number(e.target.value) || 0) / 100 }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Line items</Label>
          <div className="space-y-1">
            {invoice.items.map((i, idx) => (
              <div key={i.id} className="grid grid-cols-[40px_1fr_60px_100px_100px_60px] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                <span className="text-muted-500">{idx + 1}</span>
                <span>{i.description}</span>
                <code className="font-mono">{i.quantity}</code>
                <code className="font-mono">{formatCurrency(i.unitPrice, invoice.currency)}</code>
                <code className="font-mono font-medium">{formatCurrency(lineTotal(i), invoice.currency)}</code>
                <button onClick={() => setInvoice((inv) => removeItem(inv, i.id))} className="text-red-500 text-[10px] hover:underline">remove</button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" className="rounded-md border border-border bg-background px-3 py-1.5 text-xs sm:col-span-2" />
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" className="rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            <div className="flex gap-2">
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
              <button onClick={handleAdd} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90">+ Add</button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Totals</Label>
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <div className="space-y-1 text-xs">
            <div className="grid grid-cols-[1fr_120px] gap-2 py-1 border-b border-border/40">
              <span className="text-muted-foreground">Subtotal</span>
              <code className="font-mono text-right">{formatCurrency(sub, invoice.currency)}</code>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2 py-1 border-b border-border/40">
              <span className="text-muted-foreground">Discount ({(invoice.discountRate * 100).toFixed(1)}%)</span>
              <code className="font-mono text-right">-{formatCurrency(disc, invoice.currency)}</code>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2 py-1 border-b border-border/40">
              <span className="text-muted-foreground">Tax</span>
              <code className="font-mono text-right">{formatCurrency(tax, invoice.currency)}</code>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2 py-1 text-sm font-semibold">
              <span>TOTAL</span>
              <code className="font-mono text-right">{formatCurrency(tot, invoice.currency)}</code>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2 py-1">
              <span className="text-muted-foreground">Amount due</span>
              <code className="font-mono text-right">{formatCurrency(due, invoice.currency)}</code>
            </div>
          </div>
          <div className="space-y-1 pt-1">
            <Label className="text-xs text-muted-foreground">Terms</Label>
            <textarea value={invoice.terms} onChange={(e) => setInvoice((inv) => ({ ...inv, terms: e.target.value }))} rows={2} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
