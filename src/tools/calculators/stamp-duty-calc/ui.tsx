"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  computeStampDuty,
  formatCurrency,
  validateInput,
  rateCard,
  compareJurisdictions,
  additionalFees,
  type Jurisdiction,
  type StampDutyInput,
} from "./logic";

const JURISDICTIONS: { id: Jurisdiction; label: string }[] = [
  { id: "uk", label: "United Kingdom (SDLT)" },
  { id: "au-nsw", label: "Australia — NSW" },
  { id: "au-vic", label: "Australia — Victoria" },
  { id: "au-qld", label: "Australia — Queensland" },
  { id: "in", label: "India" },
  { id: "us-ny", label: "USA — New York" },
  { id: "us-ca", label: "USA — California" },
  { id: "us-fl", label: "USA — Florida" },
  { id: "us-tx", label: "USA — Texas" },
];

export default function StampDutyCalcUI() {
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("uk");
  const [price, setPrice] = useState("500000");
  const [buyerType, setBuyerType] = useState<StampDutyInput["buyerType"]>("residential");
  const [foreignBuyer, setForeignBuyer] = useState(false);
  const [gender, setGender] = useState<"male" | "female" | "joint">("male");
  const [senior, setSenior] = useState(false);

  const priceNum = parseFloat(price);
  const errors = useMemo(
    () => validateInput({ price: priceNum, jurisdiction }),
    [priceNum, jurisdiction],
  );

  const result = useMemo(() => {
    if (errors.length) return null;
    return computeStampDuty({
      jurisdiction,
      price: priceNum,
      buyerType,
      propertyType: "residential",
      foreignBuyer,
      gender,
      senior,
    });
  }, [jurisdiction, priceNum, buyerType, foreignBuyer, gender, senior, errors]);

  const fees = useMemo(() => additionalFees(priceNum, jurisdiction), [priceNum, jurisdiction]);
  const card = useMemo(() => rateCard(jurisdiction), [jurisdiction]);
  const cmp = useMemo(
    () => compareJurisdictions(priceNum, JURISDICTIONS.map((j) => j.id)),
    [priceNum],
  );

  const summary = useMemo(() => {
    if (!result) return "";
    return [
      `Jurisdiction: ${jurisdiction}`,
      `Price: ${formatCurrency(priceNum, jurisdiction)}`,
      `Stamp duty: ${formatCurrency(result.duty, jurisdiction)}`,
      `Surcharge: ${formatCurrency(result.surcharge, jurisdiction)}`,
      `Concession: ${formatCurrency(result.concession, jurisdiction)}`,
      `Total: ${formatCurrency(result.total, jurisdiction)}`,
      `Effective rate: ${result.effectiveRate}%`,
      ...result.notes,
    ].join("\n");
  }, [result, jurisdiction, priceNum]);

  return (
    <div className="space-y-4">
      {errors.length > 0 && <ErrorBanner message={errors.join("; ")} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Jurisdiction</Label>
              <select
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value as Jurisdiction)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                {JURISDICTIONS.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Property price</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Buyer type</Label>
              <select
                value={buyerType}
                onChange={(e) => setBuyerType(e.target.value as typeof buyerType)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="residential">Residential</option>
                <option value="firstTime">First-time buyer</option>
                <option value="investor">Investor / additional</option>
                <option value="nonResident">Non-resident (UK)</option>
              </select>
            </div>
            {jurisdiction.startsWith("au-") && (
              <div className="flex items-center gap-2 pt-6">
                <input
                  id="foreign"
                  type="checkbox"
                  checked={foreignBuyer}
                  onChange={(e) => setForeignBuyer(e.target.checked)}
                />
                <Label htmlFor="foreign" className="text-xs">Foreign buyer (AU)</Label>
              </div>
            )}
            {jurisdiction === "in" && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Gender (IN)</Label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as typeof gender)}
                    className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="joint">Joint</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    id="senior"
                    type="checkbox"
                    checked={senior}
                    onChange={(e) => setSenior(e.target.checked)}
                  />
                  <Label htmlFor="senior" className="text-xs">Senior citizen (IN)</Label>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Stamp duty breakdown</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Base duty</p>
                <p className="text-lg font-bold">{formatCurrency(result.duty, jurisdiction)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Surcharge</p>
                <p className="text-lg font-bold">{formatCurrency(result.surcharge, jurisdiction)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Concession</p>
                <p className="text-lg font-bold">−{formatCurrency(result.concession, jurisdiction)}</p>
              </div>
              <div className="rounded-md border p-3 bg-primary/5">
                <p className="text-xs text-muted-foreground">Total payable</p>
                <p className="text-lg font-bold">{formatCurrency(result.total, jurisdiction)}</p>
              </div>
            </div>
            <p className="text-sm">
              Effective rate: <span className="font-bold">{result.effectiveRate}%</span> · Plus fees ~{formatCurrency(fees.total, jurisdiction)}
            </p>
            {result.breakdown.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-1.5">From</th>
                      <th className="py-1.5">Up to</th>
                      <th className="py-1.5">Rate</th>
                      <th className="py-1.5">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {result.breakdown.map((b, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-1.5">{formatCurrency(b.from, jurisdiction)}</td>
                        <td className="py-1.5">{b.to === null ? "—" : formatCurrency(b.to, jurisdiction)}</td>
                        <td>{b.ratePct}%</td>
                        <td>{formatCurrency(b.amount, jurisdiction)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.notes.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                {result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">Rate card ({jurisdiction})</p>
            <div className="space-y-1">
              {card.map((c) => (
                <div key={c.price} className="flex justify-between text-sm border-b border-border/30 py-1">
                  <span>{formatCurrency(c.price, jurisdiction)}</span>
                  <span className="font-mono">{formatCurrency(c.duty, jurisdiction)} ({c.effectivePct}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">Compare jurisdictions</p>
            <div className="space-y-1">
              {cmp.sort((a, b) => a.duty - b.duty).map((c) => (
                <div key={c.jurisdiction} className="flex justify-between text-sm border-b border-border/30 py-1">
                  <span>{c.jurisdiction}</span>
                  <span className="font-mono">{formatCurrency(c.duty, c.jurisdiction)} ({c.effectivePct}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium mb-2">Additional fees</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div className="rounded border p-2"><p className="text-xs text-muted-foreground">Registration</p><p className="font-mono">{formatCurrency(fees.registration, jurisdiction)}</p></div>
            <div className="rounded border p-2"><p className="text-xs text-muted-foreground">Legal</p><p className="font-mono">{formatCurrency(fees.legal, jurisdiction)}</p></div>
            <div className="rounded border p-2"><p className="text-xs text-muted-foreground">Mortgage</p><p className="font-mono">{formatCurrency(fees.mortgage, jurisdiction)}</p></div>
            <div className="rounded border p-2 bg-primary/5"><p className="text-xs text-muted-foreground">Total fees</p><p className="font-mono font-bold">{formatCurrency(fees.total, jurisdiction)}</p></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center">
          <CopyButton getText={() => summary} label="Copy summary" />
          <DownloadButton getText={() => summary} filename="stamp-duty.txt" />
          <p className="text-xs text-muted-foreground ml-auto">
            100% private — runs locally. Brackets reflect 2024 standard rates; verify with a tax professional.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
