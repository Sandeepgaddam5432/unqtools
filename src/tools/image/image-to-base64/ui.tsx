"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, ErrorBanner } from "../../_shared";
import { detectMime, buildBase64Result, formatSize } from "./logic";
import { toast } from "sonner";

export default function ImageToBase64() {
  const [output, setOutput] = useState<string>("");
  const [mime, setMime] = useState<string>("");
  const [size, setSize] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") && !detectMime(file.name)) {
      setError("Please choose an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        setError("Could not read file as data URL");
        return;
      }
      const detected = detectMime(file.name) || (file.type as "image/png") || "image/png";
      // Strip the prefix to get raw base64.
      const raw = result.split(",", 2)[1] ?? "";
      const built = buildBase64Result(raw, detected);
      setOutput(built.dataUrl);
      setMime(built.mime);
      setSize(built.sizeBytes);
      setError(null);
      toast.success("Converted to Base64");
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsDataURL(file);
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Choose image
          </Button>
        </CardContent>
      </Card>

      {output && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>MIME: {mime}</span>
              <span>·</span>
              <span>Size: {formatSize(size)}</span>
              <span className="ml-auto">
                <CopyButton getText={() => output} label="Copy data URL" />
              </span>
            </div>
            <textarea
              readOnly
              value={output}
              aria-label="Base64 data URL output"
              className="w-full h-40 rounded-md border bg-muted/30 p-2 font-mono text-xs resize-y"
            />
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> conversion runs locally via FileReader. Nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
