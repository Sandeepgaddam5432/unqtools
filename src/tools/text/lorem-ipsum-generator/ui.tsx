"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { generate, countWords, countCharacters, countSentences, DEFAULT_OPTIONS, type GenerateOptions, type Variant, type Unit, type OutputFormat } from "./logic";

export default function LoremIpsumGenerator() {
  const [options, setOptions] = useState<GenerateOptions>(DEFAULT_OPTIONS);
  const [output, setOutput] = useState("");
  const [customWordsInput, setCustomWordsInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const generateText = useCallback(() => {
    setError(null);
    try {
      const opts = { ...options };
      if (opts.variant === "custom") {
        opts.customWords = customWordsInput.split(/[\s,]+/).filter(Boolean);
        if (opts.customWords.length < 5) {
          setError("Custom word list needs at least 5 words.");
          return;
        }
      }
      const result = generate(opts);
      setOutput(result);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [options, customWordsInput]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Variant</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.variant} onChange={(e) => setOptions({ ...options, variant: e.target.value as Variant })}>
                <option value="lorem-ipsum">Lorem Ipsum (classic)</option>
                <option value="cicero">Cicero (original source)</option>
                <option value="hipster">Hipster Ipsum</option>
                <option value="bacon">Bacon Ipsum</option>
                <option value="custom">Custom word list</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.unit} onChange={(e) => setOptions({ ...options, unit: e.target.value as Unit })}>
                <option value="paragraphs">Paragraphs</option>
                <option value="sentences">Sentences</option>
                <option value="words">Words</option>
                <option value="characters">Characters</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Count</Label>
              <Input type="number" min="1" value={options.count} onChange={(e) => setOptions({ ...options, count: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Output format</Label>
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={options.format} onChange={(e) => setOptions({ ...options, format: e.target.value as OutputFormat })}>
                <option value="text">Plain text</option>
                <option value="html">HTML (with &lt;p&gt; tags)</option>
                <option value="markdown">Markdown</option>
              </select>
            </div>
          </div>

          {options.variant === "custom" && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Custom words (space- or comma-separated)</Label>
              <Input value={customWordsInput} onChange={(e) => setCustomWordsInput(e.target.value)} placeholder="alpha beta gamma delta epsilon" />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Min words/sentence</Label><Input type="number" min="1" value={options.minWordsPerSentence} onChange={(e) => setOptions({ ...options, minWordsPerSentence: Number(e.target.value) })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Max words/sentence</Label><Input type="number" min="1" value={options.maxWordsPerSentence} onChange={(e) => setOptions({ ...options, maxWordsPerSentence: Number(e.target.value) })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Min sentences/paragraph</Label><Input type="number" min="1" value={options.minSentencesPerParagraph} onChange={(e) => setOptions({ ...options, minSentencesPerParagraph: Number(e.target.value) })} /></div>
            <div className="flex flex-col gap-1.5"><Label className="text-xs text-muted-foreground">Max sentences/paragraph</Label><Input type="number" min="1" value={options.maxSentencesPerParagraph} onChange={(e) => setOptions({ ...options, maxSentencesPerParagraph: Number(e.target.value) })} /></div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.startWithLorem} onChange={(e) => setOptions({ ...options, startWithLorem: e.target.checked })} />
            <span>Start with canonical "Lorem ipsum dolor sit amet..."</span>
          </label>

          <div className="flex gap-2">
            <Button size="sm" onClick={generateText}>Generate</Button>
            <Button size="sm" variant="ghost" onClick={() => { setOptions(DEFAULT_OPTIONS); setOutput(""); setError(null); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {output && !error && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Words</p><p className="text-sm font-bold">{countWords(output)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Characters</p><p className="text-sm font-bold">{countCharacters(output)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Sentences</p><p className="text-sm font-bold">{countSentences(output)}</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Generated text</CardTitle>
                <div className="flex gap-2">
                  <CopyButton getText={() => output} />
                  <DownloadButton getText={() => output} filename="lorem-ipsum.txt" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-sm p-4 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-words max-h-[400px] overflow-auto">{output}</pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all generation runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
