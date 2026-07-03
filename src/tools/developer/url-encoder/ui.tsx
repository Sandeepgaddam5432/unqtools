"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { encodeUrl, decodeUrl, type UrlMode } from "./logic";

export default function UrlEncoder() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [urlMode, setUrlMode] = useState<UrlMode>("component");
  const [liveUpdate, setLiveUpdate] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    (textInput?: string) => {
      const text = textInput ?? input;
      if (!text) {
        setOutput("");
        setError(null);
        return;
      }
      try {
        if (mode === "encode") {
          setOutput(encodeUrl(text, urlMode));
        } else {
          setOutput(decodeUrl(text, urlMode));
        }
        setError(null);
      } catch (e) {
        setError((e as Error).message ?? "Invalid URL input");
        setOutput("");
      }
    },
    [input, mode, urlMode],
  );

  const onInputChange = useCallback(
    (val: string) => {
      setInput(val);
      if (liveUpdate) run(val);
    },
    [liveUpdate, run],
  );

  const swap = useCallback(() => {
    setMode((m) => (m === "encode" ? "decode" : "encode"));
    const tmp = input;
    setInput(output);
    setOutput(tmp);
    toast.info("Swapped input ↔ output");
  }, [input, output]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant={mode === "encode" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("encode")}
              >
                Encode
              </Button>
              <Button
                variant={mode === "decode" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("decode")}
              >
                Decode
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={urlMode === "uri"}
                onCheckedChange={(c) => setUrlMode(c ? "uri" : "component")}
                id="full-uri"
              />
              <Label htmlFor="full-uri" className="text-sm cursor-pointer">
                Full URI (vs component)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={liveUpdate} onCheckedChange={setLiveUpdate} id="url-live" />
              <Label htmlFor="url-live" className="text-sm cursor-pointer">Live update</Label>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={swap} disabled={!output}>Swap</Button>
              {!liveUpdate && <Button size="sm" onClick={() => run()}>Run</Button>}
              <Button variant="ghost" size="sm" onClick={() => { setInput(""); setOutput(""); setError(null); }} disabled={!input}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="url-input">Input</Label>
          <Textarea
            id="url-input"
            placeholder={mode === "encode" ? "Type text to URL-encode…" : "Paste encoded URL to decode…"}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            className="min-h-[200px] font-mono text-sm resize-y"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Output</Label>
            {output && <CopyButton getText={() => output} />}
          </div>
          <pre className="min-h-[200px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-sm break-all">
            {output || <span className="text-muted-foreground">Output will appear here…</span>}
          </pre>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all encoding/decoding runs locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
