"use client";

/** PDF Text-to-Speech (Read Aloud) — real UI. */

import React, { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUp, Play, Square, Trash2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { ActionBar, ClearButton, ErrorBanner, RunButton } from "../../_shared";
import { formatBytes } from "../_shared/download";
import { prepareTts, speakText, stopSpeech } from "./logic";

type LoadedFile = { name: string; bytes: Uint8Array; pageCount: number };

export default function TextToSpeech() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [text, setText] = useState("");
  const [rate, setRate] = useState("1");
  const [pitch, setPitch] = useState("1");
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => stopSpeech();
  }, []);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setText("");
      setError("");
    } catch {
      toast.error(`Could not read ${f.name}`);
    }
  }

  function reset() {
    stopSpeech();
    setSpeaking(false);
    setFile(null);
    setText("");
    setError("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setText("");
    const r = await prepareTts(file.bytes);
    setWorking(false);
    if (r.ok) {
      setText(r.output.text);
      setSupported(r.output.supported);
      toast.success("Text ready to read aloud");
    } else {
      setError(r.error);
    }
  }

  function togglePlay() {
    if (!text) return;
    if (speaking) {
      stopSpeech();
      setSpeaking(false);
    } else {
      const ok = speakText(text, Number(rate) || 1, Number(pitch) || 1);
      if (ok) setSpeaking(true);
    }
  }

  return (
    <div className="space-y-4">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{file.pageCount} pages • {formatBytes(file.bytes.length)}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={reset}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) void loadFile(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-10 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <Volume2 className="mx-auto mb-2 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Read the document aloud with your browser&apos;s voice.</p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose PDF"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f);
          e.target.value = "";
        }}
      />

      {file && (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <ActionBar>
            <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Extract for reading" />
            <ClearButton onClick={reset} disabled={!file && !text && !error} label="Clear" />
          </ActionBar>

          {error && <ErrorBanner message={error} />}

          {text && (
            <div className="space-y-3">
              {!supported && (
                <p className="text-xs text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  This browser doesn&apos;t support speech synthesis — text was extracted anyway.
                </p>
              )}
              {supported && (
                <div className="flex flex-wrap items-end gap-3">
                  <Button onClick={togglePlay} className="gap-2 cursor-pointer">
                    {speaking ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {speaking ? "Stop" : "Read aloud"}
                  </Button>
                  <div className="space-y-1">
                    <Label htmlFor="tts-rate">Rate: {rate}×</Label>
                    <Input id="tts-rate" type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(e.target.value)} className="w-32" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tts-pitch">Pitch: {pitch}</Label>
                    <Input id="tts-pitch" type="range" min={0} max={2} step={0.1} value={pitch} onChange={(e) => setPitch(e.target.value)} className="w-32" />
                  </div>
                </div>
              )}
              <div className="max-h-56 overflow-y-auto rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                {text.slice(0, 4000)}
                {text.length > 4000 ? "\n…" : ""}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Privacy: 100% local — your PDF never leaves your device. Voice comes from your browser&apos;s built-in speech
        engine.
      </p>
    </div>
  );
}
