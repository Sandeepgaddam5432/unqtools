"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "../../_shared";
import { toast } from "sonner";
import { answerQuestion, getTextStats, type QaResult } from "./logic";
import {
  FileText,
  Upload,
  MessageSquare,
  Send,
  BookOpen,
  BarChart3,
  Trash2,
  FileUp,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  result?: QaResult;
}

export default function PdfAiChat() {
  const [pdfText, setPdfText] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [pdfStats, setPdfStats] = useState<{ pageCount?: number; wordsCount?: number; charsCount?: number } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadPdf = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes);

      // Extract basic stats
      const pageCount = pdf.getPageCount();
      const textContent = extractTextContent(bytes);
      const wordsCount = textContent.split(/\s+/).filter(Boolean).length;
      const charsCount = textContent.length;

      setPdfText(textContent);
      setPdfName(file.name);
      setPdfStats({ pageCount, wordsCount, charsCount });
      setMessages([]);
      toast.success(`Loaded "${file.name}" — ${pageCount} pages`);
    } catch (e) {
      setError(`Failed to load PDF: ${e instanceof Error ? e.message : "Invalid PDF file"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const extractTextContent = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder("latin1").decode(bytes);
    const parts: string[] = [];
    const btEtRegex = /BT\s([\s\S]*?)ET/g;
    let match;
    while ((match = btEtRegex.exec(text)) !== null) {
      const content = match[1];
      const stringRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = stringRegex.exec(content)) !== null) {
        const decoded = strMatch[1]
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\\\/g, "\\");
        if (decoded.trim()) parts.push(decoded);
      }
    }
    return parts.join(" ");
  };

  const askQuestion = useCallback(() => {
    if (!question.trim()) return;
    if (!pdfText) {
      toast.error("Please load a PDF first");
      return;
    }

    const result = answerQuestion(question, pdfText);
    const userMsg: ChatMessage = { role: "user", content: question };
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: result.answer + (result.relevantExcerpt ? `\n\n"${result.relevantExcerpt}"` : ""),
      result,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setQuestion("");

    // Scroll to bottom
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [question, pdfText]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadPdf(file);
    },
    [loadPdf],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/pdf") loadPdf(file);
      else toast.error("Please drop a PDF file");
    },
    [loadPdf],
  );

  const stats = pdfText ? getTextStats(pdfText) : null;

  return (
    <div className="space-y-4">
      {/* Upload area */}
      {!pdfText && (
        <Card
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-dashed border-2 border-primary/30 hover:border-primary/50 transition-colors"
        >
          <CardContent className="p-8 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <FileUp className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Load a PDF to chat with</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Drop a PDF file here or click to browse. All processing happens in your browser — your document never leaves your device.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Choose PDF File
            </Button>
          </CardContent>
        </Card>
      )}

      {/* PDF loaded - show stats and chat */}
      {pdfText && (
        <>
          {/* PDF info bar */}
          <Card>
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{pdfName}</p>
                  <p className="text-xs text-muted-foreground">
                    {pdfStats?.pageCount} pages · {pdfStats?.wordsCount?.toLocaleString()} words · {pdfStats?.charsCount?.toLocaleString()} chars
                  </p>
                </div>
              </div>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="gap-1.5"
                >
                  <FileUp className="h-3.5 w-3.5" /> Load different PDF
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPdfText("");
                    setPdfName("");
                    setPdfStats(null);
                    setMessages([]);
                  }}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats (collapsible) */}
          {stats && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Document Analysis</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="font-bold text-foreground">{stats.words.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Words</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="font-bold text-foreground">{stats.sentences.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Sentences</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="font-bold text-foreground">{stats.paragraphs.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Paragraphs</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="font-bold text-foreground">{stats.avgWordsPerSentence}</p>
                    <p className="text-xs text-muted-foreground">Avg words/sentence</p>
                  </div>
                </div>
                {stats.topWords.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground">Top keywords:</span>
                    {stats.topWords.map(([word, count]) => (
                      <Badge key={word} variant="outline" className="text-xs">
                        {word} ({count})
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Chat area */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Ask about this PDF</h3>
              </div>

              {/* Messages */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4 pr-2">
                {messages.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Ask a question about the PDF content</p>
                    <p className="text-xs mt-1">e.g., "What is this document about?" or "What are the key topics?"</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted border"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.result && (
                        <Badge
                          variant="outline"
                          className={`mt-1.5 text-[10px] ${
                            msg.result.confidence === "high"
                              ? "text-emerald-600 border-emerald-500/30"
                              : msg.result.confidence === "medium"
                              ? "text-amber-600 border-amber-500/30"
                              : "text-muted-foreground"
                          }`}
                        >
                          {msg.result.confidence} confidence
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Ask a question about the PDF…"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && askQuestion()}
                  className="flex-1"
                />
                <Button onClick={askQuestion} disabled={!question.trim()} className="gap-1.5">
                  <Send className="h-4 w-4" /> Ask
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All PDF processing and Q&A analysis runs 100% locally in your browser. Your documents never leave your device. Text extraction uses pdf-lib, and Q&A uses keyword-based matching.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
