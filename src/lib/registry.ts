/**
 * Central tool registry — explicit imports (Next.js-compatible, no Vite glob).
 *
 * Adding a new tool: drop a folder under src/tools/<cat>/<id>/ with a manifest.ts,
 * then add an import + TOOLS.push line below. Routing, search, and the homepage
 * grid pick it up automatically.
 */
import type { ToolCategory, ToolManifest } from "./tool";

import { manifest as emiCalculator } from "@/tools/calculators/emi-calculator/manifest";
import { manifest as mortgageCalculator } from "@/tools/calculators/mortgage-calculator/manifest";
import { manifest as sipCalculator } from "@/tools/calculators/sip-calculator/manifest";
import { manifest as base64 } from "@/tools/developer/base64/manifest";
import { manifest as hashGenerator } from "@/tools/developer/hash-generator/manifest";
import { manifest as jsonFormatter } from "@/tools/developer/json-formatter/manifest";
import { manifest as urlEncoder } from "@/tools/developer/url-encoder/manifest";
import { manifest as uuidGenerator } from "@/tools/developer/uuid-generator/manifest";
import { manifest as colorPicker } from "@/tools/image/color-picker/manifest";
import { manifest as imageCompressor } from "@/tools/image/image-compressor/manifest";
import { manifest as bcryptHashGenerator } from "@/tools/network-security/bcrypt-hash-generator/manifest";
import { manifest as cspEvaluator } from "@/tools/network-security/csp-evaluator/manifest";
import { manifest as dataUrlConverter } from "@/tools/network-security/data-url-converter/manifest";
import { manifest as fileHashChecker } from "@/tools/file/file-hash-checker/manifest";
import { manifest as fileMetadataViewer } from "@/tools/file/file-metadata-viewer/manifest";
import { manifest as httpStatusCodeReference } from "@/tools/network-security/http-status-code-reference/manifest";
import { manifest as ipSubnetCalculator } from "@/tools/network-security/ip-subnet-calculator/manifest";
import { manifest as jwtDecoder } from "@/tools/network-security/jwt-decoder/manifest";
import { manifest as mimeTypeLookup } from "@/tools/network-security/mime-type-lookup/manifest";
import { manifest as passwordGenerator } from "@/tools/network-security/password-generator/manifest";
import { manifest as totpGenerator } from "@/tools/network-security/totp-generator/manifest";
import { manifest as urlParser } from "@/tools/network-security/url-parser/manifest";
import { manifest as compressPdf } from "@/tools/pdf/compress-pdf/manifest";
import { manifest as contactSheetPdf } from "@/tools/pdf/pdf-contact-sheet/manifest";
import { manifest as cropPdf } from "@/tools/pdf/crop-pdf/manifest";
import { manifest as csvFileJoiner } from "@/tools/file/csv-file-joiner/manifest";
import { manifest as csvFileSplitter } from "@/tools/file/csv-file-splitter/manifest";
import { manifest as csvToTsvConverter } from "@/tools/file/csv-to-tsv-converter/manifest";
import { manifest as deletePdfPages } from "@/tools/pdf/delete-pdf-pages/manifest";
import { manifest as duplicatePdfPages } from "@/tools/pdf/duplicate-pdf-pages/manifest";
import { manifest as duplicateFileFinder } from "@/tools/file/duplicate-file-finder/manifest";
import { manifest as extractPdfPages } from "@/tools/pdf/extract-pdf-pages/manifest";
import { manifest as fileRenameUtility } from "@/tools/file/file-rename-utility/manifest";
import { manifest as flattenPdf } from "@/tools/pdf/flatten-pdf/manifest";
import { manifest as htmlToPdf } from "@/tools/pdf/html-to-pdf/manifest";
import { manifest as imagesToPdf } from "@/tools/pdf/images-to-pdf/manifest";
import { manifest as insertPdfPages } from "@/tools/pdf/insert-pdf-pages/manifest";
import { manifest as interleavePdf } from "@/tools/pdf/interleave-pdf/manifest";
import { manifest as jsonToXmlConverter } from "@/tools/file/json-to-xml-converter/manifest";
import { manifest as markdownToPdf } from "@/tools/pdf/markdown-to-pdf/manifest";
import { manifest as mergePdf } from "@/tools/pdf/merge-pdf/manifest";
import { manifest as nUpPdf } from "@/tools/pdf/n-up-pdf/manifest";
import { manifest as pdfBookmarksEditor } from "@/tools/pdf/pdf-bookmarks-editor/manifest";
import { manifest as pdfMetadataEditor } from "@/tools/pdf/pdf-metadata-editor/manifest";
import { manifest as pdfPageNumbers } from "@/tools/pdf/pdf-page-numbers/manifest";
import { manifest as pdfSignDraw } from "@/tools/pdf/pdf-sign-draw/manifest";
import { manifest as pdfStamp } from "@/tools/pdf/pdf-stamp/manifest";
import { manifest as pdfWatermark } from "@/tools/pdf/pdf-watermark/manifest";
import { manifest as removeBlankPages } from "@/tools/pdf/remove-blank-pages/manifest";
import { manifest as reorderPdfPages } from "@/tools/pdf/reorder-pdf-pages/manifest";
import { manifest as resizePdfPages } from "@/tools/pdf/resize-pdf-pages/manifest";
import { manifest as rtfToPdf } from "@/tools/pdf/rtf-to-pdf/manifest";
import { manifest as reversePdf } from "@/tools/pdf/reverse-pdf/manifest";
import { manifest as rotatePdf } from "@/tools/pdf/rotate-pdf/manifest";
import { manifest as scalePdf } from "@/tools/pdf/scale-pdf/manifest";
import { manifest as splitPdf } from "@/tools/pdf/split-pdf/manifest";
import { manifest as svgToPdf } from "@/tools/pdf/svg-to-pdf/manifest";
import { manifest as textFileJoiner } from "@/tools/file/text-file-joiner/manifest";
import { manifest as textToPdf } from "@/tools/pdf/text-to-pdf/manifest";
import { manifest as tsvToCsvConverter } from "@/tools/file/tsv-to-csv-converter/manifest";
import { manifest as addLineBreaks } from "@/tools/text/add-line-breaks/manifest";
import { manifest as addPrefixSuffix } from "@/tools/text/add-prefix-suffix/manifest";
import { manifest as bigTextGenerator } from "@/tools/text/big-text-generator/manifest";
import { manifest as boldTextGenerator } from "@/tools/text/bold-text-generator/manifest";
import { manifest as bubbleTextGenerator } from "@/tools/text/bubble-text-generator/manifest";
import { manifest as caesarCipher } from "@/tools/text/caesar-cipher/manifest";
import { manifest as caseConverter } from "@/tools/text/case-converter/manifest";
import { manifest as csvToMarkdown } from "@/tools/text/csv-to-markdown/manifest";
import { manifest as csvToTextList } from "@/tools/text/csv-to-text-list/manifest";
import { manifest as diffChecker } from "@/tools/text/diff-checker/manifest";
import { manifest as duplicateLinesRemover } from "@/tools/text/duplicate-lines-remover/manifest";
import { manifest as wordCharacterCounter } from "@/tools/text/word-character-counter/manifest";
import { manifest as base64FileDecoder } from "@/tools/file/base64-file-decoder/manifest";
import { manifest as base64FileEncoder } from "@/tools/file/base64-file-encoder/manifest";
import { manifest as binaryFileViewer } from "@/tools/file/binary-file-viewer/manifest";
import { manifest as emptyFileCreator } from "@/tools/file/empty-file-creator/manifest";
import { manifest as fileExtensionChanger } from "@/tools/file/file-extension-changer/manifest";
import { manifest as hexViewer } from "@/tools/file/hex-viewer/manifest";
import { manifest as largeFileGenerator } from "@/tools/file/large-file-generator/manifest";
import { manifest as onlineFileMerger } from "@/tools/file/online-file-merger/manifest";
import { manifest as onlineFileSplitter } from "@/tools/file/online-file-splitter/manifest";
import { manifest as xmlToJsonConverter } from "@/tools/file/xml-to-json-converter/manifest";
import { manifest as cbzComicBookReader } from "@/tools/file/cbz-comic-book-reader/manifest";
import { manifest as csvToExcelConverter } from "@/tools/file/csv-to-excel-converter/manifest";
import { manifest as epubReader } from "@/tools/file/epub-reader/manifest";
import { manifest as excelToCsvConverter } from "@/tools/file/excel-to-csv-converter/manifest";
import { manifest as fileMetadataStripper } from "@/tools/file/file-metadata-stripper/manifest";
import { manifest as gzipCompressor } from "@/tools/file/gzip-compressor/manifest";
import { manifest as gzipDecompressor } from "@/tools/file/gzip-decompressor/manifest";
import { manifest as jsonToExcelConverter } from "@/tools/file/json-to-excel-converter/manifest";
import { manifest as localFileIntegrityAuditor } from "@/tools/file/local-file-integrity-auditor/manifest";
import { manifest as tarExtractor } from "@/tools/file/tar-extractor/manifest";
import { manifest as apkExtractor } from "@/tools/file/apk-extractor/manifest";
import { manifest as chmExtractor } from "@/tools/file/chm-extractor/manifest";
import { manifest as excelToJsonConverter } from "@/tools/file/excel-to-json-converter/manifest";
import { manifest as fb2Reader } from "@/tools/file/fb2-reader/manifest";
import { manifest as isoExtractor } from "@/tools/file/iso-extractor/manifest";
import { manifest as jarExtractor } from "@/tools/file/jar-extractor/manifest";
import { manifest as lzhExtractor } from "@/tools/file/lzh-extractor/manifest";
import { manifest as mobiReader } from "@/tools/file/mobi-reader/manifest";
import { manifest as onlineZipCompressor } from "@/tools/file/online-zip-compressor/manifest";
import { manifest as onlineZipExtractor } from "@/tools/file/online-zip-extractor/manifest";
import { manifest as debExtractor } from "@/tools/file/deb-extractor/manifest";
import { manifest as cabFileExtractor } from "@/tools/file/cab-file-extractor/manifest";
import { manifest as odtToPdfConverter } from "@/tools/file/odt-to-pdf-converter/manifest";
import { manifest as odsToPdfConverter } from "@/tools/file/ods-to-pdf-converter/manifest";
import { manifest as odpToPdfConverter } from "@/tools/file/odp-to-pdf-converter/manifest";
import { manifest as pdfToHtmlConverter } from "@/tools/file/pdf-to-html-converter/manifest";
import { manifest as pdfToTextConverter } from "@/tools/file/pdf-to-text-converter/manifest";
import { manifest as pdfToWordConverter } from "@/tools/file/pdf-to-word-converter/manifest";
import { manifest as pdfToExcelConverter } from "@/tools/file/pdf-to-excel-converter/manifest";
import { manifest as pdfToRtfConverter } from "@/tools/file/pdf-to-rtf-converter/manifest";
import { manifest as pdfToImageConverter } from "@/tools/file/pdf-to-image-converter/manifest";
import { manifest as pdfToEpubConverter } from "@/tools/file/pdf-to-epub-converter/manifest";
import { manifest as pdfToPowerpointConverter } from "@/tools/file/pdf-to-powerpoint-converter/manifest";
import { manifest as pdfToOdtConverter } from "@/tools/file/pdf-to-odt-converter/manifest";
import { manifest as pdfToOdsConverter } from "@/tools/file/pdf-to-ods-converter/manifest";
import { manifest as pdfToOdpConverter } from "@/tools/file/pdf-to-odp-converter/manifest";
import { manifest as pdfToPostScriptConverter } from "@/tools/file/pdf-to-postscript-converter/manifest";
import { manifest as pdfToMobiConverter } from "@/tools/file/pdf-to-mobi-converter/manifest";
import { manifest as pdfToAzw3Converter } from "@/tools/file/pdf-to-azw3-converter/manifest";
import { manifest as pdfToDjvuConverter } from "@/tools/file/pdf-to-djvu-converter/manifest";
import { manifest as dmgExtractor } from "@/tools/file/dmg-extractor/manifest";
import { manifest as keynoteToPdfConverter } from "@/tools/file/keynote-to-pdf-converter/manifest";
import { manifest as numbersToPdfConverter } from "@/tools/file/numbers-to-pdf-converter/manifest";
import { manifest as pagesToPdfConverter } from "@/tools/file/pages-to-pdf-converter/manifest";
import { manifest as epubToMobiConverter } from "@/tools/file/epub-to-mobi-converter/manifest";
import { manifest as epubToAzw3Converter } from "@/tools/file/epub-to-azw3-converter/manifest";
import { manifest as mobiToEpubConverter } from "@/tools/file/mobi-to-epub-converter/manifest";
import { manifest as litToPdfConverter } from "@/tools/file/lit-to-pdf-converter/manifest";
import { manifest as lrfToPdfConverter } from "@/tools/file/lrf-to-pdf-converter/manifest";
import { manifest as extractor7z } from "@/tools/file/7z-extractor/manifest";
import { manifest as arjExtractor } from "@/tools/file/arj-extractor/manifest";
import { manifest as bzip2Compressor } from "@/tools/file/bzip2-compressor/manifest";
import { manifest as bzip2Decompressor } from "@/tools/file/bzip2-decompressor/manifest";
import { manifest as cbrComicBookReader } from "@/tools/file/cbr-comic-book-reader/manifest";
import { manifest as litToEpubConverter } from "@/tools/file/lit-to-epub-converter/manifest";
import { manifest as lrfToEpubConverter } from "@/tools/file/lrf-to-epub-converter/manifest";
import { manifest as pdfPasswordEncryptor } from "@/tools/file/pdf-password-encryptor/manifest";
import { manifest as pdfSecurityRemover } from "@/tools/file/pdf-security-remover/manifest";
import { manifest as postscriptToPdfConverter } from "@/tools/file/postscript-to-pdf-converter/manifest";
import { manifest as prcToEpubConverter } from "@/tools/file/prc-to-epub-converter/manifest";
import { manifest as rarExtractor } from "@/tools/file/rar-extractor/manifest";
import { manifest as rpmExtractor } from "@/tools/file/rpm-extractor/manifest";
import { manifest as tcrToEpubConverter } from "@/tools/file/tcr-to-epub-converter/manifest";
import { manifest as wimExtractor } from "@/tools/file/wim-extractor/manifest";
import { manifest as xarExtractor } from "@/tools/file/xar-extractor/manifest";
import { manifest as zCompressor } from "@/tools/file/z-compressor/manifest";
import { manifest as canonicalTagGenerator } from "@/tools/seo/canonical-tag-generator/manifest";
import { manifest as faqSchemaGenerator } from "@/tools/seo/faq-schema-generator/manifest";
import { manifest as hreflangTagGenerator } from "@/tools/seo/hreflang-tag-generator/manifest";
import { manifest as metaTagGenerator } from "@/tools/seo/meta-tag-generator/manifest";
import { manifest as openGraphGenerator } from "@/tools/seo/open-graph-generator/manifest";
import { manifest as robotsTxtGenerator } from "@/tools/seo/robots-txt-generator/manifest";
import { manifest as schemaJsonldGenerator } from "@/tools/seo/schema-jsonld-generator/manifest";
import { manifest as serpSnippetPreview } from "@/tools/seo/serp-snippet-preview/manifest";
import { manifest as utmUrlBuilder } from "@/tools/seo/utm-url-builder/manifest";
import { manifest as xmlSitemapGenerator } from "@/tools/seo/xml-sitemap-generator/manifest";
import { manifest as breadcrumbSchemaGenerator } from "@/tools/seo/breadcrumb-schema-generator/manifest";
import { manifest as howToSchemaGenerator } from "@/tools/seo/how-to-schema-generator/manifest";
import { manifest as contentReadabilityAnalyzer } from "@/tools/seo/content-readability-analyzer/manifest";
import { manifest as contentWordCount } from "@/tools/seo/content-word-count/manifest";
import { manifest as headingStructureAnalyzer } from "@/tools/seo/heading-structure-analyzer/manifest";
import { manifest as contentOutlineGenerator } from "@/tools/seo/content-outline-generator/manifest";
import { manifest as contentBriefGenerator } from "@/tools/seo/content-brief-generator/manifest";
import { manifest as keywordDensityAnalyzer } from "@/tools/seo/keyword-density-analyzer/manifest";
import { manifest as contentGapAnalyzer } from "@/tools/seo/content-gap-analyzer/manifest";
import { manifest as redirectChainChecker } from "@/tools/seo/redirect-chain-checker/manifest";
import { manifest as disavowFileGenerator } from "@/tools/seo/disavow-file-generator/manifest";
import { manifest as keywordMatchTypeBuilder } from "@/tools/seo/keyword-match-type-builder/manifest";
import { manifest as outreachEmailTemplate } from "@/tools/seo/outreach-email-template/manifest";
import { manifest as htmlToTextRatioChecker } from "@/tools/seo/html-to-text-ratio-checker/manifest";
import { manifest as imageSeoAltTextAuditor } from "@/tools/seo/image-seo-alt-text-auditor/manifest";
import { manifest as anchorTextDistributionAnalyzer } from "@/tools/seo/anchor-text-distribution-analyzer/manifest";
import { manifest as napCitationConsistencyChecker } from "@/tools/seo/nap-citation-consistency-checker/manifest";
import { manifest as googleAnalytics4EventBuilder } from "@/tools/seo/google-analytics-4-event-builder/manifest";
import { manifest as conversionTrackingTagGenerator } from "@/tools/seo/conversion-tracking-tag-generator/manifest";
import { manifest as responsiveSearchAdBuilder } from "@/tools/seo/responsive-search-ad-builder/manifest";
import { manifest as seoSlugGenerator } from "@/tools/seo/seo-slug-generator/manifest";
import { manifest as metaDescriptionGenerator } from "@/tools/seo/meta-description-generator/manifest";
import { manifest as titleTagOptimizer } from "@/tools/seo/title-tag-optimizer/manifest";
import { manifest as internalLinkingSuggester } from "@/tools/seo/internal-linking-suggester/manifest";
import { manifest as keywordCannibalizationDetector } from "@/tools/seo/keyword-cannibalization-detector/manifest";
import { manifest as longTailKeywordGenerator } from "@/tools/seo/long-tail-keyword-generator/manifest";
import { manifest as keywordGroupingTool } from "@/tools/seo/keyword-grouping-tool/manifest";
import { manifest as peopleAlsoAskExtractor } from "@/tools/seo/people-also-ask-extractor/manifest";
import { manifest as redirectHtaccessGenerator } from "@/tools/seo/redirect-htaccess-generator/manifest";
import { manifest as seoContentScorecard } from "@/tools/seo/seo-content-scorecard/manifest";
import { manifest as keywordResearchExplorer } from "@/tools/seo/keyword-research-explorer/manifest";
import { manifest as keywordDifficultyEstimator } from "@/tools/seo/keyword-difficulty-estimator/manifest";
import { manifest as searchIntentClassifier } from "@/tools/seo/search-intent-classifier/manifest";
import { manifest as tfIdfContentOptimizer } from "@/tools/seo/tf-idf-content-optimizer/manifest";
import { manifest as serpCompetitorAnalysis } from "@/tools/seo/serp-competitor-analysis/manifest";
import { manifest as localBusinessSchemaGenerator } from "@/tools/seo/local-business-schema-generator/manifest";
import { manifest as openGraphImageGenerator } from "@/tools/seo/open-graph-image-generator/manifest";
import { manifest as titleMetaPixelChecker } from "@/tools/seo/title-meta-pixel-checker/manifest";
import { manifest as structuredDataValidator } from "@/tools/seo/structured-data-validator/manifest";
import { manifest as backlinkProfileAnalyzer } from "@/tools/seo/backlink-profile-analyzer/manifest";
import { manifest as keywordRankTracker } from "@/tools/seo/keyword-rank-tracker/manifest";
import { manifest as serpPositionChecker } from "@/tools/seo/serp-position-checker/manifest";
import { manifest as rankChangeVisualizer } from "@/tools/seo/rank-change-visualizer/manifest";
import { manifest as shareOfVoiceCalculator } from "@/tools/seo/share-of-voice-calculator/manifest";
import { manifest as competitorRankComparison } from "@/tools/seo/competitor-rank-comparison/manifest";
import { manifest as backlinkQualityScorer } from "@/tools/seo/backlink-quality-scorer/manifest";
import { manifest as lostNewBacklinkTracker } from "@/tools/seo/lost-new-backlink-tracker/manifest";
import { manifest as backlinkGapAnalyzer } from "@/tools/seo/backlink-gap-analyzer/manifest";
import { manifest as linkProspectingBuilder } from "@/tools/seo/link-prospecting-builder/manifest";
import { manifest as guestPostFinder } from "@/tools/seo/guest-post-finder/manifest";
import { manifest as contentPruningAuditor } from "@/tools/seo/content-pruning-auditor/manifest";
import { manifest as orphanPageDetector } from "@/tools/seo/orphan-page-detector/manifest";
import { manifest as crawlBudgetEstimator } from "@/tools/seo/crawl-budget-estimator/manifest";
import { manifest as paginationSeoChecker } from "@/tools/seo/pagination-seo-checker/manifest";
import { manifest as facetedNavSeoAnalyzer } from "@/tools/seo/faceted-nav-seo-analyzer/manifest";
import { manifest as javascriptSeoRenderTester } from "@/tools/seo/javascript-seo-render-tester/manifest";
import { manifest as logFileAnalyzer } from "@/tools/seo/log-file-analyzer/manifest";
import { manifest as indexCoverageReporter } from "@/tools/seo/index-coverage-reporter/manifest";
import { manifest as pageExperienceSignalChecker } from "@/tools/seo/page-experience-signal-checker/manifest";
import { manifest as ecommerceProductSeoOptimizer } from "@/tools/seo/e-commerce-product-seo-optimizer/manifest";
import { manifest as localRankTracker } from "@/tools/seo/local-rank-tracker/manifest";
import { manifest as googleBusinessProfileOptimizer } from "@/tools/seo/google-business-profile-optimizer/manifest";
import { manifest as citationFinder } from "@/tools/seo/citation-finder/manifest";
import { manifest as reviewSentimentAnalyzer } from "@/tools/seo/review-sentiment-analyzer/manifest";
import { manifest as youtubeVideoSeoOptimizer } from "@/tools/seo/youtube-video-seo-optimizer/manifest";
import { manifest as videoSchemaGenerator } from "@/tools/seo/video-schema-generator/manifest";
import { manifest as contentCalendarPlanner } from "@/tools/seo/content-calendar-planner/manifest";
import { manifest as topicClusterBuilder } from "@/tools/seo/topic-cluster-builder/manifest";
import { manifest as contentDistributionPlanner } from "@/tools/seo/content-distribution-planner/manifest";
import { manifest as brandMentionMonitor } from "@/tools/seo/brand-mention-monitor/manifest";
import { manifest as internationalSeoPlanner } from "@/tools/seo/international-seo-planner/manifest";
import { manifest as localeKeywordResearcher } from "@/tools/seo/locale-keyword-researcher/manifest";
import { manifest as affiliateLinkCloaker } from "@/tools/seo/affiliate-link-cloaker/manifest";
import { manifest as affiliateCommissionCalculator } from "@/tools/seo/affiliate-commission-calculator/manifest";
import { manifest as productReviewSchemaGenerator } from "@/tools/seo/product-review-schema-generator/manifest";
import { manifest as seoReportGenerator } from "@/tools/seo/seo-report-generator/manifest";
import { manifest as seoKpiDashboardBuilder } from "@/tools/seo/seo-kpi-dashboard-builder/manifest";
import { manifest as competitorWebsiteAnalyzer } from "@/tools/seo/competitor-website-analyzer/manifest";
import { manifest as seoExperimentTracker } from "@/tools/seo/experiment-tracker/manifest";
import { manifest as searchConsoleDataAnalyzer } from "@/tools/seo/search-console-data-analyzer/manifest";
import { manifest as audioRecorder } from "@/tools/audio-video/audio-recorder/manifest";
import { manifest as audioTrimmer } from "@/tools/audio-video/audio-trimmer/manifest";
import { manifest as audioConverter } from "@/tools/audio-video/audio-converter/manifest";
import { manifest as audioVolumeNormalizer } from "@/tools/audio-video/audio-volume-normalizer/manifest";
import { manifest as audioSpeedChanger } from "@/tools/audio-video/audio-speed-changer/manifest";
import { manifest as audioReverser } from "@/tools/audio-video/audio-reverser/manifest";
import { manifest as audioMerger } from "@/tools/audio-video/audio-merger/manifest";
import { manifest as audioSplitter } from "@/tools/audio-video/audio-splitter/manifest";
import { manifest as audioFadeGenerator } from "@/tools/audio-video/audio-fade-generator/manifest";
import { manifest as audioMetadataEditor } from "@/tools/audio-video/audio-metadata-editor/manifest";
import { manifest as audioSpectrumAnalyzer } from "@/tools/audio-video/audio-spectrum-analyzer/manifest";
import { manifest as audioWaveformViewer } from "@/tools/audio-video/audio-waveform-viewer/manifest";
import { manifest as audioNoiseReducer } from "@/tools/audio-video/audio-noise-reducer/manifest";
import { manifest as audioEqualizer } from "@/tools/audio-video/audio-equalizer/manifest";
import { manifest as videoTrimmer } from "@/tools/audio-video/video-trimmer/manifest";
import { manifest as videoCompressor } from "@/tools/audio-video/video-compressor/manifest";
import { manifest as videoMetadataViewer } from "@/tools/audio-video/video-metadata-viewer/manifest";
import { manifest as videoFrameExtractor } from "@/tools/audio-video/video-frame-extractor/manifest";
import { manifest as audioFormatDetector } from "@/tools/audio-video/audio-format-detector/manifest";
import { manifest as audioBitrateCalculator } from "@/tools/audio-video/audio-bitrate-calculator/manifest";
import { manifest as invoiceGenerator } from "@/tools/business/invoice-generator/manifest";
import { manifest as quoteGenerator } from "@/tools/business/quote-generator/manifest";
import { manifest as receiptMaker } from "@/tools/business/receipt-maker/manifest";
import { manifest as taxCalculator } from "@/tools/business/tax-calculator/manifest";
import { manifest as payrollCalculator } from "@/tools/business/payroll-calculator/manifest";
import { manifest as timeTracker } from "@/tools/business/time-tracker/manifest";
import { manifest as timesheetGenerator } from "@/tools/business/timesheet-generator/manifest";
import { manifest as pomodoroTimer } from "@/tools/business/pomodoro-timer/manifest";
import { manifest as workHoursCalculator } from "@/tools/business/work-hours-calculator/manifest";
import { manifest as expenseTracker } from "@/tools/business/expense-tracker/manifest";
import { manifest as budgetPlanner } from "@/tools/business/budget-planner/manifest";
import { manifest as roiCalculator } from "@/tools/business/roi-calculator/manifest";
import { manifest as breakEvenCalculator } from "@/tools/business/break-even-calculator/manifest";
import { manifest as loanAmortizationSchedule } from "@/tools/business/loan-amortization-schedule/manifest";
import { manifest as projectTaskTracker } from "@/tools/business/project-task-tracker/manifest";
import { manifest as ganttChartMaker } from "@/tools/business/gantt-chart-maker/manifest";
import { manifest as meetingAgendaMaker } from "@/tools/business/meeting-agenda-maker/manifest";
import { manifest as decisionMatrixBuilder } from "@/tools/business/decision-matrix-builder/manifest";
import { manifest as contractTemplateGenerator } from "@/tools/business/contract-template-generator/manifest";
import { manifest as emailTemplateManager } from "@/tools/business/email-template-manager/manifest";
import { manifest as meetingNotesMaker } from "@/tools/business/meeting-notes-maker/manifest";
import { manifest as sopGenerator } from "@/tools/business/sop-generator/manifest";
import { manifest as salesPipelineTracker } from "@/tools/business/sales-pipeline-tracker/manifest";
import { manifest as customerTracker } from "@/tools/business/customer-tracker/manifest";
import { manifest as commissionTracker } from "@/tools/business/commission-tracker/manifest";
import { manifest as flashcardMaker } from "@/tools/education/flashcard-maker/manifest";
import { manifest as quizGenerator } from "@/tools/education/quiz-generator/manifest";
import { manifest as studyPlanner } from "@/tools/education/study-planner/manifest";
import { manifest as gradeCalculator } from "@/tools/education/grade-calculator/manifest";
import { manifest as vocabularyBuilder } from "@/tools/education/vocabulary-builder/manifest";
import { manifest as typingPractice } from "@/tools/education/typing-practice/manifest";
import { manifest as multiplicationTablesGenerator } from "@/tools/education/multiplication-tables-generator/manifest";
import { manifest as unitConverterEducational } from "@/tools/education/unit-converter-educational/manifest";
import { manifest as periodicTableReference } from "@/tools/education/periodic-table-reference/manifest";
import { manifest as mathPracticeGenerator } from "@/tools/education/math-practice-generator/manifest";
import { manifest as spellingBeePractice } from "@/tools/education/spelling-bee-practice/manifest";
import { manifest as languageTranslatorHelper } from "@/tools/education/language-translator-helper/manifest";
import { manifest as historyTimelineMaker } from "@/tools/education/history-timeline-maker/manifest";
import { manifest as geographyQuiz } from "@/tools/education/geography-quiz/manifest";
import { manifest as citationGenerator } from "@/tools/education/citation-generator/manifest";
import { manifest as readingListTracker } from "@/tools/education/reading-list-tracker/manifest";
import { manifest as chemistryFormulaCalculator } from "@/tools/education/chemistry-formula-calculator/manifest";
import { manifest as physicsFormulaReference } from "@/tools/education/physics-formula-reference/manifest";
import { manifest as studyNotesOrganizer } from "@/tools/education/study-notes-organizer/manifest";
import { manifest as presentationSlideOutliner } from "@/tools/education/presentation-slide-outliner/manifest";
import { manifest as socialMediaPostGenerator } from "@/tools/social/social-media-post-generator/manifest";
import { manifest as hashtagGenerator } from "@/tools/social/hashtag-generator/manifest";
import { manifest as captionGenerator } from "@/tools/social/caption-generator/manifest";
import { manifest as socialMediaBioGenerator } from "@/tools/social/social-media-bio-generator/manifest";
import { manifest as emojiPickerKeyboard } from "@/tools/social/emoji-picker-keyboard/manifest";
import { manifest as socialMediaImageResizer } from "@/tools/social/social-media-image-resizer/manifest";
import { manifest as tweetThreadPlanner } from "@/tools/social/tweet-thread-planner/manifest";
import { manifest as instagramStoryPlanner } from "@/tools/social/instagram-story-planner/manifest";
import { manifest as linkedinPostFormatter } from "@/tools/social/linkedin-post-formatter/manifest";
import { manifest as youtubeThumbnailTextOverlay } from "@/tools/social/youtube-thumbnail-text-overlay/manifest";
import { manifest as contentCalendarScheduler } from "@/tools/social/content-calendar-scheduler/manifest";
import { manifest as socialMediaCharacterCounter } from "@/tools/social/social-media-character-counter/manifest";
import { manifest as tiktokVideoDescriptionGenerator } from "@/tools/social/tiktok-video-description-generator/manifest";
import { manifest as pinterestPinDescriptionGenerator } from "@/tools/social/pinterest-pin-description-generator/manifest";
import { manifest as socialMediaEngagementTracker } from "@/tools/social/social-media-engagement-tracker/manifest";
import { manifest as socialMediaMentionTracker } from "@/tools/social/social-media-mention-tracker/manifest";
import { manifest as socialMediaHashtagAnalyzer } from "@/tools/social/social-media-hashtag-analyzer/manifest";
import { manifest as socialMediaTrendDetector } from "@/tools/social/social-media-trend-detector/manifest";
import { manifest as socialMediaContestPlanner } from "@/tools/social/social-media-contest-planner/manifest";
import { manifest as socialMediaCollabFinder } from "@/tools/social/social-media-collab-finder/manifest";
import { manifest as socialMediaAnalyticsDashboard } from "@/tools/social/social-media-analytics-dashboard/manifest";
import { manifest as socialMediaContentRepurposer } from "@/tools/social/social-media-content-repurposer/manifest";
import { manifest as socialMediaCommentResponder } from "@/tools/social/social-media-comment-responder/manifest";
import { manifest as socialMediaEmojiTranslator } from "@/tools/social/social-media-emoji-translator/manifest";
import { manifest as socialMediaPollGenerator } from "@/tools/social/social-media-poll-generator/manifest";
import { manifest as pdfOcrTextExtractor } from "@/tools/pdf/pdf-ocr-text-extractor/manifest";
import { manifest as pdfWordConverterV2 } from "@/tools/pdf/pdf-to-word-converter/manifest";
import { manifest as pdfExcelConverterV2 } from "@/tools/pdf/pdf-to-excel-converter/manifest";
import { manifest as pdfFormFiller } from "@/tools/pdf/pdf-form-filler/manifest";
import { manifest as pdfRedactionTool } from "@/tools/pdf/pdf-redaction-tool/manifest";
import { manifest as pdfCompare } from "@/tools/pdf/pdf-compare/manifest";
import { manifest as pdfBookletMaker } from "@/tools/pdf/pdf-booklet-maker/manifest";
import { manifest as pdfImposition } from "@/tools/pdf/pdf-imposition/manifest";
import { manifest as pdfColorSeparation } from "@/tools/pdf/pdf-color-separation/manifest";
import { manifest as pdfGrayscaleConverter } from "@/tools/pdf/pdf-grayscale-converter/manifest";
import { manifest as pdfBleedAdder } from "@/tools/pdf/pdf-bleed-adder/manifest";
import { manifest as pdfCropMarks } from "@/tools/pdf/pdf-crop-marks/manifest";
import { manifest as pdfInkCoverageAnalyzer } from "@/tools/pdf/pdf-ink-coverage-analyzer/manifest";
import { manifest as pdfFontExtractor } from "@/tools/pdf/pdf-font-extractor/manifest";
import { manifest as pdfFontSubsetter } from "@/tools/pdf/pdf-font-subsetter/manifest";
import { manifest as pdfAccessibilityChecker } from "@/tools/pdf/pdf-accessibility-checker/manifest";
import { manifest as pdfAltTextGenerator } from "@/tools/pdf/pdf-alt-text-generator/manifest";
import { manifest as pdfTagTreeViewer } from "@/tools/pdf/pdf-tag-tree-viewer/manifest";
import { manifest as pdfThumbnailGenerator } from "@/tools/pdf/pdf-thumbnail-generator/manifest";
import { manifest as pdfZipBundler } from "@/tools/pdf/pdf-zip-bundler/manifest";
import { manifest as pdfSizeOptimizer } from "@/tools/pdf/pdf-size-optimizer/manifest";
import { manifest as pdfVersionConverter } from "@/tools/pdf/pdf-version-converter/manifest";
import { manifest as pdfQrCodeStamper } from "@/tools/pdf/pdf-qr-code-stamper/manifest";
import { manifest as pdfBarcodeStamper } from "@/tools/pdf/pdf-barcode-stamper/manifest";
import { manifest as pdfHeaderFooterAdder } from "@/tools/pdf/pdf-header-footer-adder/manifest";
import { manifest as pdfBookmarkFromHeadings } from "@/tools/pdf/pdf-bookmark-from-headings/manifest";
import { manifest as pdfTranslationOverlay } from "@/tools/pdf/pdf-translation-overlay/manifest";
import { manifest as pdfTableExtractor } from "@/tools/pdf/pdf-table-extractor/manifest";
import { manifest as pdfFormFieldExtractor } from "@/tools/pdf/pdf-form-field-extractor/manifest";
import { manifest as pdfPowerpointConverterV2 } from "@/tools/pdf/pdf-to-powerpoint-converter/manifest";

