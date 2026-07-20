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
  COMMON_DOMAINS,
  NAME_FORMATS,
  HONESTY_BANNER,
  validateEmail,
  parseEmail,
  generateEmailBatch,
  maskEmail,
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
  type NameFormat,
  type HistoryEntry,
} from "./logic";
import {
  Mail,
  History,
  ShieldCheck,
  AlertTriangle,
  Wand2,
  ListChecks,
  Hash,
  AtSign,
  User,
} from "lucide-react";

export default function EmailAddressGeneratorValidator() {
  const [mode, setMode] = useState<"generate" | "validate" | "batch">("generate");
  const [genMode, setGenMode] = useState<"random" | "name">("random");
  const [count, setCount] = useState(10);
  const [domain, setDomain] = useState("example.com");
  const [firstName, setFirstName] = useState("Jane");
  const [lastName, setLastName] = useState("Doe");
  const [nameFormat, setNameFormat] = useState<NameFormat>("first.last");
  const [seed, setSeed] = useState("test-seed");
  const [masked, setMasked] = useState(false);
  const [singleInput, setSingleInput] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.mode) setGenMode(p.mode);
      if (p.count) setCount(p.count);
      if (p.domain) setDomain(p.domain);
      if (p.format) setNameFormat(p.format);
      toast.info("Loaded from share link");
    }
  }, []);

  // ---- generate mode ----
  const generated = useMemo(() => {
    try {
      return generateEmailBatch({
        mode: genMode,
        count,
        domain: domain || undefined,
        firstName,
        lastName,
        format: nameFormat,
        seed: seed || "default",
      });
    } catch {
      return [];
    }
  }, [genMode, count, domain, firstName, lastName, nameFormat, seed]);

  const generatedDisplay = useMemo(
    () => generated.map((e) => (masked ? maskEmail(e) : e)),
    [generated, masked],
  );
  const generatedText = useMemo(() => generatedDisplay.join("\n"), [generatedDisplay]);

  // ---- single validate mode ----
  const singleResult = useMemo(() => {
    if (!singleInput.trim()) return null;
    return validateEmail(singleInput);
  }, [singleInput]);

  const singleParsed = useMemo(() => {
    if (!singleInput.trim()) return null;
    return parseEmail(singleInput);
  }, [singleInput]);

  const singleDisplay = useMemo(() => {
    if (!singleResult) return "";
    return masked ? maskEmail(singleResult.normalized) : singleResult.normalized;
  }, [singleResult, masked]);

  // ---- batch mode ----
  const batchEmails = useMemo(() => parseBatchInput(batchInput), [batchInput]);
  const batchRows = useMemo(() => validateBatch(batchEmails), [batchEmails]);
  const batchSummary = useMemo(() => summarizeBatch(batchRows), [batchRows]);
  const batchCsv = useMemo(() => renderBatchCsv(batchRows), [batchRows]);

  // ---- handlers ----
  const handleRandomSeed = useCallback(() => {
    const s = Math.random().toString(36).slice(2, 10);
    setSeed(s);
    toast.success(`New seed: ${s}`);
  }, []);

  const handleSaveHistory = useCallback(
    (action: HistoryEntry["action"], batchTotal = 0, batchValid = 0, batchInvalid = 0, batchDisposable = 0) => {
      saveHistory({
        ts: Date.now(),
        action,
        mode: action === "generate" ? genMode : null,
        domain: action === "generate" ? domain : null,
        generateCount: action === "generate" ? count : 0,
        batchTotal,
        batchValid,
        batchInvalid,
        batchDisposable,
      });
      setHistory(loadHistory());
    },
    [genMode, count, domain],
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
    () => buildShareUrl(genMode, count, domain, nameFormat),
    [genMode, count, domain, nameFormat],
  );

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
          100% client-side. RFC 5322 syntax, disposable detection, and typo suggestions all run locally — addresses are never transmitted or logged. There is no MX-record lookup (the tool is fully offline). History stores only metadata (counts + timestamps), never the addresses themselves.
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
              <Label className="text-xs">Display</Label>
              <div className="flex flex-wrap gap-1">
                <Button
                  variant={masked ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => setMasked((v) => !v)}
                  title="Mask local-part"
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
              <Wand2 className="h-4 w-4" /> Generate test emails
            </h3>
            <div className="flex flex-wrap gap-1">
              {(["random", "name"] as const).map((m) => (
                <Button
                  key={m}
                  variant={genMode === m ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[11px] capitalize"
                  onClick={() => setGenMode(m)}
                >
                  {m === "random" && <AtSign className="h-3.5 w-3.5 mr-1" />}
                  {m === "name" && <User className="h-3.5 w-3.5 mr-1" />}
                  {m}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="eag-domain" className="text-xs">Domain (blank = random common provider)</Label>
                <Input
                  id="eag-domain"
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="example.com"
                  className="h-9 text-sm font-mono"
                />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {COMMON_DOMAINS.slice(0, 6).map((d) => (
                    <Button
                      key={d}
                      variant="ghost"
                      size="sm"
                      className="h-5 text-[10px]"
                      onClick={() => setDomain(d)}
                    >{d}</Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eag-count" className="text-xs">Count (max 1000)</Label>
                <Input
                  id="eag-count"
                  type="number"
                  min={1}
                  max={1000}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Math.min(1000, parseInt(e.target.value, 10) || 1)))}
                  className="h-9 text-sm"
                />
              </div>
              {genMode === "name" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="eag-first" className="text-xs">First name</Label>
                    <Input
                      id="eag-first"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="eag-last" className="text-xs">Last name</Label>
                    <Input
                      id="eag-last"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="eag-fmt" className="text-xs">Name format</Label>
                    <select
                      id="eag-fmt"
                      value={nameFormat}
                      onChange={(e) => setNameFormat(e.target.value as NameFormat)}
                      className="h-9 w-full rounded border bg-background px-2 text-sm"
                    >
                      {NAME_FORMATS.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="eag-seed" className="text-xs">Seed (deterministic)</Label>
                <div className="flex gap-1">
                  <Input
                    id="eag-seed"
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
                    filename={`emails-${genMode}.txt`}
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => "email\n" + generated.join("\n")}
                    filename={`emails-${genMode}.csv`}
                    mime="text/csv"
                    label="Download CSV"
                  />
                </div>
              </>
            ) : (
              <EmptyState
                title="No emails generated"
                hint="Pick a mode (random or name-based) and a domain, then addresses will appear here deterministically."
                icon={<Mail className="h-8 w-8" />}
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
              <ShieldCheck className="h-4 w-4" /> Validate an email address
            </h3>
            <Textarea
              value={singleInput}
              onChange={(e) => setSingleInput(e.target.value)}
              placeholder="user@example.com"
              className="min-h-[60px] resize-y font-mono text-sm"
            />
            {singleResult && singleParsed && (
              <div className="rounded border bg-background p-3 space-y-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={singleResult.valid ? "default" : "destructive"}>
                    {singleResult.valid ? "VALID" : "INVALID"}
                  </Badge>
                  {singleResult.isDisposable && (
                    <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" /> disposable
                    </Badge>
                  )}
                  {singleResult.isRole && (
                    <Badge variant="outline" className="text-blue-600 dark:text-blue-400">
                      <AtSign className="h-3 w-3" /> role
                    </Badge>
                  )}
                  {singleResult.typoSuggestion && (
                    <Badge variant="outline" className="text-purple-600 dark:text-purple-400">
                      typo? → {singleParsed.baseLocal}@{singleResult.typoSuggestion}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{singleResult.message}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <Detail label="Local-part" value={singleParsed.local} />
                  <Detail label="Domain" value={singleParsed.domain} />
                  <Detail label="TLD" value={singleResult.tld ?? "—"} />
                  <Detail label="Plus-tag" value={singleParsed.plusTag ?? "—"} />
                </div>
                <div className="text-[10px] text-muted-foreground font-mono break-all">
                  normalized: {singleDisplay}
                </div>
              </div>
            )}
            {!singleResult && (
              <EmptyState
                title="Enter an email address to validate"
                hint="We check RFC 5322 syntax, domain/TLD sanity, disposable providers, role addresses, and common typos — all in your browser."
                icon={<Mail className="h-8 w-8" />}
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
              placeholder={"user@example.com\ninfo@company.com\nx@mailinator.com"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            {batchRows.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <Stat label="Total" value={batchSummary.total} />
                  <Stat label="Valid" value={batchSummary.valid} highlight="good" />
                  <Stat label="Invalid" value={batchSummary.invalid} highlight="bad" />
                  <Stat label="Disposable" value={batchSummary.disposable} />
                  <Stat label="Role" value={batchSummary.role} />
                </div>
                <div className="rounded border bg-background max-h-[360px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">#</th>
                        <th className="px-2 py-1 text-left">Email</th>
                        <th className="px-2 py-1 text-left">TLD</th>
                        <th className="px-2 py-1 text-left">Flags</th>
                        <th className="px-2 py-1 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchRows.map((r) => (
                        <tr key={r.index} className="border-t">
                          <td className="px-2 py-1 text-muted-foreground">{r.index + 1}</td>
                          <td className="px-2 py-1 font-mono break-all">{r.normalized || r.raw}</td>
                          <td className="px-2 py-1">{r.tld ?? "—"}</td>
                          <td className="px-2 py-1">
                            <div className="flex flex-wrap gap-1">
                              {r.isDisposable && (
                                <Badge variant="outline" className="text-[9px] text-amber-600 dark:text-amber-400">disposable</Badge>
                              )}
                              {r.isRole && (
                                <Badge variant="outline" className="text-[9px] text-blue-600 dark:text-blue-400">role</Badge>
                              )}
                              {r.typoSuggestion && (
                                <Badge variant="outline" className="text-[9px] text-purple-600 dark:text-purple-400">typo</Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-1">
                            <Badge variant={r.valid ? "default" : "destructive"} className="text-[10px]">
                              {r.valid ? "valid" : "invalid"}
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
                    filename="email-batch-results.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveHistory(
                      "validate_batch",
                      batchSummary.total,
                      batchSummary.valid,
                      batchSummary.invalid,
                      batchSummary.disposable,
                    )}
                    className="gap-1.5"
                  >
                    <History className="h-3.5 w-3.5" /> Save to history
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState
                title="Enter multiple email addresses"
                hint="One per line (commas and semicolons also work). We validate each and produce a downloadable CSV with disposable / role / typo flags."
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
                      <Badge variant="outline" className="mr-2">{h.mode}</Badge>
                      <Badge variant="outline" className="mr-2">{h.generateCount} × {h.domain || "random"}</Badge>
                    </>
                  )}
                  {h.action === "validate_batch" && (
                    <>
                      <Badge variant="outline" className="mr-2">{h.batchTotal} total</Badge>
                      <Badge variant="outline" className="mr-2">{h.batchValid} valid</Badge>
                      <Badge variant="outline" className="mr-2">{h.batchInvalid} invalid</Badge>
                      <Badge variant="outline" className="mr-2">{h.batchDisposable} disposable</Badge>
                    </>
                  )}
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
            <strong className="text-foreground">Privacy:</strong> All validation, generation, and disposable/typo checks run 100% client-side. Email addresses never leave your browser. History stores only metadata (counts + timestamps), never the addresses themselves.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
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
