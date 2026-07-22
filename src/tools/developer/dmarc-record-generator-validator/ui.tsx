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
  CheckCircle2, ShieldAlert, ListChecks, ShieldCheck, TrendingUp,
} from "lucide-react";
import {
  VALID_FAILURE_OPTIONS,
  DMARC_RI_DEFAULT,
  DMARC_PCT_DEFAULT,
  explainTag,
  explainAllTags,
  explainAllPolicies,
  explainAllFailureOptions,
  isValidDomain,
  isValidPolicy,
  buildRecord,
  buildDmarcName,
  validateRecord,
  detectMultipleDmarcRecords,
  generateEnforcementRoadmap,
  generateDigCommands,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DmarcInput,
  type DmarcPolicy,
  type AlignmentMode,
  type FailureOption,
  type ValidationIssue,
  type HistoryEntry,
} from "./logic";

type Tab = "generate" | "validate";

const TABS: { id: Tab; label: string }[] = [
  { id: "generate", label: "Generator" },
  { id: "validate", label: "Validator" },
];

const POLICIES: { value: DmarcPolicy; label: string; tone: "bad" | "warn" | "good" }[] = [
  { value: "none", label: "none (monitor)", tone: "bad" },
  { value: "quarantine", label: "quarantine (spam)", tone: "warn" },
  { value: "reject", label: "reject (SMTP)", tone: "good" },
];

const DEFAULT_INPUT: DmarcInput = {
  domain: "example.com",
  policy: "none",
  subdomainPolicy: "inherit",
  rua: "mailto:dmarc-reports@example.com",
  ruf: "",
  fo: ["0"],
  adkim: "r",
  aspf: "r",
  pct: 100,
  rf: "afrf",
  ri: DMARC_RI_DEFAULT,
};

