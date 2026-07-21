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
  FORMAT_LABELS,
  FAMILY_LABELS,
  IP_PRESETS,
  parseIPv4Auto,
  formatIPv4All,
  parseIPv6,
  formatIPv6All,
  convertAny,
  parseBatchInput,
  batchConvert,
  renderBatchCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
  type IPv4AllFormats,
  type IPv6AllFormats,
  type BatchResult,
} from "./logic";
import { History, Binary, ArrowRightLeft, AlertTriangle, CheckCircle2, ListChecks } from "lucide-react";

type Mode = "single" | "batch";

const TABS: { id: Mode; label: string; icon: typeof Binary }[] = [
  { id: "single", label: "Single address", icon: ArrowRightLeft },
  { id: "batch", label: "Batch list", icon: ListChecks },
];

export default function IPAddressFormatConverter() {
  const [mode, setMode] = useState<Mode>("single");
  const [input, setInput] = useState("192.168.0.1");
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

  const singleResult = useMemo(() => convertAny(input), [input]);

  const batchList = useMemo(() => parseBatchInput(batchText), [batchText]);
  const batchResult = useMemo<BatchResult>(() => batchConvert(batchList), [batchList]);
  const batchCsv = useMemo(() => renderBatchCsv(batchResult), [batchResult]);

  const handleSaveHistory = useCallback(
    (summary: string, entryInput: string, family?: "ipv4" | "ipv6") => {
      saveHistory({ ts: Date.now(), input: entryInput, family, summary });
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
                <Label htmlFor="ipfc-input" className="text-xs">IP address (any format)</Label>
                <Input
                  id="ipfc-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="192.168.0.1  |  0xC0A80001  |  3232235521  |  2001:db8::1"
                  className="font-mono text-sm"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {IP_PRESETS.map((p) => (
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

          {singleResult.ok ? (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Result
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {FAMILY_LABELS[singleResult.family as "ipv4" | "ipv6"]}
                    </Badge>
                    {singleResult.format && (
                      <Badge variant="outline" className="text-[10px]">
                        {FORMAT_LABELS[singleResult.format]}
                      </Badge>
                    )}
                  </div>
                </div>

                {singleResult.family === "ipv4" && singleResult.ipv4 && (
                  <IPv4Output v4={singleResult.ipv4} />
                )}
                {singleResult.family === "ipv6" && singleResult.ipv6 && (
                  <IPv6Output v6={singleResult.ipv6} />
                )}

                <div className="flex flex-wrap gap-2">
                  <ShareButton
                    getUrl={() => {
                      handleSaveHistory(
                        singleResult.family === "ipv4"
                          ? singleResult.ipv4?.dottedDecimal ?? ""
                          : singleResult.ipv6?.compressed ?? "",
                        input,
                        singleResult.family,
                      );
                      return buildShareUrl(input, "");
                    }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </CardContent>
            </Card>
          ) : (
            input.trim() !== "" && (
              <ErrorBanner message={singleResult.error ?? "Invalid IP address"} />
            )
          )}
        </>
      )}

      {/* Batch mode */}
      {mode === "batch" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ipfc-batch" className="text-xs">Addresses (one per line or comma-separated)</Label>
              <Textarea
                id="ipfc-batch"
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder={"192.168.0.1\n0xC0A80001\n3232235521\n2001:db8::1\n::ffff:192.0.2.1"}
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
                          <>
                            <Badge variant="secondary" className="text-[10px]">
                              {r.family ? FAMILY_LABELS[r.family] : ""}
                            </Badge>
                            {r.format && (
                              <Badge variant="outline" className="text-[10px]">{FORMAT_LABELS[r.format]}</Badge>
                            )}
                          </>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">invalid</Badge>
                        )}
                      </div>
                      {r.ok && r.ipv4 && (
                        <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {r.ipv4.dottedDecimal} · {r.ipv4.decimal} · {r.ipv4.hex} · {r.ipv4.octal}
                        </div>
                      )}
                      {r.ok && r.ipv6 && (
                        <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {r.ipv6.compressed} · {r.ipv6.expanded}
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
                      handleSaveHistory(`${batchResult.okCount}/${batchResult.total} converted`, batchText);
                      return batchResult.rows
                        .map((r) => {
                          if (!r.ok) return `${r.input}\tERROR\t${r.error ?? ""}`;
                          if (r.family === "ipv4" && r.ipv4) {
                            return [r.input, r.ipv4.dottedDecimal, r.ipv4.decimal, r.ipv4.hex, r.ipv4.octal, r.ipv4.binary].join("\t");
                          }
                          if (r.family === "ipv6" && r.ipv6) {
                            return [r.input, r.ipv6.compressed, r.ipv6.expanded, r.ipv6.decimal, r.ipv6.hex].join("\t");
                          }
                          return r.input;
                        })
                        .join("\n");
                    }}
                    label="Copy all"
                    disabled={batchResult.total === 0}
                  />
                  <DownloadButton
                    getText={() => batchCsv}
                    filename="ip-format-conversions.csv"
                    label="Download CSV"
                    disabled={batchResult.total === 0}
                  />
                  <DownloadButton
                    getText={() => renderJson(batchResult)}
                    filename="ip-format-conversions.json"
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
                title="Enter addresses to convert in bulk"
                hint="One per line or comma-separated. Each entry is auto-detected as IPv4 or IPv6 and converted to every representation."
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
                    {h.family && (
                      <Badge variant="outline" className="text-[10px]">{FAMILY_LABELS[h.family]}</Badge>
                    )}
                    <span className="font-mono text-muted-foreground truncate flex-1">{h.input}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                  {h.summary && (
                    <div className="text-[10px] text-foreground mt-0.5">{h.summary}</div>
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
            <strong className="text-foreground">Privacy:</strong> All conversions run locally. IPv6 math uses BigInt 128-bit arithmetic. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function IPv4Output({ v4 }: { v4: IPv4AllFormats }) {
  const rows: { label: string; value: string }[] = [
    { label: "Dotted decimal", value: v4.dottedDecimal },
    { label: "32-bit integer", value: v4.decimal },
    { label: "Hexadecimal", value: v4.hex },
    { label: "Octal", value: v4.octal },
    { label: "Binary", value: v4.binary },
    { label: "Dotted hex", value: v4.dottedHex },
    { label: "Dotted octal", value: v4.dottedOctal },
    { label: "Dotted binary", value: v4.dottedBinary },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded border bg-background px-3 py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{r.label}</div>
              <div className="text-xs font-mono text-foreground break-all">{r.value}</div>
            </div>
            <CopyButton getText={() => r.value} size="icon-sm" />
          </div>
        ))}
      </div>

      <div className="pt-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Per-octet breakdown</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="p-1.5">#</th>
                <th className="p-1.5">Decimal</th>
                <th className="p-1.5">Hex</th>
                <th className="p-1.5">Binary</th>
                <th className="p-1.5">Octal</th>
              </tr>
            </thead>
            <tbody>
              {v4.octets.map((o) => (
                <tr key={o.index} className="border-b hover:bg-muted/30">
                  <td className="p-1.5 font-mono text-muted-foreground">{o.index}</td>
                  <td className="p-1.5 font-mono">{o.decimal}</td>
                  <td className="p-1.5 font-mono">{o.hex}</td>
                  <td className="p-1.5 font-mono">{o.binary}</td>
                  <td className="p-1.5 font-mono">{o.octal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function IPv6Output({ v6 }: { v6: IPv6AllFormats }) {
  const rows: { label: string; value: string }[] = [
    { label: "Compressed (RFC 5952)", value: v6.compressed },
    { label: "Expanded", value: v6.expanded },
    { label: "128-bit decimal integer", value: v6.decimal },
    { label: "128-bit hex", value: v6.hex },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded border bg-background px-3 py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{r.label}</div>
              <div className="text-xs font-mono text-foreground break-all">{r.value}</div>
            </div>
            <CopyButton getText={() => r.value} size="icon-sm" />
          </div>
        ))}
      </div>
      <div className="rounded border bg-background px-3 py-2">
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground">128-bit binary</div>
        <div className="text-[10px] font-mono text-foreground break-all">
          {v6.binary.match(/.{1,16}/g)?.join(" ")}
        </div>
      </div>
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
