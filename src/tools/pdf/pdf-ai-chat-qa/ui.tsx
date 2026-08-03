"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton } from "../../_shared";
import { toast } from "sonner";
import { analyzePdf, generateSummary, searchPassages, type PdfAnalysis } from "./logic";
import { FileText, Search, BookOpen, FileUp, Sparkles, ListChecks, Lightbulb, Trash2 } from "lucide-react";

export default function PdfAiChatQa() {
  const [analysis, setAnalysis] = useState<PdfAnalysis | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [query, setQuery] = useState("");
  const [summary, setSummary] = useState("");
  const [searchResults, setSearchResults] = useState<{ passage: string; relevance: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPdf = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setSummary("");
    setSearchResults([]);
    try {
      const bytes = await file.arrayBuffer();
      const result = await analyzePdf(bytes);
      if (result.ok) {
        setAnalysis(result.analysis);
        setPdfName(file.name);
        toast.success(`Loaded "${file.name}" — ${result.analysis.pageCount} pages`);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError(`Failed to load PDF: ${e instanceof Error ? e.message : "Invalid file"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleGenerateSummary = useCallback(() => {
    if (!analysis) return;
    const s = generateSummary(analysis.text, 400);
    setSummary(s);
    toast.success("Summary generated");
  }, [analysis]);

  const handleSearch = useCallback(() => {
    if (!analysis || !query.trim()) return;
    const results = searchPassages(query, analysis.text, 5);
    setSearchResults(results);
    if (results.length === 0) toast.info("No matching passages found");
    else toast.success(`Found ${results.length} relevant passage(s)`);
  }, [analysis, query]);

  const reset = useCallback(() => {
    setAnalysis(null);
    setPdfName("");
    setSummary("");
    setSearchResults([]);
    setQuery("");
  }, []);

  return (
    <div className="space-y-4">
      {/* Upload */}
      {!analysis && (
        <Card
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file?.type === "application/pdf") loadPdf(file);
            else toast.error("Please drop a PDF file");
          }}
          className="border-dashed border-2 border-primary/30 hover:border-primary/50 transition-colors"
        >
          <CardContent className="p-8 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Q&A Analysis for PDF</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Upload a PDF to generate summaries, search passages, and analyze content — all locally in your browser.
            </p>
            <input ref={fileInputRef} type="file" accept=".pdf" onChange={(e) => e.target.files?.[0] && loadPdf(e.target.files[0])} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
              <FileUp className="h-4 w-4" /> Choose PDF
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Analysis dashboard */}
      {analysis && (
        <>
          {/* Header */}
          <Card>
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">{pdfName}</p>
                <p className="text-xs text-muted-foreground">
                  {analysis.pageCount} pages · {analysis.wordCount.toLocaleString()} words · ~{analysis.readingTimeMinutes} min read
                </p>
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                  <FileUp className="h-3.5 w-3.5" /> New PDF
                </Button>
                <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats & Keywords */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="font-bold text-lg">{analysis.wordCount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Words</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="font-bold text-lg">{analysis.sentenceCount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Sentences</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="font-bold text-lg">{analysis.readingTimeMinutes}</p>
                  <p className="text-xs text-muted-foreground">Min read</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="font-bold text-lg">{analysis.pageCount}</p>
                  <p className="text-xs text-muted-foreground">Pages</p>
                </div>
              </div>
              {analysis.topKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground self-center">Top keywords:</span>
                  {analysis.topKeywords.map(([word, count]) => (
                    <Badge key={word} variant="secondary" className="text-xs gap-1">
                      {word} <span className="text-muted-foreground">({count})</span>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Auto-Summary</h3>
                </div>
                <Button size="sm" onClick={handleGenerateSummary} className="gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Generate Summary
                </Button>
              </div>
              {summary ? (
                <div className="rounded-lg bg-muted/30 border p-3">
                  <p className="text-sm text-foreground leading-relaxed">{summary}</p>
                  <div className="mt-2">
                    <CopyButton getText={() => summary} label="Copy summary" />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Click "Generate Summary" to create an auto-summary of the document.</p>
              )}
            </CardContent>
          </Card>

          {/* Search */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Search Passages</h3>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter keywords to search…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                />
                <Button onClick={handleSearch} disabled={!query.trim()} className="gap-1.5">
                  <Search className="h-4 w-4" /> Search
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-2 mt-3">
                  {searchResults.map((r, i) => (
                    <div key={i} className="rounded-lg border bg-muted/20 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs">
                          Match {i + 1}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${r.relevance >= 0.8 ? "text-emerald-600 border-emerald-500/30" : r.relevance >= 0.5 ? "text-amber-600 border-amber-500/30" : "text-muted-foreground"}`}
                        >
                          {Math.round(r.relevance * 100)}% relevance
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{r.passage}.</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All PDF analysis runs 100% locally in your browser. Your documents never leave your device. Uses pdf-lib for extraction and custom algorithms for Q&A.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
