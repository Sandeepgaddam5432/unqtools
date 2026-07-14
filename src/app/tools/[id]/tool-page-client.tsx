"use client";

import React, { Suspense, lazy } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { SidebarNav } from "@/components/navigation/sidebar";
import { ToolSkeleton } from "@/components/tool-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  WifiOff,
  Zap,
  Code2,
  Type,
  Calculator,
  Image as ImageIcon,
  Layers,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import type { ToolManifest, ToolCategory } from "@/lib/tool";

// ---- Named motion constants (avoids double-brace push hazard) ----
const MO_HIDDEN = { opacity: 0, y: 10 };
const MO_HERO = { opacity: 0, y: 20 };
const MO_VISIBLE = { opacity: 1, y: 0 };
const MO_NAV_TRANS = { duration: 0.4 };
const MO_HERO_TRANS = { duration: 0.6, ease: [0.25, 0.4, 0.25, 1] as number[] };
const MO_H1_TRANS = { duration: 0.6, delay: 0.1 };
const MO_P_TRANS = { duration: 0.6, delay: 0.2 };
const MO_BADGES_TRANS = { duration: 0.6, delay: 0.3 };
const MO_SCROLL_TRANS = { duration: 0.6 };
const MO_VIEWPORT = { once: true, margin: "-50px" };
const MO_HOVER = { y: -4, transition: { duration: 0.2 } };

const CATEGORY_ICONS: Record<ToolCategory, typeof Code2> = {
  developer: Code2,
  text: Type,
  calculators: Calculator,
  image: ImageIcon,
  pdf: Layers,
  "audio-video": Layers,
  seo: Layers,
  "network-security": Lock,
  file: Layers,
  business: Layers,
  education: Layers,
  social: Layers,
  ai: ShieldCheck,
};

