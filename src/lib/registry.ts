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
