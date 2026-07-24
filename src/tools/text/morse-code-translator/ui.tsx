"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  textToMorse, morseToText, getCharBreakdown, generateBeepPattern, validateMorse,
  MORSE_PROSIGNS, type MorseOptions,
} from "./logic";

export default function MorseCodeTranslator() {
  const [mode, setMode] = useState<"text-to-morse" | "morse-to-text">("text-to-morse");
  const [input, setInput] = useState("HELLO WORLD");
  const [output, setOutput] = useState("");
  const [options, setOptions] = useState<MorseOptions>({ useSlashForWord: false, useMiddleDot: false });
  const [wpm, setWpm] = useState(20);
  const [frequency, setFrequency] = useState(600);
  const [volume, setVolume] = useState(0.5);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const translate = useCallback(() => {
    setError(null);
    try {
      if (mode === "text-to-morse") {
        setOutput(textToMorse(input, options));
      } else {
        const validation = validateMorse(input);
        if (!validation.isValid && input.trim()) {
          setError(`Morse validation: ${validation.errors.join("; ")}`);
        }
        setOutput(morseToText(input));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [input, mode, options]);

  const stopPlayback = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
    setCurrentIdx(-1);
  }, []);

  const playAudio = useCallback(async () => {
    if (!output) return;
    stopPlayback();
    setIsPlaying(true);
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      const pattern = mode === "text-to-morse"
        ? generateBeepPattern(output, wpm, frequency)
        : generateBeepPattern(textToMorse(output), wpm, frequency);

      let elapsed = 0;
      for (let i = 0; i < pattern.length; i++) {
        const segment = pattern[i]!;
        const startMs = elapsed;
        if (segment.on) {
          const startTime = ctx.currentTime + startMs / 1000;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = segment.frequency;
          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(volume, startTime + 0.005);
          gain.gain.setValueAtTime(volume, startTime + segment.durationMs / 1000 - 0.005);
          gain.gain.linearRampToValueAtTime(0, startTime + segment.durationMs / 1000);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + segment.durationMs / 1000);
        }
        // Highlight current segment
        timeoutRef.current = setTimeout(() => setCurrentIdx(i), startMs);
        elapsed += segment.durationMs;
      }
      timeoutRef.current = setTimeout(() => {
        setIsPlaying(false);
        setCurrentIdx(-1);
      }, elapsed);
    } catch (e) {
      setError(`Audio playback failed: ${(e as Error).message}`);
      setIsPlaying(false);
    }
  }, [output, mode, wpm, frequency, volume, stopPlayback]);

  const breakdown = mode === "text-to-morse" && input ? getCharBreakdown(input) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2">
            <Button size="sm" variant={mode === "text-to-morse" ? "default" : "outline"} onClick={() => setMode("text-to-morse")}>Text → Morse</Button>
            <Button size="sm" variant={mode === "morse-to-text" ? "default" : "outline"} onClick={() => setMode("morse-to-text")}>Morse → Text</Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">{mode === "text-to-morse" ? "Input text" : "Input Morse (use . - / and spaces)"}</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} placeholder={mode === "text-to-morse" ? "HELLO WORLD" : ".... . .-.. .-.. ---"} />
          </div>

          {mode === "text-to-morse" && (
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={options.useSlashForWord ?? false} onChange={(e) => setOptions({ ...options, useSlashForWord: e.target.checked })} /><span>Use '/' for word separator</span></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={options.useMiddleDot ?? false} onChange={(e) => setOptions({ ...options, useMiddleDot: e.target.checked })} /><span>Use middle dot (·)</span></label>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">WPM (speed)</Label>
              <Input type="number" min="5" max="40" value={wpm} onChange={(e) => setWpm(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Pitch (Hz)</Label>
              <Input type="number" min="200" max="2000" value={frequency} onChange={(e) => setFrequency(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Volume (0-1)</Label>
              <Input type="number" min="0" max="1" step="0.1" value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={translate}>Translate</Button>
            {output && (
              <>
                <Button size="sm" variant="outline" onClick={playAudio} disabled={isPlaying}>{isPlaying ? "Playing..." : "▶ Play audio"}</Button>
                {isPlaying && <Button size="sm" variant="ghost" onClick={stopPlayback}>⏹ Stop</Button>}
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => { setInput(mode === "text-to-morse" ? "HELLO WORLD" : ".... . .-.. .-.. ---"); setOutput(""); setError(null); }}>Sample</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setOutput(""); setError(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {output && !error && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Output</CardTitle>
              <div className="flex gap-2">
                <CopyButton getText={() => output} />
                <DownloadButton getText={() => output} filename="morse-output.txt" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <pre className="text-sm p-4 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-all">{output}</pre>
          </CardContent>
        </Card>
      )}

      {breakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Character breakdown</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-wrap gap-2 p-3">
              {breakdown.map((b, i) => (
                <div key={i} className={`p-2 rounded border ${currentIdx === i ? "border-primary bg-primary/10" : "border-border"}`}>
                  <p className="text-xs text-center font-mono font-bold">{b.char}</p>
                  <p className="text-xs text-center text-muted-foreground">{b.morse}</p>
                  {b.phonetic && <p className="text-[10px] text-center text-muted-foreground">{b.phonetic}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Common prosigns</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-wrap gap-2 p-3">
            {Object.entries(MORSE_PROSIGNS).map(([name, morse]) => (
              <Badge key={name} variant="outline" title={morse}>{name} = {morse}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all translation + audio synthesis runs locally via Web Audio API. Nothing leaves your browser.</p></CardContent></Card>
    </div>
  );
}