// Lazy-loaded tool UI registry — only the active tool's JS ships to the client.
const TOOL_UI_LOADERS: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "json-formatter": () => import("@/tools/developer/json-formatter/ui"),
  base64: () => import("@/tools/developer/base64/ui"),
  "hash-generator": () => import("@/tools/developer/hash-generator/ui"),
  "url-encoder": () => import("@/tools/developer/url-encoder/ui"),
  "uuid-generator": () => import("@/tools/developer/uuid-generator/ui"),
  "emi-calculator": () => import("@/tools/calculators/emi-calculator/ui"),
  "mortgage-calculator": () => import("@/tools/calculators/mortgage-calculator/ui"),
  "sip-calculator": () => import("@/tools/calculators/sip-calculator/ui"),
  "color-picker": () => import("@/tools/image/color-picker/ui"),
  "image-compressor": () => import("@/tools/image/image-compressor/ui"),
  // Network, Security & Privacy tools
  "bcrypt-hash-generator": () => import("@/tools/network-security/bcrypt-hash-generator/ui"),
  "csp-evaluator": () => import("@/tools/network-security/csp-evaluator/ui"),
  "data-url-converter": () => import("@/tools/network-security/data-url-converter/ui"),
  "http-status-code-reference": () => import("@/tools/network-security/http-status-code-reference/ui"),
  "ip-subnet-calculator": () => import("@/tools/network-security/ip-subnet-calculator/ui"),
  "jwt-decoder": () => import("@/tools/network-security/jwt-decoder/ui"),
  "mime-type-lookup": () => import("@/tools/network-security/mime-type-lookup/ui"),
  "password-generator": () => import("@/tools/network-security/password-generator/ui"),
  "totp-generator": () => import("@/tools/network-security/totp-generator/ui"),
  "url-parser": () => import("@/tools/network-security/url-parser/ui"),
  "add-line-breaks": () => import("@/tools/text/add-line-breaks/ui"),
  "add-prefix-suffix": () => import("@/tools/text/add-prefix-suffix/ui"),
  "big-text-generator": () => import("@/tools/text/big-text-generator/ui"),
  "bold-text-generator": () => import("@/tools/text/bold-text-generator/ui"),
  "bubble-text-generator": () => import("@/tools/text/bubble-text-generator/ui"),
  "caesar-cipher": () => import("@/tools/text/caesar-cipher/ui"),
  "case-converter": () => import("@/tools/text/case-converter/ui"),
  "csv-to-markdown": () => import("@/tools/text/csv-to-markdown/ui"),
  "csv-to-text-list": () => import("@/tools/text/csv-to-text-list/ui"),
  "diff-checker": () => import("@/tools/text/diff-checker/ui"),
  "duplicate-lines-remover": () => import("@/tools/text/duplicate-lines-remover/ui"),
  "word-character-counter": () => import("@/tools/text/word-character-counter/ui"),
  // PDF tools
  "compress-pdf": () => import("@/tools/pdf/compress-pdf/ui"),
  "crop-pdf": () => import("@/tools/pdf/crop-pdf/ui"),
  "delete-pdf-pages": () => import("@/tools/pdf/delete-pdf-pages/ui"),
  "duplicate-pdf-pages": () => import("@/tools/pdf/duplicate-pdf-pages/ui"),
  "extract-pdf-pages": () => import("@/tools/pdf/extract-pdf-pages/ui"),
  "flatten-pdf": () => import("@/tools/pdf/flatten-pdf/ui"),
  "html-to-pdf": () => import("@/tools/pdf/html-to-pdf/ui"),
  "images-to-pdf": () => import("@/tools/pdf/images-to-pdf/ui"),
  "insert-pdf-pages": () => import("@/tools/pdf/insert-pdf-pages/ui"),
  "interleave-pdf": () => import("@/tools/pdf/interleave-pdf/ui"),
  "markdown-to-pdf": () => import("@/tools/pdf/markdown-to-pdf/ui"),
  "merge-pdf": () => import("@/tools/pdf/merge-pdf/ui"),
  "n-up-pdf": () => import("@/tools/pdf/n-up-pdf/ui"),
  "pdf-bookmarks-editor": () => import("@/tools/pdf/pdf-bookmarks-editor/ui"),
  "pdf-contact-sheet": () => import("@/tools/pdf/pdf-contact-sheet/ui"),
  "pdf-metadata-editor": () => import("@/tools/pdf/pdf-metadata-editor/ui"),
  "pdf-page-numbers": () => import("@/tools/pdf/pdf-page-numbers/ui"),
  "pdf-sign-draw": () => import("@/tools/pdf/pdf-sign-draw/ui"),
  "pdf-stamp": () => import("@/tools/pdf/pdf-stamp/ui"),
  "pdf-watermark": () => import("@/tools/pdf/pdf-watermark/ui"),
  "remove-blank-pages": () => import("@/tools/pdf/remove-blank-pages/ui"),
  "reorder-pdf-pages": () => import("@/tools/pdf/reorder-pdf-pages/ui"),
  "resize-pdf-pages": () => import("@/tools/pdf/resize-pdf-pages/ui"),
  "rtf-to-pdf": () => import("@/tools/pdf/rtf-to-pdf/ui"),
  "reverse-pdf": () => import("@/tools/pdf/reverse-pdf/ui"),
  "rotate-pdf": () => import("@/tools/pdf/rotate-pdf/ui"),
  "scale-pdf": () => import("@/tools/pdf/scale-pdf/ui"),
  "split-pdf": () => import("@/tools/pdf/split-pdf/ui"),
  "svg-to-pdf": () => import("@/tools/pdf/svg-to-pdf/ui"),
  "text-to-pdf": () => import("@/tools/pdf/text-to-pdf/ui"),
};

interface ToolPageClientProps {
  tool: ToolManifest;
  related: ToolManifest[];
  categoryLabel: string;
}

