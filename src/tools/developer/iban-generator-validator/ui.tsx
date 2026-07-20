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
  IBAN_REGISTRY,
  COUNTRY_LIST,
  HONESTY_BANNER,
  validateIban,
  decodeIban,
  formatIban,
  maskIban,
  generateIbanBatch,
  parseBatchInput,
  validateBatch,
  summarizeBatch,
  renderBatchCsv,
  autocompleteIban,
  createRng,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type IbanFormat,
  type HistoryEntry,
} from "./logic";
import {
  CreditCard,
  History,
  ShieldCheck,
  AlertTriangle,
  Globe,
  Wand2,
  ListChecks,
  Hash,
  Banknote,
} from "lucide-react";

const SEGMENT_COLORS = [
  "text-emerald-600 dark:text-emerald-400",
  "text-blue-600 dark:text-blue-400",
  "text-amber-600 dark:text-amber-400",
  "text-purple-600 dark:text-purple-400",
  "text-rose-600 dark:text-rose-400",
  "text-cyan-600 dark:text-cyan-400",
];

export default function IbanGeneratorValidator() {
  const [mode, setMode] = useState<"generate" | "validate" | "batch">("generate");
  const [country, setCountry] = useState("DE");
  const [count, setCount] = useState(10);
  const [seed, setSeed] = useState("test-seed");
  const [format, setFormat] = useState<IbanFormat>("print");
  const [masked, setMasked] = useState(false);
  const [singleInput, setSingleInput] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [autoTemplate, setAutoTemplate] = useState("DE??");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.country) setCountry(p.country);
      if (p.count) setCount(p.count);
      if (p.format) setFormat(p.format);
      if (p.country || p.count || p.format) toast.info("Loaded from share link");
    }
  }, []);

  // ---- generate mode ----
  const generated = useMemo(() => {
    try {
      return generateIbanBatch({ country, count, seed: seed || "default" });
    } catch (e) {
      return [];
    }
  }, [country, count, seed]);

  const generatedDisplay = useMemo(() => {
    return generated.map((iban) => (masked ? maskIban(iban) : formatIban(iban, format)));
  }, [generated, format, masked]);

  const generatedText = useMemo(() => generatedDisplay.join("\n"), [generatedDisplay]);

  // ---- single validate mode ----
  const singleResult = useMemo(() => {
    if (!singleInput.trim()) return null;
    return validateIban(singleInput);
  }, [singleInput]);

  const decoded = useMemo(() => {
    if (!singleInput.trim()) return null;
    return decodeIban(singleInput);
  }, [singleInput]);

  const singleDisplay = useMemo(() => {
    if (!singleResult) return "";
    return masked
      ? maskIban(singleResult.normalized)
      : formatIban(singleResult.normalized, format);
  }, [singleResult, format, masked]);

  // ---- batch mode ----
  const batchNumbers = useMemo(() => parseBatchInput(batchInput), [batchInput]);
  const batchRows = useMemo(() => validateBatch(batchNumbers), [batchNumbers]);
  const batchSummary = useMemo(() => summarizeBatch(batchRows), [batchRows]);
  const batchCsv = useMemo(() => renderBatchCsv(batchRows), [batchRows]);

  // ---- autocomplete ----
  const autoResult = useMemo(() => {
    if (!autoTemplate.trim()) return null;
    try {
      const iban = autocompleteIban(autoTemplate, createRng("auto"));
      return { iban, valid: validateIban(iban).valid };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [autoTemplate]);

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
        batchTotal,
        batchValid,
        batchInvalid,
      });
      setHistory(loadHistory());
    },
    [country, count, format],
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
    () => buildShareUrl(country, count, format),
    [country, count, format],
  );

  const spec = IBAN_REGISTRY[country];

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
          100% client-side. MOD-97 + structural validation all run locally — IBANs are never transmitted or logged. History stores only metadata (counts + timestamps), never the IBANs themselves.
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
                {(["print", "electronic"] as const).map((f) => (
                  <Button
                    key={f}
                    variant={format === f ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setFormat(f)}
                  >
                    {f}
                  </Button>
                ))}
                <Button
                  variant={masked ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setMasked((v) => !v)}
                  title="Mask all but first 4 + last 4"
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
      {mode === "generate" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Wand2 className="h-4 w-4" /> Generate test IBANs
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="iban-country" className="text-xs">Country ({COUNTRY_LIST.length} in registry)</Label>
                <select
                  id="iban-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {COUNTRY_LIST.map((cc) => (
                    <option key={cc} value={cc}>
                      {cc} — {IBAN_REGISTRY[cc]!.name} ({IBAN_REGISTRY[cc]!.length} chars)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="iban-count" className="text-xs">Count (max 1000)</Label>
                <Input
                  id="iban-count"
                  type="number"
                  min={1}
                  max={1000}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="iban-seed" className="text-xs">Seed (deterministic)</Label>
                <div className="flex gap-1">
                  <Input
                    id="iban-seed"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    className="font-mono text-xs"
                    placeholder="my-seed"
                  />
                  <Button variant="outline" size="sm" onClick={handleRandomSeed} title="Random seed">
                    <Wand2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            {spec && (
              <div className="rounded border bg-muted/30 p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{spec.country}</Badge>
                  <Badge variant="outline" className="text-[10px]">{spec.name}</Badge>
                  <Badge variant="outline" className="text-[10px]">{spec.length} chars</Badge>
                  <Badge variant="outline" className="text-[10px]">BBAN: {spec.structure}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                  Specimen: {formatIban(spec.country + "00" + "0".repeat(spec.length - 4), "print")}
                </p>
              </div>
            )}
            {generated.length > 0 ? (
              <>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {generated.slice(0, 100).map((iban, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs font-mono">
                      {generatedDisplay[i]}
                    </div>
                  ))}
                  {generated.length > 100 && (
                    <div className="text-[11px] text-muted-foreground text-center pt-1">
                      Showing first 100 of {generated.length.toLocaleString()} — see export below for full output.
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <CopyButton
                    getText={() => { handleSaveHistory("generate"); return generatedText; }}
                    label={`Copy all ${generated.length}`}
                  />
                  <DownloadButton
                    getText={() => { handleSaveHistory("generate"); return generatedText; }}
                    filename={`test-ibans-${country.toLowerCase()}.txt`}
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBatchInput(generatedText)}
                  >
                    Send to batch validator
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pick a country above to generate {count} test IBANs.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- VALIDATE MODE ---- */}
      {mode === "validate" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Single-IBAN validation
            </h3>
            <Input
              value={singleInput}
              onChange={(e) => setSingleInput(e.target.value)}
              placeholder="Paste an IBAN — e.g. GB82 WEST 1234 5698 7654 32"
              className="font-mono text-sm"
              autoComplete="off"
              data-lpignore="true"
            />
            {singleResult ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant={singleResult.valid ? "default" : "destructive"}>
                    {singleResult.valid ? "✓ Valid" : "✗ Invalid"}
                  </Badge>
                  {singleResult.country && (
                    <Badge variant="outline">
                      <Globe className="inline h-3 w-3 mr-1" />
                      {singleResult.country} {singleResult.countryName}
                    </Badge>
                  )}
                  {singleResult.expectedLength && (
                    <Badge variant="outline">{singleResult.actualLength}/{singleResult.expectedLength} chars</Badge>
                  )}
                  {singleResult.checkDigits && (
                    <Badge variant="outline">check {singleResult.checkDigits}</Badge>
                  )}
                  {singleResult.mod97Remainder !== null && (
                    <Badge variant={singleResult.mod97Remainder === 1 ? "default" : "secondary"}>
                      mod-97 = {singleResult.mod97Remainder}
                    </Badge>
                  )}
                </div>
                <div className="rounded border bg-muted/30 p-2 font-mono text-sm break-all">
                  {singleDisplay}
                </div>
                {!singleResult.valid && (
                  <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                    <AlertTriangle className="inline h-3 w-3 mr-1" />
                    {singleResult.message}
                  </div>
                )}
                {decoded && decoded.segments.length > 0 && singleResult.valid && (
                  <details className="rounded border bg-background">
                    <summary className="px-3 py-1.5 text-xs cursor-pointer select-none">
                      Structural breakdown ({decoded.structure})
                    </summary>
                    <div className="p-2 space-y-1">
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <Badge variant="outline">Country: {decoded.country}</Badge>
                        <Badge variant="outline">Check: {decoded.checkDigits}</Badge>
                      </div>
                      {decoded.segments.map((seg, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted-foreground w-32">{seg.label}:</span>
                          <code className={`font-mono ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]}`}>
                            {seg.value}
                          </code>
                          <Badge variant="secondary" className="text-[10px]">
                            {seg.length}{seg.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => singleResult.normalized} label="Copy electronic" />
                  <CopyButton getText={() => formatIban(singleResult.normalized, "print")} label="Copy print" />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Type or paste an IBAN above to validate MOD-97, structural rules, and decode the BBAN components.
              </p>
            )}

            {/* Autocomplete helper */}
            <div className="rounded border border-dashed p-3 space-y-2">
              <h4 className="text-xs font-semibold flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" /> Autocomplete partial IBAN
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Use <code className="font-mono">?</code> placeholders for missing digits/letters. Country + check digits are auto-computed.
              </p>
              <Input
                value={autoTemplate}
                onChange={(e) => setAutoTemplate(e.target.value)}
                placeholder="e.g. DE?? or GB??WEST??????????????"
                className="font-mono text-xs"
              />
              {autoResult && !("error" in autoResult) && (
                <div className="rounded bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs">
                  <Badge variant="default" className="mr-2">✓ MOD-97 valid</Badge>
                  <code className="font-mono">{autoResult.iban}</code>
                </div>
              )}
              {autoResult && "error" in autoResult && (
                <div className="rounded bg-destructive/10 border border-destructive/30 p-2 text-xs">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  {autoResult.error}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- BATCH MODE ---- */}
      {mode === "batch" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" /> Batch validation
              </h3>
              {batchRows.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">{batchSummary.total} total</Badge>
                  <Badge variant="default" className="text-[10px]">{batchSummary.valid} valid</Badge>
                  <Badge variant="destructive" className="text-[10px]">{batchSummary.invalid} invalid</Badge>
                </div>
              )}
            </div>
            <Textarea
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              placeholder={"One IBAN per line (or comma-separated)\nGB82WEST12345698765432\nDE89370400440532013000\nBE68539007547034"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            {batchRows.length > 0 ? (
              <>
                <div className="space-y-1 max-h-[400px] overflow-auto">
                  {batchRows.map((r) => (
                    <div
                      key={r.index}
                      className={`rounded border px-3 py-1.5 text-xs flex flex-wrap items-center gap-2 ${
                        r.valid ? "bg-emerald-500/5 border-emerald-500/30" : "bg-destructive/5 border-destructive/30"
                      }`}
                    >
                      <Badge variant={r.valid ? "default" : "destructive"} className="text-[10px]">
                        {r.valid ? "✓" : "✗"}
                      </Badge>
                      {r.country && (
                        <Badge variant="outline" className="text-[10px]">{r.country}</Badge>
                      )}
                      <span className="font-mono text-foreground truncate flex-1 min-w-0">
                        {r.normalized ? (masked ? maskIban(r.normalized) : formatIban(r.normalized, format)) : "(empty)"}
                      </span>
                      {!r.valid && (
                        <span className="text-muted-foreground text-[10px] ml-auto truncate">{r.message}</span>
                      )}
                    </div>
                  ))}
                </div>
                {Object.keys(batchSummary.byCountry).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {Object.entries(batchSummary.byCountry).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="text-[10px]">
                        {k}: {v}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <CopyButton
                    getText={() => { handleSaveHistory("validate_batch", batchSummary.total, batchSummary.valid, batchSummary.invalid); return batchCsv; }}
                    label="Copy CSV"
                  />
                  <DownloadButton
                    getText={() => { handleSaveHistory("validate_batch", batchSummary.total, batchSummary.valid, batchSummary.invalid); return batchCsv; }}
                    filename="iban-validation.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const validOnly = batchRows.filter((r) => r.valid).map((r) => r.normalized).join("\n");
                      setBatchInput(validOnly);
                      toast.success(`Kept ${batchSummary.valid} valid rows`);
                    }}
                  >
                    Keep only valid
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Paste multiple IBANs above to validate them all in one pass. Handles 5k+ rows instantly.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Country reference */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Banknote className="h-4 w-4" /> Country registry ({COUNTRY_LIST.length} IBAN-enabled)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-[200px] overflow-auto">
            {COUNTRY_LIST.map((cc) => (
              <button
                key={cc}
                onClick={() => { setCountry(cc); setMode("generate"); }}
                className="rounded border bg-background px-2 py-1 text-left text-[11px] hover:bg-muted/40 transition-colors"
              >
                <div className="font-mono font-medium text-foreground">{cc} · {IBAN_REGISTRY[cc]!.length}c</div>
                <div className="text-muted-foreground truncate">{IBAN_REGISTRY[cc]!.name}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* History */}
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
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.action}</Badge>
                  {h.country && <Badge variant="outline" className="text-[10px]">{h.country}</Badge>}
                  <Badge variant="outline" className="text-[10px]">{h.format}</Badge>
                  {h.generateCount > 0 && (
                    <Badge variant="outline" className="text-[10px]">{h.generateCount} generated</Badge>
                  )}
                  {h.batchTotal > 0 && (
                    <Badge variant="outline" className="text-[10px]">{h.batchValid}/{h.batchTotal} valid</Badge>
                  )}
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground pt-1">
              History stores action, country, and counts only — never the IBANs themselves.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">100% client-side.</strong> MOD-97 validation, BBAN structural checks, and IBAN generation all run in your browser. No server, no network, no telemetry on the input field. IBANs are never stored — only operation metadata lives in localStorage (max 20).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
