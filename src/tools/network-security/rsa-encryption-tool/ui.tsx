"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  securityInfoFor, maxPlaintextBytes, planEncrypt, planBatch,
  renderBatchCsv, renderReport, planJwkShape, planFingerprint,
  keySizeComparisonTable, PADDING_MODES, KEY_SIZES, bytesToHex,
  type KeySize, type PaddingMode,
} from "./logic";

const LEVEL_COLOR: Record<string, string> = {
  deprecated: "bg-red-500/15 text-red-700 dark:text-red-300",
  acceptable: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  strong: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "very-strong": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
};

export default function RsaEncryptionTool() {
  const [plaintext, setPlaintext] = useState("Hello RSA!");
  const [keySize, setKeySize] = useState<KeySize>(2048);
  const [mode, setMode] = useState<PaddingMode>("OAEP-SHA256");
  const [publicKeyJwk, setPublicKeyJwk] = useState("");
  const [privateKeyJwk, setPrivateKeyJwk] = useState("");
  const [ciphertextB64, setCiphertextB64] = useState("");
  const [decrypted, setDecrypted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sec = useMemo(() => securityInfoFor(keySize), [keySize]);
  const plan = useMemo(() => planEncrypt({ plaintext, keySize, mode }), [plaintext, keySize, mode]);
  const maxBytes = useMemo(() => maxPlaintextBytes(keySize, mode), [keySize, mode]);
  const report = useMemo(() => renderReport(plan, sec), [plan, sec]);
  const jwkShape = useMemo(() => planJwkShape({ keySize, publicExponent: 65537, extractable: true }, mode, true), [keySize, mode]);
  const fingerprint = useMemo(() => planFingerprint(keySize), [keySize]);
  const comparisonTable = useMemo(() => keySizeComparisonTable(), []);

  const generateKey = async () => {
    setError(""); setBusy(true);
    try {
      const alg = { name: "RSA-OAEP", modulusLength: keySize, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
      const pair = await window.crypto.subtle.generateKey(alg, true, ["encrypt", "decrypt"]);
      const pub = await window.crypto.subtle.exportKey("jwk", pair.publicKey);
      const priv = await window.crypto.subtle.exportKey("jwk", pair.privateKey);
      setPublicKeyJwk(JSON.stringify(pub, null, 2));
      setPrivateKeyJwk(JSON.stringify(priv, null, 2));
      const spki = await window.crypto.subtle.exportKey("spki", pair.publicKey);
      fingerprint.fingerprintHex = bytesToHex(new Uint8Array(spki));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Key generation failed");
    } finally {
      setBusy(false);
    }
  };

  const encrypt = async () => {
    setError(""); setBusy(true);
    try {
      if (!publicKeyJwk) throw new Error("Generate or paste a public key first.");
      const pub = await window.crypto.subtle.importKey("jwk", JSON.parse(publicKeyJwk),
        { name: "RSA-OAEP", hash: mode.startsWith("OAEP-SHA") ? mode.replace("OAEP-", "SHA-") : "SHA-256" },
        true, ["encrypt"]);
      const enc = new TextEncoder().encode(plaintext);
      const ct = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, enc);
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ct)));
      setCiphertextB64(b64);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Encryption failed");
    } finally {
      setBusy(false);
    }
  };

  const decrypt = async () => {
    setError(""); setBusy(true);
    try {
      if (!privateKeyJwk) throw new Error("Paste a private JWK first.");
      if (!ciphertextB64) throw new Error("No ciphertext to decrypt.");
      const priv = await window.crypto.subtle.importKey("jwk", JSON.parse(privateKeyJwk),
        { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);
      const ct = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
      const pt = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, priv, ct);
      setDecrypted(new TextDecoder().decode(pt));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decryption failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Key size</Label>
              <select value={keySize} onChange={(e) => setKeySize(Number(e.target.value) as KeySize)}
                className="h-9 w-full text-sm rounded border bg-background px-2 cursor-pointer">
                {KEY_SIZES.map((k) => <option key={k} value={k}>{k}-bit</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Padding mode</Label>
              <select value={mode} onChange={(e) => setMode(e.target.value as PaddingMode)}
                className="h-9 w-full text-sm rounded border bg-background px-2 cursor-pointer">
                {PADDING_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max plaintext</Label>
              <div className="h-9 flex items-center text-sm font-mono text-muted-foreground">{maxBytes} B</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
            <Badge variant="outline" className={`text-[11px] ${LEVEL_COLOR[sec.level]}`}>{sec.level}</Badge>
            <Badge variant="outline" className="text-[11px]">~{sec.symmetricBits}-bit symmetric</Badge>
            <button type="button" onClick={generateKey} disabled={busy}
              className="ml-auto px-3 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:opacity-90 cursor-pointer disabled:opacity-50">
              {busy ? "Working…" : "Generate key pair"}
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-xs text-muted-foreground">Plaintext</Label>
          <Textarea value={plaintext} onChange={(e) => setPlaintext(e.target.value)}
            className="font-mono text-xs min-h-[80px]" />
          <div className="flex items-center gap-2 text-xs">
            <span>{plan.plaintextBytes} / {maxBytes} bytes</span>
            {!plan.fits && <Badge variant="outline" className="text-[10px] text-red-700 dark:text-red-300">too large</Badge>}
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={encrypt} disabled={busy || !publicKeyJwk}
                className="px-2 py-1 rounded-md text-xs border bg-background hover:bg-muted cursor-pointer disabled:opacity-50">
                Encrypt
              </button>
              <button type="button" onClick={decrypt} disabled={busy || !privateKeyJwk || !ciphertextB64}
                className="px-2 py-1 rounded-md text-xs border bg-background hover:bg-muted cursor-pointer disabled:opacity-50">
                Decrypt
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-xs text-muted-foreground">Public key (JWK)</Label>
          <Textarea value={publicKeyJwk} onChange={(e) => setPublicKeyJwk(e.target.value)}
            placeholder="Paste public JWK or generate above"
            className="font-mono text-[10px] min-h-[100px]" />
          <Label className="text-xs text-muted-foreground mt-2">Private key (JWK)</Label>
          <Textarea value={privateKeyJwk} onChange={(e) => setPrivateKeyJwk(e.target.value)}
            placeholder="Paste private JWK or generate above"
            className="font-mono text-[10px] min-h-[120px]" />
          <div className="flex gap-2 pt-1">
            <CopyButton getText={() => publicKeyJwk} label="Copy pub" />
            <CopyButton getText={() => privateKeyJwk} label="Copy priv" />
            <DownloadButton getText={() => report} filename="rsa-plan.txt" />
          </div>
        </CardContent>
      </Card>

      {ciphertextB64 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">Ciphertext (base64)</Label>
            <pre className="text-[10px] font-mono bg-muted/30 p-2 rounded break-all whitespace-pre-wrap">{ciphertextB64}</pre>
            <CopyButton getText={() => ciphertextB64} label="Copy ciphertext" />
          </CardContent>
        </Card>
      )}

      {decrypted && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">Decrypted</Label>
            <pre className="text-xs font-mono bg-muted/30 p-2 rounded break-all whitespace-pre-wrap">{decrypted}</pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Key size comparison</Label>
          <pre className="text-[10px] font-mono bg-muted/30 p-2 rounded overflow-x-auto">{comparisonTable}</pre>
          <Label className="text-xs text-muted-foreground mt-2">JWK shape (planned)</Label>
          <pre className="text-[10px] font-mono bg-muted/30 p-2 rounded">{JSON.stringify(jwkShape, null, 2)}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> key generation, encryption, and
            decryption happen entirely in your browser via WebCrypto.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
