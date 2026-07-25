"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { valueInventory, toCsv, type Item, type ValuationMethod } from "./logic";

export default function InventoryTracker() {
  const [items, setItems] = useState<Item[]>([
    {
      id: "1", name: "Widget", sku: "W-001", reorderPoint: 5, soldQty: 30,
      purchases: [
        { qty: 10, unitCost: 5, date: "2024-01-01" },
        { qty: 20, unitCost: 7, date: "2024-02-01" },
        { qty: 15, unitCost: 6, date: "2024-03-01" },
      ],
    },
  ]);
  const [method, setMethod] = useState<ValuationMethod>("FIFO");
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("10");
  const [newCost, setNewCost] = useState("5");
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => valueInventory(items, method), [items, method]);
  const csv = useMemo(() => toCsv(result), [result]);

  const addItem = () => {
    setError(null);
    const qty = Number(newQty);
    const cost = Number(newCost);
    if (!newName.trim()) { setError("Name is required"); return; }
    if (!Number.isFinite(qty) || qty <= 0) { setError("Quantity must be positive"); return; }
    if (!Number.isFinite(cost) || cost <= 0) { setError("Unit cost must be positive"); return; }
    const id = String(Date.now());
    setItems((prev) => [...prev, {
      id, name: newName.trim(), sku: `SKU-${id.slice(-4)}`,
      reorderPoint: 5, soldQty: 0,
      purchases: [{ qty, unitCost: cost, date: new Date().toISOString().slice(0, 10) }],
    }]);
    setNewName("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Valuation method</Label>
            <select value={method} onChange={(e) => setMethod(e.target.value as ValuationMethod)} className="mt-1 h-9 w-full text-sm rounded border bg-background px-2">
              <option value="FIFO">FIFO (first in, first out)</option>
              <option value="LIFO">LIFO (last in, first out)</option>
              <option value="AVG">AVG (weighted average)</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <Input placeholder="Item name" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-xs" />
            <Input type="number" placeholder="Qty" value={newQty} onChange={(e) => setNewQty(e.target.value)} className="h-8 text-xs" />
            <Input type="number" placeholder="Unit cost" value={newCost} onChange={(e) => setNewCost(e.target.value)} className="h-8 text-xs" />
            <Button size="sm" onClick={addItem}>Add item</Button>
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Valuation ({method})</p>
            <div className="flex gap-2">
              <CopyButton getText={() => csv} label="Copy CSV" />
              <DownloadButton getText={() => csv} filename="inventory.csv" mime="text/csv" label="Download" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Cell label="Total value" value={`$${result.totalValue}`} />
            <Cell label="Total COGS" value={`$${result.totalCogs}`} />
            <Cell label="On hand" value={String(result.totalOnHand)} />
            <Cell label="Reorders needed" value={String(result.reorderCount)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/80"><tr>
                <th className="p-2 text-left">Item</th>
                <th className="p-2 text-right">On hand</th>
                <th className="p-2 text-right">Unit cost</th>
                <th className="p-2 text-right">Value</th>
                <th className="p-2 text-right">COGS</th>
                <th className="p-2 text-center">Reorder?</th>
                <th className="p-2"></th>
              </tr></thead>
              <tbody>
                {result.items.map((v, i) => (
                  <tr key={v.id} className="border-t border-border/50">
                    <td className="p-2"><span className="font-medium">{v.name}</span><span className="ml-2 text-[10px] text-muted-foreground">{v.sku}</span></td>
                    <td className="p-2 text-right font-mono">{v.onHand}</td>
                    <td className="p-2 text-right font-mono">${v.unitCost}</td>
                    <td className="p-2 text-right font-mono">${v.inventoryValue}</td>
                    <td className="p-2 text-right font-mono">${v.cogs}</td>
                    <td className="p-2 text-center">{v.needsReorder ? <Badge variant="destructive" className="text-[10px]">yes</Badge> : <Badge variant="outline" className="text-[10px]">no</Badge>}</td>
                    <td className="p-2"><Button size="icon-sm" variant="ghost" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}>×</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all valuation runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value}</div>
    </div>
  );
}
