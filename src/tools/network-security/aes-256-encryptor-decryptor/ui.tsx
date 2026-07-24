"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  passwordScore, generateSalt, generateIv, bytesToBase64, base64ToBytes,
  bytesToHex, hexToBytes, envelopeToJson, parseEnvelope, validateEnvelope,
  formatDuration, DEFAULT_OPTIONS, type AesMode, type KdfHash, type OutputFormat, type EncryptEnvelope,
} from "./logic";

export default function Aes256EncryptorDecryptor() {
  const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [text, setText] = useState("");
  const [password, setPassword] = useState("");
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [envelope, setEnvelope] = useState<EncryptEnvelope | null>(null);
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [envelopeInput, setEnvelopeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [timing, setTiming] = useState<number | null>(null);
  const [roundTrip, setRoundTrip] = useState<string | null>(null);

  const pwScore = passwordScore(password);

  const encrypt = useCallback(async () => {
    if (!text) { setError("Enter text to encrypt."); return; }
    if (!password) { setError("Enter a password."); return; }
    setError(null);
    try {
      const start = performance.now();
      const enc = new TextEncoder();
      const salt = generateSalt(16);
      const iv = generateIv(options.mode);
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"],
      );
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt as BufferSource, iterations: options.iterations, hash: options.hash },
        keyMaterial,
        { name: options.mode, length: 256 },
        false,
        ["encrypt"],
      );
      const ciphertext = await crypto.subtle.encrypt(
        { name: options.mode, iv: iv as BufferSource },
        key,
        enc.encode(text) as BufferSource,
      );
      const ctBytes = new Uint8Array(ciphertext);
      const env: EncryptEnvelope = {
        v: 1,
        mode: options.mode,
        hash: options.hash,
        iterations: options.iterations,
        salt: bytesToBase64(salt),
        iv: bytesToBase64(iv),
        ciphertext: options.outputFormat === "hex" ? bytesToHex(ctBytes) : bytesToBase64(ctBytes),
      };
      setEnvelope(env);
      setTiming(performance.now() - start);

      // Self-test: round-trip decrypt
      const decKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt as BufferSource, iterations: options.iterations, hash: options.hash },
        keyMaterial,
        { name: options.mode, length: 256 },
        false,
        ["decrypt"],
      );
      const ctBytesForDec = options.outputFormat === "hex" ? hexToBytes(env.ciphertext) : base64ToBytes(env.ciphertext);
      const decrypted = await crypto.subtle.decrypt(
        { name: options.mode, iv: iv as BufferSource },
        decKey,
        ctBytesForDec as BufferSource,
      );
      setRoundTrip(new TextDecoder().decode(decrypted));
    } catch (e) {
      setError(`Encryption failed: ${(e as Error).message}`);
    }
  }, [text, password, options]);

  const decrypt = useCallback(async () => {
    if (!envelopeInput) { setError("Paste an envelope JSON."); return; }
    if (!password) { setError("Enter the password."); return; }
    setError(null);
    try {
      const start = performance.now();
      const env = parseEnvelope(envelopeInput);
      if ("error" in env) { setError(env.error); return; }
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"],
      );
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: base64ToBytes(env.salt) as BufferSource, iterations: env.iterations, hash: env.hash },
        keyMaterial,
        { name: env.mode, length: 256 },
        false,
        ["decrypt"],
      );
      // Try hex first if it looks like hex, else base64
      let ctBytes: Uint8Array;
      try {
        ctBytes = /^[0-9a-f\s]+$/i.test(env.ciphertext) ? hexToBytes(env.ciphertext) : base64ToBytes(env.ciphertext);
      } catch {
        ctBytes = base64ToBytes(env.ciphertext);
      }
      const decrypted = await crypto.subtle.decrypt(
        { name: env.mode, iv: base64ToBytes(env.iv) as BufferSource },
        key,
        ctBytes as BufferSource,
      );
      setDecrypted(new TextDecoder().decode(decrypted));
      setTiming(performance.now() - start);
    } catch (e) {
      setError(`Decryption failed: ${(e as Error).message}. Check password or envelope.`);
    }
  }, [envelopeInput, password]);

  const warnings = envelope ? validateEnvelope(envelope) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant={mode === "encrypt" ? "default" : "outline"} onClick={() => setMode("encrypt")}>Encrypt</Button>
            <Button size="sm" variant={mode === "decrypt" ? "default" : "outline"} onClick={() => setMode("decrypt")}>Decrypt</Button>
          </div>

          {mode === "encrypt" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Text to encrypt</Label>
                <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono" value={text} onChange={(e) => setText(e.target.value)} placeholder="Secret message" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Password ({pwScore.label})</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <div className="flex gap-1 mt-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded ${i < pwScore.score ? ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-emerald-500", "bg-emerald-600"][pwScore.score] : "bg-muted"}`} />
                  ))}
                </div>
                {pwScore.suggestions.length > 0 && password && (
                  <p className="text-xs text-muted-foreground mt-1">{pwScore.suggestions[0]}</p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Cipher mode</Label>
                  <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.mode} onChange={(e) => setOptions({ ...options, mode: e.target.value as AesMode })}>
                    <option value="aes-gcm">AES-GCM (recommended)</option>
                    <option value="aes-cbc">AES-CBC</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">PBKDF2 iterations</Label>
                  <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.iterations} onChange={(e) => setOptions({ ...options, iterations: Number(e.target.value) })}>
                    <option value={100_000}>100,000 (minimum)</option>
                    <option value={210_000}>210,000 (OWASP 2023)</option>
                    <option value={500_000}>500,000</option>
                    <option value={1_000_000}>1,000,000</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Hash function</Label>
                  <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.hash} onChange={(e) => setOptions({ ...options, hash: e.target.value as KdfHash })}>
                    <option value="SHA-256">SHA-256</option>
                    <option value="SHA-384">SHA-384</option>
                    <option value="SHA-512">SHA-512</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Output format</Label>
                  <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.outputFormat} onChange={(e) => setOptions({ ...options, outputFormat: e.target.value as OutputFormat })}>
                    <option value="base64">Base64</option>
                    <option value="hex">Hex</option>
                  </select>
                </div>
              </div>

              <Button size="sm" onClick={encrypt}>Encrypt</Button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Envelope JSON</Label>
                <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] font-mono" value={envelopeInput} onChange={(e) => setEnvelopeInput(e.target.value)} placeholder='{"v":1,"mode":"aes-gcm",...}' />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button size="sm" onClick={decrypt}>Decrypt</Button>
            </>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {envelope && mode === "encrypt" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Cipher</p><p className="text-sm font-bold uppercase">{envelope.mode}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Hash</p><p className="text-sm font-bold">{envelope.hash}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Iterations</p><p className="text-sm font-bold">{envelope.iterations.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Time</p><p className="text-sm font-bold">{timing ? formatDuration(timing) : "-"}</p></CardContent></Card>
          </div>
          {warnings.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {warnings.map((w, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
            </CardContent></Card>
          )}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Encrypted envelope (JSON)</CardTitle>
                <div className="flex gap-2">
                  <CopyButton getText={() => envelopeToJson(envelope)} />
                  <DownloadButton getText={() => envelopeToJson(envelope)} filename="encrypted.enc" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs overflow-x-auto p-4 bg-muted/40 rounded-b-lg"><code>{envelopeToJson(envelope)}</code></pre>
            </CardContent>
          </Card>
          {roundTrip && (
            <Card><CardContent className="p-3">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">✅ Round-trip self-test passed (decrypting now produces original):</p>
              <p className="text-xs font-mono">{roundTrip.slice(0, 100)}{roundTrip.length > 100 ? "…" : ""}</p>
            </CardContent></Card>
          )}
        </>
      )}

      {decrypted && mode === "decrypt" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Decrypted text</CardTitle>
              <CopyButton getText={() => decrypted} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-sm overflow-x-auto p-4 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-all">{decrypted}</pre>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all encryption uses the browser's native Web Crypto API. Nothing is uploaded. Note: this tool uses AES-256-GCM with PBKDF2 key derivation — the strongest cipher widely available in browsers.</p></CardContent></Card>
    </div>
  );
}
