"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  buildBatch, sortReports, groupByStatus, computeBatchStats,
  renderBatchCsv, renderBatchSummary, getSampleRecords, STATUS_COLOR,
  DEFAULT_THRESHOLDS, type CertRecord, type CertStatus, type SortKey,
} from "./logic";

export default function SslExpiryTracker() {
  const [records, setRecords] = useState<CertRecord[]>(getSampleRecords());
  const [domain, setDomain] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [issuer, setIssuer] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("daysRemaining");
  const [asc, setAsc] = useState(true);
  const [error, setError] = useState("");

  const reports = useMemo(() => buildBatch(records, DEFAULT_THRESHOLDS, new Date()), [records]);
  const sorted = useMemo(() => sortReports(reports, sortKey, asc), [reports, sortKey, asc]);
  const groups = useMemo(() => groupByStatus(reports), [reports]);
  const stats = useMemo(() => computeBatchStats(reports), [reports]);
  const csv = useMemo(() => renderBatchCsv(reports), [reports]);
  const summary = useMemo(() => renderBatchSummary(stats), [stats]);

  const addRecord = () => {
    setError("");
    if (!domain || !issuedOn || !expiresOn) {
      setError("Domain, issued, and expiry dates are required.");
      return;
    }
    setRecords((prev) => [...prev, { domain, issuedOn, expiresOn, issuer }]);
    setDomain(""); setIssuedOn(""); setExpiresOn(""); setIssuer("");
  };
  const removeRecord = (i: number) => setRecords((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Domain</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} className="text-xs h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Issued on</Label>
              <Input type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} className="text-xs h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Expires on</Label>
              <Input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className="text-xs h-8" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Issuer</Label>
              <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} className="text-xs h-8" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={addRecord}
              className="px-3 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">
              + Add certificate
            </button>
            <button type="button" onClick={() => setRecords(getSampleRecords())}
              className="px-3 py-1 rounded-md text-xs border bg-background hover:bg-muted cursor-pointer">
              Load samples
            </button>
            <div className="ml-auto flex gap-2">
              <CopyButton getText={() => csv} label="Copy CSV" />
              <DownloadButton getText={() => csv} filename="ssl-expiry.csv" mime="text/csv" />
              <DownloadButton getText={() => summary} filename="ssl-summary.txt" label="Summary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {(Object.keys(groups) as CertStatus[]).map((s) => (
              <div key={s} className={`rounded border p-2 ${STATUS_COLOR[s]}`}>
                <div className="text-[10px] uppercase tracking-wide">{s}</div>
                <div className="text-lg font-mono">{groups[s].length}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Avg days remaining: {stats.avgDaysRemaining}. Earliest expiry: {stats.earliestExpiry || "—"}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Sort by</Label>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-7 text-xs rounded border bg-background px-2 cursor-pointer">
              <option value="daysRemaining">Days remaining</option>
              <option value="domain">Domain</option>
              <option value="expiresOn">Expiry date</option>
              <option value="status">Status</option>
            </select>
            <label className="flex items-center gap-1 text-xs cursor-pointer ml-2">
              <input type="checkbox" checked={asc} onChange={(e) => setAsc(e.target.checked)} />
              ascending
            </label>
          </div>
          <div className="space-y-2">
            {sorted.map((r, i) => {
              const idx = reports.indexOf(r);
              return (
                <div key={i} className="rounded border p-3 bg-background">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLOR[r.status]}`}>{r.status}</Badge>
                    <span className="font-semibold text-sm">{r.record.domain}</span>
                    {Number.isNaN(r.daysRemaining) ? (
                      <span className="text-[10px] text-muted-foreground">days: unknown</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">days remaining: {r.daysRemaining}</span>
                    )}
                    <button type="button" onClick={() => removeRecord(idx)}
                      className="ml-auto text-[11px] text-destructive hover:underline cursor-pointer">
                      Remove
                    </button>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Issued: {r.record.issuedOn} · Expires: {r.record.expiresOn}{r.record.issuer ? ` · Issuer: ${r.record.issuer}` : ""}
                  </div>
                  {r.warnings.length > 0 && (
                    <div className="text-[10px] text-yellow-700 dark:text-yellow-300 mt-1">
                      {r.warnings.map((w, j) => <div key={j}>⚠ {w}</div>)}
                    </div>
                  )}
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">No certificates tracked.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> certificate dates are processed locally.
            No network requests are made to fetch live certificates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
