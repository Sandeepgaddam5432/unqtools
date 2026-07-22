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
  CheckCircle2, ShieldAlert, Key, Plus, X, ListChecks, KeyRound,
} from "lucide-react";
import {
  COMMON_SELECTORS,
  TXT_MAX_PER_STRING,
  VALID_FLAGS,
  VALID_HASHES,
  explainTag,
  explainAllTags,
  explainAllFlags,
  isValidSelector,
  isValidDomain,
  isValidKeyType,
  estimateKeyBits,
  buildRecord,
  buildSelectorName,
  validateRecord,
  detectMultipleDkimRecords,
  splitTxtForBind,
  generateDigCommands,
  generateKeygenCommands,
  generateCommonSelectorCommands,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DkimInput,
  type KeyType,
  type RsaBitLength,
  type HashAlgorithm,
  type DkimFlag,
  type ValidationIssue,
  type HistoryEntry,
} from "./logic";

type Tab = "generate" | "validate";

const TABS: { id: Tab; label: string }[] = [
  { id: "generate", label: "Generator" },
  { id: "validate", label: "Validator" },
];

const KEY_TYPES: { value: KeyType; label: string }[] = [
  { value: "rsa", label: "RSA" },
  { value: "ed25519", label: "Ed25519" },
];

const RSA_SIZES: RsaBitLength[] = [1024, 2048, 4096];

const DEFAULT_INPUT: DkimInput = {
  selector: "default",
  domain: "example.com",
  keyType: "rsa",
  publicKey: "",
  hashes: ["sha256"],
  service: "email",
  flags: ["s"],
  notes: "",
};

