"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseEncryptDict, extractDocumentId, verifyUserPassword,
  removeSecurity, removeSecurityBatch,
  describePermissions, formatBytes, toHex,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl,
  type HistoryEntry, type ParsedEncryptDict,
} from "./logic";
import {
  Upload, Unlock, Download, History, BarChart3, X, Eye, EyeOff, FileText, ShieldAlert,
} from "lucide-react";

interface InputFile {
  fileName: string;
  size: number;
  bytes: Uint8Array;
  parsed?: ParsedEncryptDict;
  passwordVerified?: boolean;
}

interface OutputResult {
  fileName: string;
  blob: Blob;
  originalSize: number;
  removedSize: number;
}

interface BatchEntry {
  fileName: string;
  outFileName: string;
  bytes: Uint8Array | null;
  error: string | null;
  originalSize: number;
}

export default function PdfSecurityRemover() {
  const [inputs, setInputs] = useState<InputFile[]>([]);
  const [userPassword, setUserPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState(true);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<OutputResult | null>(null);
  const [batchResults, setBatchResults] = useState<BatchEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [outputName, setOutputName] = useState("unlocked.pdf");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSize = useMemo(() => inputs.reduce((s, i) => s + i.size, 0), [inputs]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const newInputs: InputFile[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const parsed = parseEncryptDict(bytes);
        newInputs.push({ fileName: file.name, size: file.size, bytes, parsed });
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

  const verifyInputs = useCallback(() => {
    if (!verifyPassword || !userPassword) return;
    setInputs((prev) => prev.map((inp) => {
      if (!inp.parsed?.hasEncrypt || !inp.parsed.U || !inp.parsed.O || !inp.parsed.P || !inp.parsed.R || !inp.parsed.V) {
        return { ...inp, passwordVerified: undefined };
      }
      const id = extractDocumentId(inp.bytes) ?? new Uint8Array(16);
      const ok = verifyUserPassword(userPassword, inp.parsed, id);
      return { ...inp, passwordVerified: ok };
    }));
  }, [verifyPassword, userPassword]);

  const remove = useCallback(async () => {
    if (inputs.length === 0) return;
    setWorking(true);
    setError(null);
    try {
      if (inputs.length === 1) {
        const inp = inputs[0]!;
        // Optionally verify password first
        if (verifyPassword && inp.parsed?.hasEncrypt && userPassword) {
          const id = extractDocumentId(inp.bytes) ?? new Uint8Array(16);
          if (!verifyUserPassword(userPassword, inp.parsed, id)) {
            setError("Wrong password — could not verify against /U hash. The PDF will still be processed but content may remain encrypted if streams were actually encrypted.");
          }
        }
        const out = await removeSecurity(inp.bytes);
        const blob = new Blob([out as BlobPart], { type: "application/pdf" });
        const outName = outputName || inp.fileName.replace(/\.pdf$/i, "") + "-unlocked.pdf";
        setResult({ fileName: outName, blob, originalSize: inp.size, removedSize: out.length });
        setBatchResults(null);
        setHistory(saveToHistory({
          fileCount: 1,
          totalOriginal: inp.size, totalRemoved: out.length,
          removedAt: new Date().toISOString(),
        }));
        toast.success(`Unlocked ${outName} (${formatBytes(out.length)})`);
      } else {
        const r = await removeSecurityBatch(inputs.map((i) => ({ fileName: i.fileName, bytes: i.bytes })));
        const entries: BatchEntry[] = r.outputs.map((o, i) => ({
          fileName: inputs[i]!.fileName,
          outFileName: inputs[i]!.fileName.replace(/\.pdf$/i, "") + "-unlocked.pdf",
          bytes: o.bytes,
          error: o.error,
          originalSize: inputs[i]!.size,
        }));
        setBatchResults(entries);
        setResult(null);
        setHistory(saveToHistory({
          fileCount: r.outputs.length,
          totalOriginal: r.totalOriginal, totalRemoved: r.totalRemoved,
          removedAt: new Date().toISOString(),
        }));
        const ok = entries.filter((e) => e.bytes).length;
        toast.success(`Unlocked ${ok}/${entries.length} files`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, [inputs, verifyPassword, userPassword, outputName]);

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

  const totalEncryptedCount = useMemo(() => inputs.filter((i) => i.parsed?.hasEncrypt).length, [inputs]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Removal options</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">User password (for verification)</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={userPassword}
                  onChange={(e) => { setUserPassword(e.target.value); setTimeout(verifyInputs, 0); }}
                  placeholder="user password (optional)"
                  aria-label="User password"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Output filename (single-file mode)</Label>
              <Input
                value={outputName}
                onChange={(e) => setOutputName(e.target.value)}
                aria-label="Output filename"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="verify-pw"
              checked={verifyPassword}
              onChange={(e) => { setVerifyPassword(e.target.checked); setTimeout(verifyInputs, 0); }}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="verify-pw" className="text-xs cursor-pointer">
              Verify password against /U hash before removing (recommended)
            </Label>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton getUrl={() => buildShareUrl()} label="Share" size="sm" />
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-3 w-3 mr-1" /> Streams not decrypted
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
            aria-label="Choose PDF files to unlock"
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
            <p className="mt-1 text-xs text-muted-foreground">Multiple files · /Encrypt dictionary parsing · password verification · strip /Encrypt from trailer</p>
          </button>
        </CardContent>
      </Card>

      {inputs.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                Input files ({inputs.length}) — {formatBytes(totalSize)} · {totalEncryptedCount} encrypted
              </Label>
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
                <div key={i} className="rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
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
                  {inp.parsed?.hasEncrypt ? (
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                      <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-500/30">
                        Encrypted · V={inp.parsed.V} R={inp.parsed.R} Length={inp.parsed.length}
                      </Badge>
                      {inp.passwordVerified === true && (
                        <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-500/30">
                          ✓ Password verified
                        </Badge>
                      )}
                      {inp.passwordVerified === false && (
                        <Badge variant="outline" className="text-[9px] text-red-600 border-red-500/30">
                          ✗ Wrong password
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-[10px] text-muted-foreground">No /Encrypt dictionary found (not encrypted).</p>
                  )}
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
              <Label className="text-sm font-semibold">Remove security & download</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={remove}
                  disabled={working}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground h-8 px-3 text-xs hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  <Unlock className="h-3.5 w-3.5" /> {working ? "Removing..." : "Remove security"}
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
                {inputs[0]?.parsed?.hasEncrypt && (
                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" /> {showDetails ? "Hide" : "Details"}
                  </button>
                )}
              </div>
            </div>
            {result && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Original" value={formatBytes(result.originalSize)} />
                <Stat label="Unlocked" value={formatBytes(result.removedSize)} accent />
                <Stat label="Diff" value={`${result.removedSize - result.originalSize > 0 ? "+" : ""}${formatBytes(result.removedSize - result.originalSize)}`} />
                <Stat label="Encrypted?" value={inputs[0]?.parsed?.hasEncrypt ? "Yes" : "No"} />
              </div>
            )}
            {showDetails && inputs[0]?.parsed && inputs[0].parsed.hasEncrypt && (
              <pre className="text-[10px] font-mono bg-muted/40 p-2 rounded-md overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
{`/Encrypt dictionary contents:
${inputs[0].parsed.rawText}

V (algorithm version):     ${inputs[0].parsed.V}
R (revision):              ${inputs[0].parsed.R}
Length (key bits):         ${inputs[0].parsed.length}
P (permissions int):       ${inputs[0].parsed.P} (0x${((inputs[0].parsed.P ?? 0) >>> 0).toString(16)})
O (owner hash, hex):       ${inputs[0].parsed.O ? toHex(inputs[0].parsed.O) : "(missing)"}
U (user hash, hex):        ${inputs[0].parsed.U ? toHex(inputs[0].parsed.U) : "(missing)"}
Encryption level:          ${inputs[0].parsed.level ?? "(unknown)"}

Permissions (decoded from /P):
${(inputs[0].parsed.permissions ? describePermissions(inputs[0].parsed.permissions) : []).map((s) => `  ${s}`).join("\n")}

HONESTY NOTE: We strip the /Encrypt dictionary from the trailer so the
PDF opens without a password prompt. We do NOT decrypt encrypted streams.
For PDFs with full stream encryption (Acrobat-produced), the content may
appear as garbage. For full decryption, use Adobe Acrobat or qpdf --decrypt.`}
              </pre>
            )}
            {batchResults && (
              <div className="rounded-md border">
                <div className="px-2 py-1 bg-muted/30 text-[10px] text-muted-foreground border-b">Batch results ({batchResults.length})</div>
                <div className="max-h-[300px] overflow-y-auto">
                  {batchResults.map((b, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-2 py-1 text-xs border-b border-border/40 last:border-0">
                      <span className="truncate min-w-0 flex-1">{b.fileName}</span>
                      {b.bytes ? (
                        <>
                          <Badge variant="outline" className="text-[10px]">{formatBytes(b.bytes.length)}</Badge>
                          <button
                            type="button"
                            onClick={() => download(b.outFileName, new Blob([b.bytes as BlobPart], { type: "application/pdf" }))}
                            className="text-[10px] text-primary hover:underline cursor-pointer flex-shrink-0"
                          >
                            Download
                          </button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-red-600 border-red-500/30">Error: {b.error}</Badge>
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
          title="Remove password & restrictions from PDF"
          hint="Parses /Encrypt dictionary, verifies user password against /U hash, strips /Encrypt from trailer. Honest about stream decryption limitation."
          icon={<Unlock className="h-8 w-8" />}
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
                      <p className="font-medium">{h.fileCount} file{h.fileCount === 1 ? "" : "s"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatBytes(h.totalOriginal)} → {formatBytes(h.totalRemoved)} · {new Date(h.removedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy + Honesty:</strong> all /Encrypt dictionary parsing, password verification (MD5 + RC4 + /U comparison), and PDF re-saving runs in your browser. PDF contents and password never leave your device. <strong className="text-foreground">This tool does NOT decrypt encrypted streams</strong> — it strips the /Encrypt dictionary so the PDF opens without a password prompt, but streams that were actually encrypted (Acrobat-produced PDFs) remain encrypted and may show as garbage. For full decryption, use Adobe Acrobat (with password) or qpdf --decrypt.
          </p>
        </CardContent>
      </Card>
    </div>
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