export const TOOLS: readonly ToolManifest[] = [
  emiCalculator,
  mortgageCalculator,
  sipCalculator,
  base64,
  hashGenerator,
  jsonFormatter,
  urlEncoder,
  uuidGenerator,
  colorPicker,
  imageCompressor,
  bcryptHashGenerator,
  cspEvaluator,
  dataUrlConverter,
  httpStatusCodeReference,
  ipSubnetCalculator,
  jwtDecoder,
  mimeTypeLookup,
  passwordGenerator,
  totpGenerator,
  urlParser,
  csvFileJoiner,
  csvFileSplitter,
  csvToTsvConverter,
  fileHashChecker,
  fileMetadataViewer,
  fileRenameUtility,
  jsonToXmlConverter,
  textFileJoiner,
  tsvToCsvConverter,
  duplicateFileFinder,
  compressPdf,
  contactSheetPdf,
  cropPdf,
  deletePdfPages,
  duplicatePdfPages,
  extractPdfPages,
  flattenPdf,
  htmlToPdf,
  imagesToPdf,
  insertPdfPages,
  interleavePdf,
  markdownToPdf,
  mergePdf,
  nUpPdf,
  pdfBookmarksEditor,
  pdfMetadataEditor,
  pdfPageNumbers,
  pdfSignDraw,
  pdfStamp,
  pdfWatermark,
  removeBlankPages,
  reorderPdfPages,
  resizePdfPages,
  rtfToPdf,
  reversePdf,
  rotatePdf,
  scalePdf,
  splitPdf,
  svgToPdf,
  textToPdf,
  addLineBreaks,
  addPrefixSuffix,
  bigTextGenerator,
  boldTextGenerator,
  bubbleTextGenerator,
  caesarCipher,
  caseConverter,
  csvToMarkdown,
  csvToTextList,
  diffChecker,
  duplicateLinesRemover,
  wordCharacterCounter,
  base64FileDecoder,
  base64FileEncoder,
  binaryFileViewer,
  emptyFileCreator,
  fileExtensionChanger,
  hexViewer,
  largeFileGenerator,
  onlineFileMerger,
  onlineFileSplitter,
  xmlToJsonConverter,
  cbzComicBookReader,
  csvToExcelConverter,
  epubReader,
  excelToCsvConverter,
  fileMetadataStripper,
  gzipCompressor,
  gzipDecompressor,
  jsonToExcelConverter,
  localFileIntegrityAuditor,
  tarExtractor,
  apkExtractor,
  chmExtractor,
  excelToJsonConverter,
  fb2Reader,
  isoExtractor,
  jarExtractor,
  lzhExtractor,
  mobiReader,
  onlineZipCompressor,
  onlineZipExtractor,
  debExtractor,
  cabFileExtractor,
  odtToPdfConverter,
  odsToPdfConverter,
  odpToPdfConverter,
  pdfToHtmlConverter,
  pdfToTextConverter,
  pdfToWordConverter,
  pdfToExcelConverter,
  pdfToRtfConverter,
  pdfToImageConverter,
  pdfToEpubConverter,
  pdfToPowerpointConverter,
  pdfToOdtConverter,
  pdfToOdsConverter,
  pdfToOdpConverter,
  pdfToPostScriptConverter,
  pdfToMobiConverter,
  pdfToAzw3Converter,
  pdfToDjvuConverter,
  dmgExtractor,
  keynoteToPdfConverter,
  numbersToPdfConverter,
  pagesToPdfConverter,
  epubToMobiConverter,
  epubToAzw3Converter,
  mobiToEpubConverter,
  litToPdfConverter,
  lrfToPdfConverter,
  extractor7z,
  arjExtractor,
  bzip2Compressor,
  bzip2Decompressor,
  cbrComicBookReader,
  litToEpubConverter,
  lrfToEpubConverter,
  pdfPasswordEncryptor,
  pdfSecurityRemover,
  postscriptToPdfConverter,
  prcToEpubConverter,
  rarExtractor,
  rpmExtractor,
  tcrToEpubConverter,
  wimExtractor,
  xarExtractor,
  zCompressor,
  canonicalTagGenerator,
  faqSchemaGenerator,
  hreflangTagGenerator,
  metaTagGenerator,
  openGraphGenerator,
  robotsTxtGenerator,
  schemaJsonldGenerator,
  serpSnippetPreview,
  utmUrlBuilder,
  xmlSitemapGenerator,
  breadcrumbSchemaGenerator,
  howToSchemaGenerator,
  contentReadabilityAnalyzer,
  contentWordCount,
  headingStructureAnalyzer,
  contentOutlineGenerator,
  contentBriefGenerator,
  keywordDensityAnalyzer,
  contentGapAnalyzer,
  redirectChainChecker,
  disavowFileGenerator,
  keywordMatchTypeBuilder,
  outreachEmailTemplate,
  htmlToTextRatioChecker,
  imageSeoAltTextAuditor,
  anchorTextDistributionAnalyzer,
  napCitationConsistencyChecker,
  googleAnalytics4EventBuilder,
  conversionTrackingTagGenerator,
  responsiveSearchAdBuilder,
  seoSlugGenerator,
  metaDescriptionGenerator,
  titleTagOptimizer,
  internalLinkingSuggester,
  keywordCannibalizationDetector,
  longTailKeywordGenerator,
  keywordGroupingTool,
  peopleAlsoAskExtractor,
  redirectHtaccessGenerator,
  seoContentScorecard,
  keywordResearchExplorer,
  keywordDifficultyEstimator,
  searchIntentClassifier,
  tfIdfContentOptimizer,
  serpCompetitorAnalysis,
  localBusinessSchemaGenerator,
  openGraphImageGenerator,
  titleMetaPixelChecker,
  structuredDataValidator,
  backlinkProfileAnalyzer,
  keywordRankTracker,
  serpPositionChecker,
  rankChangeVisualizer,
  shareOfVoiceCalculator,
  competitorRankComparison,
  backlinkQualityScorer,
  lostNewBacklinkTracker,
  backlinkGapAnalyzer,
  linkProspectingBuilder,
  guestPostFinder,
  contentPruningAuditor,
  orphanPageDetector,
  crawlBudgetEstimator,
  paginationSeoChecker,
  facetedNavSeoAnalyzer,
  javascriptSeoRenderTester,
  logFileAnalyzer,
  indexCoverageReporter,
  pageExperienceSignalChecker,
  ecommerceProductSeoOptimizer,
  localRankTracker,
  googleBusinessProfileOptimizer,
  citationFinder,
  reviewSentimentAnalyzer,
  youtubeVideoSeoOptimizer,
  videoSchemaGenerator,
  contentCalendarPlanner,
  topicClusterBuilder,
  contentDistributionPlanner,
  brandMentionMonitor,
  internationalSeoPlanner,
  localeKeywordResearcher,
  affiliateLinkCloaker,
  affiliateCommissionCalculator,
  productReviewSchemaGenerator,
  seoReportGenerator,
  seoKpiDashboardBuilder,
  competitorWebsiteAnalyzer,
  seoExperimentTracker,
  searchConsoleDataAnalyzer,
  audioRecorder,
  audioTrimmer,
  audioConverter,
  audioVolumeNormalizer,
  audioSpeedChanger,
  audioReverser,
  audioMerger,
  audioSplitter,
  audioFadeGenerator,
  audioMetadataEditor,
  audioSpectrumAnalyzer,
  audioWaveformViewer,
  audioNoiseReducer,
  audioEqualizer,
  videoTrimmer,
  videoCompressor,
  videoMetadataViewer,
  videoFrameExtractor,
  audioFormatDetector,
  audioBitrateCalculator,
  invoiceGenerator,
  quoteGenerator,
  receiptMaker,
  taxCalculator,
  payrollCalculator,
  timeTracker,
  timesheetGenerator,
  pomodoroTimer,
  workHoursCalculator,
  expenseTracker,
  budgetPlanner,
  roiCalculator,
  breakEvenCalculator,
  loanAmortizationSchedule,
  projectTaskTracker,
  ganttChartMaker,
  meetingAgendaMaker,
  decisionMatrixBuilder,
  contractTemplateGenerator,
  emailTemplateManager,
  meetingNotesMaker,
  sopGenerator,
  salesPipelineTracker,
  customerTracker,
  commissionTracker,
  flashcardMaker,
  quizGenerator,
  studyPlanner,
  gradeCalculator,
  vocabularyBuilder,
  typingPractice,
  multiplicationTablesGenerator,
  unitConverterEducational,
  periodicTableReference,
  mathPracticeGenerator,
  spellingBeePractice,
  languageTranslatorHelper,
  historyTimelineMaker,
  geographyQuiz,
  citationGenerator,
  readingListTracker,
  chemistryFormulaCalculator,
  physicsFormulaReference,
  studyNotesOrganizer,
  presentationSlideOutliner,
  socialMediaPostGenerator,
  hashtagGenerator,
  captionGenerator,
  socialMediaBioGenerator,
  emojiPickerKeyboard,
  socialMediaImageResizer,
  tweetThreadPlanner,
  instagramStoryPlanner,
  linkedinPostFormatter,
  youtubeThumbnailTextOverlay,
  contentCalendarScheduler,
  socialMediaCharacterCounter,
  tiktokVideoDescriptionGenerator,
  pinterestPinDescriptionGenerator,
  socialMediaEngagementTracker,
  socialMediaMentionTracker,
  socialMediaHashtagAnalyzer,
  socialMediaTrendDetector,
  socialMediaContestPlanner,
  socialMediaCollabFinder,
  socialMediaAnalyticsDashboard,
  socialMediaContentRepurposer,
  socialMediaCommentResponder,
  socialMediaEmojiTranslator,
  socialMediaPollGenerator,
  pdfOcrTextExtractor,
  pdfWordConverterV2,
  pdfExcelConverterV2,
  pdfFormFiller,
  pdfRedactionTool,
  pdfCompare,
  pdfBookletMaker,
  pdfImposition,
  pdfColorSeparation,
  pdfGrayscaleConverter,
  pdfBleedAdder,
  pdfCropMarks,
  pdfInkCoverageAnalyzer,
  pdfFontExtractor,
  pdfFontSubsetter,
  pdfAccessibilityChecker,
  pdfAltTextGenerator,
  pdfTagTreeViewer,
  pdfThumbnailGenerator,
  pdfZipBundler,
  pdfSizeOptimizer,
  pdfVersionConverter,
  pdfQrCodeStamper,
  pdfBarcodeStamper,
  pdfHeaderFooterAdder,
  pdfBookmarkFromHeadings,
  pdfTranslationOverlay,
  pdfTableExtractor,
  pdfFormFieldExtractor,
  pdfPowerpointConverterV2,
]
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

export function byCategory(c: ToolCategory): ToolManifest[] {
  return TOOLS.filter((t) => t.category === c);
}

export function byId(id: string): ToolManifest | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function countByCategory(): Record<ToolCategory, number> {
  const counts = {} as Record<ToolCategory, number>;
  for (const t of TOOLS) {
    counts[t.category] = (counts[t.category] ?? 0) + 1;
  }
  return counts;
}
