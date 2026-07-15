"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  encryptPdf, encryptBatch, formatBytes, toHex,
  getEncryptionParams, encodePermissions, describePermissions,
  DEFAULT_PERMISSIONS,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl,
  type HistoryEntry, type EncryptionLevel, type PermissionFlags, type EncryptResult,
} from "./logic";
import {
  Upload, Lock, Download, History, BarChart3, X, Eye, EyeOff, FileText, ShieldAlert,
} from "lucide-react";

interface InputFile {
  fileName: string;
  size: number;
  bytes: Uint8Array;
}

interface OutputResult {
  fileName: string;
  blob: Blob;
  result: EncryptResult;
}

export default function PdfPasswordEncryptor() {
  const [inputs, setInputs] = useState<InputFile[]>([]);
  const [userPassword, setUserPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showUserPw, setShowUserPw] = useState(false);
  const [showOwnerPw, setShowOwnerPw] = useState(false);
  const [level, setLevel] = useState<EncryptionLevel>("rc4-128");
  const [perms, setPerms] = useState<PermissionFlags>(DEFAULT_PERMISSIONS);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<OutputResult | null>(null);
  const [batchResults, setBatchResults] = useState<Array<{ fileName: string; result: EncryptResult | null; error: string | null }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [showManifest, setShowManifest] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSize = useMemo(() => inputs.reduce((s, i) => s + i.size, 0), [inputs]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const newInputs: InputFile[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        newInputs.push({ fileName: file.name, size: file.size, bytes });
      } catch (e) {
        setError(`Failed to read ${file.name}: ${(e as Error).message}`);
      }
    }
    setInputs((prev) => [...prev, ...newInputs]);
    setResult(null);
    setBatchResults(null);
  }, []);

  const removeInput = useCallback((index: number) => {
    setInputs((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
    setBatchResults(null);
  }, []);

  const encrypt = useCallback(() => {
    if (inputs.length === 0) return;
    if (!userPassword && !ownerPassword) {
      setError("Set at least one of user password or owner password.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      if (inputs.length === 1) {
        const inp = inputs[0]!;
        const r = encryptPdf(inp.bytes, {
          userPassword, ownerPassword, permissions: perms, level,
        });
        const blob = new Blob([r.encryptedBytes as BlobPart], { type: "application/pdf" });
        const outName = inp.fileName.replace(/\.pdf$/i, "") + "-encrypted.pdf";
        setResult({ fileName: outName, blob, result: r });
        setBatchResults(null);
        setHistory(saveToHistory({
          fileCount: 1, level,
          totalOriginal: r.originalSize, totalEncrypted: r.encryptedSize,
          permissions: describePermissions(perms),
          encryptedAt: new Date().toISOString(),
        }));
        toast.success(`Encrypted ${outName} (${formatBytes(r.encryptedSize)})`);
      } else {
        const r = encryptBatch(
          inputs.map((i) => ({ fileName: i.fileName, bytes: i.bytes })),
          { userPassword, ownerPassword, permissions: perms, level },
        );
        setBatchResults(r.outputs);
        setResult(null);
        setHistory(saveToHistory({
          fileCount: r.outputs.length, level,
          totalOriginal: r.totalOriginal, totalEncrypted: r.totalEncrypted,
          permissions: describePermissions(perms),
          encryptedAt: new Date().toISOString(),
        }));
        const ok = r.outputs.filter((o) => o.result).length;
        toast.success(`Encrypted ${ok}/${r.outputs.length} files`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, [inputs, userPassword, ownerPassword, perms, level]);

  const download = useCallback((fileName: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${fileName}`);
  }, []);

  const downloadBatchEntry = useCallback((fileName: string, r: EncryptResult) => {
    const blob = new Blob([r.encryptedBytes as BlobPart], { type: "application/pdf" });
    download(fileName.replace(/\.pdf$/i, "") + "-encrypted.pdf", blob);
  }, [download]);

  const permSummary = useMemo(() => describePermissions(perms), [perms]);
  const params = useMemo(() => getEncryptionParams(level), [level]);
  const computedP = useMemo(() => encodePermissions(perms, params.R), [perms, params]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Encryption options</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">User password (required to open)</Label>
              <div className="relative">
                <Input
                  type={showUserPw ? "text" : "password"}
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="user password"
                  aria-label="User password"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowUserPw(!showUserPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                  aria-label={showUserPw ? "Hide user password" : "Show user password"}
                >
                  {showUserPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Owner password (required to change permissions)</Label>
              <div className="relative">
                <Input
                  type={showOwnerPw ? "text" : "password"}
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="owner password"
                  aria-label="Owner password"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowOwnerPw(!showOwnerPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                  aria-label={showOwnerPw ? "Hide owner password" : "Show owner password"}
                >
                  {showOwnerPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Encryption level</Label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as EncryptionLevel)}
              className="w-full sm:w-auto h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              aria-label="Encryption level"
            >
              <option value="rc4-40">40-bit RC4 (PDF 1.3, V=1, R=2)</option>
              <option value="rc4-128">128-bit RC4 (PDF 1.4, V=2, R=3)</option>
              <option value="aes-128">128-bit AES (PDF 1.5, V=4, R=4)</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Permissions</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
              <PermCheckbox label="Print" checked={perms.print} onChange={(v) => setPerms({ ...perms, print: v })} />
              <PermCheckbox label="Modify" checked={perms.modify} onChange={(v) => setPerms({ ...perms, modify: v })} />
              <PermCheckbox label="Copy" checked={perms.copy} onChange={(v) => setPerms({ ...perms, copy: v })} />
              <PermCheckbox label="Annotate" checked={perms.annotate} onChange={(v) => setPerms({ ...perms, annotate: v })} />
              {params.R >= 3 && (
                <>
                  <PermCheckbox label="Fill forms" checked={perms.fillForms} onChange={(v) => setPerms({ ...perms, fillForms: v })} />
                  <PermCheckbox label="Accessibility" checked={perms.extractAccessibility} onChange={(v) => setPerms({ ...perms, extractAccessibility: v })} />
                  <PermCheckbox label="Assemble" checked={perms.assemble} onChange={(v) => setPerms({ ...perms, assemble: v })} />
                  <PermCheckbox label="HQ print" checked={perms.printHighQuality} onChange={(v) => setPerms({ ...perms, printHighQuality: v })} />
                </>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">/P = {computedP >>> 0} (0x{(computedP >>> 0).toString(16)})</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton
              getUrl={() => buildShareUrl({ level, print: perms.print, modify: perms.modify, copy: perms.copy, annotate: perms.annotate })}
              label="Share options"
              size="sm"
            />
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-3 w-3 mr-1" /> Soft-lock: streams not encrypted
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept=".pdf,application/pdf"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="pdf-input"
            aria-label="Choose PDF files to encrypt"
            ref={fileInputRef}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop PDF files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Multiple files · /Encrypt dictionary injection · 40-bit RC4 / 128-bit RC4 / 128-bit AES</p>
          </button>
        </CardContent>
      </Card>

      {inputs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Input files ({inputs.length}) — {formatBytes(totalSize)}</Label>
              <button
                type="button"
                onClick={() => { setInputs([]); setResult(null); setBatchResults(null); }}
                className="text-[10px] text-red-600 hover:underline cursor-pointer"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-2">
              {inputs.map((inp, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs font-medium truncate">{inp.fileName}</p>
                    <Badge variant="outline" className="text-[10px]">{formatBytes(inp.size)}</Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInput(i)}
                    className="p-1 rounded-md hover:bg-accent cursor-pointer"
                    aria-label={`Remove ${inp.fileName}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {inputs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-semibold">Encrypt & download</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={encrypt}
                  disabled={working}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground h-8 px-3 text-xs hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  <Lock className="h-3.5 w-3.5" /> {working ? "Encrypting..." : "Encrypt"}
                </button>
                {result && (
                  <button
                    type="button"
                    onClick={() => download(result.fileName, result.blob)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                )}
                {result && (
                  <button
                    type="button"
                    onClick={() => setShowManifest(!showManifest)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" /> {showManifest ? "Hide" : "Manifest"}
                  </button>
                )}
              </div>
            </div>
            {result && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Original" value={formatBytes(result.result.originalSize)} />
                  <Stat label="Encrypted" value={formatBytes(result.result.encryptedSize)} />
                  <Stat label="V/R" value={`${result.result.params.V}/${result.result.params.R}`} />
                  <Stat label="Key bits" value={String(result.result.params.length)} />
                </div>
                {showManifest && (
                  <pre className="text-[10px] font-mono bg-muted/40 p-2 rounded-md overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
{`/Encrypt dictionary:
${result.result.encryptDictBody}

/O (owner hash, 32 bytes hex): ${toHex(result.result.O)}
/U (user hash, 32 bytes hex):  ${toHex(result.result.U)}
/P (permissions int):          ${(result.result.P >>> 0)} (0x${(result.result.P >>> 0).toString(16)})
/V (algorithm version):        ${result.result.params.V}
/R (revision):                 ${result.result.params.R}
/Length (key bits):            ${result.result.params.length}
/ID (document ID, hex):        ${toHex(result.result.documentId)}
Encryption key (hex):          ${toHex(result.result.encryptionKey)}

Permissions:
${permSummary.map((s) => `  ${s}`).join("\n")}

HONESTY NOTE: Streams are NOT encrypted. The /Encrypt dictionary is
injected into the trailer, but the PDF streams/strings remain in
plaintext. Viewers that check /Encrypt presence will prompt for a
password; viewers that fully verify /U may behave unpredictably.`}
                  </pre>
                )}
              </div>
            )}
            {batchResults && (
              <div className="rounded-md border">
                <div className="px-2 py-1 bg-muted/30 text-[10px] text-muted-foreground border-b">Batch results ({batchResults.length})</div>
                <div className="max-h-[300px] overflow-y-auto">
                  {batchResults.map((b, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-2 py-1 text-xs border-b border-border/40 last:border-0">
                      <span className="truncate min-w-0 flex-1">{b.fileName}</span>
                      {b.result ? (
                        <>
                          <Badge variant="outline" className="text-[10px]">{formatBytes(b.result.encryptedSize)}</Badge>
                          <button
                            type="button"
                            onClick={() => downloadBatchEntry(b.fileName, b.result!)}
                            className="text-[10px] text-primary hover:underline cursor-pointer flex-shrink-0"
                          >
                            Download
                          </button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-red-600 border-red-500/30">Error</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {inputs.length === 0 && !error && !working && (
        <EmptyState
          title="Add password protection to PDF"
          hint="Computes /O, /U, /P per PDF spec (RC4 + MD5). Injects /Encrypt dictionary into trailer. Honest about stream encryption limitation."
          icon={<Lock className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
          >
            <History className="h-3 w-3" /> History ({history.length})
          </button>
          {showHistory && (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Recent batches</Label>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { clearHistory(); setHistory([]); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No history yet.</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                      <p className="font-medium">{h.fileCount} file{h.fileCount === 1 ? "" : "s"} · {h.level}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatBytes(h.totalOriginal)} → {formatBytes(h.totalEncrypted)} · {new Date(h.encryptedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy + Honesty:</strong> all encryption parameter computation (MD5, RC4, /O, /U, /P, key derivation) runs in your browser using pure JavaScript. PDF contents and passwords never leave your device. <strong className="text-foreground">This tool does NOT encrypt PDF streams</strong> — it injects a valid /Encrypt dictionary with correct /O and /U hashes for your password, but stream objects remain plaintext. Viewers that check /Encrypt presence will prompt for a password; viewers that fully verify /U may behave unpredictably. For full stream encryption, use Adobe Acrobat or qpdf --encrypt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function PermCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-input"
      />
      {label}
    </label>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`text-sm font-mono font-semibold ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}
