"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  hashFile, hashText, verifyHash, detectAlgorithmFromHash,
  formatHashList, type HashResult,
} from "./logic";

export default function FileHashValidator() {
  const [results, setResults] = useState<HashResult[]>([]);
  const [expectedHash, setExpectedHash] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [textInput, setTextInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setProgress(`Hashing ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`);
    try {
      const algorithms = ["MD5", "SHA-1", "SHA-256", "SHA-512"];
      const r = await hashFile(file, algorithms);
      setResults(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResults([]);
    } finally {
      setProgress(null);
    }
  }, []);

  const handleText = useCallback(async () => {
    setError(null);
    if (!textInput.trim()) {
      setError("Please enter text to hash.");
      return;
    }
    try {
      const r = await hashText(textInput, ["MD5", "SHA-1", "SHA-256", "SHA-512"]);
      setResults(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [textInput]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const detectedAlg = expectedHash.trim() ? detectAlgorithmFromHash(expectedHash) : "Unknown";
  const verifyResult = results.length > 0 && expectedHash.trim()
    ? (() => {
        const matched = results.find((r) => r.algorithm === detectedAlg);
        return matched ? verifyHash(matched.hex, expectedHash) : null;
      })()
    : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 flex-wrap">
            <Button variant={mode === "file" ? "default" : "outline"} size="sm" onClick={() => setMode("file")}>File mode</Button>
            <Button variant={mode === "text" ? "default" : "outline"} size="sm" onClick={() => setMode("text")}>Text mode</Button>
          </div>
        </CardContent>
      </Card>

      {mode === "file" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <p className="text-sm font-medium">{dragOver ? "Drop file here" : "Drag & drop a file or click to browse"}</p>
              <p className="text-xs text-muted-foreground mt-1">All hashing happens in your browser — nothing is uploaded.</p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
          </CardContent>
        </Card>
      )}

      {mode === "text" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label htmlFor="text-input">Text to hash</Label>
            <Textarea
              id="text-input"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text to hash..."
              rows={5}
            />
            <Button onClick={handleText}>Compute hashes</Button>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {results.length > 0 && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-sm">Computed Hashes</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              {results.map((r) => (
                <div key={r.algorithm} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.algorithm}</Badge>
                    <span className="text-xs text-muted-foreground">{r.hex.length} hex chars</span>
                    <CopyButton getText={() => r.hex} label="Copy hex" size="sm" />
                    <CopyButton getText={() => r.base64} label="Copy base64" size="sm" />
                  </div>
                  <div className="font-mono text-xs break-all bg-muted/30 p-2 rounded">{r.hex}</div>
                </div>
              ))}
              <DownloadButton
                getText={() => formatHashList(results)}
                filename="checksums.txt"
                disabled={results.length === 0}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Verify against expected hash</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-3">
              <Label htmlFor="expected">Expected hash</Label>
              <Input
                id="expected"
                value={expectedHash}
                onChange={(e) => setExpectedHash(e.target.value)}
                placeholder="Paste expected hash..."
              />
              {expectedHash.trim() && (
                <p className="text-xs text-muted-foreground">Detected algorithm: {detectedAlg}</p>
              )}
              {verifyResult && (
                <div className={`rounded-md p-3 text-sm ${verifyResult.match ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"}`}>
                  <p className="font-medium">
                    {verifyResult.match ? "✓ Hash matches" : "✗ Hash does NOT match"}
                  </p>
                  {verifyResult.match && <p className="text-xs text-muted-foreground mt-1">File integrity verified.</p>}
                </div>
              )}
              {expectedHash.trim() && !verifyResult && (
                <p className="text-xs text-muted-foreground">
                  No matching algorithm computed. Expected: {detectedAlg}.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