export default function DkimRecordGeneratorValidator() {
  const [tab, setTab] = useState<Tab>("generate");
  const [input, setInput] = useState<DkimInput>(DEFAULT_INPUT);
  const [rsaBits, setRsaBits] = useState<RsaBitLength>(2048);
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
  const selectorName = useMemo(
    () => buildSelectorName(input.selector, input.domain),
    [input.selector, input.domain],
  );

  const validateResult = useMemo(() => validateRecord(validateInput), [validateInput]);
  const digCommands = useMemo(
    () => generateDigCommands(input.selector, input.domain),
    [input.selector, input.domain],
  );
  const keygenCommands = useMemo(
    () => generateKeygenCommands(input.selector, input.domain, input.keyType, rsaBits),
    [input.selector, input.domain, input.keyType, rsaBits],
  );
  const commonCommands = useMemo(
    () => generateCommonSelectorCommands(input.domain),
    [input.domain],
  );

  const handleSaveHistory = useCallback((action: "generate" | "validate") => {
    const kType = action === "generate" ? input.keyType : validateResult.keyType ?? "unknown";
    const bits = action === "generate" ? generatedResult.estimatedBits : validateResult.estimatedBits;
    saveHistory({ ts: Date.now(), action, keyType: kType, estimatedBits: bits });
    setHistory(loadHistory());
  }, [input.keyType, generatedResult.estimatedBits, validateResult.keyType, validateResult.estimatedBits]);

  const handleClear = useCallback(() => {
    setInput(DEFAULT_INPUT);
    setRsaBits(2048);
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

  const toggleHash = (h: HashAlgorithm) => {
    setInput((prev) => ({
      ...prev,
      hashes: prev.hashes.includes(h)
        ? prev.hashes.filter((x) => x !== h)
        : [...prev.hashes, h],
    }));
  };
  const toggleFlag = (f: DkimFlag) => {
    setInput((prev) => ({
      ...prev,
      flags: prev.flags.includes(f)
        ? prev.flags.filter((x) => x !== f)
        : [...prev.flags, f],
    }));
  };

  const splitRecord = useMemo(
    () => generatedRecord.length > TXT_MAX_PER_STRING ? splitTxtForBind(generatedRecord) : null,
    [generatedRecord],
  );

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
                <Key className="h-4 w-4" /> DKIM Record Builder
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="dkim-selector">Selector</Label>
                  <Input
                    id="dkim-selector"
                    value={input.selector}
                    onChange={(e) => setInput((p) => ({ ...p, selector: e.target.value }))}
                    placeholder="default"
                    className="font-mono text-sm h-8"
                  />
                  {input.selector && !isValidSelector(input.selector) && (
                    <p className="text-[11px] text-red-600 dark:text-red-400">Invalid selector (DNS label rules: letters, digits, -, _; max 63 chars).</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="dkim-domain">Domain</Label>
                  <Input
                    id="dkim-domain"
                    value={input.domain}
                    onChange={(e) => setInput((p) => ({ ...p, domain: e.target.value }))}
                    placeholder="example.com"
                    className="font-mono text-sm h-8"
                  />
                  {input.domain && !isValidDomain(input.domain) && (
                    <p className="text-[11px] text-red-600 dark:text-red-400">Invalid domain.</p>
                  )}
                </div>
              </div>
              {selectorName && (
                <p className="text-[11px] text-muted-foreground">
                  DNS name: <code className="font-mono text-foreground">{selectorName}</code>
                </p>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Key type</Label>
                <div className="flex flex-wrap gap-1.5">
                  {KEY_TYPES.map((kt) => (
                    <Button
                      key={kt.value}
                      variant={input.keyType === kt.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setInput((p) => ({ ...p, keyType: kt.value }))}
                    >
                      {kt.label}
                    </Button>
                  ))}
                </div>
                {input.keyType === "rsa" && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">RSA key size (for keygen command only — does NOT affect the record)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {RSA_SIZES.map((sz) => (
                        <Button
                          key={sz}
                          variant={rsaBits === sz ? "default" : "outline"}
                          size="sm"
                          onClick={() => setRsaBits(sz)}
                        >
                          {sz}-bit{sz === 1024 ? " (weak)" : ""}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="dkim-pubkey">Public key (base64 — the p= value)</Label>
                <Textarea
                  id="dkim-pubkey"
                  value={input.publicKey}
                  onChange={(e) => setInput((p) => ({ ...p, publicKey: e.target.value }))}
                  placeholder="Paste the base64-encoded public key generated by opendkim-genkey or openssl (see commands below). Empty = revoked."
                  className="min-h-[60px] resize-y font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  The private key stays on your mail server — NEVER paste it here. Only the public key goes in DNS.
                  {input.publicKey && input.keyType && estimateKeyBits(input.publicKey, input.keyType) !== null && (
                    <> Estimated bit length: <Badge variant="outline" className="text-[10px]">{estimateKeyBits(input.publicKey, input.keyType)}-bit</Badge></>
                  )}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hash algorithms (h=) — optional</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[...VALID_HASHES].map((h) => (
                    <Button
                      key={h}
                      variant={input.hashes.includes(h) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleHash(h)}
                      className="font-mono"
                    >
                      {h}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Service type (s=) — optional</Label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant={!input.service ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInput((p) => ({ ...p, service: undefined }))}
                  >
                    (omit)
                  </Button>
                  <Button
                    variant={input.service === "email" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInput((p) => ({ ...p, service: "email" }))}
                    className="font-mono"
                  >
                    email
                  </Button>
                  <Button
                    variant={input.service === "*" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInput((p) => ({ ...p, service: "*" }))}
                    className="font-mono"
                  >
                    * (any)
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Flags (t=) — optional</Label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant={input.flags.length === 0 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInput((p) => ({ ...p, flags: [] }))}
                  >
                    (none)
                  </Button>
                  {[...VALID_FLAGS].map((f) => (
                    <Button
                      key={f}
                      variant={input.flags.includes(f) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleFlag(f)}
                      className="font-mono"
                    >
                      {f}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  <strong>y</strong> = test mode (do not enforce). <strong>s</strong> = strict selector. <strong>i</strong> = obsolete.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="dkim-notes">Notes (n=) — optional</Label>
                <Input
                  id="dkim-notes"
                  value={input.notes ?? ""}
                  onChange={(e) => setInput((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="production key"
                  className="text-sm h-8"
                />
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
                <Stat label="Length" value={`${generatedRecord.length} chars`} hint={generatedResult.txtSplitNeeded ? `Over ${TXT_MAX_PER_STRING} — needs TXT split` : undefined} tone={generatedResult.txtSplitNeeded ? "warn" : undefined} />
                <Stat label="Key type" value={generatedResult.keyType ?? "—"} />
                <Stat label="Est. bits" value={generatedResult.estimatedBits ?? "—"} tone={generatedResult.estimatedBits === 1024 ? "warn" : undefined} />
                <Stat label="Valid" value={generatedResult.valid ? "Yes" : "No"} tone={generatedResult.valid ? "good" : "bad"} />
              </div>
              {splitRecord && (
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Bind-format split (record &gt; {TXT_MAX_PER_STRING} chars — paste this version into your DNS UI)
                  </Label>
                  <pre className="font-mono text-[11px] text-foreground whitespace-pre-wrap break-all bg-muted/40 rounded px-3 py-2 border">
                    {splitRecord}
                  </pre>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => { handleSaveHistory("generate"); return generatedRecord; }} label="Copy record" />
                <DownloadButton getText={() => generatedRecord} filename="dkim-record.txt" mime="text/plain" label="Download .txt" />
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
                <KeyRound className="h-4 w-4" /> Key-pair generation commands
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Run these on your mail server to generate a key pair. The <strong>private</strong> key stays on the server;
                the <strong>public</strong> key (base64 output) goes in the p= field above.
              </p>
              <div className="space-y-1.5">
                {keygenCommands.map((c, i) => (
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
                <Terminal className="h-4 w-4" /> Verify with dig
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Run these in your terminal to look up the published DKIM record for <code className="font-mono">{selectorName || "<selector>._domainkey.<domain>"}</code>.
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

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" /> Common-selector auto-detection
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Try each common selector against <code className="font-mono">{input.domain || "<domain>"}</code> to discover which one a third-party sender (Google, SendGrid, …) is using.
              </p>
              <div className="space-y-1 max-h-[260px] overflow-auto">
                {commonCommands.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px]">{COMMON_SELECTORS[i]}</Badge>
                    <code className="font-mono text-foreground flex-1 truncate text-[11px]">{c.command}</code>
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
                <CheckCircle2 className="h-4 w-4" /> Validate a DKIM record
              </h3>
              <Textarea
                value={validateInput}
                onChange={(e) => setValidateInput(e.target.value)}
                placeholder="v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ..."
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Length" value={`${validateResult.recordLength} chars`} hint={validateResult.txtSplitNeeded ? `Over ${TXT_MAX_PER_STRING}` : undefined} tone={validateResult.txtSplitNeeded ? "warn" : undefined} />
                <Stat label="Key type" value={validateResult.keyType ?? "—"} />
                <Stat label="Est. bits" value={validateResult.estimatedBits ?? "—"} tone={validateResult.estimatedBits === 1024 ? "warn" : undefined} />
                <Stat label="Status" value={validateResult.isRevoked ? "Revoked" : "Active"} tone={validateResult.isRevoked ? "warn" : "good"} />
              </div>

              {validateResult.issues.length === 0 && validateInput.trim() ? (
                <div className="flex items-center gap-2 rounded border bg-emerald-500/5 px-3 py-2 text-xs">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-foreground">No issues found. Record is RFC 6376-valid.</span>
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
                  title="Paste a DKIM record to validate"
                  hint="Looks like v=DKIM1; k=rsa; p=<base64>; t=s"
                  icon={<CheckCircle2 className="h-8 w-8" />}
                />
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
                          <pre className="font-mono text-[11px] text-foreground whitespace-pre-wrap break-all bg-muted/40 rounded px-2 py-1 mt-1">{value === "" ? "(empty — revoked key)" : value}</pre>
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
                <ShieldAlert className="h-4 w-4" /> Multiple-DKIM-record detector
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Paste the TXT records returned by <code className="font-mono">dig +short TXT &lt;selector&gt;._domainkey.&lt;domain&gt;</code> (one per line). RFC 6376 §3.6.1 forbids more than one DKIM record on the same selector name.
              </p>
              <MultipleDkimChecker />
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
              </div>
            ))}
          </div>
          <div className="pt-2">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">t= flags</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1 text-xs">
              {explainAllFlags().map((f) => (
                <div key={f.flag} className="rounded border bg-background px-3 py-2">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-foreground text-sm">{f.flag}</code>
                    <Badge variant="outline" className="text-[10px]">{f.short}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{f.long}</p>
                </div>
              ))}
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.keyType}</Badge>
                  {h.estimatedBits !== null && <Badge variant="outline" className="mr-2 text-[10px]">{h.estimatedBits}-bit</Badge>}
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
            The private key NEVER touches this tool — only the base64 public key (which is already public in DNS)
            is processed. History stores only operation metadata (action + key type + estimated bits + ts),
            never the public key, selector, or domain. Live lookup requires the network via the dig commands above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MultipleDkimChecker() {
  const [txt, setTxt] = useState("");
  const records = useMemo(() => txt.split(/\n+/).map((s) => s.trim()).filter(Boolean), [txt]);
  const issue = useMemo(() => detectMultipleDkimRecords(records), [records]);
  const dkimCount = records.filter((r) => r.toLowerCase().includes("v=dkim1")).length;

  return (
    <div className="space-y-2">
      <Textarea
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        placeholder={'"v=DKIM1; k=rsa; p=ABC"\n"google-site-verification=abc"'}
        className="min-h-[80px] resize-y font-mono text-xs"
      />
      {records.length > 0 && (
        <div className="text-xs">
          <p className="text-muted-foreground">Found {records.length} TXT records ({dkimCount} DKIM).</p>
          {issue ? (
            <div className="mt-1.5 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-300">
              <div className="font-medium">{issue.message}</div>
              {issue.fix && <div className="text-[11px] mt-0.5"><span className="font-medium">Fix:</span> {issue.fix}</div>}
            </div>
          ) : dkimCount === 1 ? (
            <div className="mt-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" /> Exactly one DKIM record found.
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
