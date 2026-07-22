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
  History, Mail, Terminal, AlertCircle, BookOpen,
  CheckCircle2, ShieldAlert, Plus, X, ListChecks,
} from "lucide-react";
import {
  QUALIFIER_TABLE,
  LOOKUP_MECHANISMS,
  explainMechanism,
  buildRecord,
  validateRecord,
  detectMultipleSpfRecords,
  generateCommands,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SpfInput,
  type ValidationIssue,
  type HistoryEntry,
} from "./logic";

type Tab = "generate" | "validate";

const TABS: { id: Tab; label: string }[] = [
  { id: "generate", label: "Generator" },
  { id: "validate", label: "Validator" },
];

const DEFAULT_INPUT: SpfInput = {
  ip4: ["192.0.2.0/24"],
  ip6: [],
  a: [],
  mx: [],
  include: ["_spf.google.com"],
  all: "~",
};

export default function SpfRecordGeneratorValidator() {
  const [tab, setTab] = useState<Tab>("generate");
  const [input, setInput] = useState<SpfInput>(DEFAULT_INPUT);
  const [validateInput, setValidateInput] = useState("v=spf1 ip4:192.0.2.0/24 include:_spf.google.com ~all");
  const [includeDepth, setIncludeDepth] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.tab) setTab(p.tab);
      if (p.record) {
        setValidateInput(p.record);
        if (p.tab === "validate") setTab("validate");
      }
      if (p.tab || p.record) toast.info("Loaded from share link");
    }
  }, []);

  const generatedRecord = useMemo(() => buildRecord(input), [input]);
  const validateResult = useMemo(
    () => validateRecord(validateInput, { includeDepth }),
    [validateInput, includeDepth],
  );
  const commands = useMemo(() => {
    // Try to extract domain from validate input if it's a record
    return generateCommands("example.com");
  }, []);

  const lookupMeterTone = useMemo(() => {
    if (validateResult.lookupCount > validateResult.lookupLimit) return "bad";
    if (validateResult.lookupCount > 7) return "warn";
    return "good";
  }, [validateResult.lookupCount, validateResult.lookupLimit]);

  const updateList = (key: "ip4" | "ip6" | "a" | "mx" | "include", idx: number, value: string) => {
    setInput((prev) => {
      const next = [...prev[key]];
      next[idx] = value;
      return { ...prev, [key]: next };
    });
  };
  const addToList = (key: "ip4" | "ip6" | "a" | "mx" | "include") => {
    setInput((prev) => ({ ...prev, [key]: [...prev[key], ""] }));
  };
  const removeFromList = (key: "ip4" | "ip6" | "a" | "mx" | "include", idx: number) => {
    setInput((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  };

  const handleSaveHistory = useCallback((action: "generate" | "validate") => {
    const count = action === "generate"
      ? input.ip4.length + input.ip6.length + input.a.length + input.mx.length + input.include.length + (input.all !== "none" ? 1 : 0) + (input.redirect ? 1 : 0)
      : validateResult.mechanisms.length;
    saveHistory({ ts: Date.now(), action, count });
    setHistory(loadHistory());
  }, [input, validateResult.mechanisms.length]);

  const handleClear = useCallback(() => {
    setInput(DEFAULT_INPUT);
    setValidateInput("v=spf1 ip4:192.0.2.0/24 include:_spf.google.com ~all");
    setIncludeDepth({});
    toast.info("Reset to defaults");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareUrl = useMemo(
    () => buildShareUrl({
      tab,
      ...(tab === "validate" ? { record: validateInput } : {}),
    }),
    [tab, validateInput],
  );

  const issueTone = (level: ValidationIssue["level"]): string => {
    if (level === "error") return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30";
    if (level === "warning") return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
    return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30";
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map((t) => (
              <Button
                key={t.id}
                variant={tab === t.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {tab === "generate" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> SPF Record Builder
              </h3>
              <MechanismEditor
                title="ip4 (IPv4 CIDR)"
                placeholder="192.0.2.0/24"
                values={input.ip4}
                onChange={(i, v) => updateList("ip4", i, v)}
                onAdd={() => addToList("ip4")}
                onRemove={(i) => removeFromList("ip4", i)}
                help="Does NOT count as a DNS lookup. Recommended for static IP ranges."
              />
              <MechanismEditor
                title="ip6 (IPv6 CIDR)"
                placeholder="2001:db8::/32"
                values={input.ip6}
                onChange={(i, v) => updateList("ip6", i, v)}
                onAdd={() => addToList("ip6")}
                onRemove={(i) => removeFromList("ip6", i)}
                help="Does NOT count as a DNS lookup."
              />
              <MechanismEditor
                title="a (A/AAAA record match)"
                placeholder="leave empty for bare 'a' or example.com"
                values={input.a}
                onChange={(i, v) => updateList("a", i, v)}
                onAdd={() => addToList("a")}
                onRemove={(i) => removeFromList("a", i)}
                help="Counts as 1 DNS lookup each."
              />
              <MechanismEditor
                title="mx (MX record match)"
                placeholder="leave empty for bare 'mx' or example.com"
                values={input.mx}
                onChange={(i, v) => updateList("mx", i, v)}
                onAdd={() => addToList("mx")}
                onRemove={(i) => removeFromList("mx", i)}
                help="Counts as 1 DNS lookup each."
              />
              <MechanismEditor
                title="include (another domain's SPF)"
                placeholder="_spf.google.com"
                values={input.include}
                onChange={(i, v) => updateList("include", i, v)}
                onAdd={() => addToList("include")}
                onRemove={(i) => removeFromList("include", i)}
                help="Counts as 1 DNS lookup each. Recursive includes from the included domain also count."
              />
              {input.include.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Recursive include depth (lookup count per include, excluding the include itself)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    For accurate recursive lookup counting, enter how many lookups each included domain's SPF triggers (you can find this by validating each included domain's SPF separately). Leave 0 if unknown.
                  </p>
                  {input.include.filter(Boolean).map((inc) => (
                    <div key={inc} className="flex items-center gap-2 text-xs">
                      <code className="font-mono text-foreground flex-1 truncate">{inc}</code>
                      <Input
                        type="number"
                        min={0}
                        max={20}
                        value={includeDepth[inc.toLowerCase()] ?? 0}
                        onChange={(e) => setIncludeDepth((prev) => ({ ...prev, [inc.toLowerCase()]: Number(e.target.value) }))}
                        className="h-7 w-20 text-xs"
                      />
                      <span className="text-[10px] text-muted-foreground">extra lookups</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">all qualifier (default verdict)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(["-", "~", "?", "+", "none"] as const).map((q) => (
                    <Button
                      key={q}
                      variant={input.all === q ? "default" : "outline"}
                      size="sm"
                      onClick={() => setInput((prev) => ({ ...prev, all: q }))}
                      className="font-mono"
                    >
                      {q === "none" ? "(omit all)" : `${q}all`}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  <strong>-all</strong> = Fail (recommended). <strong>~all</strong> = SoftFail (rollout). <strong>?all</strong> = Neutral. <strong>+all</strong> = NEVER (allows everyone).
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">redirect= (optional — replaces this record)</Label>
                <Input
                  value={input.redirect ?? ""}
                  onChange={(e) => setInput((prev) => ({ ...prev, redirect: e.target.value }))}
                  placeholder="spf.example.com (leave empty to use 'all' instead)"
                  className="font-mono text-sm h-8"
                />
                <p className="text-[11px] text-muted-foreground">
                  Use <code>redirect=</code> OR <code>all</code> — never both. Redirect replaces the current record with the target domain's SPF.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ShareButton getUrl={() => { handleSaveHistory("generate"); return shareUrl; }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> Generated Record
              </h3>
              <pre className="font-mono text-xs text-foreground whitespace-pre-wrap break-all bg-muted/40 rounded px-3 py-2 border">
                {generatedRecord}
              </pre>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Length" value={`${generatedRecord.length} chars`} hint={generatedRecord.length > 255 ? "Over 255 — needs TXT split" : undefined} tone={generatedRecord.length > 255 ? "warn" : undefined} />
                <Stat label="Mechanisms" value={validateRecord(generatedRecord, { includeDepth }).mechanisms.length} />
                <Stat label="DNS lookups" value={validateRecord(generatedRecord, { includeDepth }).lookupCount} hint={`/ ${validateRecord(generatedRecord, { includeDepth }).lookupLimit} max`} tone={validateRecord(generatedRecord, { includeDepth }).lookupCount > 7 ? "warn" : undefined} />
                <Stat label="Valid" value={validateRecord(generatedRecord, { includeDepth }).valid ? "Yes" : "No"} tone={validateRecord(generatedRecord, { includeDepth }).valid ? "good" : "bad"} />
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleSaveHistory("generate"); return generatedRecord; }} label="Copy record" />
                <DownloadButton getText={() => generatedRecord} filename="spf-record.txt" mime="text/plain" label="Download .txt" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setValidateInput(generatedRecord); setTab("validate"); toast.info("Sent to validator"); }}
                >
                  → Validate
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {tab === "validate" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Validate an SPF record
              </h3>
              <Textarea
                value={validateInput}
                onChange={(e) => setValidateInput(e.target.value)}
                placeholder="v=spf1 ip4:192.0.2.0/24 include:_spf.google.com ~all"
                className="min-h-[80px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => validateInput} label="Copy record" />
                <ShareButton getUrl={() => { handleSaveHistory("validate"); return shareUrl; }} />
                <ClearButton onClick={() => setValidateInput("")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4" /> Validation Result
                </h3>
                <Badge
                  variant="outline"
                  className={`text-[11px] ${
                    validateResult.valid
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-red-500/10 text-red-700 dark:text-red-300"
                  }`}
                >
                  {validateResult.valid ? "VALID" : "INVALID"}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">DNS lookup count (RFC 7208 §4.6.4 limit: {validateResult.lookupLimit})</span>
                  <span className={`font-mono font-medium ${
                    lookupMeterTone === "bad"
                      ? "text-red-600 dark:text-red-400"
                      : lookupMeterTone === "warn"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                  }`}>
                    {validateResult.lookupCount} / {validateResult.lookupLimit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      lookupMeterTone === "bad"
                        ? "bg-red-500"
                        : lookupMeterTone === "warn"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, (validateResult.lookupCount / validateResult.lookupLimit) * 100)}%` }}
                  />
                </div>
              </div>

              {validateResult.issues.length === 0 ? (
                <div className="flex items-center gap-2 rounded border bg-emerald-500/5 px-3 py-2 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-foreground">No issues found. Record is RFC 7208-valid.</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {validateResult.issues.map((iss, i) => (
                    <div key={i} className={`rounded border px-3 py-2 text-xs space-y-0.5 ${issueTone(iss.level)}`}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] uppercase">{iss.level}</Badge>
                        <code className="font-mono text-[10px] opacity-70">{iss.code}</code>
                      </div>
                      <div className="text-foreground">{iss.message}</div>
                      {iss.fix && (
                        <div className="text-[11px] opacity-80">
                          <span className="font-medium">Fix:</span> {iss.fix}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {validateResult.mechanisms.length > 0 && (
                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Parsed mechanisms ({validateResult.mechanisms.length})
                  </Label>
                  <div className="space-y-1 pt-1">
                    {validateResult.mechanisms.map((m, i) => {
                      const expl = explainMechanism(m.type);
                      const isLookup = LOOKUP_MECHANISMS.has(m.type);
                      return (
                        <div key={i} className="rounded border bg-background px-2 py-1.5 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="font-mono text-foreground">
                              {m.qualifier !== "+" ? m.qualifier : ""}{m.type}{m.value ? `:${m.value}` : ""}
                            </code>
                            <Badge variant="outline" className="text-[9px]">{expl.short}</Badge>
                            {isLookup && (
                              <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-300">1 lookup</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{expl.long}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Terminal className="h-4 w-4" /> Verify with dig
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Run these commands in your terminal to look up the actual published SPF record for a domain. Replace <code className="font-mono">example.com</code> with your domain.
              </p>
              <div className="space-y-1.5">
                {commands.map((c, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{c.tool}</Badge>
                      <span className="font-medium text-foreground">{c.label}</span>
                    </div>
                    <pre className="font-mono text-[11px] text-foreground whitespace-pre-wrap break-all bg-muted/40 rounded px-2 py-1">{c.command}</pre>
                    <p className="text-[11px] text-muted-foreground">{c.explanation}</p>
                    <CopyButton getText={() => c.command} label="Copy" size="sm" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" /> Multiple-SPF-record detector
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Paste the TXT records returned by <code className="font-mono">dig +short TXT yourdomain.com</code> (one per line). RFC 7208 §3.2 forbids more than one SPF record per domain.
              </p>
              <MultipleSpfChecker />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Qualifier reference
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            {QUALIFIER_TABLE.map((q) => (
              <div key={q.qualifier} className="rounded border bg-background px-3 py-2">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-foreground text-base">{q.qualifier}all</code>
                  <Badge variant="outline" className="text-[10px]">{q.name}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{q.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.action}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.count} mechanisms</Badge>
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All generation and validation runs locally.
            Recursive DNS resolution (for the lookup counter) uses the per-include depth input you provide —
            or a clearly-labeled live-DNS mode in your terminal via the dig commands above. History stores
            only operation metadata (action + count + ts), never the record contents.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MechanismEditor({
  title,
  placeholder,
  values,
  onChange,
  onAdd,
  onRemove,
  help,
}: {
  title: string;
  placeholder: string;
  values: string[];
  onChange: (idx: number, value: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  help?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{title}</Label>
        <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={onAdd}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      {values.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">No {title.toLowerCase()} entries. Click Add to create one.</p>
      ) : (
        <div className="space-y-1">
          {values.map((v, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                value={v}
                onChange={(e) => onChange(i, e.target.value)}
                placeholder={placeholder}
                className="font-mono text-xs h-8 flex-1"
              />
              <Button variant="ghost" size="icon" onClick={() => onRemove(i)} aria-label="Remove">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );
}

function MultipleSpfChecker() {
  const [txt, setTxt] = useState("");
  const records = useMemo(() => txt.split(/\n+/).map((s) => s.trim()).filter(Boolean), [txt]);
  const issue = useMemo(() => detectMultipleSpfRecords(records), [records]);

  return (
    <div className="space-y-2">
      <Textarea
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        placeholder={'"v=spf1 ip4:192.0.2.0/24 -all"\n"google-site-verification=abc"'}
        className="min-h-[80px] resize-y font-mono text-xs"
      />
      {records.length > 0 && (
        <div className="text-xs">
          <p className="text-muted-foreground">Found {records.length} TXT records ({records.filter((r) => r.toLowerCase().includes("v=spf1")).length} SPF).</p>
          {issue ? (
            <div className="mt-1.5 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-300">
              <div className="font-medium">{issue.message}</div>
              {issue.fix && <div className="text-[11px] mt-0.5"><span className="font-medium">Fix:</span> {issue.fix}</div>}
            </div>
          ) : records.filter((r) => r.toLowerCase().includes("v=spf1")).length === 1 ? (
            <div className="mt-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" /> Exactly one SPF record found.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "good" | "warn" | "bad";
}) {
  const color = tone === "bad"
    ? "text-red-600 dark:text-red-400"
    : tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "good"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
