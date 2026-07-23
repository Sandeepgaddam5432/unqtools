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
  "age-calculator": () => import("@/tools/calculators/age-calculator/ui"),
  "bmi-calculator": () => import("@/tools/calculators/bmi-calculator/ui"),
  "date-difference-calculator": () => import("@/tools/calculators/date-difference-calculator/ui"),
  "discount-calculator": () => import("@/tools/calculators/discount-calculator/ui"),
  "percentage-calculator": () => import("@/tools/calculators/percentage-calculator/ui"),
  "simple-interest-calculator": () => import("@/tools/calculators/simple-interest-calculator/ui"),
  "tip-calculator": () => import("@/tools/calculators/tip-calculator/ui"),
  "unit-converter-length": () => import("@/tools/calculators/unit-converter-length/ui"),
  "color-picker": () => import("@/tools/image/color-picker/ui"),
  "image-compressor": () => import("@/tools/image/image-compressor/ui"),
  "ascii-art-generator": () => import("@/tools/image/ascii-art-generator/ui"),
  "barcode-generator": () => import("@/tools/image/barcode-generator/ui"),
  "bulk-image-renamer-optimizer": () => import("@/tools/image/bulk-image-renamer-optimizer/ui"),
  "photo-mosaic-generator": () => import("@/tools/image/photo-mosaic-generator/ui"),
  "pixel-art-maker": () => import("@/tools/image/pixel-art-maker/ui"),
  // File tools
  "csv-file-joiner": () => import("@/tools/file/csv-file-joiner/ui"),
  "csv-file-splitter": () => import("@/tools/file/csv-file-splitter/ui"),
  "csv-to-tsv-converter": () => import("@/tools/file/csv-to-tsv-converter/ui"),
  "duplicate-file-finder": () => import("@/tools/file/duplicate-file-finder/ui"),
  "file-hash-checker": () => import("@/tools/file/file-hash-checker/ui"),
  "file-metadata-viewer": () => import("@/tools/file/file-metadata-viewer/ui"),
  "file-rename-utility": () => import("@/tools/file/file-rename-utility/ui"),
  "json-to-xml-converter": () => import("@/tools/file/json-to-xml-converter/ui"),
  "text-file-joiner": () => import("@/tools/file/text-file-joiner/ui"),
  "tsv-to-csv-converter": () => import("@/tools/file/tsv-to-csv-converter/ui"),
  "xml-to-json-converter": () => import("@/tools/file/xml-to-json-converter/ui"),
  "base64-file-encoder": () => import("@/tools/file/base64-file-encoder/ui"),
  "base64-file-decoder": () => import("@/tools/file/base64-file-decoder/ui"),
  "binary-file-viewer": () => import("@/tools/file/binary-file-viewer/ui"),
  "file-extension-changer": () => import("@/tools/file/file-extension-changer/ui"),
  "hex-viewer": () => import("@/tools/file/hex-viewer/ui"),
  "large-file-generator": () => import("@/tools/file/large-file-generator/ui"),
  "online-file-merger": () => import("@/tools/file/online-file-merger/ui"),
  "online-file-splitter": () => import("@/tools/file/online-file-splitter/ui"),
  "empty-file-creator": () => import("@/tools/file/empty-file-creator/ui"),
  "cbz-comic-book-reader": () => import("@/tools/file/cbz-comic-book-reader/ui"),
  "csv-to-excel-converter": () => import("@/tools/file/csv-to-excel-converter/ui"),
  "epub-reader": () => import("@/tools/file/epub-reader/ui"),
  "excel-to-csv-converter": () => import("@/tools/file/excel-to-csv-converter/ui"),
  "file-metadata-stripper": () => import("@/tools/file/file-metadata-stripper/ui"),
  "gzip-compressor": () => import("@/tools/file/gzip-compressor/ui"),
  "gzip-decompressor": () => import("@/tools/file/gzip-decompressor/ui"),
  "json-to-excel-converter": () => import("@/tools/file/json-to-excel-converter/ui"),
  "local-file-integrity-auditor": () => import("@/tools/file/local-file-integrity-auditor/ui"),
  "tar-extractor": () => import("@/tools/file/tar-extractor/ui"),
  "apk-extractor": () => import("@/tools/file/apk-extractor/ui"),
  "chm-extractor": () => import("@/tools/file/chm-extractor/ui"),
  "excel-to-json-converter": () => import("@/tools/file/excel-to-json-converter/ui"),
  "fb2-reader": () => import("@/tools/file/fb2-reader/ui"),
  "iso-extractor": () => import("@/tools/file/iso-extractor/ui"),
  "jar-extractor": () => import("@/tools/file/jar-extractor/ui"),
  "lzh-extractor": () => import("@/tools/file/lzh-extractor/ui"),
  "mobi-reader": () => import("@/tools/file/mobi-reader/ui"),
  "online-zip-compressor": () => import("@/tools/file/online-zip-compressor/ui"),
  "online-zip-extractor": () => import("@/tools/file/online-zip-extractor/ui"),
  "deb-extractor": () => import("@/tools/file/deb-extractor/ui"),
  "cab-file-extractor": () => import("@/tools/file/cab-file-extractor/ui"),
  "odt-to-pdf-converter": () => import("@/tools/file/odt-to-pdf-converter/ui"),
  "ods-to-pdf-converter": () => import("@/tools/file/ods-to-pdf-converter/ui"),
  "odp-to-pdf-converter": () => import("@/tools/file/odp-to-pdf-converter/ui"),
  "pdf-to-html-converter": () => import("@/tools/file/pdf-to-html-converter/ui"),
  "pdf-to-text-converter": () => import("@/tools/file/pdf-to-text-converter/ui"),
  "pdf-to-word-converter": () => import("@/tools/file/pdf-to-word-converter/ui"),
  "pdf-to-excel-converter": () => import("@/tools/file/pdf-to-excel-converter/ui"),
  "pdf-to-rtf-converter": () => import("@/tools/file/pdf-to-rtf-converter/ui"),
  "pdf-to-image-converter": () => import("@/tools/file/pdf-to-image-converter/ui"),
  "pdf-to-epub-converter": () => import("@/tools/file/pdf-to-epub-converter/ui"),
  "pdf-to-powerpoint-converter": () => import("@/tools/file/pdf-to-powerpoint-converter/ui"),
  "pdf-to-odt-converter": () => import("@/tools/file/pdf-to-odt-converter/ui"),
  "pdf-to-ods-converter": () => import("@/tools/file/pdf-to-ods-converter/ui"),
  "pdf-to-odp-converter": () => import("@/tools/file/pdf-to-odp-converter/ui"),
  "pdf-to-postscript-converter": () => import("@/tools/file/pdf-to-postscript-converter/ui"),
  "pdf-to-mobi-converter": () => import("@/tools/file/pdf-to-mobi-converter/ui"),
  "pdf-to-azw3-converter": () => import("@/tools/file/pdf-to-azw3-converter/ui"),
  "pdf-to-djvu-converter": () => import("@/tools/file/pdf-to-djvu-converter/ui"),
  "dmg-extractor": () => import("@/tools/file/dmg-extractor/ui"),
  "keynote-to-pdf-converter": () => import("@/tools/file/keynote-to-pdf-converter/ui"),
  "numbers-to-pdf-converter": () => import("@/tools/file/numbers-to-pdf-converter/ui"),
  "pages-to-pdf-converter": () => import("@/tools/file/pages-to-pdf-converter/ui"),
  "epub-to-mobi-converter": () => import("@/tools/file/epub-to-mobi-converter/ui"),
  "epub-to-azw3-converter": () => import("@/tools/file/epub-to-azw3-converter/ui"),
  "mobi-to-epub-converter": () => import("@/tools/file/mobi-to-epub-converter/ui"),
  "lit-to-pdf-converter": () => import("@/tools/file/lit-to-pdf-converter/ui"),
  "lrf-to-pdf-converter": () => import("@/tools/file/lrf-to-pdf-converter/ui"),
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
  "base64": () => import("@/tools/developer/base64/ui"),
  "7z-extractor": () => import("@/tools/file/7z-extractor/ui"),
  "arj-extractor": () => import("@/tools/file/arj-extractor/ui"),
  "bzip2-compressor": () => import("@/tools/file/bzip2-compressor/ui"),
  "bzip2-decompressor": () => import("@/tools/file/bzip2-decompressor/ui"),
  "cbr-comic-book-reader": () => import("@/tools/file/cbr-comic-book-reader/ui"),
  "lit-to-epub-converter": () => import("@/tools/file/lit-to-epub-converter/ui"),
  "lrf-to-epub-converter": () => import("@/tools/file/lrf-to-epub-converter/ui"),
  "pdf-password-encryptor": () => import("@/tools/file/pdf-password-encryptor/ui"),
  "pdf-security-remover": () => import("@/tools/file/pdf-security-remover/ui"),
  "postscript-to-pdf-converter": () => import("@/tools/file/postscript-to-pdf-converter/ui"),
  "prc-to-epub-converter": () => import("@/tools/file/prc-to-epub-converter/ui"),
  "rar-extractor": () => import("@/tools/file/rar-extractor/ui"),
  "rpm-extractor": () => import("@/tools/file/rpm-extractor/ui"),
  "tcr-to-epub-converter": () => import("@/tools/file/tcr-to-epub-converter/ui"),
  "wim-extractor": () => import("@/tools/file/wim-extractor/ui"),
  "xar-extractor": () => import("@/tools/file/xar-extractor/ui"),
  "z-compressor": () => import("@/tools/file/z-compressor/ui"),
  "canonical-tag-generator": () => import("@/tools/seo/canonical-tag-generator/ui"),
  "faq-schema-generator": () => import("@/tools/seo/faq-schema-generator/ui"),
  "hreflang-tag-generator": () => import("@/tools/seo/hreflang-tag-generator/ui"),
  "meta-tag-generator": () => import("@/tools/seo/meta-tag-generator/ui"),
  "open-graph-generator": () => import("@/tools/seo/open-graph-generator/ui"),
  "robots-txt-generator": () => import("@/tools/seo/robots-txt-generator/ui"),
  "schema-jsonld-generator": () => import("@/tools/seo/schema-jsonld-generator/ui"),
  "serp-snippet-preview": () => import("@/tools/seo/serp-snippet-preview/ui"),
  "utm-url-builder": () => import("@/tools/seo/utm-url-builder/ui"),
  "xml-sitemap-generator": () => import("@/tools/seo/xml-sitemap-generator/ui"),
  "breadcrumb-schema-generator": () => import("@/tools/seo/breadcrumb-schema-generator/ui"),
  "how-to-schema-generator": () => import("@/tools/seo/how-to-schema-generator/ui"),
  "content-readability-analyzer": () => import("@/tools/seo/content-readability-analyzer/ui"),
  "content-word-count": () => import("@/tools/seo/content-word-count/ui"),
  "heading-structure-analyzer": () => import("@/tools/seo/heading-structure-analyzer/ui"),
  "content-outline-generator": () => import("@/tools/seo/content-outline-generator/ui"),
  "content-brief-generator": () => import("@/tools/seo/content-brief-generator/ui"),
  "keyword-density-analyzer": () => import("@/tools/seo/keyword-density-analyzer/ui"),
  "content-gap-analyzer": () => import("@/tools/seo/content-gap-analyzer/ui"),
  "redirect-chain-checker": () => import("@/tools/seo/redirect-chain-checker/ui"),
  "disavow-file-generator": () => import("@/tools/seo/disavow-file-generator/ui"),
  "keyword-match-type-builder": () => import("@/tools/seo/keyword-match-type-builder/ui"),
  "outreach-email-template": () => import("@/tools/seo/outreach-email-template/ui"),
  "html-to-text-ratio-checker": () => import("@/tools/seo/html-to-text-ratio-checker/ui"),
  "image-seo-alt-text-auditor": () => import("@/tools/seo/image-seo-alt-text-auditor/ui"),
  "anchor-text-distribution-analyzer": () => import("@/tools/seo/anchor-text-distribution-analyzer/ui"),
  "nap-citation-consistency-checker": () => import("@/tools/seo/nap-citation-consistency-checker/ui"),
  "google-analytics-4-event-builder": () => import("@/tools/seo/google-analytics-4-event-builder/ui"),
  "conversion-tracking-tag-generator": () => import("@/tools/seo/conversion-tracking-tag-generator/ui"),
  "responsive-search-ad-builder": () => import("@/tools/seo/responsive-search-ad-builder/ui"),
  "seo-slug-generator": () => import("@/tools/seo/seo-slug-generator/ui"),
  "meta-description-generator": () => import("@/tools/seo/meta-description-generator/ui"),
  "title-tag-optimizer": () => import("@/tools/seo/title-tag-optimizer/ui"),
  "internal-linking-suggester": () => import("@/tools/seo/internal-linking-suggester/ui"),
  "keyword-cannibalization-detector": () => import("@/tools/seo/keyword-cannibalization-detector/ui"),
  "long-tail-keyword-generator": () => import("@/tools/seo/long-tail-keyword-generator/ui"),
  "keyword-grouping-tool": () => import("@/tools/seo/keyword-grouping-tool/ui"),
  "people-also-ask-extractor": () => import("@/tools/seo/people-also-ask-extractor/ui"),
  "redirect-htaccess-generator": () => import("@/tools/seo/redirect-htaccess-generator/ui"),
  "seo-content-scorecard": () => import("@/tools/seo/seo-content-scorecard/ui"),
  "keyword-research-explorer": () => import("@/tools/seo/keyword-research-explorer/ui"),
  "keyword-difficulty-estimator": () => import("@/tools/seo/keyword-difficulty-estimator/ui"),
  "search-intent-classifier": () => import("@/tools/seo/search-intent-classifier/ui"),
  "tf-idf-content-optimizer": () => import("@/tools/seo/tf-idf-content-optimizer/ui"),
  "serp-competitor-analysis": () => import("@/tools/seo/serp-competitor-analysis/ui"),
  "local-business-schema-generator": () => import("@/tools/seo/local-business-schema-generator/ui"),
  "open-graph-image-generator": () => import("@/tools/seo/open-graph-image-generator/ui"),
  "title-meta-pixel-checker": () => import("@/tools/seo/title-meta-pixel-checker/ui"),
  "structured-data-validator": () => import("@/tools/seo/structured-data-validator/ui"),
  "backlink-profile-analyzer": () => import("@/tools/seo/backlink-profile-analyzer/ui"),
  "keyword-rank-tracker": () => import("@/tools/seo/keyword-rank-tracker/ui"),
  "serp-position-checker": () => import("@/tools/seo/serp-position-checker/ui"),
  "rank-change-visualizer": () => import("@/tools/seo/rank-change-visualizer/ui"),
  "share-of-voice-calculator": () => import("@/tools/seo/share-of-voice-calculator/ui"),
  "competitor-rank-comparison": () => import("@/tools/seo/competitor-rank-comparison/ui"),
  "backlink-quality-scorer": () => import("@/tools/seo/backlink-quality-scorer/ui"),
  "lost-new-backlink-tracker": () => import("@/tools/seo/lost-new-backlink-tracker/ui"),
  "backlink-gap-analyzer": () => import("@/tools/seo/backlink-gap-analyzer/ui"),
  "link-prospecting-builder": () => import("@/tools/seo/link-prospecting-builder/ui"),
  "guest-post-finder": () => import("@/tools/seo/guest-post-finder/ui"),
  "content-pruning-auditor": () => import("@/tools/seo/content-pruning-auditor/ui"),
  "orphan-page-detector": () => import("@/tools/seo/orphan-page-detector/ui"),
  "crawl-budget-estimator": () => import("@/tools/seo/crawl-budget-estimator/ui"),
  "pagination-seo-checker": () => import("@/tools/seo/pagination-seo-checker/ui"),
  "faceted-nav-seo-analyzer": () => import("@/tools/seo/faceted-nav-seo-analyzer/ui"),
  "javascript-seo-render-tester": () => import("@/tools/seo/javascript-seo-render-tester/ui"),
  "log-file-analyzer": () => import("@/tools/seo/log-file-analyzer/ui"),
  "index-coverage-reporter": () => import("@/tools/seo/index-coverage-reporter/ui"),
  "page-experience-signal-checker": () => import("@/tools/seo/page-experience-signal-checker/ui"),
  "e-commerce-product-seo-optimizer": () => import("@/tools/seo/e-commerce-product-seo-optimizer/ui"),
  "local-rank-tracker": () => import("@/tools/seo/local-rank-tracker/ui"),
  "google-business-profile-optimizer": () => import("@/tools/seo/google-business-profile-optimizer/ui"),
  "citation-finder": () => import("@/tools/seo/citation-finder/ui"),
  "review-sentiment-analyzer": () => import("@/tools/seo/review-sentiment-analyzer/ui"),
  "youtube-video-seo-optimizer": () => import("@/tools/seo/youtube-video-seo-optimizer/ui"),
  "video-schema-generator": () => import("@/tools/seo/video-schema-generator/ui"),
  "content-calendar-planner": () => import("@/tools/seo/content-calendar-planner/ui"),
  "topic-cluster-builder": () => import("@/tools/seo/topic-cluster-builder/ui"),
  "content-distribution-planner": () => import("@/tools/seo/content-distribution-planner/ui"),
  "brand-mention-monitor": () => import("@/tools/seo/brand-mention-monitor/ui"),
  "international-seo-planner": () => import("@/tools/seo/international-seo-planner/ui"),
  "locale-keyword-researcher": () => import("@/tools/seo/locale-keyword-researcher/ui"),
  "affiliate-link-cloaker": () => import("@/tools/seo/affiliate-link-cloaker/ui"),
  "affiliate-commission-calculator": () => import("@/tools/seo/affiliate-commission-calculator/ui"),
  "product-review-schema-generator": () => import("@/tools/seo/product-review-schema-generator/ui"),
  "seo-report-generator": () => import("@/tools/seo/seo-report-generator/ui"),
  "seo-kpi-dashboard-builder": () => import("@/tools/seo/seo-kpi-dashboard-builder/ui"),
  "competitor-website-analyzer": () => import("@/tools/seo/competitor-website-analyzer/ui"),
  "seo-experiment-tracker": () => import("@/tools/seo/experiment-tracker/ui"),
  "search-console-data-analyzer": () => import("@/tools/seo/search-console-data-analyzer/ui"),
  "audio-recorder": () => import("@/tools/audio-video/audio-recorder/ui"),
  "audio-trimmer": () => import("@/tools/audio-video/audio-trimmer/ui"),
  "audio-converter": () => import("@/tools/audio-video/audio-converter/ui"),
  "audio-volume-normalizer": () => import("@/tools/audio-video/audio-volume-normalizer/ui"),
  "audio-speed-changer": () => import("@/tools/audio-video/audio-speed-changer/ui"),
  "audio-reverser": () => import("@/tools/audio-video/audio-reverser/ui"),
  "audio-merger": () => import("@/tools/audio-video/audio-merger/ui"),
  "audio-splitter": () => import("@/tools/audio-video/audio-splitter/ui"),
  "audio-fade-generator": () => import("@/tools/audio-video/audio-fade-generator/ui"),
  "audio-metadata-editor": () => import("@/tools/audio-video/audio-metadata-editor/ui"),
  "audio-spectrum-analyzer": () => import("@/tools/audio-video/audio-spectrum-analyzer/ui"),
  "audio-waveform-viewer": () => import("@/tools/audio-video/audio-waveform-viewer/ui"),
  "audio-noise-reducer": () => import("@/tools/audio-video/audio-noise-reducer/ui"),
  "audio-equalizer": () => import("@/tools/audio-video/audio-equalizer/ui"),
  "video-trimmer": () => import("@/tools/audio-video/video-trimmer/ui"),
  "video-compressor": () => import("@/tools/audio-video/video-compressor/ui"),
  "video-metadata-viewer": () => import("@/tools/audio-video/video-metadata-viewer/ui"),
  "video-frame-extractor": () => import("@/tools/audio-video/video-frame-extractor/ui"),
  "audio-format-detector": () => import("@/tools/audio-video/audio-format-detector/ui"),
  "audio-bitrate-calculator": () => import("@/tools/audio-video/audio-bitrate-calculator/ui"),
  "invoice-generator": () => import("@/tools/business/invoice-generator/ui"),
  "quote-generator": () => import("@/tools/business/quote-generator/ui"),
  "receipt-maker": () => import("@/tools/business/receipt-maker/ui"),
  "tax-calculator": () => import("@/tools/business/tax-calculator/ui"),
  "payroll-calculator": () => import("@/tools/business/payroll-calculator/ui"),
  "time-tracker": () => import("@/tools/business/time-tracker/ui"),
  "timesheet-generator": () => import("@/tools/business/timesheet-generator/ui"),
  "pomodoro-timer": () => import("@/tools/business/pomodoro-timer/ui"),
  "work-hours-calculator": () => import("@/tools/business/work-hours-calculator/ui"),
  "expense-tracker": () => import("@/tools/business/expense-tracker/ui"),
  "budget-planner": () => import("@/tools/business/budget-planner/ui"),
  "roi-calculator": () => import("@/tools/business/roi-calculator/ui"),
  "break-even-calculator": () => import("@/tools/business/break-even-calculator/ui"),
  "loan-amortization-schedule": () => import("@/tools/business/loan-amortization-schedule/ui"),
  "project-task-tracker": () => import("@/tools/business/project-task-tracker/ui"),
  "gantt-chart-maker": () => import("@/tools/business/gantt-chart-maker/ui"),
  "meeting-agenda-maker": () => import("@/tools/business/meeting-agenda-maker/ui"),
  "decision-matrix-builder": () => import("@/tools/business/decision-matrix-builder/ui"),
  "contract-template-generator": () => import("@/tools/business/contract-template-generator/ui"),
  "email-template-manager": () => import("@/tools/business/email-template-manager/ui"),
  "meeting-notes-maker": () => import("@/tools/business/meeting-notes-maker/ui"),
  "sop-generator": () => import("@/tools/business/sop-generator/ui"),
  "sales-pipeline-tracker": () => import("@/tools/business/sales-pipeline-tracker/ui"),
  "customer-tracker": () => import("@/tools/business/customer-tracker/ui"),
  "commission-tracker": () => import("@/tools/business/commission-tracker/ui"),
  "flashcard-maker": () => import("@/tools/education/flashcard-maker/ui"),
  "quiz-generator": () => import("@/tools/education/quiz-generator/ui"),
  "study-planner": () => import("@/tools/education/study-planner/ui"),
  "grade-calculator": () => import("@/tools/education/grade-calculator/ui"),
  "vocabulary-builder": () => import("@/tools/education/vocabulary-builder/ui"),
  "typing-practice": () => import("@/tools/education/typing-practice/ui"),
  "multiplication-tables-generator": () => import("@/tools/education/multiplication-tables-generator/ui"),
  "unit-converter-educational": () => import("@/tools/education/unit-converter-educational/ui"),
  "periodic-table-reference": () => import("@/tools/education/periodic-table-reference/ui"),
  "math-practice-generator": () => import("@/tools/education/math-practice-generator/ui"),
  "spelling-bee-practice": () => import("@/tools/education/spelling-bee-practice/ui"),
  "language-translator-helper": () => import("@/tools/education/language-translator-helper/ui"),
  "history-timeline-maker": () => import("@/tools/education/history-timeline-maker/ui"),
  "geography-quiz": () => import("@/tools/education/geography-quiz/ui"),
  "citation-generator": () => import("@/tools/education/citation-generator/ui"),
  "reading-list-tracker": () => import("@/tools/education/reading-list-tracker/ui"),
  "chemistry-formula-calculator": () => import("@/tools/education/chemistry-formula-calculator/ui"),
  "physics-formula-reference": () => import("@/tools/education/physics-formula-reference/ui"),
  "study-notes-organizer": () => import("@/tools/education/study-notes-organizer/ui"),
  "presentation-slide-outliner": () => import("@/tools/education/presentation-slide-outliner/ui"),
  "social-media-post-generator": () => import("@/tools/social/social-media-post-generator/ui"),
  "hashtag-generator": () => import("@/tools/social/hashtag-generator/ui"),
  "caption-generator": () => import("@/tools/social/caption-generator/ui"),
  "social-media-bio-generator": () => import("@/tools/social/social-media-bio-generator/ui"),
  "emoji-picker-keyboard": () => import("@/tools/social/emoji-picker-keyboard/ui"),
  "social-media-image-resizer": () => import("@/tools/social/social-media-image-resizer/ui"),
  "tweet-thread-planner": () => import("@/tools/social/tweet-thread-planner/ui"),
  "instagram-story-planner": () => import("@/tools/social/instagram-story-planner/ui"),
  "linkedin-post-formatter": () => import("@/tools/social/linkedin-post-formatter/ui"),
  "youtube-thumbnail-text-overlay": () => import("@/tools/social/youtube-thumbnail-text-overlay/ui"),
  "content-calendar-scheduler": () => import("@/tools/social/content-calendar-scheduler/ui"),
  "social-media-character-counter": () => import("@/tools/social/social-media-character-counter/ui"),
  "tiktok-video-description-generator": () => import("@/tools/social/tiktok-video-description-generator/ui"),
  "pinterest-pin-description-generator": () => import("@/tools/social/pinterest-pin-description-generator/ui"),
  "social-media-engagement-tracker": () => import("@/tools/social/social-media-engagement-tracker/ui"),
  "social-media-mention-tracker": () => import("@/tools/social/social-media-mention-tracker/ui"),
  "social-media-hashtag-analyzer": () => import("@/tools/social/social-media-hashtag-analyzer/ui"),
  "social-media-trend-detector": () => import("@/tools/social/social-media-trend-detector/ui"),
  "social-media-contest-planner": () => import("@/tools/social/social-media-contest-planner/ui"),
  "social-media-collab-finder": () => import("@/tools/social/social-media-collab-finder/ui"),
  "social-media-analytics-dashboard": () => import("@/tools/social/social-media-analytics-dashboard/ui"),
  "social-media-content-repurposer": () => import("@/tools/social/social-media-content-repurposer/ui"),
  "social-media-comment-responder": () => import("@/tools/social/social-media-comment-responder/ui"),
  "social-media-emoji-translator": () => import("@/tools/social/social-media-emoji-translator/ui"),
  "social-media-poll-generator": () => import("@/tools/social/social-media-poll-generator/ui"),
  "pdf-ocr-text-extractor": () => import("@/tools/pdf/pdf-ocr-text-extractor/ui"),
  "pdf-to-word-converter": () => import("@/tools/pdf/pdf-to-word-converter/ui"),
  "pdf-to-excel-converter": () => import("@/tools/pdf/pdf-to-excel-converter/ui"),
  "pdf-form-filler": () => import("@/tools/pdf/pdf-form-filler/ui"),
  "pdf-redaction-tool": () => import("@/tools/pdf/pdf-redaction-tool/ui"),
  "pdf-compare": () => import("@/tools/pdf/pdf-compare/ui"),
  "pdf-booklet-maker": () => import("@/tools/pdf/pdf-booklet-maker/ui"),
  "pdf-imposition": () => import("@/tools/pdf/pdf-imposition/ui"),
  "pdf-color-separation": () => import("@/tools/pdf/pdf-color-separation/ui"),
  "pdf-grayscale-converter": () => import("@/tools/pdf/pdf-grayscale-converter/ui"),
  "pdf-bleed-adder": () => import("@/tools/pdf/pdf-bleed-adder/ui"),
  "pdf-crop-marks": () => import("@/tools/pdf/pdf-crop-marks/ui"),
  "pdf-ink-coverage-analyzer": () => import("@/tools/pdf/pdf-ink-coverage-analyzer/ui"),
  "pdf-font-extractor": () => import("@/tools/pdf/pdf-font-extractor/ui"),
  "pdf-font-subsetter": () => import("@/tools/pdf/pdf-font-subsetter/ui"),
  "pdf-accessibility-checker": () => import("@/tools/pdf/pdf-accessibility-checker/ui"),
  "pdf-alt-text-generator": () => import("@/tools/pdf/pdf-alt-text-generator/ui"),
  "pdf-tag-tree-viewer": () => import("@/tools/pdf/pdf-tag-tree-viewer/ui"),
  "pdf-thumbnail-generator": () => import("@/tools/pdf/pdf-thumbnail-generator/ui"),
  "pdf-zip-bundler": () => import("@/tools/pdf/pdf-zip-bundler/ui"),
  "pdf-size-optimizer": () => import("@/tools/pdf/pdf-size-optimizer/ui"),
  "pdf-version-converter": () => import("@/tools/pdf/pdf-version-converter/ui"),
  "pdf-qr-code-stamper": () => import("@/tools/pdf/pdf-qr-code-stamper/ui"),
  "pdf-barcode-stamper": () => import("@/tools/pdf/pdf-barcode-stamper/ui"),
  "pdf-header-footer-adder": () => import("@/tools/pdf/pdf-header-footer-adder/ui"),
  "pdf-bookmark-from-headings": () => import("@/tools/pdf/pdf-bookmark-from-headings/ui"),
  "pdf-translation-overlay": () => import("@/tools/pdf/pdf-translation-overlay/ui"),
  "pdf-table-extractor": () => import("@/tools/pdf/pdf-table-extractor/ui"),
  "pdf-form-field-extractor": () => import("@/tools/pdf/pdf-form-field-extractor/ui"),
  "pdf-to-powerpoint-converter": () => import("@/tools/pdf/pdf-to-powerpoint-converter/ui"),  "ai-alt-text-generator": () => import("@/tools/ai/ai-alt-text-generator/ui"),
  "ai-analogies-generator": () => import("@/tools/ai/ai-analogies-generator/ui"),
  "ai-api-payload-mocking-tool": () => import("@/tools/ai/ai-api-payload-mocking-tool/ui"),
  "ai-article-headline-generator": () => import("@/tools/ai/ai-article-headline-generator/ui"),
  "ai-bias-checker": () => import("@/tools/ai/ai-bias-checker/ui"),
  "ai-book-summary-generator": () => import("@/tools/ai/ai-book-summary-generator/ui"),
  "ai-brand-positioning-statement-generator": () => import("@/tools/ai/ai-brand-positioning-statement-generator/ui"),
  "ai-brand-tone-of-voice-builder": () => import("@/tools/ai/ai-brand-tone-of-voice-builder/ui"),
  "ai-business-name-ideator": () => import("@/tools/ai/ai-business-name-ideator/ui"),
  "ai-business-pitch-deck-outline-generator": () => import("@/tools/ai/ai-business-pitch-deck-outline-generator/ui"),
  "ai-character-name-generator": () => import("@/tools/ai/ai-character-name-generator/ui"),
  "ai-chatbot-emulator": () => import("@/tools/ai/ai-chatbot-emulator/ui"),
  "ai-chrome-extension-boilerplate-generator": () => import("@/tools/ai/ai-chrome-extension-boilerplate-generator/ui"),
  "ai-citation-formatter": () => import("@/tools/ai/ai-citation-formatter/ui"),
  "ai-code-converter": () => import("@/tools/ai/ai-code-converter/ui"),
  "ai-code-debugger": () => import("@/tools/ai/ai-code-debugger/ui"),
  "ai-code-explainer": () => import("@/tools/ai/ai-code-explainer/ui"),
  "ai-coding-pattern-refactorer": () => import("@/tools/ai/ai-coding-pattern-refactorer/ui"),
  "ai-cold-email-personalizer": () => import("@/tools/ai/ai-cold-email-personalizer/ui"),
  "ai-competitor-analysis-framework": () => import("@/tools/ai/ai-competitor-analysis-framework/ui"),
  "ai-copywriting-framework-assistant": () => import("@/tools/ai/ai-copywriting-framework-assistant/ui"),
  "ai-cover-letter-writer": () => import("@/tools/ai/ai-cover-letter-writer/ui"),
  "ai-cron-job-scheduler-builder": () => import("@/tools/ai/ai-cron-job-scheduler-builder/ui"),
  "ai-css-ui-component-generator": () => import("@/tools/ai/ai-css-ui-component-generator/ui"),
  "ai-cta-generator": () => import("@/tools/ai/ai-cta-generator/ui"),
  "ai-customer-support-script-writer": () => import("@/tools/ai/ai-customer-support-script-writer/ui"),
  "ai-db-schema-diagram-builder": () => import("@/tools/ai/ai-db-schema-diagram-builder/ui"),
  "ai-dockerfile-builder": () => import("@/tools/ai/ai-dockerfile-builder/ui"),
  "ai-domain-name-generator": () => import("@/tools/ai/ai-domain-name-generator/ui"),
  "ai-email-draft-generator": () => import("@/tools/ai/ai-email-draft-generator/ui"),
  "ai-emoji-translator": () => import("@/tools/ai/ai-emoji-translator/ui"),
  "ai-essay-outline-generator": () => import("@/tools/ai/ai-essay-outline-generator/ui"),
  "ai-faq-generator": () => import("@/tools/ai/ai-faq-generator/ui"),
  "ai-fiction-story-generator": () => import("@/tools/ai/ai-fiction-story-generator/ui"),
  "ai-financial-goal-planner": () => import("@/tools/ai/ai-financial-goal-planner/ui"),
  "ai-flashcard-qa-generator": () => import("@/tools/ai/ai-flashcard-qa-generator/ui"),
  "ai-gift-idea-generator": () => import("@/tools/ai/ai-gift-idea-generator/ui"),
  "ai-git-commit-message-generator": () => import("@/tools/ai/ai-git-commit-message-generator/ui"),
  "ai-grammar-correction-tool": () => import("@/tools/ai/ai-grammar-correction-tool/ui"),
  "ai-htaccess-redirect-generator": () => import("@/tools/ai/ai-htaccess-redirect-generator/ui"),
  "ai-html-landing-page-generator": () => import("@/tools/ai/ai-html-landing-page-generator/ui"),
  "ai-instagram-bio-generator": () => import("@/tools/ai/ai-instagram-bio-generator/ui"),
  "ai-interview-question-generator": () => import("@/tools/ai/ai-interview-question-generator/ui"),
  "ai-jargon-simplifier": () => import("@/tools/ai/ai-jargon-simplifier/ui"),
  "ai-js-object-to-json-schema-converter": () => import("@/tools/ai/ai-js-object-to-json-schema-converter/ui"),
  "ai-json-mock-data-generator": () => import("@/tools/ai/ai-json-mock-data-generator/ui"),
  "ai-keyword-extractor": () => import("@/tools/ai/ai-keyword-extractor/ui"),
  "ai-kubernetes-manifest-generator": () => import("@/tools/ai/ai-kubernetes-manifest-generator/ui"),
  "ai-linkedin-bio-optimizer": () => import("@/tools/ai/ai-linkedin-bio-optimizer/ui"),
  "ai-logical-fallacy-detector": () => import("@/tools/ai/ai-logical-fallacy-detector/ui"),
  "ai-markdown-readme-generator": () => import("@/tools/ai/ai-markdown-readme-generator/ui"),
  "ai-markdown-table-generator": () => import("@/tools/ai/ai-markdown-table-generator/ui"),
  "ai-math-word-problem-solver": () => import("@/tools/ai/ai-math-word-problem-solver/ui"),
  "ai-meeting-minutes-summarizer": () => import("@/tools/ai/ai-meeting-minutes-summarizer/ui"),
  "ai-mermaid-flowchart-generator": () => import("@/tools/ai/ai-mermaid-flowchart-generator/ui"),
  "ai-meta-tag-builder": () => import("@/tools/ai/ai-meta-tag-builder/ui"),
  "ai-multi-language-translator": () => import("@/tools/ai/ai-multi-language-translator/ui"),
  "ai-newsletter-subject-line-ab-tester": () => import("@/tools/ai/ai-newsletter-subject-line-ab-tester/ui"),
  "ai-nginx-config-rule-builder": () => import("@/tools/ai/ai-nginx-config-rule-builder/ui"),
  "ai-paragraph-summarizer": () => import("@/tools/ai/ai-paragraph-summarizer/ui"),
  "ai-paraphrasing-rewriter-tool": () => import("@/tools/ai/ai-paraphrasing-rewriter-tool/ui"),
  "ai-passive-active-voice-converter": () => import("@/tools/ai/ai-passive-active-voice-converter/ui"),
  "ai-passive-aggressive-email-translator": () => import("@/tools/ai/ai-passive-aggressive-email-translator/ui"),
  "ai-podcast-episode-planner": () => import("@/tools/ai/ai-podcast-episode-planner/ui"),
  "ai-poem-lyrics-writer": () => import("@/tools/ai/ai-poem-lyrics-writer/ui"),
  "ai-presentation-outline-generator": () => import("@/tools/ai/ai-presentation-outline-generator/ui"),
  "ai-press-release-draft-builder": () => import("@/tools/ai/ai-press-release-draft-builder/ui"),
  "ai-product-description-writer": () => import("@/tools/ai/ai-product-description-writer/ui"),
  "ai-product-feature-prioritization-helper": () => import("@/tools/ai/ai-product-feature-prioritization-helper/ui"),
  "ai-prompt-improver": () => import("@/tools/ai/ai-prompt-improver/ui"),
  "ai-recipe-generator": () => import("@/tools/ai/ai-recipe-generator/ui"),
  "ai-reddit-post-title-optimizer": () => import("@/tools/ai/ai-reddit-post-title-optimizer/ui"),
  "ai-regex-builder": () => import("@/tools/ai/ai-regex-builder/ui"),
  "ai-resume-bullet-point-optimizer": () => import("@/tools/ai/ai-resume-bullet-point-optimizer/ui"),
  "ai-robots-txt": () => import("@/tools/ai/ai-robots-txt/ui"),
  "ai-salary-negotiation-script-writer": () => import("@/tools/ai/ai-salary-negotiation-script-writer/ui"),
  "ai-sentiment-analysis-tool": () => import("@/tools/ai/ai-sentiment-analysis-tool/ui"),
  "ai-shell-bash-script-writer": () => import("@/tools/ai/ai-shell-bash-script-writer/ui"),
  "ai-slogan-tagline-generator": () => import("@/tools/ai/ai-slogan-tagline-generator/ui"),
  "ai-social-media-caption-writer": () => import("@/tools/ai/ai-social-media-caption-writer/ui"),
  "ai-sql-query-generator": () => import("@/tools/ai/ai-sql-query-generator/ui"),
  "ai-study-guide-generator": () => import("@/tools/ai/ai-study-guide-generator/ui"),
  "ai-svg-vector-art-generator": () => import("@/tools/ai/ai-svg-vector-art-generator/ui"),
  "ai-swot-analysis-creator": () => import("@/tools/ai/ai-swot-analysis-creator/ui"),
  "ai-tailwind-css-palette-generator": () => import("@/tools/ai/ai-tailwind-css-palette-generator/ui"),
  "ai-target-audience-demographics-profiler": () => import("@/tools/ai/ai-target-audience-demographics-profiler/ui"),
  "ai-tech-stack-recommender": () => import("@/tools/ai/ai-tech-stack-recommender/ui"),
  "ai-text-based-adventure-game-engine": () => import("@/tools/ai/ai-text-based-adventure-game-engine/ui"),
  "ai-text-simplifier-eli5": () => import("@/tools/ai/ai-text-simplifier-eli5/ui"),
  "ai-text-to-image-generator": () => import("@/tools/ai/ai-text-to-image-generator/ui"),
  "ai-thesis-statement-generator": () => import("@/tools/ai/ai-thesis-statement-generator/ui"),
  "ai-travel-itinerary-planner": () => import("@/tools/ai/ai-travel-itinerary-planner/ui"),
  "ai-typescript-interface-generator": () => import("@/tools/ai/ai-typescript-interface-generator/ui"),
  "ai-unit-test-case-generator": () => import("@/tools/ai/ai-unit-test-case-generator/ui"),
  "ai-user-persona-creator": () => import("@/tools/ai/ai-user-persona-creator/ui"),
  "ai-user-story-creator": () => import("@/tools/ai/ai-user-story-creator/ui"),
  "ai-video-script-outliner": () => import("@/tools/ai/ai-video-script-outliner/ui"),
  "ai-website-sitemap-generator": () => import("@/tools/ai/ai-website-sitemap-generator/ui"),
  "ai-weekly-meal-planner": () => import("@/tools/ai/ai-weekly-meal-planner/ui"),
  "ai-workout-planner": () => import("@/tools/ai/ai-workout-planner/ui"),  "add-subtract-date-calculator": () => import("@/tools/developer/add-subtract-date-calculator/ui"),
  "age-calculator": () => import("@/tools/developer/age-calculator/ui"),
  "awk-command-builder-tester": () => import("@/tools/developer/awk-command-builder-tester/ui"),
  "bash-script-generator-boilerplate": () => import("@/tools/developer/bash-script-generator-boilerplate/ui"),
  "business-working-days-calculator": () => import("@/tools/developer/business-working-days-calculator/ui"),
  "chmod-calculator": () => import("@/tools/developer/chmod-calculator/ui"),
  "connection-string-builder-parser": () => import("@/tools/developer/connection-string-builder-parser/ui"),
  "countdown-timer-generator": () => import("@/tools/developer/countdown-timer-generator/ui"),
  "create-table-generator": () => import("@/tools/developer/create-table-generator/ui"),
  "credit-card-test-number-generator": () => import("@/tools/developer/credit-card-test-number-generator/ui"),
  "csv-to-sql-insert-converter": () => import("@/tools/developer/csv-to-sql-insert-converter/ui"),
  "database-schema-diff": () => import("@/tools/developer/database-schema-diff/ui"),
  "date-difference-calculator": () => import("@/tools/developer/date-difference-calculator/ui"),
  "date-format-converter-strftime": () => import("@/tools/developer/date-format-converter-strftime/ui"),
  "day-of-the-week-finder": () => import("@/tools/developer/day-of-the-week-finder/ui"),
  "dice-roller-random-picker": () => import("@/tools/developer/dice-roller-random-picker/ui"),
  "email-address-generator-validator": () => import("@/tools/developer/email-address-generator-validator/ui"),
  "er-diagram-designer": () => import("@/tools/developer/er-diagram-designer/ui"),
  "fake-data-generator": () => import("@/tools/developer/fake-data-generator/ui"),
  "iban-generator-validator": () => import("@/tools/developer/iban-generator-validator/ui"),
  "in-browser-sql-playground": () => import("@/tools/developer/in-browser-sql-playground/ui"),
  "isbn-generator-validator": () => import("@/tools/developer/isbn-generator-validator/ui"),
  "iso-8601-date-parser-formatter": () => import("@/tools/developer/iso-8601-date-parser-formatter/ui"),
  "jq-playground-filter-builder": () => import("@/tools/developer/jq-playground-filter-builder/ui"),
  "julian-date-astronomical-time-converter": () => import("@/tools/developer/julian-date-astronomical-time-converter/ui"),
  "luhn-credit-card-validator": () => import("@/tools/developer/luhn-credit-card-validator/ui"),
  "mock-csv-data-generator": () => import("@/tools/developer/mock-csv-data-generator/ui"),
  "mock-graphql-response-generator": () => import("@/tools/developer/mock-graphql-response-generator/ui"),
  "mock-sql-data-generator": () => import("@/tools/developer/mock-sql-data-generator/ui"),
  "mongodb-aggregation-pipeline-builder": () => import("@/tools/developer/mongodb-aggregation-pipeline-builder/ui"),
  "mongodb-query-builder": () => import("@/tools/developer/mongodb-query-builder/ui"),
  "naughty-string-generator": () => import("@/tools/developer/naughty-string-generator/ui"),
  "number-base-converter": () => import("@/tools/developer/number-base-converter/ui"),
  "online-stopwatch-timer": () => import("@/tools/developer/online-stopwatch-timer/ui"),
  "phone-number-generator-validator": () => import("@/tools/developer/phone-number-generator-validator/ui"),
  "printable-calendar-generator": () => import("@/tools/developer/printable-calendar-generator/ui"),
  "random-date-time-generator": () => import("@/tools/developer/random-date-time-generator/ui"),
  "random-ip-mac-address-generator": () => import("@/tools/developer/random-ip-mac-address-generator/ui"),
  "random-number-generator-seeded": () => import("@/tools/developer/random-number-generator-seeded/ui"),
  "random-user-profile-generator": () => import("@/tools/developer/random-user-profile-generator/ui"),
  "recurring-date-rrule-generator": () => import("@/tools/developer/recurring-date-rrule-generator/ui"),
  "redis-command-reference-builder": () => import("@/tools/developer/redis-command-reference-builder/ui"),
  "relative-time-formatter": () => import("@/tools/developer/relative-time-formatter/ui"),
  "sample-json-mock-api-response-generator": () => import("@/tools/developer/sample-json-mock-api-response-generator/ui"),
  "sed-command-builder-tester": () => import("@/tools/developer/sed-command-builder-tester/ui"),
  "shell-command-explainer": () => import("@/tools/developer/shell-command-explainer/ui"),
  "sql-ddl-to-er-diagram-generator": () => import("@/tools/developer/sql-ddl-to-er-diagram-generator/ui"),
  "sql-dialect-converter": () => import("@/tools/developer/sql-dialect-converter/ui"),
  "sql-explain-plan-visualizer": () => import("@/tools/developer/sql-explain-plan-visualizer/ui"),
  "sql-formatter-beautifier": () => import("@/tools/developer/sql-formatter-beautifier/ui"),
  "sql-index-advisor": () => import("@/tools/developer/sql-index-advisor/ui"),
  "sql-join-visualizer": () => import("@/tools/developer/sql-join-visualizer/ui"),
  "sql-minifier": () => import("@/tools/developer/sql-minifier/ui"),
  "sql-result-to-csv-json-exporter": () => import("@/tools/developer/sql-result-to-csv-json-exporter/ui"),
  "sql-to-orm-code-converter": () => import("@/tools/developer/sql-to-orm-code-converter/ui"),
  "test-data-anonymizer": () => import("@/tools/developer/test-data-anonymizer/ui"),
  "test-dummy-file-generator": () => import("@/tools/developer/test-dummy-file-generator/ui"),
  "test-id-generator": () => import("@/tools/developer/test-id-generator/ui"),
  "time-duration-calculator": () => import("@/tools/developer/time-duration-calculator/ui"),
  "time-unit-converter": () => import("@/tools/developer/time-unit-converter/ui"),
  "time-zone-abbreviation-utc-offset-reference": () => import("@/tools/developer/time-zone-abbreviation-utc-offset-reference/ui"),
  "time-zone-converter": () => import("@/tools/developer/time-zone-converter/ui"),
  "unix-timestamp-epoch-converter": () => import("@/tools/developer/unix-timestamp-epoch-converter/ui"),
  "user-agent-string-generator-parser": () => import("@/tools/developer/user-agent-string-generator-parser/ui"),
  "visual-sql-query-builder": () => import("@/tools/developer/visual-sql-query-builder/ui"),
  "week-number-iso-calculator": () => import("@/tools/developer/week-number-iso-calculator/ui"),
  "world-clock-meeting-planner": () => import("@/tools/developer/world-clock-meeting-planner/ui"),  "ansi-escape-code-terminal-color-generator": () => import("@/tools/developer/ansi-escape-code-terminal-color-generator/ui"),
  "bash-prompt-ps1-generator": () => import("@/tools/developer/bash-prompt-ps1-generator/ui"),
  "bashrc-zshrc-alias-config-manager": () => import("@/tools/developer/bashrc-zshrc-alias-config-manager/ui"),
  "bitwise-operation-calculator": () => import("@/tools/developer/bitwise-operation-calculator/ui"),
  "bit-shift-rotate-visualizer": () => import("@/tools/developer/bit-shift-rotate-visualizer/ui"),
  "bit-field-bitmask-flags-designer-decoder": () => import("@/tools/developer/bit-field-bitmask-flags-designer-decoder/ui"),
  "endianness-byte-order-converter": () => import("@/tools/developer/endianness-byte-order-converter/ui"),
  "dotfiles-manager-generator": () => import("@/tools/developer/dotfiles-manager-generator/ui"),
  "find-command-builder": () => import("@/tools/developer/find-command-builder/ui"),
  "glob-pattern-tester": () => import("@/tools/developer/glob-pattern-tester/ui"),
  "grep-ripgrep-command-builder": () => import("@/tools/developer/grep-ripgrep-command-builder/ui"),
  "rsync-command-builder": () => import("@/tools/developer/rsync-command-builder/ui"),
  "tar-archive-command-builder": () => import("@/tools/developer/tar-archive-command-builder/ui"),
  "tmux-config-generator-cheatsheet": () => import("@/tools/developer/tmux-config-generator-cheatsheet/ui"),
  "vim-cheatsheet-keybinding-reference": () => import("@/tools/developer/vim-cheatsheet-keybinding-reference/ui"),
  "ssh-config-generator": () => import("@/tools/developer/ssh-config-generator/ui"),
  "man-page-tldr-command-reference": () => import("@/tools/developer/man-page-tldr-command-reference/ui"),
  "exit-code-signal-reference": () => import("@/tools/developer/exit-code-signal-reference/ui"),
  "twos-complement-signed-integer-calculator": () => import("@/tools/developer/twos-complement-signed-integer-calculator/ui"),
  "crontab-generator": () => import("@/tools/developer/crontab-generator/ui"),
  "markdown-live-editor-previewer": () => import("@/tools/developer/markdown-live-editor-previewer/ui"),
  "markdown-table-generator": () => import("@/tools/developer/markdown-table-generator/ui"),
  "markdown-table-of-contents-generator": () => import("@/tools/developer/markdown-table-of-contents-generator/ui"),
  "readme-generator": () => import("@/tools/developer/readme-generator/ui"),
  "github-badge-shields-io-generator": () => import("@/tools/developer/github-badge-shields-io-generator/ui"),
  "mermaid-diagram-live-editor": () => import("@/tools/developer/mermaid-diagram-live-editor/ui"),
  "plantuml-diagram-editor": () => import("@/tools/developer/plantuml-diagram-editor/ui"),
  "markdown-to-slides-presentation-generator": () => import("@/tools/developer/markdown-to-slides-presentation-generator/ui"),
  "markdown-syntax-cheatsheet-reference": () => import("@/tools/developer/markdown-syntax-cheatsheet-reference/ui"),
  "markdown-linter-formatter": () => import("@/tools/developer/markdown-linter-formatter/ui"),
  "ieee-754-floating-point-converter": () => import("@/tools/developer/ieee-754-floating-point-converter/ui"),
  "fixed-point-q-format-converter": () => import("@/tools/developer/fixed-point-q-format-converter/ui"),
  "big-integer-arbitrary-precision-calculator": () => import("@/tools/developer/big-integer-arbitrary-precision-calculator/ui"),
  "hex-dump-hex-viewer-editor": () => import("@/tools/developer/hex-dump-hex-viewer-editor/ui"),
  "binary-file-signature-magic-number-inspector": () => import("@/tools/developer/binary-file-signature-magic-number-inspector/ui"),
  "ascii-art-text-banner-generator": () => import("@/tools/developer/ascii-art-text-banner-generator/ui"),
  "integer-data-type-range-overflow-reference": () => import("@/tools/developer/integer-data-type-range-overflow-reference/ui"),
  "roman-numeral-converter": () => import("@/tools/developer/roman-numeral-converter/ui"),
  "scientific-engineering-notation-converter": () => import("@/tools/developer/scientific-engineering-notation-converter/ui"),
  "modular-arithmetic-gcd-lcm-calculator": () => import("@/tools/developer/modular-arithmetic-gcd-lcm-calculator/ui"),
  "prime-number-checker-factorization-tool": () => import("@/tools/developer/prime-number-checker-factorization-tool/ui"),
  "ascii-unicode-code-point-explorer": () => import("@/tools/developer/ascii-unicode-code-point-explorer/ui"),
  "checksum-parity-bit-calculator": () => import("@/tools/developer/checksum-parity-bit-calculator/ui"),
  "gray-code-converter": () => import("@/tools/developer/gray-code-converter/ui"),
  "hamming-code-error-correction-calculator": () => import("@/tools/developer/hamming-code-error-correction-calculator/ui"),
  "ipv4-subnet-calculator-cidr-vlsm": () => import("@/tools/developer/ipv4-subnet-calculator-cidr-vlsm/ui"),
  "ipv6-subnet-calculator": () => import("@/tools/developer/ipv6-subnet-calculator/ui"),
  "cidr-ip-range-netmask-converter": () => import("@/tools/developer/cidr-ip-range-netmask-converter/ui"),
  "ip-address-format-converter": () => import("@/tools/developer/ip-address-format-converter/ui"),
  "ipv6-address-expander-compressor-validator": () => import("@/tools/developer/ipv6-address-expander-compressor-validator/ui"),
  "mac-address-vendor-oui-lookup-formatter": () => import("@/tools/developer/mac-address-vendor-oui-lookup-formatter/ui"),
  "dns-record-lookup-reference": () => import("@/tools/developer/dns-record-lookup-reference/ui"),
  "reverse-dns-ptr-lookup-generator": () => import("@/tools/developer/reverse-dns-ptr-lookup-generator/ui"),
  "dns-propagation-checker-reference": () => import("@/tools/developer/dns-propagation-checker-reference/ui"),
  "whois-domain-ip-lookup": () => import("@/tools/developer/whois-domain-ip-lookup/ui"),
  "spf-record-generator-validator": () => import("@/tools/developer/spf-record-generator-validator/ui"),
  "dkim-record-generator-validator": () => import("@/tools/developer/dkim-record-generator-validator/ui"),
  "dmarc-record-generator-validator": () => import("@/tools/developer/dmarc-record-generator-validator/ui"),
  "ssl-tls-certificate-decoder-checker": () => import("@/tools/developer/ssl-tls-certificate-decoder-checker/ui"),
  "well-known-common-ports-reference": () => import("@/tools/developer/well-known-common-ports-reference/ui"),
  "ping-latency-tester-browser": () => import("@/tools/developer/ping-latency-tester-browser/ui"),
  "traceroute-visualizer": () => import("@/tools/developer/traceroute-visualizer/ui"),
  "public-ip-geolocation-lookup": () => import("@/tools/developer/public-ip-geolocation-lookup/ui"),
  "dns-over-https-doh-query-tool": () => import("@/tools/developer/dns-over-https-doh-query-tool/ui"),
  "cidr-aggregator-network-summarizer": () => import("@/tools/developer/cidr-aggregator-network-summarizer/ui"),
  "sorting-algorithm-visualizer": () => import("@/tools/developer/sorting-algorithm-visualizer/ui"),
  "pathfinding-algorithm-visualizer": () => import("@/tools/developer/pathfinding-algorithm-visualizer/ui"),
  "binary-search-tree-bst-visualizer": () => import("@/tools/developer/binary-search-tree-bst-visualizer/ui"),
  "heap-priority-queue-visualizer": () => import("@/tools/developer/heap-priority-queue-visualizer/ui"),
  "trie-prefix-tree-visualizer": () => import("@/tools/developer/trie-prefix-tree-visualizer/ui"),
  "avl-tree-visualizer": () => import("@/tools/developer/avl-tree-visualizer/ui"),
  "red-black-tree-visualizer": () => import("@/tools/developer/red-black-tree-visualizer/ui"),
  "broken-backlink-finder": () => import("@/tools/seo/broken-backlink-finder/ui"),
  "broken-link-checker": () => import("@/tools/seo/broken-link-checker/ui"),
  "core-web-vitals-analyzer": () => import("@/tools/seo/core-web-vitals-analyzer/ui"),
  "gtm-datalayer-helper": () => import("@/tools/seo/gtm-datalayer-helper/ui"),
  "meta-robots-tester": () => import("@/tools/seo/meta-robots-tester/ui"),
  "mobile-friendly-tester": () => import("@/tools/seo/mobile-friendly-tester/ui"),
  "referring-domains-explorer": () => import("@/tools/seo/referring-domains-explorer/ui"),
  "ssl-https-checker": () => import("@/tools/seo/ssl-https-checker/ui"),
  "meta-tag-generator": () => import("@/tools/seo/meta-tag-generator/ui"),
  "seo-slug-generator": () => import("@/tools/seo/seo-slug-generator/ui"),
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
