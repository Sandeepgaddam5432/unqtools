"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  computeCapitalGains,
  validateInputs,
  fmtUSD,
  niit,
  stateCapitalGainsTax,
  exchange1031Eligibility,
  harvestLosses,
  type FilingStatus,
  type AssetType,
} from "./logic";

export default function CapitalGainsCalcUI() {
  const [purchasePrice, setPurchasePrice] = useState("10000");
  const [salePrice, setSalePrice] = useState("30000");
  const [purchaseDate, setPurchaseDate] = useState("2020-01-01");
  const [saleDate, setSaleDate] = useState("2024-01-02");
  const [improvements, setImprovements] = useState("0");
  const [sellingCosts, setSellingCosts] = useState("500");
  const [depreciation, setDepreciation] = useState("0");
  const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");
  const [taxableIncome, setTaxableIncome] = useState("50000");
  const [assetType, setAssetType] = useState<AssetType>("stocks");
  const [isPrimary, setIsPrimary] = useState(false);
  const [yearsPrimary, setYearsPrimary] = useState("5");
  const [losses, setLosses] = useState("0");
  const [state, setState] = useState("CA");

  const errors = useMemo(
    () =>
      validateInputs({
        purchasePrice: parseFloat(purchasePrice),
        salePrice: parseFloat(salePrice),
        purchaseDate,
        saleDate,
      }),
    [purchasePrice, salePrice, purchaseDate, saleDate],
  );

  const result = useMemo(() => {
    if (errors.length) return null;
    return computeCapitalGains({
      purchasePrice: parseFloat(purchasePrice),
      salePrice: parseFloat(salePrice),
      purchaseDate,
      saleDate,
      improvements: parseFloat(improvements) || 0,
      sellingCosts: parseFloat(sellingCosts) || 0,
      depreciationRecapture: parseFloat(depreciation) || 0,
      filingStatus,
      taxableIncome: parseFloat(taxableIncome) || 0,
      assetType,
      isPrimaryResidence: isPrimary,
      yearsOwnedAsPrimary: parseFloat(yearsPrimary) || 0,
    });
  }, [purchasePrice, salePrice, purchaseDate, saleDate, improvements, sellingCosts, depreciation, filingStatus, taxableIncome, assetType, isPrimary, yearsPrimary, errors]);

  const stateTax = useMemo(() => {
    if (!result) return 0;
    return stateCapitalGainsTax(state, result.taxableGain);
  }, [result, state]);

  const niitTax = useMemo(() => {
    if (!result) return 0;
    return niit(parseFloat(taxableIncome) + result.taxableGain, filingStatus, result.taxableGain);
  }, [result, taxableIncome, filingStatus]);

  const harvest = useMemo(() => {
    if (!result) return null;
    return harvestLosses(result.gain, parseFloat(losses) || 0);
  }, [result, losses]);

  const exchange = useMemo(() => {
    if (!result || assetType !== "realEstate") return null;
    return exchange1031Eligibility(assetType, 0);
  }, [result, assetType]);

  const summary = useMemo(() => {
    if (!result) return "";
    return [
      `Asset: ${assetType}`,
      `Holding period: ${result.holdingPeriodYears} years (${result.isLongTerm ? "long-term" : "short-term"})`,
      `Gain: ${fmtUSD(result.gain)}`,
      `Exclusion: ${fmtUSD(result.exclusion)}`,
      `Taxable gain: ${fmtUSD(result.taxableGain)}`,
      `Federal tax: ${fmtUSD(result.federalTax)}`,
      `NIIT: ${fmtUSD(niitTax)}`,
      `State (${state}): ${fmtUSD(stateTax)}`,
      `Net proceeds: ${fmtUSD(result.netProceeds)}`,
      `Effective rate: ${result.effectiveRate}%`,
      ...result.notes,
    ].join("\n");
  }, [result, assetType, niitTax, stateTax, state]);

  return (
    <div className="space-y-4">
      {errors.length > 0 && <ErrorBanner message={errors.join("; ")} />}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Purchase price ($)</Label>
              <Input value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sale price ($)</Label>
              <Input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Purchase date</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sale date</Label>
              <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Improvements ($)</Label>
              <Input value={improvements} onChange={(e) => setImprovements(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Selling costs ($)</Label>
              <Input value={sellingCosts} onChange={(e) => setSellingCosts(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Depreciation recapture ($)</Label>
              <Input value={depreciation} onChange={(e) => setDepreciation(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Taxable income (excl. gains, $)</Label>
              <Input value={taxableIncome} onChange={(e) => setTaxableIncome(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Filing status</Label>
              <select
                value={filingStatus}
                onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="single">Single</option>
                <option value="marriedJoint">Married filing jointly</option>
                <option value="marriedSeparate">Married filing separately</option>
                <option value="headOfHouse">Head of household</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Asset type</Label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value as AssetType)}
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              >
                <option value="stocks">Stocks</option>
                <option value="crypto">Crypto</option>
                <option value="realEstate">Real estate</option>
                <option value="collectibles">Collectibles</option>
                <option value="business">Business</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">State (e.g. CA, NY, TX)</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} />
            </div>
            {assetType === "realEstate" && (
              <>
                <div className="flex items-center gap-2 pt-6">
                  <input id="is-primary" type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
                  <Label htmlFor="is-primary" className="text-xs">Primary residence</Label>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Years as primary</Label>
                  <Input value={yearsPrimary} onChange={(e) => setYearsPrimary(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Capital gains breakdown</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Holding period</p>
                <p className="text-lg font-bold">{result.holdingPeriodYears}y</p>
                <p className="text-xs">{result.isLongTerm ? "long-term" : "short-term"}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Gross gain</p>
                <p className="text-lg font-bold">{fmtUSD(result.gain)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Exclusion</p>
                <p className="text-lg font-bold">−{fmtUSD(result.exclusion)}</p>
              </div>
              <div className="rounded-md border p-3 bg-primary/5">
                <p className="text-xs text-muted-foreground">Taxable gain</p>
                <p className="text-lg font-bold">{fmtUSD(result.taxableGain)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Federal tax</p>
                <p className="text-lg font-bold">{fmtUSD(result.federalTax)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">NIIT (3.8%)</p>
                <p className="text-lg font-bold">{fmtUSD(niitTax)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">State ({state})</p>
                <p className="text-lg font-bold">{fmtUSD(stateTax)}</p>
              </div>
              <div className="rounded-md border p-3 bg-primary/5">
                <p className="text-xs text-muted-foreground">Net proceeds</p>
                <p className="text-lg font-bold">{fmtUSD(result.netProceeds)}</p>
              </div>
            </div>
            <p className="text-sm">
              Effective rate: <span className="font-bold">{result.effectiveRate}%</span>
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Tax-loss harvesting</p>
            <div>
              <Label className="text-xs text-muted-foreground">Capital losses to harvest ($)</Label>
              <Input value={losses} onChange={(e) => setLosses(e.target.value)} />
            </div>
            {harvest && (
              <div className="text-sm space-y-1">
                <p>Net gain: <span className="font-bold">{fmtUSD(harvest.netGain)}</span></p>
                <p>Deductible this year: <span className="font-bold">{fmtUSD(harvest.deductibleLoss)}</span></p>
                <p>Carryover: <span className="font-bold">{fmtUSD(harvest.carryover)}</span></p>
              </div>
            )}
          </CardContent>
        </Card>

        {exchange && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium">1031 Exchange (real estate)</p>
              <p className="text-sm">{exchange.notes}</p>
              <p className="text-xs text-muted-foreground">
                Identify replacement property within <span className="font-bold">{exchange.identifyDeadline} days</span>;
                close within <span className="font-bold">{exchange.closeDeadline} days</span>.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-center">
          <CopyButton getText={() => summary} label="Copy summary" />
          <DownloadButton getText={() => summary} filename="capital-gains.txt" />
          <p className="text-xs text-muted-foreground ml-auto">
            100% private — runs locally. 2024 US federal brackets; consult a CPA for filing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
