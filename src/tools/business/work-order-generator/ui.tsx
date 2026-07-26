"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  computeWorkOrder,
  renderWorkOrder,
  toCsv,
  computeBatch,
  batchStats,
  batchToCsv,
  formatMoney,
  lineTotal,
  type LineItem,
  type WorkOrderInput,
  type DiscountType,
} from "./logic";

const SAMPLE_INPUT: WorkOrderInput = {
  workOrderNumber: "WO-001",
  customer: "Acme Corp",
  labor: [{ description: "Repair", quantity: 2, unitPrice: 50 }],
  materials: [{ description: "Part", quantity: 1, unitPrice: 100 }],
  taxRate: 10,
};

export default function WorkOrderGenerator() {
  const [num, setNum] = useState("WO-001");
  const [customer, setCustomer] = useState("Acme Corp");
  const [labor, setLabor] = useState<LineItem[]>([{ description: "Repair", quantity: 2, unitPrice: 50 }]);
  const [materials, setMaterials] = useState<LineItem[]>([{ description: "Part", quantity: 1, unitPrice: 100 }]);
  const [taxRate, setTaxRate] = useState(10);
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [notes, setNotes] = useState("");
  const [batchText, setBatchText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const input: WorkOrderInput = useMemo(() => ({
    workOrderNumber: num,
    customer,
    labor,
    materials,
    taxRate,
    discount: discountValue > 0 ? { type: discountType, value: discountValue } : undefined,
    notes,
  }), [num, customer, labor, materials, taxRate, discountType, discountValue, notes]);

  const result = useMemo(() => {
    const r = computeWorkOrder(input);
    queueMicrotask(() => setError("error" in r ? r.error : null));
    return r;
  }, [input]);

  const report = useMemo(() => ("error" in result ? "" : renderWorkOrder(input, result)), [input, result]);

  const updateItem = (kind: "labor" | "materials", i: number, field: keyof LineItem, value: string) => {
    const list = kind === "labor" ? [...labor] : [...materials];
    list[i] = { ...list[i]!, [field]: field === "description" ? value : Number(value) };
    if (kind === "labor") setLabor(list); else setMaterials(list);
  };

  const Items = ({ kind, items }: { kind: "labor" | "materials"; items: LineItem[] }) => (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <input type="text" placeholder="Description" className="col-span-5 rounded-md border px-2 py-1 text-sm" value={it.description} onChange={(e) => updateItem(kind, i, "description", e.target.value)} />
          <input type="number" placeholder="Qty" className="col-span-2 rounded-md border px-2 py-1 text-sm" value={it.quantity} onChange={(e) => updateItem(kind, i, "quantity", e.target.value)} />
          <input type="number" placeholder="Unit price" className="col-span-2 rounded-md border px-2 py-1 text-sm" value={it.unitPrice} onChange={(e) => updateItem(kind, i, "unitPrice", e.target.value)} />
          <span className="col-span-2 text-sm font-mono text-muted-foreground text-right">{formatMoney(lineTotal(it))}</span>
          <Button size="sm" variant="ghost" className="col-span-1" onClick={() => { const list = items.filter((_, j) => j !== i); if (kind === "labor") setLabor(list); else setMaterials(list); }}>×</Button>
        </div>
      ))}
    </div>
  );

  const batchInputs = useMemo<WorkOrderInput[]>(() => {
    return batchText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const [n, c] = line.split(/[,\t]+/);
        return { ...SAMPLE_INPUT, workOrderNumber: n ?? "", customer: (c ?? "").trim() };
      });
  }, [batchText]);

  const batchResults = useMemo(() => computeBatch(batchInputs), [batchInputs]);
  const stats = useMemo(() => batchStats(batchResults), [batchResults]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground">Work order #</Label><input type="text" className="w-full rounded-md border px-2 py-1 text-sm" value={num} onChange={(e) => setNum(e.target.value)} /></div>
            <div><Label className="text-xs text-muted-foreground">Customer</Label><input type="text" className="w-full rounded-md border px-2 py-1 text-sm" value={customer} onChange={(e) => setCustomer(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs text-muted-foreground">Tax rate (%)</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} /></div>
            <div>
              <Label className="text-xs text-muted-foreground">Discount type</Label>
              <select className="w-full h-9 rounded-md border bg-background px-2 text-sm" value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)}>
                <option value="percent">percent</option>
                <option value="fixed">fixed ($)</option>
              </select>
            </div>
            <div><Label className="text-xs text-muted-foreground">Discount value</Label><input type="number" className="w-full rounded-md border px-2 py-1 text-sm" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} /></div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Notes (optional)</Label><textarea className="w-full rounded-md border px-2 py-1 text-sm min-h-[40px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Labor</Label><Button size="sm" variant="outline" onClick={() => setLabor([...labor, { description: "", quantity: 1, unitPrice: 0 }])}>+ Add</Button></div>
          <Items kind="labor" items={labor} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Materials</Label><Button size="sm" variant="outline" onClick={() => setMaterials([...materials, { description: "", quantity: 1, unitPrice: 0 }])}>+ Add</Button></div>
          <Items kind="materials" items={materials} />
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && !("error" in result) && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Labor subtotal</p><p className="text-sm font-bold font-mono">{formatMoney(result.laborSubtotal)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Materials subtotal</p><p className="text-sm font-bold font-mono">{formatMoney(result.materialsSubtotal)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Tax ({taxRate}%)</p><p className="text-sm font-bold font-mono">{formatMoney(result.tax)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-sm font-bold font-mono text-primary">{formatMoney(result.total)}</p></CardContent></Card>
          </div>
          {result.discountAmount > 0 && (
            <Card><CardContent className="p-3 text-xs"><Badge variant="outline" className="mr-2">Discount</Badge>−{formatMoney(result.discountAmount)} applied to subtotal ({formatMoney(result.taxableBase)} taxable)</CardContent></Card>
          )}
          {result.warnings.length > 0 && (
            <Card><CardContent className="p-3 text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Work order preview</CardTitle>
                <div className="flex gap-2">
                  <CopyButton getText={() => report} />
                  <DownloadButton getText={() => report} filename={`work-order-${num}.txt`} />
                  <DownloadButton getText={() => toCsv(input, result)} filename={`work-order-${num}.csv`} mime="text/csv" label="Download CSV" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap">{report}</pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch mode (one entry per line: &lt;number&gt;, &lt;customer&gt;)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono"
            placeholder={"WO-001, Acme Corp\nWO-002, Globex Inc"}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
          />
          {batchResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline">{stats.total} orders</Badge>
                  <Badge variant="secondary">{stats.valid} valid</Badge>
                  {stats.errors > 0 && <Badge variant="destructive">{stats.errors} errors</Badge>}
                  <Badge variant="outline">total {formatMoney(stats.grandTotal)}</Badge>
                </div>
                <DownloadButton getText={() => batchToCsv(batchResults)} filename="work-orders-batch.csv" mime="text/csv" />
              </div>
              <ul className="text-xs divide-y divide-border/50 rounded-md border border-border/50">
                {batchResults.map((r, i) => (
                  <li key={i} className="p-2 flex items-center justify-between gap-2">
                    <span className="font-mono flex-1 truncate">{r.input.workOrderNumber} · {r.input.customer}</span>
                    {"error" in r.result ? (
                      <span className="text-destructive truncate max-w-[50%]">{r.result.error}</span>
                    ) : (
                      <span className="font-mono">{formatMoney(r.result.total)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all calculations run locally in your browser.</p></CardContent></Card>
    </div>
  );
}
