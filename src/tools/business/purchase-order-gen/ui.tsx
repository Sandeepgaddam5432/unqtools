"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  createVendor,
  createPO,
  addItem,
  removeItem,
  lineTotal,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  formatCurrency,
  validatePO,
  transitionStatus,
  exportPOCSV,
  exportPOText,
  poStats,
  daysUntilDelivery,
  isOverdue,
  type PurchaseOrder,
  type POStatus,
} from "./logic";

export default function PurchaseOrderGen() {
  const [po, setPO] = useState<PurchaseOrder>(() => {
    const v = createVendor("Acme Supplies Co", "orders@acmesupplies.com", "1 Industrial Way, Newark NJ", "555-1234", "TAX-99-1234567", "Net 30");
    let p = createPO(v, "PO-001", "Warehouse A, 100 Bay St");
    p = addItem(p, "SKU-1001", "Industrial widget", 50, 12.5);
    p = addItem(p, "SKU-1002", "Calibrated gadget", 10, 75);
    return p;
  });
  const [sku, setSku] = useState<string>("");
  const [desc, setDesc] = useState<string>("");
  const [qty, setQty] = useState<string>("1");
  const [price, setPrice] = useState<string>("10");
  const [approver, setApprover] = useState<string>("");
  const [error, setError] = useState<string>("");

  const warnings = useMemo(() => validatePO(po), [po]);
  const stats = useMemo(() => poStats(po), [po]);
  const sub = subtotal(po);
  const disc = discountAmount(po);
  const tax = taxAmount(po);
  const tot = total(po);
  const days = daysUntilDelivery(po);

  const handleAdd = () => {
    if (!desc.trim()) {
      setError("Description required.");
      return;
    }
    setError("");
    setPO((p) => addItem(p, sku, desc, Number(qty) || 0, Number(price) || 0));
    setSku("");
    setDesc("");
    setQty("1");
    setPrice("10");
  };

  const updateVendor = (field: keyof PurchaseOrder["vendor"], value: string) => {
    setPO((p) => ({ ...p, vendor: { ...p.vendor, [field]: value } }));
  };

  const handleTransition = (newStatus: POStatus) => {
    setPO((p) => transitionStatus(p, newStatus, approver || undefined));
  };

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-base font-semibold">PO {po.number}</h3>
              <p className="text-xs text-muted-foreground">
                Status: {po.status} · {days > 0 ? `${days}d to delivery` : `${Math.abs(days)}d overdue`}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {po.status === "draft" && <button onClick={() => handleTransition("submitted")} className="px-2 py-0.5 text-[10px] rounded border border-border bg-muted/40 hover:bg-muted">Submit</button>}
              {po.status === "submitted" && (
                <>
                  <input value={approver} onChange={(e) => setApprover(e.target.value)} placeholder="Approver name" className="px-2 py-0.5 text-[10px] rounded border border-border bg-background" />
                  <button onClick={() => handleTransition("approved")} className="px-2 py-0.5 text-[10px] rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:opacity-80">Approve</button>
                  <button onClick={() => handleTransition("rejected")} className="px-2 py-0.5 text-[10px] rounded border border-red-500/30 bg-red-500/10 text-red-700 hover:opacity-80">Reject</button>
                </>
              )}
              {po.status === "approved" && <button onClick={() => handleTransition("received")} className="px-2 py-0.5 text-[10px] rounded border border-border bg-muted/40 hover:bg-muted">Mark received</button>}
              {po.status === "received" && <button onClick={() => handleTransition("closed")} className="px-2 py-0.5 text-[10px] rounded border border-border bg-muted/40 hover:bg-muted">Close</button>}
              <CopyButton getText={() => exportPOText(po)} label="Copy" />
              <DownloadButton getText={() => exportPOCSV(po)} filename={`${po.number}.csv`} mime="text/csv" label="CSV" />
              <DownloadButton getText={() => exportPOText(po)} filename={`${po.number}.txt`} label="TXT" />
            </div>
          </div>
          {isOverdue(po) && (
            <p className="text-xs text-red-600 dark:text-red-400">⚠ PO is overdue (expected delivery passed).</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Vendor</Label>
              <input value={po.vendor.name} onChange={(e) => updateVendor("name", e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
              <input value={po.vendor.email} onChange={(e) => updateVendor("email", e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
              <input value={po.vendor.address} onChange={(e) => updateVendor("address", e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
              <input value={po.vendor.paymentTerms} onChange={(e) => updateVendor("paymentTerms", e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ship-to &amp; dates</Label>
              <input value={po.shipTo} onChange={(e) => setPO((p) => ({ ...p, shipTo: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
              <input value={po.number} onChange={(e) => setPO((p) => ({ ...p, number: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
              <input value={po.currency} onChange={(e) => setPO((p) => ({ ...p, currency: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Shipping cost</Label>
              <input type="number" value={po.shippingCost} onChange={(e) => setPO((p) => ({ ...p, shippingCost: Number(e.target.value) || 0 }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tax %</Label>
              <input type="number" step="0.01" value={po.taxRate * 100} onChange={(e) => setPO((p) => ({ ...p, taxRate: (Number(e.target.value) || 0) / 100 }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Discount %</Label>
              <input type="number" step="0.01" value={po.discountRate * 100} onChange={(e) => setPO((p) => ({ ...p, discountRate: (Number(e.target.value) || 0) / 100 }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Expected delivery</Label>
              <input type="date" value={new Date(po.expectedDeliveryAt).toISOString().slice(0, 10)} onChange={(e) => setPO((p) => ({ ...p, expectedDeliveryAt: new Date(e.target.value).getTime() }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Line items</Label>
          <div className="space-y-1">
            {po.items.map((i, idx) => (
              <div key={i.id} className="grid grid-cols-[40px_80px_1fr_50px_80px_100px_50px] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                <span className="text-muted-500">{idx + 1}</span>
                <code className="font-mono text-[10px]">{i.sku}</code>
                <span>{i.description}</span>
                <code className="font-mono">{i.quantity}</code>
                <code className="font-mono">{formatCurrency(i.unitPrice, po.currency)}</code>
                <code className="font-mono font-medium">{formatCurrency(lineTotal(i), po.currency)}</code>
                <button onClick={() => setPO((p) => removeItem(p, i.id))} className="text-red-500 text-[10px] hover:underline">remove</button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" className="rounded-md border border-border bg-background px-3 py-1.5 text-xs" />
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Label className="text-sm font-semibold">Totals</Label>
            <div className="text-xs text-muted-foreground">{stats.itemCount} items · {stats.totalQuantity} units</div>
          </div>
          {warnings.length > 0 && (
            <ul className="text-xs text-amber-700 dark:text-amber-400 list-disc pl-4">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <div className="space-y-1 text-xs">
            <div className="grid grid-cols-[1fr_120px] gap-2 py-1 border-b border-border/40">
              <span className="text-muted-foreground">Subtotal</span>
              <code className="font-mono text-right">{formatCurrency(sub, po.currency)}</code>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2 py-1 border-b border-border/40">
              <span className="text-muted-foreground">Discount</span>
              <code className="font-mono text-right">-{formatCurrency(disc, po.currency)}</code>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2 py-1 border-b border-border/40">
              <span className="text-muted-foreground">Tax</span>
              <code className="font-mono text-right">{formatCurrency(tax, po.currency)}</code>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2 py-1 border-b border-border/40">
              <span className="text-muted-foreground">Shipping</span>
              <code className="font-mono text-right">{formatCurrency(po.shippingCost, po.currency)}</code>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2 py-1 text-sm font-semibold">
              <span>TOTAL</span>
              <code className="font-mono text-right">{formatCurrency(tot, po.currency)}</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
