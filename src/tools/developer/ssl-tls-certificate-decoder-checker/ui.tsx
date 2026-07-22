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
  History, ShieldCheck, Terminal, AlertCircle, BookOpen,
  CheckCircle2, ShieldAlert, Calendar, Server,
  ListChecks, Network, Lock, KeyRound, FileWarning,
} from "lucide-react";
import {
  DEFAULT_TLS_PORT,
  MIN_RSA_BITS,
  WEAK_SIG_ALGORITHMS,
  explainAllFields,
  explainPemLabel,
  decodePem,
  decodePemBlock,
  parseCertificate,
  checkExpiry,
  isSelfSigned,
  validateChain,
  matchHostname,
  detectWeaknesses,
  generateOpensslCommands,
  generatePemInspectionCommands,
  getCn,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Decoded,
  type DecodedCertificate,
  type DecodedCsr,
  type ExpiryCheck,
  type ValidationIssue,
  type HistoryEntry,
  type OpensslCommand,
} from "./logic";

type Tab = "decode" | "commands";

const TABS: { id: Tab; label: string }[] = [
  { id: "decode", label: "Decoder" },
  { id: "commands", label: "openssl Commands" },
];

export default function SslTlsCertificateDecoderChecker() {
  const [tab, setTab] = useState<Tab>("decode");
  const [pemInput, setPemInput] = useState("");
  const [hostname, setHostname] = useState("");
  const [host, setHost] = useState("example.com");
  const [port, setPort] = useState<number>(DEFAULT_TLS_PORT);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.tab) setTab(p.tab);
      if (p.host) setHost(p.host);
      if (p.port) setPort(p.port);
      if (p.tab || p.host || p.port) toast.info("Loaded from share link");
    }
  }, []);

  // ---- Decoded PEM (decode tab) -----------------------------------------
  const pemResult = useMemo(() => decodePem(pemInput), [pemInput]);

  const decoded: Decoded[] = useMemo(() => {
    if (!pemResult.ok) return [];
    return pemResult.blocks.map((b) => {
      try {
        return decodePemBlock(b);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          kind: "crl",
          label: b.label,
          der: b.der,
          sha1: "",
          sha256: "",
          parseWarnings: [`Parse failed: ${msg}`],
        } as Decoded;
      }
    });
  }, [pemResult]);

  const certs = decoded.filter(
    (d): d is DecodedCertificate => d.kind === "certificate",
  );
  const csrs = decoded.filter((d): d is DecodedCsr => d.kind === "csr");

  const chainResult = useMemo(
    () => (certs.length >= 1 ? validateChain(certs) : null),
    [certs],
  );

  // ---- Expiry + weakness (first cert only, for the summary card) --------
  const firstCert = certs[0];
  const expiry: ExpiryCheck | null = firstCert
    ? checkExpiry(firstCert.notBefore, firstCert.notAfter)
    : null;
  const weakness = firstCert ? detectWeaknesses(firstCert) : null;
  const selfSigned = firstCert ? isSelfSigned(firstCert) : false;
  const hostnameMatch = firstCert
    ? hostname.trim()
      ? matchHostname(firstCert.sans, hostname)
      : null
    : null;

  // ---- openssl commands (commands tab) ----------------------------------
  const opensslCommands = useMemo(
    () => generateOpensslCommands(host, port),
    [host, port],
  );
  const pemInspectionCommands = useMemo(
    () => generatePemInspectionCommands("cert.pem", csrs.length > 0 && certs.length === 0),
    [csrs.length, certs.length],
  );

  // ---- History -----------------------------------------------------------
  const handleSaveHistory = useCallback(
    (action: "decode" | "check") => {
      const subjectCn = firstCert ? getCn(firstCert.subject) : null;
      const issuerCn = firstCert ? getCn(firstCert.issuer) : null;
      const expiryDate = firstCert ? firstCert.notAfter : null;
      const sha256 = firstCert ? firstCert.sha256 : null;
      saveHistory({ ts: Date.now(), action, subjectCn, issuerCn, expiryDate, sha256 });
      setHistory(loadHistory());
    },
    [firstCert],
  );

  const handleClear = useCallback(() => {
    setPemInput("");
    setHostname("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const shareUrl = useMemo(
    () => buildShareUrl({ tab, host, port }),
    [tab, host, port],
  );

  const issueTone = (level: ValidationIssue["level"]): string => {
    if (level === "error") return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30";
    if (level === "warning") return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
    return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30";
  };

  const expiryTone = (s: ExpiryCheck["status"]): string => {
    if (s === "expired") return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30";
    if (s === "not-yet-valid") return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
    if (s && expiry && expiry.daysRemaining < 30) {
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
    }
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
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

      {tab === "decode" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> Paste a PEM certificate or CSR
              </h3>
              <Textarea
                value={pemInput}
                onChange={(e) => setPemInput(e.target.value)}
                placeholder={"-----BEGIN CERTIFICATE-----\nMIIDjDCCAnSgAwIBAgIU...\n-----END CERTIFICATE-----"}
                className="min-h-[120px] resize-y font-mono text-xs"
              />
              {pemResult.errors.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <div>{pemResult.errors.join(" ")}</div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <ShareButton getUrl={() => { handleSaveHistory("decode"); return shareUrl; }} />
                <ClearButton onClick={handleClear} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                The PEM is parsed entirely in your browser — nothing is uploaded. Private keys
                are detected but their key material is never extracted or displayed.
              </p>
            </CardContent>
          </Card>

          {decoded.length === 0 && (
            <Card>
              <CardContent className="p-4">
                <EmptyState
                  title="Paste a PEM block to decode"
                  hint="Accepts CERTIFICATE, CERTIFICATE REQUEST, PRIVATE KEY (label-only), PUBLIC KEY, X509 CRL. Multiple PEMs are decoded as a chain."
                  icon={<ShieldCheck className="h-8 w-8" />}
                />
              </CardContent>
            </Card>
          )}

          {decoded.map((d, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">{d.kind}</Badge>
                  <span className="text-sm font-semibold text-foreground">
                    Block {i + 1} of {decoded.length}
                  </span>
                  {"label" in d && d.label && (
                    <Badge variant="outline" className="text-[10px] font-mono">{d.label}</Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {explainPemLabel("label" in d ? d.label : d.kind === "certificate" ? "CERTIFICATE" : d.kind === "csr" ? "CERTIFICATE REQUEST" : "")}
                </p>
                {d.kind === "certificate" && <CertificateView cert={d} expiry={i === 0 ? expiry : null} weakness={i === 0 ? weakness : null} selfSigned={i === 0 ? selfSigned : null} />}
                {d.kind === "csr" && <CsrView csr={d} />}
                {(d.kind === "private-key" || d.kind === "public-key" || d.kind === "crl") && (
                  <KeyValueView entry={d} />
                )}
                {d.parseWarnings.length > 0 && (
                  <div className="space-y-1">
                    {d.parseWarnings.map((w, j) => (
                      <div key={j} className={`rounded border px-3 py-2 text-xs ${issueTone("warning")}`}>
                        <div className="flex items-center gap-2">
                          <FileWarning className="h-3.5 w-3.5" />
                          <span>{w}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => d.sha256} label="Copy SHA-256" disabled={!d.sha256} />
                  <CopyButton getText={() => d.sha1} label="Copy SHA-1" disabled={!d.sha1} />
                </div>
              </CardContent>
            </Card>
          ))}

          {firstCert && (
            <>
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" /> Expiry check (leaf cert)
                  </h3>
                  {expiry && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <Stat label="Status" value={expiry.status} tone={expiryTone(expiry.status) as "good" | "bad" | "warn" | undefined} />
                        <Stat label="Days remaining" value={String(expiry.daysRemaining)} tone={expiry.daysRemaining < 0 ? "bad" : expiry.daysRemaining < 30 ? "warn" : "good"} />
                        <Stat label="Days since issue" value={String(expiry.daysSinceIssue)} />
                        <Stat label="Total validity" value={`${expiry.totalValidityDays} days`} />
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Validity elapsed: {expiry.percentElapsed}%
                        </Label>
                        <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                          <div
                            className={`h-full ${expiry.status === "expired" ? "bg-red-500" : expiry.status === "not-yet-valid" ? "bg-amber-500" : expiry.percentElapsed > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, Math.max(0, expiry.percentElapsed))}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        notBefore: <code className="font-mono text-foreground">{firstCert.notBefore}</code>
                        <br />
                        notAfter: <code className="font-mono text-foreground">{firstCert.notAfter}</code>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Network className="h-4 w-4" /> Hostname vs SAN check
                  </h3>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs" htmlFor="ssl-hostname">Hostname to match</Label>
                      <Input
                        id="ssl-hostname"
                        value={hostname}
                        onChange={(e) => setHostname(e.target.value)}
                        placeholder="www.example.com"
                        className="font-mono text-sm h-8"
                      />
                    </div>
                  </div>
                  {hostnameMatch !== null && (
                    <div className={`flex items-center gap-2 rounded border px-3 py-2 text-xs ${hostnameMatch ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30"}`}>
                      {hostnameMatch ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                      <span>
                        {hostnameMatch
                          ? `Hostname "${hostname}" matches a SAN entry.`
                          : `Hostname "${hostname}" does NOT match any SAN. Browsers will show a NET::ERR_CERT_COMMON_NAME_INVALID error.`}
                      </span>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Wildcard SANs (e.g. <code className="font-mono">*.example.com</code>) match exactly one leftmost label.
                  </p>
                </CardContent>
              </Card>

              {weakness && weakness.issues.length > 0 && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4" /> Weakness / security notes
                    </h3>
                    <div className="space-y-1.5">
                      {weakness.issues.map((iss, j) => (
                        <div key={j} className={`rounded border px-3 py-2 text-xs ${issueTone(iss.level)}`}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] uppercase">{iss.level}</Badge>
                            <span>{iss.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {certs.length > 1 && chainResult && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <ListChecks className="h-4 w-4" /> Chain-order validation
                      </h3>
                      <Badge variant="outline" className={`text-[11px] ${chainResult.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300"}`}>
                        {chainResult.ok ? "OK" : "BROKEN"}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Order: <code className="font-mono text-foreground">{chainResult.order.join(" → ")}</code>
                    </div>
                    <div className="space-y-1.5">
                      {chainResult.issues.map((iss, j) => (
                        <div key={j} className={`rounded border px-3 py-2 text-xs ${issueTone(iss.level)}`}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[9px] uppercase">{iss.level}</Badge>
                            <span>{iss.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> X.509 field reference
              </h3>
              <div className="space-y-1 max-h-[260px] overflow-auto pr-1">
                {explainAllFields().map((f) => (
                  <div key={f.field} className="rounded border bg-background px-3 py-2 text-xs space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{f.field}</span>
                      <Badge variant="outline" className="text-[9px]">{f.short}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{f.long}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {tab === "commands" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Server className="h-4 w-4" /> Live-host TLS check (openssl)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="ssl-host">Host</Label>
                  <Input
                    id="ssl-host"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="example.com"
                    className="font-mono text-sm h-8"
                  />
                </div>
                <div className="space-y-1.5 w-full sm:w-24">
                  <Label className="text-xs" htmlFor="ssl-port">Port</Label>
                  <Input
                    id="ssl-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value, 10) || DEFAULT_TLS_PORT)}
                    className="font-mono text-sm h-8"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ShareButton getUrl={() => { handleSaveHistory("check"); return shareUrl; }} />
              </div>
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  The tool <strong>never connects anywhere itself</strong> — these are copy-ready
                  commands you run in your own terminal. The optional network step happens only
                  when you run <code className="font-mono">openssl s_client</code> locally.
                </span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Terminal className="h-4 w-4" /> Live-host commands ({opensslCommands.length})
              </h3>
              <div className="space-y-1.5">
                {opensslCommands.map((c, i) => (
                  <CommandRow key={i} c={c} />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileWarning className="h-4 w-4" /> Saved-PEM inspection commands
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Run these against a saved PEM file (cert.pem or csr.pem).
              </p>
              <div className="space-y-1.5">
                {pemInspectionCommands.map((c, i) => (
                  <CommandRow key={i} c={c} />
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <History className="h-4 w-4" /> History (max 20)
            </h3>
            {history.length > 0 && (
              <ClearButton onClick={handleClearHistory} label="Clear history" />
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Decoded-cert metadata will be saved here. The PEM itself is NEVER stored — only the
              subject CN, issuer CN, expiry date, and SHA-256 fingerprint.
            </p>
          ) : (
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[9px] uppercase">{h.action}</Badge>
                    <span className="font-mono text-foreground">{h.subjectCn ?? "—"}</span>
                    <span className="text-muted-foreground">issued by</span>
                    <span className="font-mono text-foreground">{h.issuerCn ?? "—"}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    expires {h.expiryDate ?? "—"} · SHA-256 {h.sha256 ?? "—"} · {new Date(h.ts).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CertificateView({
  cert,
  expiry,
  weakness,
  selfSigned,
}: {
  cert: DecodedCertificate;
  expiry: ExpiryCheck | null;
  weakness: { issues: ValidationIssue[]; hasWeakSig: boolean; hasWeakKey: boolean; isSelfSigned: boolean } | null;
  selfSigned: boolean | null;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <Field label="Subject" value={cert.subject.rfc4514} mono />
        <Field label="Issuer" value={cert.issuer.rfc4514} mono />
        <Field label="Serial" value={cert.serialHex} mono />
        <Field
          label="Signature algorithm"
          value={cert.signatureAlgorithm}
          tone={WEAK_SIG_ALGORITHMS.has(cert.signatureAlgorithm) ? "warn" : undefined}
        />
        <Field label="Not before" value={cert.notBefore} mono />
        <Field
          label="Not after"
          value={cert.notAfter}
          mono
          tone={expiry?.status === "expired" ? "bad" : undefined}
        />
        <Field
          label="Public key"
          value={`${cert.publicKey.algorithm}${cert.publicKey.curveName ? ` (${cert.publicKey.curveName})` : ""} — ${cert.publicKey.bitLength ?? "?"} bits`}
          tone={cert.publicKey.algorithm === "rsaEncryption" && cert.publicKey.bitLength !== null && cert.publicKey.bitLength < MIN_RSA_BITS ? "warn" : undefined}
        />
        <Field
          label="Basic constraints"
          value={cert.isCa ? "CA:TRUE" : "CA:FALSE / absent"}
        />
      </div>
      {selfSigned !== null && (
        <div className="text-[11px] text-muted-foreground">
          {selfSigned ? (
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300">
              Self-signed (subject == issuer)
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              CA-issued
            </Badge>
          )}
          {weakness && weakness.hasWeakSig && (
            <Badge variant="outline" className="text-[10px] ml-1.5 bg-red-500/10 text-red-700 dark:text-red-300">
              Weak signature
            </Badge>
          )}
          {weakness && weakness.hasWeakKey && (
            <Badge variant="outline" className="text-[10px] ml-1.5 bg-red-500/10 text-red-700 dark:text-red-300">
              Weak key
            </Badge>
          )}
        </div>
      )}
      {cert.sans.length > 0 && (
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Subject Alternative Names ({cert.sans.length})
          </Label>
          <div className="flex flex-wrap gap-1 pt-1">
            {cert.sans.map((s, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-mono">
                {s.type}:{s.value}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {(cert.keyUsage.length > 0 || cert.extKeyUsage.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {cert.keyUsage.length > 0 && (
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Key usage ({cert.keyUsage.length})
              </Label>
              <div className="flex flex-wrap gap-1 pt-1">
                {cert.keyUsage.map((k, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] font-mono">{k}</Badge>
                ))}
              </div>
            </div>
          )}
          {cert.extKeyUsage.length > 0 && (
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Extended key usage ({cert.extKeyUsage.length})
              </Label>
              <div className="flex flex-wrap gap-1 pt-1">
                {cert.extKeyUsage.map((k, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] font-mono">{k}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <Field label="SHA-1 fingerprint" value={cert.sha1} mono />
        <Field label="SHA-256 fingerprint" value={cert.sha256} mono />
      </div>
    </div>
  );
}

function CsrView({ csr }: { csr: DecodedCsr }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <Field label="Subject" value={csr.subject.rfc4514} mono />
        <Field label="Signature algorithm" value={csr.signatureAlgorithm} />
        <Field label="Public key" value={`${csr.publicKey.algorithm}${csr.publicKey.curveName ? ` (${csr.publicKey.curveName})` : ""} — ${csr.publicKey.bitLength ?? "?"} bits`} />
        <Field label="Version" value={String(csr.version)} />
      </div>
      {csr.sans.length > 0 && (
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Requested SANs ({csr.sans.length})
          </Label>
          <div className="flex flex-wrap gap-1 pt-1">
            {csr.sans.map((s, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-mono">
                {s.type}:{s.value}
              </Badge>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <Field label="SHA-1 fingerprint" value={csr.sha1} mono />
        <Field label="SHA-256 fingerprint" value={csr.sha256} mono />
      </div>
    </div>
  );
}

function KeyValueView({ entry }: { entry: { kind: string; label: string; sha1: string; sha256: string } }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 rounded border bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2 text-xs">
        <KeyRound className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <div>
          {entry.kind === "private-key"
            ? "Private key detected. The tool reports the PEM label and fingerprints only — it never parses or displays the key material. If this is a real private key, treat it as compromised: rotate the key pair and never paste private keys into web tools."
            : entry.kind === "public-key"
              ? "Public key (SubjectPublicKeyInfo). Safe to share — contains only the public half of the key pair."
              : "X.509 Certificate Revocation List (CRL). Lists certificates revoked by a CA before their notAfter date."}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <Field label="SHA-1 fingerprint" value={entry.sha1 || "—"} mono />
        <Field label="SHA-256 fingerprint" value={entry.sha256 || "—"} mono />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "good" | "bad" | "warn";
}) {
  const toneClass =
    tone === "bad"
      ? "text-red-700 dark:text-red-300"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "good"
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-foreground";
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className={`${mono ? "font-mono" : ""} text-xs break-all ${toneClass}`}>{value}</div>
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
  value: string;
  hint?: string;
  tone?: "good" | "bad" | "warn";
}) {
  const toneClass =
    tone === "bad"
      ? "text-red-700 dark:text-red-300"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "good"
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-foreground";
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function CommandRow({ c }: { c: OpensslCommand }) {
  return (
    <div className="rounded border bg-background px-3 py-2 text-xs space-y-1">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">{c.tool}</Badge>
        <span className="font-medium text-foreground">{c.label}</span>
      </div>
      <pre className="font-mono text-[11px] text-foreground whitespace-pre-wrap break-all bg-muted/40 rounded px-2 py-1">{c.command}</pre>
      <p className="text-[11px] text-muted-foreground">{c.explanation}</p>
      <CopyButton getText={() => c.command} label="Copy" size="sm" />
    </div>
  );
}
