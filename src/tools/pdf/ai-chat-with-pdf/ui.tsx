"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  chunkPages, buildTFIDFIndex, retrieveTopK, generateAnswer,
  isNotFoundAnswer, generateSuggestedQuestions, simulatePdfExtraction,
  exportConversationJSON, exportConversationMarkdown,
  type Chunk, type TFIDFIndex, type ChatMessage, type Citation, type PageText,
} from "./logic";

interface IndexedDoc {
  name: string;
  chunks: Chunk[];
  pages: PageText[];
}

export default function AiChatWithPdf() {
  const [pdfText, setPdfText] = useState("");
  const [docName, setDocName] = useState("document.pdf");
  const [documents, setDocuments] = useState<IndexedDoc[]>([]);
  const [index, setIndex] = useState<TFIDFIndex | null>(null);
  const [allChunks, setAllChunks] = useState<Chunk[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isReady = documents.length > 0 && index !== null;

  const indexDocument = useCallback(async () => {
    setError(null);
    if (!pdfText.trim()) {
      setError("Please paste some text to index. In a full implementation, this would extract text from an uploaded PDF using pdf.js.");
      return;
    }
    setIndexing(true);
    try {
      // Simulate PDF text extraction (real impl would use pdf.js)
      const pageCount = Math.max(1, Math.ceil(pdfText.length / 2000));
      const pages = simulatePdfExtraction(pdfText, pageCount);

      // Chunk the pages
      const chunks = chunkPages(docName, pages, 800, 120);

      // Add to documents
      const newDoc: IndexedDoc = { name: docName, chunks, pages };
      const updatedDocs = [...documents, newDoc];
      setDocuments(updatedDocs);

      // Rebuild index from all chunks
      const allChunks = updatedDocs.flatMap((d) => d.chunks);
      setAllChunks(allChunks);
      const newIndex = buildTFIDFIndex(allChunks);
      setIndex(newIndex);

      // Generate suggested questions
      const suggestions = generateSuggestedQuestions(allChunks, 5);
      setSuggestedQuestions(suggestions);

      setPdfText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to index document");
    } finally {
      setIndexing(false);
    }
  }, [pdfText, docName, documents]);

  const ask = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed || !index || allChunks.length === 0) return;
    setError(null);

    const userMsg: ChatMessage = { role: "user", text: trimmed, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");

    try {
      const retrieved = retrieveTopK(trimmed, allChunks, index, 5, 0.001);
      const result = generateAnswer(trimmed, retrieved);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        text: result.answer,
        citations: result.citations,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate answer");
    }

    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [question, index, allChunks]);

  const removeDocument = useCallback((name: string) => {
    const updatedDocs = documents.filter((d) => d.name !== name);
    setDocuments(updatedDocs);
    if (updatedDocs.length === 0) {
      setIndex(null);
      setAllChunks([]);
      setSuggestedQuestions([]);
    } else {
      const chunks = updatedDocs.flatMap((d) => d.chunks);
      setAllChunks(chunks);
      setIndex(buildTFIDFIndex(chunks));
      setSuggestedQuestions(generateSuggestedQuestions(chunks, 5));
    }
  }, [documents]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const loadExample = useCallback(() => {
    setDocName("unqtools-overview.pdf");
    setPdfText(`UnQTools is a privacy-first toolbox with 1600+ browser-based tools. All processing happens locally in your browser — nothing is ever uploaded to a server.

The tool collection includes PDF tools (merge, split, compress, convert), image tools (resize, compress, convert, edit), developer tools (JSON, CSS, HTML, JavaScript utilities), SEO tools (meta tags, schema, keywords), and more.

AI Chat with PDF lets you ask questions about your document and get answers grounded in its content. Every answer includes page citations so you can verify the source. The tool uses TF-IDF based retrieval to find the most relevant passages.

Key features include multi-document support, conversation memory, suggested questions, and export options. The tool works completely offline as a PWA.

UnQTools is built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, and shadcn/ui components. It deploys to Cloudflare Pages as a static site.`);
  }, []);

  const stats = useMemo(() => ({
    documents: documents.length,
    chunks: allChunks.length,
    pages: documents.reduce((sum, d) => sum + d.pages.length, 0),
    messages: messages.length,
  }), [documents, allChunks, messages]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label className="text-sm font-medium">Document Input</Label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={loadExample}>Load example</Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Paste PDF text content below (in a full implementation, you would upload a PDF file and text would be extracted using pdf.js — 100% in your browser).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Label className="text-xs">Document name</Label>
              <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="document.pdf" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Pages (auto-detected from text length)</Label>
              <Input value={Math.max(1, Math.ceil(pdfText.length / 2000))} disabled className="bg-muted/50" />
            </div>
          </div>
          <Textarea
            value={pdfText}
            onChange={(e) => setPdfText(e.target.value)}
            placeholder="Paste PDF text content here..."
            rows={4}
            className="font-mono text-sm"
          />
          <Button onClick={indexDocument} disabled={!pdfText.trim() || indexing}>
            {indexing ? "Indexing..." : "Index Document"}
          </Button>
        </CardContent>
      </Card>

      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Indexed Documents</span>
              <div className="flex gap-2">
                <Badge variant="outline">{stats.documents} docs</Badge>
                <Badge variant="outline">{stats.pages} pages</Badge>
                <Badge variant="outline">{stats.chunks} chunks</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {documents.map((doc) => (
                <Badge key={doc.name} variant="secondary" className="gap-1">
                  {doc.name} ({doc.pages.length}p, {doc.chunks.length} chunks)
                  <button
                    onClick={() => removeDocument(doc.name)}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${doc.name}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {suggestedQuestions.length > 0 && messages.length === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Suggested Questions</CardTitle></CardHeader>
          <CardContent className="p-4 flex flex-wrap gap-2">
            {suggestedQuestions.map((q, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                onClick={() => { setQuestion(q); }}
              >
                {q}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Chat</span>
            <div className="flex gap-2">
              {messages.length > 0 && (
                <>
                  <CopyButton getText={() => exportConversationJSON(messages)} label="Copy JSON" size="sm" />
                  <DownloadButton
                    getText={() => exportConversationMarkdown(messages)}
                    filename="pdf-chat-conversation.md"
                    size="sm"
                  />
                  <Button variant="ghost" size="sm" onClick={clearChat}>Clear</Button>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="min-h-[200px] max-h-[400px] overflow-y-auto space-y-3 rounded-md border p-4" aria-live="polite">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {isReady
                  ? "Ask a question about your document. Answers include page citations you can verify."
                  : "Index a document first, then ask questions about it."}
              </p>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={msg.role === "user"
                    ? "self-end ml-auto max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "self-start mr-auto max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm"
                  }
                >
                  <p className={isNotFoundAnswer(msg.text) ? "italic text-muted-foreground" : ""}>
                    {msg.text}
                  </p>
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">Sources:</span>
                      {msg.citations.map((c: Citation, j: number) => (
                        <button
                          key={j}
                          className="rounded-full border px-2 py-0.5 text-xs hover:bg-accent transition-colors"
                          title={c.quote}
                        >
                          {c.documentName} p.{c.pageNumber}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); ask(); }}
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={isReady ? "Ask about your document..." : "Index a document first..."}
              disabled={!isReady}
            />
            <Button type="submit" disabled={!isReady || !question.trim()}>
              Send
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All processing happens 100% in your browser.
            Your PDF text is never uploaded, tracked, or stored remotely. Text extraction, indexing, and
            question answering all happen locally. Works offline as a PWA.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            <strong className="text-foreground">Honesty note:</strong> Answers are generated using keyword-based
            retrieval (TF-IDF) and may not always be perfect. Citations let you verify every answer against
            the source text. For complex questions, consider rephrasing or adding more context.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
