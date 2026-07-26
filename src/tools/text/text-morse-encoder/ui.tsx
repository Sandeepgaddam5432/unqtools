"use client";

import React, { useState, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  encodeMorse,
  encodeSlashStyle,
  encodeVerbose,
  computeTiming,
  transmissionTime,
  generateToneEvents,
  validateInput,
  morseStats,
  decodeMorse,
  morseToWavBase64,
} from "./logic";

export default function MorseEncoderUI() {
  const [text, setText] = useState("HELLO WORLD");
  const [wpm, setWpm] = useState("20");
  const [freq, setFreq] = useState("600");
  const [useProsigns, setUseProsigns] = useState(false);
  const [slashStyle, setSlashStyle] = useState(false);
  const [letterSep, setLetterSep] = useState(" ");
  const [wordSep, setWordSep] = useState(" / ");
  const [decoded, setDecoded] = useState("");
  const audioCtxRef = useRef<AudioContext | null>(null);

  const validation = useMemo(() => validateInput(text), [text]);
  const wpmNum = Math.max(1, parseFloat(wpm) || 20);
  const freqNum = Math.max(50, parseFloat(freq) || 600);

  const morse = useMemo(() => {
    if (slashStyle) return encodeSlashStyle(text);
    return encodeMorse(text, { useProsigns, letterSeparator: letterSep, wordSeparator: wordSep });
  }, [text, useProsigns, slashStyle, letterSep, wordSep]);

  const timing = useMemo(() => computeTiming(wpmNum), [wpmNum]);
  const txTime = useMemo(() => transmissionTime(text, wpmNum), [text, wpmNum]);
  const stats = useMemo(() => morseStats(text, wpmNum), [text, wpmNum]);
  const verbose = useMemo(() => encodeVerbose(text), [text]);

  const playAudio = () => {
    if (typeof window === "undefined") return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    const events = generateToneEvents(text, wpmNum);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freqNum;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0;
    osc.start();
    for (const e of events) {
      if (e.type === "tone") {
        gain.gain.setValueAtTime(0.3, ctx.currentTime + e.time);
        gain.gain.setValueAtTime(0, ctx.currentTime + e.time + e.duration);
      }
    }
    const last = events[events.length - 1];
    osc.stop(ctx.currentTime + (last?.time ?? 0) + (last?.duration ?? 0) + 0.1);
  };

  const downloadWav = () => {
    const base64 = morseToWavBase64(text, wpmNum, freqNum);
    const url = `data:audio/wav;base64,${base64}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "morse.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-4">
      {!validation.valid && (
        <ErrorBanner message={`Unsupported characters: ${validation.unsupported.join(", ")}`} />
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Text to encode</Label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full min-h-[80px] rounded-md border bg-background p-2 text-sm font-mono"
            aria-label="Text to encode"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">WPM (speed)</Label>
              <Input value={wpm} onChange={(e) => setWpm(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tone freq (Hz)</Label>
              <Input value={freq} onChange={(e) => setFreq(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Letter separator</Label>
              <Input value={letterSep} onChange={(e) => setLetterSep(e.target.value)} disabled={slashStyle} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Word separator</Label>
              <Input value={wordSep} onChange={(e) => setWordSep(e.target.value)} disabled={slashStyle} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={useProsigns} onChange={(e) => setUseProsigns(e.target.checked)} />
              Use prosigns (SOS, AR, SK, etc.)
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={slashStyle} onChange={(e) => setSlashStyle(e.target.checked)} />
              Slash style (./dash/slash)
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-sm font-medium">Morse code</Label>
            <CopyButton getText={() => morse} />
            <DownloadButton getText={() => morse} filename="morse.txt" />
            <Button size="sm" onClick={playAudio} className="ml-2">Play audio</Button>
            <Button size="sm" variant="outline" onClick={downloadWav}>Download WAV</Button>
          </div>
          <pre className="w-full min-h-[60px] rounded-md border bg-muted/30 p-3 text-lg font-mono tracking-wider whitespace-pre-wrap">{morse}</pre>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Characters</p>
          <p className="text-2xl font-bold">{stats.characters}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Dots</p>
          <p className="text-2xl font-bold text-red-600">{stats.dots}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Dashes</p>
          <p className="text-2xl font-bold text-blue-600">{stats.dashes}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">TX time</p>
          <p className="text-2xl font-bold">{txTime.toFixed(1)}s</p>
        </div>
        <div className="rounded-md border p-3 bg-primary/5">
          <p className="text-xs text-muted-foreground">Dot duration</p>
          <p className="text-2xl font-bold">{(timing.dotSec * 1000).toFixed(0)}ms</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-medium">Verbose (per-character)</Label>
          <pre className="w-full min-h-[60px] rounded-md border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap">{verbose}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Decode (Morse → Text)</Label>
          <textarea
            value={decoded}
            onChange={(e) => setDecoded(e.target.value)}
            placeholder="Paste Morse here (e.g. .... . .-.. .-.. ---)"
            className="w-full min-h-[60px] rounded-md border bg-background p-2 text-sm font-mono"
          />
          <p className="text-sm">
            Decoded: <span className="font-bold font-mono">{decodeMorse(decoded, { letterSeparator: letterSep || " ", wordSeparator: wordSep || " / " })}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all encoding, audio synthesis, and WAV generation happen locally — no network calls. ITU-R M.1677 standard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