export default function DmarcRecordGeneratorValidator() {
  const [tab, setTab] = useState<Tab>("generate");
  const [input, setInput] = useState<DmarcInput>(DEFAULT_INPUT);
  const [validateInput, setValidateInput] = useState("");
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
  const generatedResult = useMemo(() => validateRecord(generatedRecord), [generatedRecord]);
  const dmarcName = useMemo(() => buildDmarcName(input.domain), [input.domain]);
  const roadmap = useMemo(
    () => generateEnforcementRoadmap(input.policy, input.pct ?? DMARC_PCT_DEFAULT),
    [input.policy, input.pct],
  );

  const validateResult = useMemo(() => validateRecord(validateInput), [validateInput]);
  const validateRoadmap = useMemo(
    () => validateResult.policy
      ? generateEnforcementRoadmap(validateResult.policy, generatedPct(validateResult.tags.pct))
      : null,
    [validateResult.policy, validateResult.tags.pct],
  );
  const digCommands = useMemo(() => generateDigCommands(input.domain), [input.domain]);

  const handleSaveHistory = useCallback((action: "generate" | "validate") => {
    const policy = action === "generate" ? input.policy : (validateResult.policy ?? "unknown");
    const strength = action === "generate" ? generatedResult.strength : validateResult.strength;
    saveHistory({ ts: Date.now(), action, policy, strength });
    setHistory(loadHistory());
  }, [input.policy, generatedResult.strength, validateResult.policy, validateResult.strength]);

  const handleClear = useCallback(() => {
    setInput(DEFAULT_INPUT);
    setValidateInput("");
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

  const toggleFo = (f: FailureOption) => {
    setInput((prev) => ({
      ...prev,
      fo: prev.fo && prev.fo.includes(f)
        ? prev.fo.filter((x) => x !== f)
        : [...(prev.fo ?? []), f],
    }));
  };

  const strengthTone = (label: string): string => {
    if (label === "none") return "bg-red-500";
    if (label === "weak") return "bg-amber-500";
    if (label === "moderate") return "bg-yellow-500";
    if (label === "strong") return "bg-emerald-500";
    return "bg-emerald-600";
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
                <ShieldCheck className="h-4 w-4" /> DMARC Record Builder
              </h3>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="dmarc-domain">Domain</Label>
                <Input
                  id="dmarc-domain"
                  value={input.domain}
                  onChange={(e) => setInput((p) => ({ ...p, domain: e.target.value }))}
                  placeholder="example.com"
                  className="font-mono text-sm h-8"
                />
                {input.domain && !isValidDomain(input.domain) && (
                  <p className="text-[11px] text-red-600 dark:text-red-400">Invalid domain.</p>
                )}
                {dmarcName && (
                  <p className="text-[11px] text-muted-foreground">
                    DNS name: <code className="font-mono text-foreground">{dmarcName}</code>
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Policy (p=) — required</Label>
                <div className="flex flex-wrap gap-1.5">
                  {POLICIES.map((p) => (
                    <Button
                      key={p.value}
                      variant={input.policy === p.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setInput((prev) => ({ ...prev, policy: p.value }))}
                      className="font-mono"
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {explainTag("p").long}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subdomain policy (sp=) — optional</Label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant={input.subdomainPolicy === "inherit" || !input.subdomainPolicy ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInput((p) => ({ ...p, subdomainPolicy: "inherit" }))}
                  >
                    (inherit from p=)
                  </Button>
                  {(["none", "quarantine", "reject"] as DmarcPolicy[]).map((sp) => (
                    <Button
                      key={sp}
                      variant={input.subdomainPolicy === sp ? "default" : "outline"}
                      size="sm"
                      onClick={() => setInput((p) => ({ ...p, subdomainPolicy: sp }))}
                      className="font-mono"
                    >
                      {sp}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="dmarc-rua">Aggregate report URI (rua=) — optional</Label>
                <Input
                  id="dmarc-rua"
                  value={input.rua ?? ""}
                  onChange={(e) => setInput((p) => ({ ...p, rua: e.target.value }))}
                  placeholder="mailto:dmarc-reports@example.com"
                  className="font-mono text-sm h-8"
                />
                <p className="text-[11px] text-muted-foreground">
                  Comma-separated for multiple. Aggregate reports are XML summaries — used for monitoring.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="dmarc-ruf">Forensic report URI (ruf=) — optional</Label>
                <Input
                  id="dmarc-ruf"
                  value={input.ruf ?? ""}
                  onChange={(e) => setInput((p) => ({ ...p, ruf: e.target.value }))}
                  placeholder="mailto:forensic@example.com (leave empty to omit)"
                  className="font-mono text-sm h-8"
                />
                <p className="text-[11px] text-muted-foreground">
                  Forensic reports may leak PII and are suppressed by Gmail/Yahoo. Rely on rua= for monitoring.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Failure reporting options (fo=) — optional</Label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant={!input.fo || input.fo.length === 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInput((p) => ({ ...p, fo: [] }))}
                  >
                    (default: 0)
                  </Button>
                  {[...VALID_FAILURE_OPTIONS].map((f) => (
                    <Button
                      key={f}
                      variant={input.fo && input.fo.includes(f) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleFo(f)}
                      className="font-mono"
                    >
                      {f}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  <strong>0</strong> = both fail. <strong>1</strong> = either fails. <strong>d</strong> = DKIM failed. <strong>s</strong> = SPF failed. Ignored without ruf=.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">DKIM alignment (adkim=)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["r", "s"] as AlignmentMode[]).map((a) => (
                      <Button
                        key={a}
                        variant={input.adkim === a ? "default" : "outline"}
                        size="sm"
                        onClick={() => setInput((p) => ({ ...p, adkim: a }))}
                        className="font-mono"
                      >
                        {a} ({a === "r" ? "relaxed" : "strict"})
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">SPF alignment (aspf=)</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["r", "s"] as AlignmentMode[]).map((a) => (
                      <Button
                        key={a}
                        variant={input.aspf === a ? "default" : "outline"}
                        size="sm"
                        onClick={() => setInput((p) => ({ ...p, aspf: a }))}
                        className="font-mono"
                      >
                        {a} ({a === "r" ? "relaxed" : "strict"})
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="dmarc-pct">Percentage (pct=) — 0–100</Label>
                  <Input
                    id="dmarc-pct"
                    type="number"
                    min={0}
                    max={100}
                    value={input.pct ?? DMARC_PCT_DEFAULT}
                    onChange={(e) => setInput((p) => ({ ...p, pct: Number(e.target.value) }))}
                    className="font-mono text-sm h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="dmarc-ri">Report interval (ri=) — seconds</Label>
                  <Input
                    id="dmarc-ri"
                    type="number"
                    min={1}
                    value={input.ri ?? DMARC_RI_DEFAULT}
                    onChange={(e) => setInput((p) => ({ ...p, ri: Number(e.target.value) }))}
                    className="font-mono text-sm h-8"
                  />
                </div>
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

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Policy strength</span>
                  <span className="font-mono font-medium">
                    {generatedResult.strength}/100 — {generatedResult.strengthLabel}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all ${strengthTone(generatedResult.strengthLabel)}`}
                    style={{ width: `${generatedResult.strength}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Length" value={`${generatedResult.recordLength} chars`} />
                <Stat label="Policy" value={generatedResult.policy ?? "—"} />
                <Stat label="rua" value={generatedResult.hasRua ? "yes" : "no"} tone={generatedResult.hasRua ? "good" : "warn"} />
                <Stat label="Valid" value={generatedResult.valid ? "Yes" : "No"} tone={generatedResult.valid ? "good" : "bad"} />
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleSaveHistory("generate"); return generatedRecord; }} label="Copy record" />
                <DownloadButton getText={() => generatedRecord} filename="dmarc-record.txt" mime="text/plain" label="Download .txt" />
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

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" /> Enforcement roadmap
              </h3>
              <p className="text-[11px] text-muted-foreground">
                The recommended path to maximum enforcement. Your current position is highlighted.
              </p>
              <div className="space-y-1.5">
                {roadmap.map((s) => (
                  <div
                    key={s.level}
                    className={`rounded border px-3 py-2 text-xs ${
                      s.isCurrent
                        ? "border-primary bg-primary/5"
                        : s.isDone
                          ? "border-emerald-500/30 bg-emerald-500/5 opacity-70"
                          : "border-border bg-background"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={s.isCurrent ? "default" : "outline"} className="text-[10px]">
                        Step {s.level}
                      </Badge>
                      <span className="font-medium text-foreground">{s.title}</span>
                      {s.isCurrent && <Badge variant="outline" className="text-[9px] bg-primary/10">current</Badge>}
                      {s.isDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{s.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Terminal className="h-4 w-4" /> Verify with dig
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Run these in your terminal to look up the published DMARC record for <code className="font-mono">{dmarcName || "_dmarc.<domain>"}</code>.
              </p>
              <div className="space-y-1.5">
                {digCommands.map((c, i) => (
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
        </>
      )}

      {tab === "validate" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Validate a DMARC record
              </h3>
              <Textarea
                value={validateInput}
                onChange={(e) => setValidateInput(e.target.value)}
                placeholder="v=DMARC1; p=reject; rua=mailto:dmarc@example.com"
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

              {validateResult.policy && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Policy strength</span>
                    <span className="font-mono font-medium">
                      {validateResult.strength}/100 — {validateResult.strengthLabel}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full transition-all ${strengthTone(validateResult.strengthLabel)}`}
                      style={{ width: `${validateResult.strength}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Length" value={`${validateResult.recordLength} chars`} />
                <Stat label="Policy" value={validateResult.policy ?? "—"} />
                <Stat label="rua" value={validateResult.hasRua ? "yes" : "no"} tone={validateResult.hasRua ? "good" : "warn"} />
                <Stat label="ruf" value={validateResult.hasRuf ? "yes" : "no"} />
              </div>

              {validateResult.issues.length === 0 && validateInput.trim() ? (
                <div className="flex items-center gap-2 rounded border bg-emerald-500/5 px-3 py-2 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-foreground">No issues found. Record is RFC 7489-valid.</span>
                </div>
              ) : validateResult.issues.length > 0 ? (
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
              ) : (
                <EmptyState
                  title="Paste a DMARC record to validate"
                  hint="Looks like v=DMARC1; p=reject; rua=mailto:dmarc@example.com"
                  icon={<CheckCircle2 className="h-8 w-8" />}
                />
              )}

              {validateRoadmap && (
                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Enforcement roadmap
                  </Label>
                  <div className="space-y-1 pt-1">
                    {validateRoadmap.map((s) => (
                      <div
                        key={s.level}
                        className={`rounded border px-2 py-1.5 text-xs ${
                          s.isCurrent
                            ? "border-primary bg-primary/5"
                            : s.isDone
                              ? "border-emerald-500/30 bg-emerald-500/5 opacity-70"
                              : "border-border bg-background"
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={s.isCurrent ? "default" : "outline"} className="text-[9px]">
                            {s.level}
                          </Badge>
                          <span className="font-medium text-foreground text-[11px]">{s.title}</span>
                          {s.isCurrent && <Badge variant="outline" className="text-[9px] bg-primary/10">current</Badge>}
                          {s.isDone && <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(validateResult.tags).length > 0 && (
                <div>
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Parsed tags ({Object.keys(validateResult.tags).length})
                  </Label>
                  <div className="space-y-1 pt-1">
                    {Object.entries(validateResult.tags).map(([name, value]) => {
                      const expl = explainTag(name as never);
                      return (
                        <div key={name} className="rounded border bg-background px-2 py-1.5 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="font-mono text-foreground text-sm">{name}=</code>
                            <Badge variant="outline" className="text-[9px]">{expl.short}</Badge>
                            {expl.required && <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-700 dark:text-amber-300">required</Badge>}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{expl.long}</p>
                          <pre className="font-mono text-[11px] text-foreground whitespace-pre-wrap break-all bg-muted/40 rounded px-2 py-1 mt-1">{value || "(empty)"}</pre>
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
                <ShieldAlert className="h-4 w-4" /> Multiple-DMARC-record detector
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Paste the TXT records returned by <code className="font-mono">dig +short TXT _dmarc.&lt;domain&gt;</code> (one per line). RFC 7489 §6.1 forbids more than one DMARC record per domain.
              </p>
              <MultipleDmarcChecker />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Tag reference
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            {explainAllTags().map((t) => (
              <div key={t.tag} className="rounded border bg-background px-3 py-2">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-foreground text-base">{t.tag}=</code>
                  <Badge variant="outline" className="text-[10px]">{t.short}</Badge>
                  {t.required && <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300">required</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t.long}</p>
                {t.default && <p className="text-[10px] text-muted-foreground mt-0.5"><span className="font-medium">Default:</span> {t.default}</p>}
              </div>
            ))}
          </div>
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Policies</Label>
              <div className="space-y-1 pt-1 text-xs">
                {explainAllPolicies().map((p) => (
                  <div key={p.policy} className="rounded border bg-background px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-foreground text-sm">p={p.policy}</code>
                      <Badge variant="outline" className="text-[9px]">{p.short}</Badge>
                      <Badge variant="outline" className="text-[9px]">{p.strength}/100</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{p.long}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">fo= options</Label>
              <div className="space-y-1 pt-1 text-xs">
                {explainAllFailureOptions().map((f) => (
                  <div key={f.option} className="rounded border bg-background px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-foreground text-sm">fo={f.option}</code>
                      <Badge variant="outline" className="text-[9px]">{f.short}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{f.long}</p>
                  </div>
                ))}
              </div>
            </div>
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
                  <Badge variant="outline" className="mr-2 text-[10px]">p={h.policy}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.strength}/100</Badge>
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
            History stores only operation metadata (action + policy + strength + ts), never the record,
            domain, or report URIs. Live lookup requires the network via the dig commands above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MultipleDmarcChecker() {
  const [txt, setTxt] = useState("");
  const records = useMemo(() => txt.split(/\n+/).map((s) => s.trim()).filter(Boolean), [txt]);
  const issue = useMemo(() => detectMultipleDmarcRecords(records), [records]);
  const dmarcCount = records.filter((r) => r.toLowerCase().includes("v=dmarc1")).length;

  return (
    <div className="space-y-2">
      <Textarea
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        placeholder={'"v=DMARC1; p=reject"\n"google-site-verification=abc"'}
        className="min-h-[80px] resize-y font-mono text-xs"
      />
      {records.length > 0 && (
        <div className="text-xs">
          <p className="text-muted-foreground">Found {records.length} TXT records ({dmarcCount} DMARC).</p>
          {issue ? (
            <div className="mt-1.5 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-300">
              <div className="font-medium">{issue.message}</div>
              {issue.fix && <div className="text-[11px] mt-0.5"><span className="font-medium">Fix:</span> {issue.fix}</div>}
            </div>
          ) : dmarcCount === 1 ? (
            <div className="mt-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" /> Exactly one DMARC record found.
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

/** Extract pct from the parsed tags (default 100 if absent / unparseable). */
function generatedPct(pctRaw: string | undefined): number {
  if (!pctRaw) return 100;
  const n = Number(pctRaw);
  if (!Number.isFinite(n) || n < 0 || n > 100) return 100;
  return n;
}
