"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton, DownloadButton } from "../../_shared";
import { ArrowUpDown, Info } from "lucide-react";
import {
  CURRENCIES,
  getCurrency,
  convert,
  formatMoney,
  convertToAll,
  tableToCsv,
} from "./logic";

export default function CurrencyConverterTool() {
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("INR");
  const [decimals, setDecimals] = useState("2");

  const numAmount = useMemo(() => {
    const n = parseFloat(amount);
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  const result = useMemo(() => convert(numAmount, from, to), [numAmount, from, to]);
  const table = useMemo(() => convertToAll(numAmount, from), [numAmount, from]);
  const dec = Math.max(0, Math.min(6, Number(decimals) || 0));

  const fromCur = getCurrency(from);
  const toCur = getCurrency(to);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-5">
        {/* Honest offline note */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <strong>Reference rates (offline).</strong> This converter uses a built-in rate
            table and works with no internet. Rates are approximate — confirm live rates with
            your bank before any real transaction.
          </span>
        </div>

        {/* Amount + from/to */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <div className="grid sm:grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="icon" onClick={swap} aria-label="Swap currencies" className="mb-0.5">
              <ArrowUpDown className="h-4 w-4" />
            </Button>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Decimals</Label>
            <Input type="number" min="0" max="6" className="w-20" value={decimals} onChange={(e) => setDecimals(e.target.value)} />
          </div>
        </div>

        {/* Result */}
        <div className="rounded-xl border bg-card p-4 space-y-1">
          <div className="text-sm text-muted-foreground">
            {formatMoney(numAmount, dec)} {fromCur.symbol} {fromCur.code}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-2xl font-bold">
              {formatMoney(result.value, dec)} {toCur.symbol}
              <span className="text-base text-muted-foreground ml-1">{toCur.code}</span>
            </div>
            <CopyButton getText={() => `${formatMoney(result.value, dec)} ${toCur.code}`} label="Copy" />
          </div>
          <div className="text-xs text-muted-foreground">
            1 {fromCur.code} = {formatMoney(1 / fromCur.perUsd * toCur.perUsd, 4)} {toCur.code}
          </div>
        </div>

        {/* Full table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">All currencies ({fromCur.code})</Label>
            <div className="flex gap-1.5">
              <CopyButton getText={() => tableToCsv(table)} label="Copy CSV" />
              <DownloadButton getText={() => tableToCsv(table)} filename="currency-table.csv" mime="text/csv" label="CSV" />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-xl border divide-y">
            {table.map((r) => (
              <div key={r.code} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                <span className="text-muted-foreground truncate">{r.symbol} {r.code}</span>
                <span className="font-medium">{formatMoney(r.value, dec)}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          100% offline and private — no exchange-rate API call, nothing uploaded.
        </p>
      </CardContent>
    </Card>
  );
}
