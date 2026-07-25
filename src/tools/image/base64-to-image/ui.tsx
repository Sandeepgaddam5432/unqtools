"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import { parseDataUrl, suggestFilename } from "./logic";
import { toast } from "sonner";

export default function Base64ToImage() {
  const [input, setInput] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("image.png");
  const [error, setError] = useState<string | null>(null);

  const onConvert = useCallback(() => {
    setError(null);
    const parsed = parseDataUrl(input);
    if ("error" in parsed) {
      setError(parsed.error);
      setPreviewUrl(null);
      return;
    }
    setFileName(suggestFilename("image", parsed.extension));
    setPreviewUrl(input);
    toast.success("Image ready");
  }, [input]);

  const download = useCallback(() => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = fileName;
    a.click();
    toast.success("Image downloaded");
  }, [previewUrl, fileName]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Base64 data URL</Label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="data:image/png;base64,..."
            aria-label="Base64 data URL input"
            className="w-full h-40 rounded-md border bg-muted/30 p-2 font-mono text-xs resize-y"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={onConvert} disabled={!input.trim()}>
              Convert
            </Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>
              Download
            </Button>
          </div>
        </CardContent>
      </Card>

      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Decoded image preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> decoding runs locally. Your data never leaves the browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
