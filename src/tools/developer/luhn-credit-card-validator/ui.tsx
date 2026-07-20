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
  BRAND_SPECS,
  BRAND_LIST,
  MODE_SPECS,
  MODE_LIST,
  CANONICAL_VALID_NUMBERS,
  normalizeNumber,
  maskCard,
  explainLuhn,
  formatCard,
  validateSingle,
  parseBatchInput,
  validateBatch,
  summarizeBatch,
  renderBatchCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type InputMode,
  type CardFormat,
  type HistoryEntry,
} from "./logic";
import {
  CreditCard,
  History,
  ShieldCheck,
  AlertTriangle,
  ListChecks,
  Hash,
  Lightbulb,
  Wand2,
} from "lucide-react";

const CARD_FORMATS: CardFormat[] = ["plain", "spaced", "dashed", "grouped"];

export default function LuhnCreditCardValidator() {
  const [singleInput, setSingleInput] = useState("");
  const [mode, setMode] = useState<InputMode>("credit");
  const [format, setFormat] = useState<CardFormat>("grouped");
  const [masked, setMasked] = useState(false);
  const [batchInput, setBatchInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.mode) setMode(p.mode);
      if (p.format) setFormat(p.format);
      if (p.mode || p.format) toast.info("Loaded from share link");
    }
  }, []);

  const singleResult = useMemo(() => {
    if (!singleInput.trim()) return null;
    return validateSingle(singleInput, mode, format);
  }, [singleInput, mode, format]);

  const explanation = useMemo(() => {
    if (!singleInput.trim()) return null;
    return explainLuhn(singleInput);
  }, [singleInput]);

  const batchNumbers = useMemo(() => parseBatchInput(batchInput), [batchInput]);
  const batchRows = useMemo(() => validateBatch(batchNumbers, mode), [batchNumbers, mode]);
  const batchSummary = useMemo(() => summarizeBatch(batchRows), [batchRows]);
  const batchCsv = useMemo(() => renderBatchCsv(batchRows), [batchRows]);

  const displayNumber = useMemo(() => {
    if (!singleResult) return "";
    return masked ? singleResult.masked : singleResult.formatted;
  }, [singleResult, masked]);

  const handleSaveHistory = useCallback(
    (singleCount: number, batchTotal: number, batchValid: number, batchInvalid: number) => {
      saveHistory({
        ts: Date.now(),
        mode,
        format,
        singleCount,
        batchTotal,
        batchValid,
        batchInvalid,
      });
      setHistory(loadHistory());
    },
    [mode, format],
  );

  const handleSingleClick = useCallback(() => {
    handleSaveHistory(1, 0, 0, 0);
  }, [handleSaveHistory]);

  const handleClear = useCallback(() => {
    setSingleInput("");
    setBatchInput("");
    setMasked(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleLoadSample = useCallback(() => {
    setSingleInput(CANONICAL_VALID_NUMBERS[0]!.number);
    setBatchInput(
      CANONICAL_VALID_NUMBERS.slice(0, 6).map((c) => c.number).join("\n") +
        "\n" +
        "79927398710",
    );
    toast.success("Loaded sample numbers");
  }, []);

  const toggleMode = (m: InputMode) => setMode(m);
  const toggleFormat = (f: CardFormat) => setFormat(f);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Privacy banner — first thing */}
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-200"
      >
        <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span className="text-xs">
          100% client-side. Card numbers are validated locally in your browser — never transmitted, never logged. History stores only metadata (counts + timestamps), never the numbers themselves.
        </span>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Input mode</Label>
              <div className="flex flex-wrap gap-1">
                {MODE_LIST.map((m) => (
                  <Button
                    key={m}
                    variant={mode === m ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => toggleMode(m)}
                  >
                    {MODE_SPECS[m].label}
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">{MODE_SPECS[mode].hint}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Display format</Label>
              <div className="flex flex-wrap gap-1">
                {CARD_FORMATS.map((f) => (
                  <Button
                    key={f}
                    variant={format === f ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-[11px] capitalize"
                    onClick={() => toggleFormat(f)}
                  >
                    {f}
                  </Button>
                ))}
                <Button
                  variant={masked ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setMasked((v) => !v)}
                  title="Mask all but last 4 digits"
                >
                  •••• Mask
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <CreditCard className="h-4 w-4" /> Single-number validation
          </h3>
          <Input
            value={singleInput}
            onChange={(e) => setSingleInput(e.target.value)}
            placeholder="Paste a credit card / IMEI / gift card number — spaces and dashes OK"
            className="font-mono text-sm"
            inputMode="numeric"
            autoComplete="off"
            data-lpignore="true"
          />
          {singleResult ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={singleResult.valid ? "default" : "destructive"}>
                  {singleResult.valid ? "✓ Luhn-valid" : "✗ Luhn-invalid"}
                </Badge>
                {MODE_SPECS[mode].detectBrand && (
                  <Badge variant="outline">
                    {singleResult.brand ? singleResult.brandLabel : "Unknown brand"}
                  </Badge>
                )}
                <Badge variant={singleResult.modeLengthOk ? "outline" : "secondary"}>
                  {singleResult.length} digits {singleResult.modeLengthOk ? "" : `· wrong for ${MODE_SPECS[mode].label}`}
                </Badge>
                {singleResult.brand && (
                  <Badge variant="outline">BIN {singleResult.bin}</Badge>
                )}
              </div>
              <div className="rounded border bg-muted/30 p-2 font-mono text-sm break-all">
                {displayNumber}
              </div>
              {!singleResult.valid && singleResult.corrected && (
                <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs">
                  <Lightbulb className="inline h-3 w-3 mr-1" />
                  Corrected check digit:{" "}
                  <code className="font-mono">{singleResult.corrected}</code>
                  {" "}
                  (changed last digit from <strong>{singleResult.providedCheck}</strong> to{" "}
                  <strong>{singleResult.expectedCheck}</strong>)
                </div>
              )}
              {!singleResult.valid && singleResult.transposition && (
                <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
                  <AlertTriangle className="inline h-3 w-3 mr-1" />
                  Possible adjacent-transposition typo →{" "}
                  <code className="font-mono">{singleResult.transposition}</code>
                </div>
              )}
              {explanation && explanation.steps.length > 0 && (
                <details className="rounded border bg-background">
                  <summary className="px-3 py-1.5 text-xs cursor-pointer select-none">
                    Step-by-step Luhn visualization (sum={explanation.sum}, mod-10={explanation.mod10})
                  </summary>
                  <div className="p-2 space-y-1">
                    <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 gap-y-0.5 text-[11px] font-mono">
                      <div className="font-semibold text-muted-foreground">pos→</div>
                      <div className="font-semibold text-muted-foreground">digit (×2 if doubled)</div>
                      <div className="font-semibold text-muted-foreground text-right">value</div>
                      {explanation.steps.map((s, i) => (
                        <React.Fragment key={i}>
                          <div className="text-muted-foreground">{s.positionFromRight}</div>
                          <div>
                            {s.digit}
                            {s.doubled && (
                              <span className="text-amber-600 dark:text-amber-400">
                                {" → "}{s.digit * 2}{s.digit * 2 > 9 ? ` → ${s.value}` : ""}
                              </span>
                            )}
                            {!s.doubled && s.positionFromRight === 1 && (
                              <span className="text-muted-foreground"> (check)</span>
                            )}
                          </div>
                          <div className={`text-right ${s.doubled ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}`}>
                            {s.value}
                          </div>
                        </React.Fragment>
                      ))}
                      <div className="col-span-2 border-t pt-1 text-right font-semibold">sum mod 10</div>
                      <div className="col-span-1 border-t pt-1 text-right font-semibold">{explanation.mod10}</div>
                    </div>
                  </div>
                </details>
              )}
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSingleClick(); return displayNumber; }}
                  label="Copy display"
                />
                <CopyButton
                  getText={() => singleResult.normalized}
                  label="Copy raw digits"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBatchInput((prev) => (prev ? `${prev}\n${singleResult.normalized}` : singleResult.normalized))}
                >
                  <ListChecks className="h-3.5 w-3.5 mr-1" /> Send to batch
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Type or paste a number above to see live validation, brand detection, and the step-by-step Luhn breakdown.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Hash className="h-4 w-4" /> Batch validation
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
            placeholder={"One number per line (or comma-separated)\n4242424242424242\n5555555555554444\n378282246310005"}
            className="min-h-[100px] resize-y font-mono text-xs"
          />
          {batchRows.length > 0 ? (
            <>
              <div className="space-y-1 max-h-[300px] overflow-auto">
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
                    {r.brand && (
                      <Badge variant="outline" className="text-[10px]">{BRAND_SPECS[r.brand].label}</Badge>
                    )}
                    <span className="font-mono text-foreground">
                      {r.normalized ? (masked ? maskCard(r.normalized) : formatCard(r.normalized, format)) : "(empty)"}
                    </span>
                    <span className="text-muted-foreground text-[10px]">{r.length}d</span>
                    {r.hint && <span className="text-muted-foreground text-[10px] ml-auto">{r.hint}</span>}
                  </div>
                ))}
              </div>
              {Object.keys(batchSummary.byBrand).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(batchSummary.byBrand).map(([brand, count]) => (
                    <Badge key={brand} variant="secondary" className="text-[10px]">
                      {brand}: {count}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <CopyButton
                  getText={() => { handleSaveHistory(0, batchSummary.total, batchSummary.valid, batchSummary.invalid); return batchCsv; }}
                  label="Copy CSV"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(0, batchSummary.total, batchSummary.valid, batchSummary.invalid); return batchCsv; }}
                  filename="luhn-validation.csv"
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
              Paste multiple numbers above to validate them all in one pass. Bulk-handles 10k+ lines instantly.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Wand2 className="h-4 w-4" /> Reference
            </h3>
            <Button variant="outline" size="sm" onClick={handleLoadSample}>
              Load samples
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
            {BRAND_LIST.map((b) => (
              <div key={b} className="rounded border bg-background px-2 py-1">
                <div className="font-medium text-foreground">{BRAND_SPECS[b].label}</div>
                <div className="text-muted-foreground">prefix: {BRAND_SPECS[b].prefixes[0]}</div>
                <div className="text-muted-foreground">{BRAND_SPECS[b].lengths.join("/")} digits</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <ShareButton getUrl={() => buildShareUrl(mode, format)} />
        <ClearButton onClick={handleClear} />
      </div>

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
                  <Badge variant="outline" className="text-[10px]">{MODE_SPECS[h.mode].label}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.format}</Badge>
                  {h.singleCount > 0 && (
                    <Badge variant="outline" className="text-[10px]">{h.singleCount} single</Badge>
                  )}
                  {h.batchTotal > 0 && (
                    <Badge variant="outline" className="text-[10px]">{h.batchValid}/{h.batchTotal} batch valid</Badge>
                  )}
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground pt-1">
              History stores mode, format, and counts only — never card numbers.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">100% client-side.</strong> Luhn (mod-10) validation runs in your browser. No server, no network, no telemetry on the input field. Numbers are never stored — only operation metadata lives in localStorage (max 20).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
