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
