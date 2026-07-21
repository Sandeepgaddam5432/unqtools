"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  ADDRESS_TYPE_LABELS,
  ADDRESS_TYPE_COLORS,
  IPV6_PRESETS,
  parseIPv6,
  expandIPv6,
  compressIPv6,
  validateIPv6,
  parseBatchInput,
  batchProcess,
  renderBatchCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
  type ValidationResult,
  type ExpansionResult,
  type CompressionResult,
  type BatchResult,
  type AddressType,
} from "./logic";
import {
  History, Network, ChevronsRightLeft, AlertTriangle, CheckCircle2,
  ListChecks, Info, FileText,
} from "lucide-react";

type Mode = "single" | "batch";

const TABS: { id: Mode; label: string; icon: typeof Network }[] = [
  { id: "single", label: "Single address", icon: ChevronsRightLeft },
  { id: "batch", label: "Batch list", icon: ListChecks },
];

export default function IPv6ExpanderCompressorValidator() {
  const [mode, setMode] = useState<Mode>("single");
  const [input, setInput] = useState("2001:db8::1");
  const [batchText, setBatchText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.batch) {
        setMode("batch");
        setBatchText(p.batch);
      } else if (p.input) {
        setMode("single");
        setInput(p.input);
      }
      if (p.input || p.batch) toast.info("Loaded from share link");
    }
  }, []);

  const expandResult = useMemo<ExpansionResult>(() => expandIPv6(input), [input]);
  const compressResult = useMemo<CompressionResult>(() => compressIPv6(input), [input]);
  const validateResult = useMemo<ValidationResult>(() => validateIPv6(input), [input]);

  const batchList = useMemo(() => parseBatchInput(batchText), [batchText]);
  const batchResult = useMemo<BatchResult>(() => batchProcess(batchList), [batchList]);
  const batchCsv = useMemo(() => renderBatchCsv(batchResult), [batchResult]);

  const handleSaveHistory = useCallback(
    (entryInput: string, type?: AddressType, compressed?: string) => {
      saveHistory({ ts: Date.now(), input: entryInput, type, compressed });
      setHistory(loadHistory());
    },
    [],
  );

  const handleClear = useCallback(() => {
    if (mode === "single") setInput("");
    else setBatchText("");
    toast.info("Cleared");
  }, [mode]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {/* Mode tabs */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <Button
                  key={t.id}
                  size="sm"
                  variant={mode === t.id ? "default" : "outline"}
                  onClick={() => setMode(t.id)}
                  className="h-8 text-xs gap-1.5"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Single mode */}
      {mode === "single" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ipv6-input" className="text-xs">IPv6 address (any valid form)</Label>
                <Input
                  id="ipv6-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="2001:db8::1  |  ::ffff:192.0.2.1  |  fe80::1%eth0"
                  className="font-mono text-sm"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {IPV6_PRESETS.map((p) => (
                    <Button
                      key={p}
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] font-mono"
                      onClick={() => setInput(p)}
                    >+ {p}</Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {validateResult.valid && validateResult.address ? (
            <>
              {/* Validation verdict + type */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Valid IPv6 address
                    </h3>
                    {validateResult.type && (
                      <Badge variant={badgeVariant(validateResult.type)} className="text-[10px]">
                        {ADDRESS_TYPE_LABELS[validateResult.type]}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field
                      label="Expanded (full 128-bit form)"
                      value={validateResult.expanded ?? ""}
                      mono
                    />
                    <Field
                      label="Compressed (RFC 5952 canonical)"
                      value={validateResult.compressed ?? ""}
                      mono
                    />
                  </div>

                  {validateResult.warnings.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <ul className="list-disc pl-4 space-y-0.5">
                        {validateResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Rule explanations */}
                  <div className="pt-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                      <Info className="h-3 w-3" /> Rules applied ({validateResult.rules.length})
                    </div>
                    <div className="space-y-1">
                      {validateResult.rules.map((r, i) => (
                        <div key={i} className="rounded border bg-background px-2 py-1.5 text-[11px]">
                          <span className="font-semibold text-foreground">{r.rule}.</span>{" "}
                          <span className="text-muted-foreground">{r.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <CopyButton getText={() => validateResult.compressed ?? ""} label="Copy compressed" />
                    <CopyButton getText={() => validateResult.expanded ?? ""} label="Copy expanded" />
                    <ShareButton
                      getUrl={() => {
                        handleSaveHistory(input, validateResult.type, validateResult.compressed);
                        return buildShareUrl(input, "");
                      }}
                    />
                    <ClearButton onClick={handleClear} />
                  </div>
                </CardContent>
              </Card>

              {/* All representations */}
              {validateResult.representations && validateResult.representations.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="h-4 w-4" /> All valid representations ({validateResult.representations.length})
                    </h3>
                    <div className="space-y-1 max-h-[280px] overflow-auto">
                      {validateResult.representations.map((rep, i) => (
                        <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                          <span className="font-mono text-foreground break-all flex-1">{rep}</span>
                          <CopyButton getText={() => rep} size="icon-sm" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Expand + Compose detail */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <ChevronsRightLeft className="h-4 w-4" /> Expand / Compress detail
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Expand result</div>
                      {expandResult.ok && expandResult.expanded ? (
                        <Field label="Expanded" value={expandResult.expanded} mono small />
                      ) : (
                        <p className="text-[11px] text-destructive">{expandResult.error}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Compress result</div>
                      {compressResult.ok && compressResult.compressed ? (
                        <Field
                          label="Compressed"
                          value={compressResult.compressed}
                          mono
                          small
                          hint={compressResult.runStart !== null
                            ? `'::' replaces ${compressResult.runLength} zero hextets at index ${compressResult.runStart}`
                            : "no '::' (no 2+ zero run)"}
                        />
                      ) : (
                        <p className="text-[11px] text-destructive">{compressResult.error}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            input.trim() !== "" && (
              <ErrorBanner message={validateResult.errors.join("; ") || "Invalid IPv6 address"} />
            )
          )}
        </>
      )}

      {/* Batch mode */}
      {mode === "batch" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ipv6-batch" className="text-xs">IPv6 addresses (one per line or comma-separated)</Label>
              <Textarea
                id="ipv6-batch"
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={"2001:db8::1\n::1\nfe80::1%eth0\n::ffff:192.0.2.1\n2001:DB8::1"}
                className="min-h-[140px] resize-y font-mono text-xs"
              />
            </div>

            {batchResult.total > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Stat label="Total" value={batchResult.total} />
                  <Stat label="Valid" value={batchResult.okCount} highlight="good" />
                  <Stat label="Invalid" value={batchResult.errCount} highlight={batchResult.errCount > 0 ? "bad" : undefined} />
                </div>

                <div className="space-y-1 max-h-[400px] overflow-auto">
                  {batchResult.rows.map((r, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-muted-foreground text-[10px] w-6">#{i + 1}</span>
                        <span className="font-mono text-foreground truncate flex-1">{r.input}</span>
                        {r.ok ? (
                          <Badge variant="secondary" className="text-[10px]">valid</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">invalid</Badge>
                        )}
                        {r.type && (
                          <Badge variant={badgeVariant(r.type)} className="text-[10px]">
                            {ADDRESS_TYPE_LABELS[r.type]}
                          </Badge>
                        )}
                      </div>
                      {r.ok && (
                        <div className="mt-1 font-mono text-[10px] text-muted-foreground space-y-0.5">
                          <div><span className="text-foreground">expanded:</span> {r.expanded}</div>
                          <div><span className="text-foreground">compressed:</span> {r.compressed}</div>
                        </div>
                      )}
                      {!r.ok && r.error && (
                        <div className="mt-1 text-[10px] text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {r.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => {
                      handleSaveHistory(`batch ${batchResult.okCount}/${batchResult.total}`, undefined, undefined);
                      return batchResult.rows
                        .map((r) => r.ok
                          ? `${r.input}\t${r.compressed}\t${r.expanded}\t${r.type ?? ""}`
                          : `${r.input}\tERROR\t${r.error ?? ""}`)
                        .join("\n");
                    }}
                    label="Copy all"
                    disabled={batchResult.total === 0}
                  />
                  <DownloadButton
                    getText={() => batchCsv}
                    filename="ipv6-expand-compress.csv"
                    label="Download CSV"
                    disabled={batchResult.total === 0}
                  />
                  <DownloadButton
                    getText={() => renderJson(batchResult)}
                    filename="ipv6-expand-compress.json"
                    label="Download JSON"
                    mime="application/json"
                    disabled={batchResult.total === 0}
                  />
                  <ShareButton getUrl={() => buildShareUrl("", batchText)} />
                  <ClearButton onClick={handleClear} />
                </div>
              </>
            )}

            {batchResult.total === 0 && (
              <EmptyState
                title="Enter IPv6 addresses to expand, compress and validate"
                hint="One per line or comma-separated. Each entry is parsed, validated, expanded, compressed and classified by type."
                icon={<ListChecks className="h-8 w-8" />}
              />
            )}
          </CardContent>
        </Card>
      )}

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
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-2 py-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {h.type && (
                      <Badge variant={badgeVariant(h.type)} className="text-[10px]">
                        {ADDRESS_TYPE_LABELS[h.type]}
                      </Badge>
                    )}
                    <span className="font-mono text-muted-foreground truncate flex-1">{h.input}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  {h.compressed && (
                    <div className="text-[10px] text-foreground font-mono mt-0.5">{h.compressed}</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All IPv6 parsing, expansion, compression and validation runs locally with BigInt 128-bit arithmetic. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function badgeVariant(type: AddressType): "default" | "secondary" | "outline" | "destructive" {
  const c = ADDRESS_TYPE_COLORS[type];
  if (c === "default") return "default";
  if (c === "secondary") return "secondary";
  return "outline";
}

function Field({
  label,
  value,
  hint,
  mono,
  small,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`${small ? "text-[11px]" : "text-sm"} font-semibold text-foreground ${mono ? "font-mono break-all" : ""}`}>
        {value}
      </div>
      {hint && <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{hint}</div>}
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
