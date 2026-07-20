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
  PHONE_REGISTRY,
  COUNTRY_LIST,
  HONESTY_BANNER,
  validatePhoneNumber,
  generatePhoneBatch,
  formatPhoneNumber,
  maskPhoneNumber,
  parseBatchInput,
  validateBatch,
  summarizeBatch,
  renderBatchCsv,
  createRng,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PhoneFormat,
  type NumberTypeFilter,
  type HistoryEntry,
} from "./logic";
import {
  Phone,
  History,
  ShieldCheck,
  AlertTriangle,
  Globe,
  Wand2,
  ListChecks,
  Hash,
  PhoneCall,
} from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  mobile: "text-emerald-600 dark:text-emerald-400",
  fixed: "text-blue-600 dark:text-blue-400",
  "toll-free": "text-amber-600 dark:text-amber-400",
  voip: "text-purple-600 dark:text-purple-400",
  premium: "text-rose-600 dark:text-rose-400",
  unknown: "text-muted-foreground",
};

export default function PhoneNumberGeneratorValidator() {
  const [mode, setMode] = useState<"generate" | "validate" | "batch">("generate");
  const [country, setCountry] = useState("US");
  const [count, setCount] = useState(10);
  const [numType, setNumType] = useState<NumberTypeFilter>("mobile");
  const [seed, setSeed] = useState("test-seed");
  const [format, setFormat] = useState<PhoneFormat>("e164");
  const [masked, setMasked] = useState(false);
  const [singleInput, setSingleInput] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.country) setCountry(p.country);
      if (p.count) setCount(p.count);
      if (p.format) setFormat(p.format);
      if (p.type) setNumType(p.type);
      toast.info("Loaded from share link");
    }
  }, []);

  // ---- generate mode ----
  const generated = useMemo(() => {
    try {
      return generatePhoneBatch({ country, count, seed: seed || "default", type: numType });
    } catch {
      return [];
    }
  }, [country, count, seed, numType]);

  const generatedDisplay = useMemo(
    () => generated.map((n) => (masked ? maskPhoneNumber(n) : formatPhoneNumber(n, format))),
    [generated, format, masked],
  );
  const generatedText = useMemo(() => generatedDisplay.join("\n"), [generatedDisplay]);

  // ---- single validate mode ----
  const singleResult = useMemo(() => {
    if (!singleInput.trim()) return null;
    return validatePhoneNumber(singleInput);
  }, [singleInput]);

  const singleDisplay = useMemo(() => {
    if (!singleResult) return "";
    return masked
      ? maskPhoneNumber(singleResult.normalized)
      : formatPhoneNumber(singleResult.normalized, format, singleResult.country ?? undefined);
  }, [singleResult, format, masked]);

  // ---- batch mode ----
  const batchNumbers = useMemo(() => parseBatchInput(batchInput), [batchInput]);
  const batchRows = useMemo(() => validateBatch(batchNumbers), [batchNumbers]);
  const batchSummary = useMemo(() => summarizeBatch(batchRows), [batchRows]);
  const batchCsv = useMemo(() => renderBatchCsv(batchRows), [batchRows]);

  // ---- handlers ----
  const handleRandomSeed = useCallback(() => {
    const s = Math.random().toString(36).slice(2, 10);
    setSeed(s);
    toast.success(`New seed: ${s}`);
  }, []);

  const handleSaveHistory = useCallback(
    (action: HistoryEntry["action"], batchTotal = 0, batchValid = 0, batchInvalid = 0) => {
      saveHistory({
        ts: Date.now(),
        action,
        country: action === "generate" ? country : null,
        format,
        generateCount: action === "generate" ? count : 0,
        generateType: action === "generate" ? numType : null,
        batchTotal,
        batchValid,
        batchInvalid,
      });
      setHistory(loadHistory());
    },
    [country, count, format, numType],
  );

  const handleClear = useCallback(() => {
    setSingleInput("");
    setBatchInput("");
    setMasked(false);
    toast.info("Cleared inputs");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareUrl = useMemo(
    () => buildShareUrl(country, count, format, numType),
    [country, count, format, numType],
  );

  const spec = PHONE_REGISTRY[country];

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Honesty banner */}
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200"
      >
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span className="text-xs">{HONESTY_BANNER}</span>
      </div>

      {/* Privacy banner */}
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-200"
      >
        <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span className="text-xs">
          100% client-side. Validation, formatting, and generation all run locally — phone numbers are never transmitted or logged. History stores only metadata (counts + timestamps), never the numbers themselves.
        </span>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-1">
            {(["generate", "validate", "batch"] as const).map((m) => (
              <Button
                key={m}
                variant={mode === m ? "default" : "outline"}
                size="sm"
                className="h-7 text-[11px] capitalize"
                onClick={() => setMode(m)}
              >
                {m === "generate" && <Wand2 className="h-3.5 w-3.5 mr-1" />}
                {m === "validate" && <ShieldCheck className="h-3.5 w-3.5 mr-1" />}
                {m === "batch" && <ListChecks className="h-3.5 w-3.5 mr-1" />}
                {m}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Display format</Label>
              <div className="flex flex-wrap gap-1">
                {(["e164", "international", "national", "rfc3966"] as const).map((f) => (
                  <Button
                    key={f}
                    variant={format === f ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setFormat(f)}
                  >
                    {f === "e164" ? "E.164" : f === "rfc3966" ? "tel:" : f}
                  </Button>
                ))}
                <Button
                  variant={masked ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setMasked((v) => !v)}
                  title="Mask all but country code + last 4"
                >
                  •••• Mask
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Shareable link</Label>
              <div className="flex gap-1">
                <ShareButton getUrl={() => shareUrl} />
                <ClearButton onClick={handleClear} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---- GENERATE MODE ---- */}
      {mode === "generate" && spec && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Wand2 className="h-4 w-4" /> Generate test numbers
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="png-country" className="text-xs">Country</Label>
                <select
                  id="png-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="h-9 w-full rounded border bg-background px-2 text-sm"
                >
                  {COUNTRY_LIST.map((c) => (
                    <option key={c} value={c}>
                      {c} — {PHONE_REGISTRY[c]!.name} (+{PHONE_REGISTRY[c]!.callingCode})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  NSN length: {spec.nsnLength} · Calling code: +{spec.callingCode}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Number type</Label>
                <div className="flex flex-wrap gap-1">
                  {(["mobile", "fixed", "toll-free"] as const).map((t) => (
                    <Button
                      key={t}
                      variant={numType === t ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setNumType(t)}
                      disabled={t === "toll-free" && !(spec.tollFreePrefixes && spec.tollFreePrefixes.length > 0)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="png-count" className="text-xs">Count (max 1000)</Label>
                <Input
                  id="png-count"
                  type="number"
                  min={1}
                  max={1000}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(1000, parseInt(e.target.value, 10) || 1)))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="png-seed" className="text-xs">Seed (deterministic)</Label>
                <div className="flex gap-1">
                  <Input
                    id="png-seed"
                    type="text"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    className="h-9 text-sm font-mono"
                  />
                  <Button variant="outline" size="sm" onClick={handleRandomSeed} className="h-9">
                    <Hash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            {generated.length > 0 ? (
              <>
                <div className="rounded border bg-background p-2 max-h-[360px] overflow-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all">{generatedText}</pre>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => { handleSaveHistory("generate"); return generatedText; }} label="Copy all" />
                  <DownloadButton
                    getText={() => generatedText}
                    filename={`phone-${country}-${numType}.txt`}
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => "number,country,type\n" + generated.map((n) => `${n},${country},${numType}`).join("\n")}
                    filename={`phone-${country}-${numType}.csv`}
                    mime="text/csv"
                    label="Download CSV"
                  />
                </div>
              </>
            ) : (
              <EmptyState
                title="No numbers generated"
                hint="Pick a country and number type, then numbers will appear here deterministically."
                icon={<Phone className="h-8 w-8" />}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- VALIDATE MODE ---- */}
      {mode === "validate" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Validate a phone number
            </h3>
            <Textarea
              value={singleInput}
              onChange={(e) => setSingleInput(e.target.value)}
              placeholder="+1 415 555 2671"
              className="min-h-[60px] resize-y font-mono text-sm"
            />
            {singleResult && (
              <div className="rounded border bg-background p-3 space-y-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={singleResult.valid ? "default" : singleResult.possible ? "secondary" : "destructive"}>
                    {singleResult.valid ? "VALID" : singleResult.possible ? "POSSIBLE" : "INVALID"}
                  </Badge>
                  {singleResult.country && (
                    <Badge variant="outline" className="gap-1">
                      <Globe className="h-3 w-3" />
                      {singleResult.countryName} (+{singleResult.callingCode})
                    </Badge>
                  )}
                  <Badge variant="outline" className={TYPE_COLORS[singleResult.type]}>
                    <PhoneCall className="h-3 w-3" />
                    {singleResult.type}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{singleResult.message}</p>
                {singleDisplay && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <FormatRow label="E.164" value={formatPhoneNumber(singleResult.normalized, "e164", singleResult.country ?? undefined)} />
                    <FormatRow label="International" value={formatPhoneNumber(singleResult.normalized, "international", singleResult.country ?? undefined)} />
                    <FormatRow label="National" value={formatPhoneNumber(singleResult.normalized, "national", singleResult.country ?? undefined)} />
                    <FormatRow label="RFC 3966" value={formatPhoneNumber(singleResult.normalized, "rfc3966", singleResult.country ?? undefined)} />
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground font-mono">
                  digits: {singleResult.digits} · nsn: {singleResult.nsn} ({singleResult.nsnLength} digits)
                </div>
              </div>
            )}
            {!singleResult && (
              <EmptyState
                title="Enter a phone number to validate"
                hint="Use +<calling-code> for international format, e.g. +1 415 555 2671 or +44 20 7183 8750."
                icon={<Phone className="h-8 w-8" />}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- BATCH MODE ---- */}
      {mode === "batch" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ListChecks className="h-4 w-4" /> Batch validate
            </h3>
            <Textarea
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              placeholder={"+1 415 555 2671\n+44 20 7183 8750\n+81 90 1234 5678"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            {batchRows.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Total" value={batchSummary.total} />
                  <Stat label="Valid" value={batchSummary.valid} highlight="good" />
                  <Stat label="Invalid" value={batchSummary.invalid} highlight="bad" />
                  <Stat label="Possible" value={batchSummary.possible} />
                </div>
                <div className="rounded border bg-background max-h-[360px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">#</th>
                        <th className="px-2 py-1 text-left">Number</th>
                        <th className="px-2 py-1 text-left">Country</th>
                        <th className="px-2 py-1 text-left">Type</th>
                        <th className="px-2 py-1 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchRows.map((r) => (
                        <tr key={r.index} className="border-t">
                          <td className="px-2 py-1 text-muted-foreground">{r.index + 1}</td>
                          <td className="px-2 py-1 font-mono break-all">{r.normalized}</td>
                          <td className="px-2 py-1">{r.countryName || "—"}</td>
                          <td className={`px-2 py-1 ${TYPE_COLORS[r.type]}`}>{r.type}</td>
                          <td className="px-2 py-1">
                            <Badge variant={r.valid ? "default" : r.possible ? "secondary" : "destructive"} className="text-[10px]">
                              {r.valid ? "valid" : r.possible ? "possible" : "invalid"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => batchCsv} label="Copy CSV" />
                  <DownloadButton
                    getText={() => batchCsv}
                    filename="phone-batch-results.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveHistory("validate_batch", batchSummary.total, batchSummary.valid, batchSummary.invalid)}
                    className="gap-1.5"
                  >
                    <History className="h-3.5 w-3.5" /> Save to history
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState
                title="Enter multiple phone numbers"
                hint="One per line (commas and semicolons also work). We validate each and produce a downloadable CSV."
                icon={<ListChecks className="h-8 w-8" />}
              />
            )}
          </CardContent>
        </Card>
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 capitalize">{h.action.replace("_", " ")}</Badge>
                  {h.action === "generate" && (
                    <>
                      <Badge variant="outline" className="mr-2">{h.country}</Badge>
                      <Badge variant="outline" className="mr-2">{h.generateCount} × {h.generateType}</Badge>
                    </>
                  )}
                  {h.action === "validate_batch" && (
                    <>
                      <Badge variant="outline" className="mr-2">{h.batchTotal} total</Badge>
                      <Badge variant="outline" className="mr-2">{h.batchValid} valid</Badge>
                      <Badge variant="outline" className="mr-2">{h.batchInvalid} invalid</Badge>
                    </>
                  )}
                  <Badge variant="outline" className="mr-2">{h.format}</Badge>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All validation, formatting, and generation run 100% client-side. Phone numbers never leave your browser. History stores only metadata (counts + timestamps), never the numbers themselves.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function FormatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-muted/30 px-2 py-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-[11px] text-foreground break-all">{value}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
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
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