export function ToolPageClient({
  tool,
  related,
  categoryLabel,
}: ToolPageClientProps) {
  const Icon = CATEGORY_ICONS[tool.category] ?? Layers;
  const loader = TOOL_UI_LOADERS[tool.id];
  const ToolUI = loader ? lazy(loader) : null;

  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-12 md:pt-0">
        <div className="section-padding pt-2 pb-8 md:py-12">
          <div className="container mx-auto px-4 md:px-6 max-w-5xl">

            {/* Breadcrumb */}
            <motion.nav
              initial={MO_HIDDEN}
              animate={MO_VISIBLE}
              transition={MO_NAV_TRANS}
              className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6"
            >
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link href="/tools" className="hover:text-foreground transition-colors">Tools</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link href={`/category/${tool.category}`} className="hover:text-foreground transition-colors">
                {categoryLabel.split(" ")[0]}
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground font-medium">{tool.name}</span>
            </motion.nav>

            {/* Tool header */}
            <motion.div
              initial={MO_HERO}
              animate={MO_VISIBLE}
              transition={MO_HERO_TRANS}
              className="flex flex-wrap items-center gap-3 mb-4"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <Badge className="bg-primary/15 text-foreground border-primary/20">
                {categoryLabel.split(" ")[0]}
              </Badge>
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 gap-1">
                <Lock className="h-3 w-3" /> Runs in your browser
              </Badge>
            </motion.div>

            <motion.h1
              initial={MO_HERO}
              animate={MO_VISIBLE}
              transition={MO_H1_TRANS}
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-3 tracking-tight text-balance"
            >
              {tool.name}
            </motion.h1>

            <motion.p
              initial={MO_HERO}
              animate={MO_VISIBLE}
              transition={MO_P_TRANS}
              className="text-base sm:text-lg text-muted-foreground mb-6 max-w-2xl text-pretty"
            >
              {tool.description}
            </motion.p>

            {/* Trust badges */}
            <motion.div
              initial={MO_HERO}
              animate={MO_VISIBLE}
              transition={MO_BADGES_TRANS}
              className="flex flex-wrap items-center gap-3 mb-8"
            >
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" /> 100% Private
              </Badge>
              <Badge variant="outline" className="gap-1">
                <WifiOff className="h-3 w-3" /> Works Offline
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Zap className="h-3 w-3" /> Instant
              </Badge>
            </motion.div>

            {/* Tool UI */}
            <Card className="mb-8">
              <CardContent className="p-6">
                {ToolUI ? (
                  <Suspense fallback={<ToolSkeleton />}>
                    <ToolUI />
                  </Suspense>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                      <Layers className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium text-foreground mb-1">UI coming soon</p>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      The {tool.name} logic is implemented and tested — the UI is
                      being rebuilt in Phase 2 of the v6.0 migration. Check back shortly.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* About / How to use */}
            <div className="unq-animate-fade-in-up mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-3">About {tool.name}</h2>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {tool.description} Everything runs locally in your browser — your data never leaves your device.
              </p>
              <h3 className="text-sm font-semibold text-foreground mb-2">How to use</h3>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside mb-4">
                <li>Enter your input in the tool above.</li>
                <li>Adjust any options to your preference.</li>
                <li>Use the Copy or Download buttons to save the result.</li>
                <li>Everything happens locally — your data never leaves your browser.</li>
              </ol>
            </div>

            {/* FAQ */}
            {tool.seo?.faq && tool.seo.faq.length > 0 && (
              <div className="unq-animate-fade-in-up mb-8" style={{ animationDelay: "100ms" }}>
                <h2 className="text-xl font-semibold text-foreground mb-4">FAQ</h2>
                <div className="space-y-4">
                  {tool.seo.faq.map((faq, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <h3 className="text-sm font-semibold text-foreground mb-1">{faq.q}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Related tools */}
            {related.length > 0 && (
              <div className="unq-animate-fade-in-up" style={{ animationDelay: "200ms" }}>
                <h2 className="text-xl font-semibold text-foreground mb-4">Related tools</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {related.map((rt) => {
                    const RIcon = CATEGORY_ICONS[rt.category] ?? Layers;
                    return (
                      <Link key={rt.id} href={`/tools/${rt.id}`} className="block group">
                        <div
                          className="card-hover rounded-xl border bg-card p-4 h-full transition-all duration-200 hover:border-primary/30 hover:-translate-y-1"
                        >
                          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
                            <RIcon className="h-4 w-4 text-primary" />
                          </div>
                          <h3 className="font-medium text-sm mb-1">{rt.name}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2">{rt.description}</p>
                          <div className="mt-2 flex items-center text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>Open</span>
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Back to tools */}
            <div className="mt-12">
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href="/tools">
                  <ArrowLeft className="h-4 w-4" /> All tools
                </Link>
              </Button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
