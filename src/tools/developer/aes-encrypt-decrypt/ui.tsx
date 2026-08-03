"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import {
  encryptText,
  decryptText,
  generatePassword,
  estimateStrength,
  getStats,
  formatBytes,
  type CipherMode,
  type KeySize,
  type OutputFormat,
} from "./logic";
import { Lock, Unlock, Dice5, Eye, EyeOff, KeyRound } from "lucide-react";

export default function AESEncryptDecrypt() {
  const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [cipherMode, setCipherMode] = useState<CipherMode>("AES-GCM");
  const [keySize, setKeySize] = useState<KeySize>(256);
  const [iterations, setIterations] = useState(100000);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("base64");

  const strength = useMemo(() => estimateStrength(password), [password]);
  const stats = useMemo(() => getStats(input, output), [input, output]);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "encrypt") {
        const result = await encryptText(input, {
          mode: cipherMode,
          keySize,
          password,
          iterations,
          outputFormat,
        });
        if (result.ok) {
          setOutput(result.fullOutput);
          toast.success("Encryption successful");
        } else {
          setError(result.error);
          setOutput("");
        }
      } else {
        const result = await decryptText(input, {
          mode: cipherMode,
          keySize,
          password,
          iterations,
          inputFormat: outputFormat,
        });
        if (result.ok) {
          setOutput(result.plaintext);
          toast.success("Decryption successful");
        } else {
          setError(result.error);
          setOutput("");
        }
      }
    } catch (e) {
      setError((e as Error).message ?? "Unexpected error");
    } finally {
      setBusy(false);
    }
  }, [mode, input, password, cipherMode, keySize, iterations, outputFormat]);

  const swap = useCallback(() => {
    setInput(output);
    setOutput(input);
    setMode((m) => (m === "encrypt" ? "decrypt" : "encrypt"));
  }, [input, output]);

  const genPassword = useCallback(() => {
    const pw = generatePassword(24, true);
    setPassword(pw);
    toast.success("Password generated");
  }, []);

  const clear = useCallback(() => {
    setInput("");
    setOutput("");
    setError(null);
    setPassword("");
  }, []);

  return (
    <div className="space-y-4">
      {/* Options */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Operation</Label>
              <div className="flex gap-2">
                <Button
                  variant={mode === "encrypt" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("encrypt")}
                  className="gap-1.5"
                >
                  <Lock className="h-3.5 w-3.5" /> Encrypt
                </Button>
                <Button
                  variant={mode === "decrypt" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode("decrypt")}
                  className="gap-1.5"
                >
                  <Unlock className="h-3.5 w-3.5" /> Decrypt
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Cipher Mode</Label>
              <Select value={cipherMode} onValueChange={(v) => setCipherMode(v as CipherMode)}>
                <SelectTrigger className="w-32" aria-label="Cipher mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AES-GCM">AES-GCM</SelectItem>
                  <SelectItem value="AES-CBC">AES-CBC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Key Size</Label>
              <Select value={String(keySize)} onValueChange={(v) => setKeySize(Number(v) as KeySize)}>
                <SelectTrigger className="w-28" aria-label="Key size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="128">128-bit</SelectItem>
                  <SelectItem value="192">192-bit</SelectItem>
                  <SelectItem value="256">256-bit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">PBKDF2 Iterations</Label>
              <Input
                type="number"
                value={iterations}
                onChange={(e) => setIterations(Math.max(1, Number(e.target.value)))}
                className="w-32 h-9"
                min={1}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Output Format</Label>
              <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as OutputFormat)}>
                <SelectTrigger className="w-28" aria-label="Output format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="base64">Base64</SelectItem>
                  <SelectItem value="hex">Hex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="aes-password" className="text-xs flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Password
              </Label>
              {password && (
                <Badge
                  variant="outline"
                  className={
                    strength.label === "Strong"
                      ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                      : strength.label === "Good"
                      ? "text-blue-600 border-blue-500/30 bg-blue-500/10"
                      : strength.label === "Fair"
                      ? "text-amber-600 border-amber-500/30 bg-amber-500/10"
                      : "text-destructive border-destructive/30 bg-destructive/10"
                  }
                >
                  {strength.label}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="aes-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter encryption password…"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={genPassword} className="gap-1.5">
                <Dice5 className="h-3.5 w-3.5" /> Generate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Input / Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="aes-input" className="text-xs">
              {mode === "encrypt" ? "Plaintext" : "Ciphertext"}
            </Label>
            <Badge variant="outline" className="text-xs">
              {formatBytes(stats.inputSize)}
            </Badge>
          </div>
          <Textarea
            id="aes-input"
            placeholder={mode === "encrypt" ? "Enter text to encrypt…" : `Paste ${outputFormat} ciphertext…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[240px] font-mono text-sm resize-y"
          />
          <div className="flex gap-2">
            <Button onClick={run} disabled={busy || !input.trim() || !password} className="gap-1.5">
              {busy ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : mode === "encrypt" ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Unlock className="h-3.5 w-3.5" />
              )}
              {busy ? "Working…" : mode === "encrypt" ? "Encrypt" : "Decrypt"}
            </Button>
            {output && (
              <Button variant="outline" size="sm" onClick={swap} className="gap-1.5">
                Swap
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={clear} disabled={!input && !output}>
              Clear
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="aes-output" className="text-xs">
              {mode === "encrypt" ? "Ciphertext" : "Plaintext"}
            </Label>
            <div className="flex items-center gap-2">
              {output && (
                <Badge variant="outline" className="text-xs">
                  {formatBytes(stats.outputSize)}
                </Badge>
              )}
              {output && <CopyButton getText={() => output} />}
              {output && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([output], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = mode === "encrypt" ? "encrypted.txt" : "decrypted.txt";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    toast.success("Downloaded");
                  }}
                  className="gap-1.5"
                >
                  Download
                </Button>
              )}
            </div>
          </div>
          <pre
            id="aes-output"
            className="min-h-[240px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-sm break-all"
          >
            {output || <span className="text-muted-foreground">Output will appear here…</span>}
          </pre>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> AES encryption/decryption runs 100% locally in your browser using the WebCrypto API. Your password and data never leave your device. PBKDF2 with SHA-256 is used for secure key derivation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
