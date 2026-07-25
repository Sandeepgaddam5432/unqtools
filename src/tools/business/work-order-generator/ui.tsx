"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { computeWorkOrder, renderWorkOrder, formatMoney, type LineItem } from "./logic";

export default function WorkOrderGenerator() {
  const [num, setNum] = useState("WO-001");
  const [customer, setCustomer] = useState("Acme Corp");
  const [labor, setLabor] = useState<LineItem[]>([{ description: "Repair", quantity: 2, unitPrice: 50 }]);
  const [materials, setMaterials] = useState<LineItem[]>([{ description: "Part", quantity: 1, unitPrice: 100 }]);
  const [taxRate, setTaxRate] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => {
    const r = computeWorkOrder({ workOrderNumber: num, customer, labor, materials, taxRate });
    if ("error" in r) { setError(r.error); return null; }
    setError(null);
    return r;
  }, [num, customer, labor, materials, taxRate]);

  const report = result ? renderWorkOrder({ workOrderNumber: num, customer, labor, materials, taxRate }, result) : "";

  const updateItem = (kind: "labor" | "materials", i: number, field: keyof LineItem, value: string) => {
    const list = kind === "labor" ? [...labor] : [...materials];
    list[i] = { ...list[i]!, [field]: field === "description" ? value : Number(value) };
    if (kind === "labor") setLabor(list); else setMaterials(list);
  };

  const Items = ({ kind, items }: { kind: "labor" | "materials"; items: LineItem[] }) => (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-4 gap-2">
          <input type="text" placeholder="Description" className="rounded-md border px-2 py-1 text-sm" value={it.description} onChange={(e) => updateItem(kind, i, "description", e.target.value)} />
          <input type="number" placeholder="Qty" className="rounded-md border px-2 py-1 text-sm" value={it.quantity} onChange={(e) => updateItem(kind, i, "quantity", e.target.value)} />
          <input type="number" placeholder="Unit price" className="rounded-md border px-2 py-1 text-sm" value={it.unitPrice} onChange={(e) => updateItem(kind, i, "unitPrice", e.target.value)} />
          <Button size="sm" variant="ghost" onClick={() => { const list = items.filter((_, j) => j !== i); if (kind === "labor") setLabor(list); else setMaterials(list); }}>Remove</Button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground">Work order #</Label><input type="text" className="w-full rounded-md border px-2 py-1 text-sm" value={num} onChange={(e) => setNum(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Customer</Label><input type="text" className="w-full rounded-md border px-2 py-1 text-sm" value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Tax rate (%)</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Labor</Label><Button size="sm" variant="outline" onClick={() => setLabor([...labor, { description: "", quantity: 1, unitPrice: 0 }])}>Add</Button></div>
          <Items kind="labor" items={labor} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Materials</Label><Button size="sm" variant="outline" onClick={() => setMaterials([...materials, { description: "", quantity: 1, unitPrice: 0 }])}>Add</Button></div>
          <Items kind="materials" items={materials} />
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{formatMoney(result.total)}</p>
              </div>
              <div className="flex gap-2">
                <CopyButton getText={() => report} />
                <DownloadButton getText={() => report} filename="work-order.txt" />
              </div>
            </div>
            <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap">{report}</pre>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
