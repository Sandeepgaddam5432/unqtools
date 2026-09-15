"use client";

import React, { Suspense, lazy, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  Clock,
  Star,
  Sparkles,
} from "lucide-react";
import type { ToolManifest, ToolCategory } from "@/lib/tool";
import { useFavorites, useRecentTools } from "@/hooks/use-tool-history";
import TemplateShell, { TemplateFooter } from "@/components/template/TemplateShell";
import {
  CATEGORIES as TEMPLATE_CATEGORIES,
} from "@/lib/template-data";
import { cn } from "@/lib/template-utils";

const MO_HIDDEN = { opacity: 0, y: 10 };
const MO_HERO = { opacity: 0, y: 20 };
const MO_VISIBLE = { opacity: 1, y: 0 };
const MO_NAV_TRANS = { duration: 0.4 };
const MO_HERO_TRANS = { duration: 0.6, ease: [0.25, 0.4, 0.25, 1] as number[] };
const MO_H1_TRANS = { duration: 0.6, delay: 0.1 };
const MO_P_TRANS = { duration: 0.6, delay: 0.2 };
const MO_BADGES_TRANS = { duration: 0.6, delay: 0.3 };
const MO_VIEWPORT = { once: true, margin: "-50px" };

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

const TOOL_UI_LOADERS: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "json-formatter": () => import("@/tools/developer/json-formatter/ui"),
  base64: () => import("@/tools/developer/base64/ui"),
  "hash-generator": () => import("@/tools/developer/hash-generator/ui"),
  "url-encoder": () => import("@/tools/developer/url-encoder/ui"),
  "uuid-generator": () => import("@/tools/developer/uuid-generator/ui"),
  "emi-calculator": () => import("@/tools/calculators/emi-calculator/ui"),
  "mortgage-calculator": () => import("@/tools/calculators/mortgage-calculator/ui"),
  "sip-calculator": () => import("@/tools/calculators/sip-calculator/ui"),
  "bmi-calculator": () => import("@/tools/calculators/bmi-calculator/ui"),
  "discount-calculator": () => import("@/tools/calculators/discount-calculator/ui"),
  "percentage-calculator": () => import("@/tools/calculators/percentage-calculator/ui"),
  "simple-interest-calculator": () => import("@/tools/calculators/simple-interest-calculator/ui"),
  "tip-calculator": () => import("@/tools/calculators/tip-calculator/ui"),
  "unit-converter-length": () => import("@/tools/calculators/unit-converter-length/ui"),
  "compound-interest-calculator": () => import("@/tools/calculators/compound-interest-calculator/ui"),
  "gst-calculator": () => import("@/tools/calculators/gst-calculator/ui"),
  "percentage-change-calc": () => import("@/tools/calculators/percentage-change-calc/ui"),
  "loan-payoff-calc": () => import("@/tools/calculators/loan-payoff-calc/ui"),
  "discount-rate-calc": () => import("@/tools/calculators/discount-rate-calc/ui"),
  "markup-margin-calc": () => import("@/tools/calculators/markup-margin-calc/ui"),
  "payment-plan-calc": () => import("@/tools/calculators/payment-plan-calc/ui"),
  "area-calculator": () => import("@/tools/calculators/area-calculator/ui"),
  "perimeter-calculator": () => import("@/tools/calculators/perimeter-calculator/ui"),
  "speed-distance-calc": () => import("@/tools/calculators/speed-distance-calc/ui"),
  "bmi-bmr-combo": () => import("@/tools/calculators/bmi-bmr-combo/ui"),
  "time-duration-calc": () => import("@/tools/calculators/time-duration-calc/ui"),
  "volume-converter": () => import("@/tools/calculators/volume-converter/ui"),
  "angle-converter": () => import("@/tools/calculators/angle-converter/ui"),
  "pressure-converter": () => import("@/tools/calculators/pressure-converter/ui"),
  "force-converter": () => import("@/tools/calculators/force-converter/ui"),
  "energy-converter": () => import("@/tools/calculators/energy-converter/ui"),
  "scientific-calculator": () => import("@/tools/calculators/scientific-calculator/ui"),
  "weight-unit-converter": () => import("@/tools/calculators/weight-unit-converter/ui"),
  "temperature-converter": () => import("@/tools/calculators/temperature-converter/ui"),
  "fuel-cost-calculator": () => import("@/tools/calculators/fuel-cost-calculator/ui"),
  "data-storage-converter": () => import("@/tools/calculators/data-storage-converter/ui"),
  "color-picker": () => import("@/tools/image/color-picker/ui"),
  "image-compressor": () => import("@/tools/image/image-compressor/ui"),
  "ascii-art-generator": () => import("@/tools/image/ascii-art-generator/ui"),
  "barcode-generator": () => import("@/tools/image/barcode-generator/ui"),
  "bulk-image-renamer-optimizer": () => import("@/tools/image/bulk-image-renamer-optimizer/ui"),
  "photo-mosaic-generator": () => import("@/tools/image/photo-mosaic-generator/ui"),
  "pixel-art-maker": () => import("@/tools/image/pixel-art-maker/ui"),
  "image-resizer": () => import("@/tools/image/image-resizer/ui"),
  "image-cropper": () => import("@/tools/image/image-cropper/ui"),
  "image-rotator": () => import("@/tools/image/image-rotator/ui"),
  "image-flipper": () => import("@/tools/image/image-flipper/ui"),
  "image-to-base64": () => import("@/tools/image/image-to-base64/ui"),
  "base64-to-image": () => import("@/tools/image/base64-to-image/ui"),
  "image-watermark-adder": () => import("@/tools/image/image-watermark-adder/ui"),
  "image-color-inverter": () => import("@/tools/image/image-color-inverter/ui"),
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
  "text-reverser": () => import("@/tools/text/text-reverser/ui"),
  "text-trimmer": () => import("@/tools/text/text-trimmer/ui"),
  "text-repeater": () => import("@/tools/text/text-repeater/ui"),
  "text-sorter": () => import("@/tools/text/text-sorter/ui"),
  "morse-code-translator": () => import("@/tools/text/morse-code-translator/ui"),
  "lorem-ipsum-generator": () => import("@/tools/text/lorem-ipsum-generator/ui"),
  "text-to-binary": () => import("@/tools/text/text-to-binary/ui"),
  "binary-to-text": () => import("@/tools/text/binary-to-text/ui"),
  "compress-pdf": () => import("@/tools/pdf/compress-pdf/ui"),
  "crop-pdf": () => import("@/tools/pdf/crop-pdf/ui"),
  "flatten-pdf": () => import("@/tools/pdf/flatten-pdf/ui"),
  "html-to-pdf": () => import("@/tools/pdf/html-to-pdf/ui"),
  "images-to-pdf": () => import("@/tools/pdf/images-to-pdf/ui"),
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
  "resize-pdf-pages": () => import("@/tools/pdf/resize-pdf-pages/ui"),
  "rtf-to-pdf": () => import("@/tools/pdf/rtf-to-pdf/ui"),
  "scale-pdf": () => import("@/tools/pdf/scale-pdf/ui"),
  "split-pdf": () => import("@/tools/pdf/split-pdf/ui"),
  "svg-to-pdf": () => import("@/tools/pdf/svg-to-pdf/ui"),
  "text-to-pdf": () => import("@/tools/pdf/text-to-pdf/ui"),
  "bcrypt-hash-generator": () => import("@/tools/network-security/bcrypt-hash-generator/ui"),
  "csp-evaluator": () => import("@/tools/network-security/csp-evaluator/ui"),
  "data-url-converter": () => import("@/tools/network-security/data-url-converter/ui"),
  "http-status-code-reference": () => import("@/tools/network-security/http-status-code-reference/ui"),
  "ip-subnet-calculator": () => import("@/tools/network-security/ip-subnet-calculator/ui"),
  "jwt-decoder": () => import("@/tools/network-security/jwt-decoder/ui"),
  "mime-type-lookup": () => import("@/tools/network-security/mime-type-lookup/ui"),
  "password-generator": () => import("@/tools/network-security/password-generator/ui"),
  "totp-generator": () => import("@/tools/network-security/totp-generator/ui"),
  "aes-256-encryptor-decryptor": () => import("@/tools/network-security/aes-256-encryptor-decryptor/ui"),
  "qr-code-generator-image": () => import("@/tools/image/qr-code-generator-image/ui"),
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
  const { isFavorite, toggle } = useFavorites();
  const { record } = useRecentTools();
  const isFav = isFavorite(tool.id);

  useEffect(() => {
    record(tool.id);
  }, [tool.id, record]);

  const [infoTab, setInfoTab] = useState<"about" | "faq" | "related">("about");
  const faqCount = tool.seo?.faq?.length ?? 0;

  function InfoTabButton({ id, label }: { id: "about" | "faq" | "related"; label: string }) {
    const active = infoTab === id;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => setInfoTab(id)}
        className={cn(
          "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors cursor-pointer touch-target rounded-t-lg",
          active
            ? "border-cyan-400 text-white"
            : "border-transparent text-white/45 hover:text-white/85"
        )}
      >
        {label}
      </button>
    );
  }

  const Icon = CATEGORY_ICONS[tool.category] ?? Layers;
  const loader = TOOL_UI_LOADERS[tool.id];
  const ToolUI = loader ? lazy(loader) : null;

  // Pull style + tint from template category data so the page matches the dashboard palette.
  const tc = TEMPLATE_CATEGORIES.find((c) => c.id === tool.category);
  const tileClass = tc?.iconTile ?? "from-slate-400 to-slate-600";

  return (
    <TemplateShell footer={<TemplateFooter />}>
      <div className="mx-auto max-w-5xl px-3 pb-32 pt-3 sm:px-6 sm:pt-5 md:pb-14">
        {/* Breadcrumb */}
        <motion.nav
          initial={MO_HIDDEN}
          animate={MO_VISIBLE}
          transition={MO_NAV_TRANS}
          className="mb-6 flex items-center gap-1.5 text-[12.5px] text-white/45"
        >
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <ChevronRight className="size-3" />
          <Link href="/tools" className="hover:text-white transition-colors">
            Tools
          </Link>
          <ChevronRight className="size-3" />
          <Link
            href={`/category/${tool.category}`}
            className="hover:text-white transition-colors"
          >
            {categoryLabel.split(" ")[0]}
          </Link>
          <ChevronRight className="size-3" />
          <span className="font-medium text-white">{tool.name}</span>
        </motion.nav>

        {/* Header card — bento style */}
        <motion.div
          initial={MO_HERO}
          animate={MO_VISIBLE}
          transition={MO_HERO_TRANS}
          className="relative mb-6 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#111726]/85 p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(0,0,0,0.4),0_24px_60px_-28px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:p-8"
        >
          {/* Ambient blob */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute -right-20 -top-20 size-72 rounded-full opacity-50 blur-3xl",
              tc?.blob ?? "bg-slate-500/20"
            )}
          />
          <span className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" aria-hidden="true" />

          <div className="relative flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "flex size-12 items-center justify-center rounded-2xl text-white shadow-[0_12px_28px_-8px_rgba(34,211,238,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)] ring-1 ring-white/20 bg-gradient-to-br",
                tileClass
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className="rounded-full border border-white/[0.09] bg-white/[0.05] px-2.5 py-1 text-[10.5px] font-semibold text-white/75">
              {categoryLabel.split(" ")[0]}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1 text-[10.5px] font-semibold text-emerald-300">
              <Lock className="size-3" /> Runs in your browser
            </span>
            <button
              type="button"
              onClick={() => toggle(tool.id)}
              aria-pressed={isFav}
              aria-label={
                isFav ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`
              }
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition-colors",
                isFav
                  ? "border-amber-300/40 bg-amber-300/[0.12] text-amber-300"
                  : "border-white/[0.1] bg-white/[0.05] text-white/75 hover:bg-white/[0.1]"
              )}
            >
              <Star className={cn("size-3.5", isFav && "fill-current")} />
              <span>{isFav ? "Favorited" : "Favorite"}</span>
            </button>
          </div>

          <motion.h1
            initial={MO_HERO}
            animate={MO_VISIBLE}
            transition={MO_H1_TRANS}
            className="relative mt-4 text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-[44px]"
          >
            {tool.name}
          </motion.h1>
          <motion.p
            initial={MO_HERO}
            animate={MO_VISIBLE}
            transition={MO_P_TRANS}
            className="relative mt-3 max-w-2xl text-[14.5px] text-white/55 sm:text-base"
          >
            {tool.description}
          </motion.p>

          <motion.div
            initial={MO_HERO}
            animate={MO_VISIBLE}
            transition={MO_BADGES_TRANS}
            className="relative mt-6 flex flex-wrap items-center gap-2"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10.5px] text-white/55">
              <Lock className="size-3" /> 100% Private
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10.5px] text-white/55">
              <WifiOff className="size-3" /> Works Offline
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-[10.5px] text-white/55">
              <Zap className="size-3" /> Instant
            </span>
            {tool.status === "planned" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/[0.08] px-2.5 py-1 text-[10.5px] font-semibold text-amber-300">
                <Clock className="size-3" /> Coming Soon
              </span>
            )}
          </motion.div>
        </motion.div>

        {/* Tool UI */}
        <section
          className="relative mb-8 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0c1018]/85 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_18px_44px_-20px_rgba(0,0,0,0.7)] sm:p-8"
        >
          <span className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" aria-hidden="true" />
          {tool.status === "planned" && (
            <div className="relative mb-5 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.08] p-3.5 text-[13px] text-amber-200">
              <Clock className="mt-0.5 size-4 shrink-0 text-amber-300" />
              <div>
                <p className="font-semibold">Upgrade coming soon</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-amber-200/80">
                  This preview template is being upgraded with extra features — 100% local, zero network requests.
                </p>
              </div>
            </div>
          )}
          {ToolUI ? (
            <Suspense
              fallback={
                <div className="flex min-h-[120px] items-center justify-center py-8 text-center text-[12.5px] text-white/45">
                  <Sparkles className="mr-2 size-4 animate-pulse" /> Loading tool…
                </div>
              }
            >
              <ToolUI />
            </Suspense>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-md">
                <Layers className="size-5" />
              </span>
              <p className="text-[16px] font-semibold">UI coming soon</p>
              <p className="mt-1 max-w-sm text-[12.5px] text-white/55">
                The {tool.name} logic is implemented and tested — UI is being rebuilt. Check back shortly.
              </p>
            </div>
          )}
        </section>

        {/* Info tabs */}
        <div className="mb-6">
          <div
            role="tablist"
            aria-label="Tool information"
            className="flex flex-wrap gap-1 border-b border-white/[0.07]"
          >
            <InfoTabButton id="about" label="About" />
            {faqCount > 0 && <InfoTabButton id="faq" label={`FAQ (${faqCount})`} />}
            {related.length > 0 && (
              <InfoTabButton id="related" label={`Related (${related.length})`} />
            )}
          </div>

          {infoTab === "about" && (
            <div className="pt-4 text-[13.5px] text-white/55">
              <p className="mb-3 leading-relaxed">
                {tool.description} Everything runs locally in your browser — your data
                never leaves your device.
              </p>
              <h3 className="mb-2 text-[14.5px] font-semibold text-white">How to use</h3>
              <ol className="ml-4 list-decimal space-y-1">
                <li>Enter your input in the tool above.</li>
                <li>Adjust any options to your preference.</li>
                <li>Use the Copy or Download buttons to save the result.</li>
                <li>Everything happens locally — your data never leaves your browser.</li>
              </ol>
            </div>
          )}

          {infoTab === "faq" && faqCount > 0 && (
            <div className="space-y-3 pt-4">
              {tool.seo?.faq?.map((faq, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4"
                >
                  <h3 className="mb-1 text-[13.5px] font-semibold">{faq.q}</h3>
                  <p className="text-[12.5px] leading-relaxed text-white/55">{faq.a}</p>
                </div>
              ))}
            </div>
          )}

          {infoTab === "related" && related.length > 0 && (
            <div className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 md:grid-cols-3">
              {related.map((rt) => {
                const RIcon = CATEGORY_ICONS[rt.category] ?? Layers;
                const rtc = TEMPLATE_CATEGORIES.find((c) => c.id === rt.category);
                return (
                  <Link
                    key={rt.id}
                    href={`/tools/${rt.id}`}
                    className="group block h-full"
                  >
                    <div className="flex h-full items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition-all hover:-translate-y-0.5 hover:border-white/[0.15]">
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md ring-1 ring-white/15 bg-gradient-to-br",
                          rtc?.iconTile ?? "from-slate-400 to-slate-600"
                        )}
                      >
                        <RIcon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[12.5px] font-semibold">{rt.name}</h3>
                        <p className="line-clamp-2 text-[11px] text-white/45">
                          {rt.description}
                        </p>
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-cyan-300 opacity-0 transition-all group-hover:opacity-100">
                          Open <ArrowRight className="size-3" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Back link */}
        <div className="mt-10">
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-3.5 py-2 text-[12px] text-white/75 transition-colors hover:bg-white/[0.1]"
          >
            <ArrowLeft className="size-3.5" /> All tools
          </Link>
        </div>
      </div>
    </TemplateShell>
  );
}
