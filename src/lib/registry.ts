/**
 * Central tool registry — explicit imports (Next.js-compatible, no Vite glob).
 *
 * Adding a new tool: drop a folder under src/tools/<cat>/<id>/ with a manifest.ts,
 * then add an import + TOOLS.push line below. Routing, search, and the homepage
 * grid pick it up automatically.
 */
import type { ToolCategory, ToolManifest } from "./tool";

import { manifest as bmiCalculator } from "@/tools/calculators/bmi-calculator/manifest";
import { manifest as discountCalculator } from "@/tools/calculators/discount-calculator/manifest";
import { manifest as emiCalculator } from "@/tools/calculators/emi-calculator/manifest";
import { manifest as mortgageCalculator } from "@/tools/calculators/mortgage-calculator/manifest";
import { manifest as percentageCalculator } from "@/tools/calculators/percentage-calculator/manifest";
import { manifest as simpleInterestCalculator } from "@/tools/calculators/simple-interest-calculator/manifest";
import { manifest as sipCalculator } from "@/tools/calculators/sip-calculator/manifest";
import { manifest as tipCalculator } from "@/tools/calculators/tip-calculator/manifest";
import { manifest as unitConverterLength } from "@/tools/calculators/unit-converter-length/manifest";
import { manifest as compoundInterestCalculator } from "@/tools/calculators/compound-interest-calculator/manifest";
import { manifest as gstCalculator } from "@/tools/calculators/gst-calculator/manifest";
import { manifest as percentageChangeCalc } from "@/tools/calculators/percentage-change-calc/manifest";
import { manifest as loanPayoffCalc } from "@/tools/calculators/loan-payoff-calc/manifest";
import { manifest as discountRateCalc } from "@/tools/calculators/discount-rate-calc/manifest";
import { manifest as markupMarginCalc } from "@/tools/calculators/markup-margin-calc/manifest";
import { manifest as paymentPlanCalc } from "@/tools/calculators/payment-plan-calc/manifest";
import { manifest as areaCalculator } from "@/tools/calculators/area-calculator/manifest";
import { manifest as perimeterCalculator } from "@/tools/calculators/perimeter-calculator/manifest";
import { manifest as speedDistanceCalc } from "@/tools/calculators/speed-distance-calc/manifest";
import { manifest as bmiBmrCombo } from "@/tools/calculators/bmi-bmr-combo/manifest";
import { manifest as timeDurationCalc } from "@/tools/calculators/time-duration-calc/manifest";
import { manifest as volumeConverter } from "@/tools/calculators/volume-converter/manifest";
import { manifest as angleConverter } from "@/tools/calculators/angle-converter/manifest";
import { manifest as pressureConverter } from "@/tools/calculators/pressure-converter/manifest";
import { manifest as forceConverter } from "@/tools/calculators/force-converter/manifest";
import { manifest as energyConverter } from "@/tools/calculators/energy-converter/manifest";
import { manifest as scientificCalculator } from "@/tools/calculators/scientific-calculator/manifest";
import { manifest as weightUnitConverter } from "@/tools/calculators/weight-unit-converter/manifest";
import { manifest as temperatureConverter } from "@/tools/calculators/temperature-converter/manifest";
import { manifest as fuelCostCalculator } from "@/tools/calculators/fuel-cost-calculator/manifest";
import { manifest as dataStorageConverter } from "@/tools/calculators/data-storage-converter/manifest";
import { manifest as base64 } from "@/tools/developer/base64/manifest";
import { manifest as hashGenerator } from "@/tools/developer/hash-generator/manifest";
import { manifest as jsonFormatter } from "@/tools/developer/json-formatter/manifest";
import { manifest as urlEncoder } from "@/tools/developer/url-encoder/manifest";
import { manifest as uuidGenerator } from "@/tools/developer/uuid-generator/manifest";
import { manifest as asciiArtGenerator } from "@/tools/image/ascii-art-generator/manifest";
import { manifest as barcodeGenerator } from "@/tools/image/barcode-generator/manifest";
import { manifest as bulkImageRenamerOptimizer } from "@/tools/image/bulk-image-renamer-optimizer/manifest";
import { manifest as colorPicker } from "@/tools/image/color-picker/manifest";
import { manifest as imageCompressor } from "@/tools/image/image-compressor/manifest";
import { manifest as photoMosaicGenerator } from "@/tools/image/photo-mosaic-generator/manifest";
import { manifest as pixelArtMaker } from "@/tools/image/pixel-art-maker/manifest";
import { manifest as imageResizer } from "@/tools/image/image-resizer/manifest";
import { manifest as imageCropper } from "@/tools/image/image-cropper/manifest";
import { manifest as imageRotator } from "@/tools/image/image-rotator/manifest";
import { manifest as imageFlipper } from "@/tools/image/image-flipper/manifest";
import { manifest as imageToBase64 } from "@/tools/image/image-to-base64/manifest";
import { manifest as base64ToImage } from "@/tools/image/base64-to-image/manifest";
import { manifest as imageWatermarkAdder } from "@/tools/image/image-watermark-adder/manifest";
import { manifest as imageColorInverter } from "@/tools/image/image-color-inverter/manifest";
import { manifest as imageGrayscaleConverter } from "@/tools/image/image-grayscale-converter/manifest";
import { manifest as imageSepiaFilter } from "@/tools/image/image-sepia-filter/manifest";
import { manifest as imageBlurTool } from "@/tools/image/image-blur-tool/manifest";
import { manifest as imageSharpener } from "@/tools/image/image-sharpener/manifest";
import { manifest as imageBrightnessAdjuster } from "@/tools/image/image-brightness-adjuster/manifest";
import { manifest as imageContrastAdjuster } from "@/tools/image/image-contrast-adjuster/manifest";
import { manifest as imageSaturationAdjuster } from "@/tools/image/image-saturation-adjuster/manifest";
import { manifest as imageHueRotator } from "@/tools/image/image-hue-rotator/manifest";
import { manifest as imageThumbnailMaker } from "@/tools/image/image-thumbnail-maker/manifest";
import { manifest as imageBgRemoverSimple } from "@/tools/image/image-bg-remover-simple/manifest";
import { manifest as imageCollageMaker } from "@/tools/image/image-collage-maker/manifest";
import { manifest as imageColorExtractor } from "@/tools/image/image-color-extractor/manifest";
import { manifest as imageEdgeDetector } from "@/tools/image/image-edge-detector/manifest";
import { manifest as imageNoiseReducer } from "@/tools/image/image-noise-reducer/manifest";
import { manifest as imageVignetteTool } from "@/tools/image/image-vignette-tool/manifest";
import { manifest as imageGradientMaker } from "@/tools/image/image-gradient-maker/manifest";
import { manifest as imageBorderAdder } from "@/tools/image/image-border-adder/manifest";
import { manifest as imageRoundCorners } from "@/tools/image/image-round-corners/manifest";
import { manifest as imagePixelateTool } from "@/tools/image/image-pixelate-tool/manifest";
import { manifest as imagePosterizeTool } from "@/tools/image/image-posterize-tool/manifest";
import { manifest as imageThresholdTool } from "@/tools/image/image-threshold-tool/manifest";
import { manifest as imageChannelMixer } from "@/tools/image/image-channel-mixer/manifest";
import { manifest as imageFisheyeTool } from "@/tools/image/image-fisheye-tool/manifest";
import { manifest as imageDrosteEffect } from "@/tools/image/image-droste-effect/manifest";
import { manifest as imageGlitchArt } from "@/tools/image/image-glitch-art/manifest";
import { manifest as imagePixelSorter } from "@/tools/image/image-pixel-sorter/manifest";
import { manifest as imageColorPickerTool } from "@/tools/image/image-color-picker-tool/manifest";
import { manifest as imageExposureAdjuster } from "@/tools/image/image-exposure-adjuster/manifest";
import { manifest as imageGammaCorrector } from "@/tools/image/image-gamma-corrector/manifest";
import { manifest as imageDitherTool } from "@/tools/image/image-dither-tool/manifest";
import { manifest as imageSolarizeTool } from "@/tools/image/image-solarize-tool/manifest";
import { manifest as imageEmbossTool } from "@/tools/image/image-emboss-tool/manifest";
import { manifest as imageAnaglyphMaker } from "@/tools/image/image-anaglyph-maker/manifest";
import { manifest as imageKaleidoscope } from "@/tools/image/image-kaleidoscope/manifest";
import { manifest as imageTileMaker } from "@/tools/image/image-tile-maker/manifest";
import { manifest as imageStitcher } from "@/tools/image/image-stitcher/manifest";
import { manifest as imageSplitter } from "@/tools/image/image-splitter/manifest";
import { manifest as imageGifFrameExtractor } from "@/tools/image/image-gif-frame-extractor/manifest";
import { manifest as imageColorOverlay } from "@/tools/image/image-color-overlay/manifest";
import { manifest as imageMosaicBlend } from "@/tools/image/image-mosaic-blend/manifest";
import { manifest as imageDehazeTool } from "@/tools/image/image-dehaze-tool/manifest";
import { manifest as imageShadowsHighlights } from "@/tools/image/image-shadows-highlights/manifest";
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
import { manifest as aes256EncryptorDecryptor } from "@/tools/network-security/aes-256-encryptor-decryptor/manifest";
import { manifest as passwordStrengthChecker } from "@/tools/network-security/password-strength-checker/manifest";
import { manifest as htaccessGenerator } from "@/tools/network-security/htaccess-generator/manifest";
import { manifest as sshKeyFingerprintExplorer } from "@/tools/network-security/ssh-key-fingerprint-explorer/manifest";
import { manifest as hashVerifier } from "@/tools/network-security/hash-verifier/manifest";
import { manifest as textEntropyCalculator } from "@/tools/network-security/text-entropy-calculator/manifest";
import { manifest as macAddressGenerator } from "@/tools/network-security/mac-address-generator/manifest";
import { manifest as uuidVersionDetector } from "@/tools/network-security/uuid-version-detector/manifest";
import { manifest as secureRandomGenerator } from "@/tools/network-security/secure-random-generator/manifest";
import { manifest as certificatePemParser } from "@/tools/network-security/certificate-pem-parser/manifest";
import { manifest as cronExpressionParser } from "@/tools/network-security/cron-expression-parser/manifest";
import { manifest as jwtClaimExtractor } from "@/tools/network-security/jwt-claim-extractor/manifest";
import { manifest as dnsRecordValidator } from "@/tools/network-security/dns-record-validator/manifest";
import { manifest as ipv6SubnetCalc } from "@/tools/network-security/ipv6-subnet-calc/manifest";
import { manifest as httpHeaderParser } from "@/tools/network-security/http-header-parser/manifest";
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
import { manifest as textReverser } from "@/tools/text/text-reverser/manifest";
import { manifest as textTrimmer } from "@/tools/text/text-trimmer/manifest";
import { manifest as textRepeater } from "@/tools/text/text-repeater/manifest";
import { manifest as textSorter } from "@/tools/text/text-sorter/manifest";
import { manifest as morseCodeTranslator } from "@/tools/text/morse-code-translator/manifest";
import { manifest as loremIpsumGenerator } from "@/tools/text/lorem-ipsum-generator/manifest";
import { manifest as textToBinary } from "@/tools/text/text-to-binary/manifest";
import { manifest as binaryToText } from "@/tools/text/binary-to-text/manifest";
import { manifest as textCaseAdvancer } from "@/tools/text/text-case-advancer/manifest";
import { manifest as textStripper } from "@/tools/text/text-stripper/manifest";
import { manifest as textWordsExtractor } from "@/tools/text/text-words-extractor/manifest";
import { manifest as textAccentRemover } from "@/tools/text/text-accent-remover/manifest";
import { manifest as textAccentAdder } from "@/tools/text/text-accent-adder/manifest";
import { manifest as textPhoneticGenerator } from "@/tools/text/text-phonetic-generator/manifest";
import { manifest as textPigLatin } from "@/tools/text/text-pig-latin/manifest";
import { manifest as textLeetspeak } from "@/tools/text/text-leetspeak/manifest";
import { manifest as textRot13Cipher } from "@/tools/text/text-rot13-cipher/manifest";
import { manifest as textVigenereCipher } from "@/tools/text/text-vigenere-cipher/manifest";
import { manifest as textAtbashCipher } from "@/tools/text/text-atbash-cipher/manifest";
import { manifest as textCaesarBruteforce } from "@/tools/text/text-caesar-bruteforce/manifest";
import { manifest as textMorseDecoder } from "@/tools/text/text-morse-decoder/manifest";
import { manifest as textFinderReplacer } from "@/tools/text/text-finder-replacer/manifest";
import { manifest as textStatistics } from "@/tools/text/text-statistics/manifest";
import { manifest as textDeduplicator } from "@/tools/text/text-deduplicator/manifest";
import { manifest as textEncoderDecoder } from "@/tools/text/text-encoder-decoder/manifest";
import { manifest as textColumnFormatter } from "@/tools/text/text-column-formatter/manifest";
import { manifest as textIndentationFixer } from "@/tools/text/text-indentation-fixer/manifest";
import { manifest as textAligner } from "@/tools/text/text-aligner/manifest";
import { manifest as textRedactor } from "@/tools/text/text-redactor/manifest";
import { manifest as unicodeExplorer } from "@/tools/text/unicode-explorer/manifest";
import { manifest as textWidthMeasurer } from "@/tools/text/text-width-measurer/manifest";
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
import { manifest as azw3ToPdfConverter } from "@/tools/file/azw3-to-pdf-converter/manifest";
import { manifest as bulkFileTimestampChanger } from "@/tools/file/bulk-file-timestamp-changer/manifest";
import { manifest as djvuToPdfConverter } from "@/tools/file/djvu-to-pdf-converter/manifest";
import { manifest as encodingDetector } from "@/tools/file/encoding-detector/manifest";
import { manifest as epubToPdfConverter } from "@/tools/file/epub-to-pdf-converter/manifest";
import { manifest as fileTreePrinter } from "@/tools/file/file-tree-printer/manifest";
import { manifest as fileTypeDetector } from "@/tools/file/file-type-detector/manifest";
import { manifest as lineEndingConverter } from "@/tools/file/line-ending-converter/manifest";
import { manifest as mobiToPdfConverter } from "@/tools/file/mobi-to-pdf-converter/manifest";
import { manifest as pdfFormFlattener } from "@/tools/file/pdf-form-flattener/manifest";
import { manifest as pdfPageOrganizer } from "@/tools/file/pdf-page-organizer/manifest";
import { manifest as pdfToXpsConverter } from "@/tools/file/pdf-to-xps-converter/manifest";
import { manifest as textEncodingConverter } from "@/tools/file/text-encoding-converter/manifest";
import { manifest as xpsToPdfConverter } from "@/tools/file/xps-to-pdf-converter/manifest";
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
import { manifest as timesheetCalc } from "@/tools/business/timesheet-calc/manifest";
import { manifest as meetingDurationCalc } from "@/tools/business/meeting-duration-calc/manifest";
import { manifest as payslipGenerator } from "@/tools/business/payslip-generator/manifest";
import { manifest as shiftScheduler } from "@/tools/business/shift-scheduler/manifest";
import { manifest as workOrderGenerator } from "@/tools/business/work-order-generator/manifest";
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
import { manifest as aiAltTextGenerator } from "@/tools/ai/ai-alt-text-generator/manifest";
import { manifest as aiAnalogiesGenerator } from "@/tools/ai/ai-analogies-generator/manifest";
import { manifest as aiApiPayloadMockingTool } from "@/tools/ai/ai-api-payload-mocking-tool/manifest";
import { manifest as aiArticleHeadlineGenerator } from "@/tools/ai/ai-article-headline-generator/manifest";
import { manifest as aiBiasChecker } from "@/tools/ai/ai-bias-checker/manifest";
import { manifest as aiBookSummaryGenerator } from "@/tools/ai/ai-book-summary-generator/manifest";
import { manifest as aiBrandPositioningStatementGenerator } from "@/tools/ai/ai-brand-positioning-statement-generator/manifest";
import { manifest as aiBrandToneOfVoiceBuilder } from "@/tools/ai/ai-brand-tone-of-voice-builder/manifest";
import { manifest as aiBusinessNameIdeator } from "@/tools/ai/ai-business-name-ideator/manifest";
import { manifest as aiBusinessPitchDeckOutlineGenerator } from "@/tools/ai/ai-business-pitch-deck-outline-generator/manifest";
import { manifest as aiCharacterNameGenerator } from "@/tools/ai/ai-character-name-generator/manifest";
import { manifest as aiChatbotEmulator } from "@/tools/ai/ai-chatbot-emulator/manifest";
import { manifest as aiChromeExtensionBoilerplateGenerator } from "@/tools/ai/ai-chrome-extension-boilerplate-generator/manifest";
import { manifest as aiCitationFormatter } from "@/tools/ai/ai-citation-formatter/manifest";
import { manifest as aiCodeConverter } from "@/tools/ai/ai-code-converter/manifest";
import { manifest as aiCodeDebugger } from "@/tools/ai/ai-code-debugger/manifest";
import { manifest as aiCodeExplainer } from "@/tools/ai/ai-code-explainer/manifest";
import { manifest as aiCodingPatternRefactorer } from "@/tools/ai/ai-coding-pattern-refactorer/manifest";
import { manifest as aiColdEmailPersonalizer } from "@/tools/ai/ai-cold-email-personalizer/manifest";
import { manifest as aiCompetitorAnalysisFramework } from "@/tools/ai/ai-competitor-analysis-framework/manifest";
import { manifest as aiCopywritingFrameworkAssistant } from "@/tools/ai/ai-copywriting-framework-assistant/manifest";
import { manifest as aiCoverLetterWriter } from "@/tools/ai/ai-cover-letter-writer/manifest";
import { manifest as aiCronJobSchedulerBuilder } from "@/tools/ai/ai-cron-job-scheduler-builder/manifest";
import { manifest as aiCssUiComponentGenerator } from "@/tools/ai/ai-css-ui-component-generator/manifest";
import { manifest as aiCtaGenerator } from "@/tools/ai/ai-cta-generator/manifest";
import { manifest as aiCustomerSupportScriptWriter } from "@/tools/ai/ai-customer-support-script-writer/manifest";
import { manifest as aiDbSchemaDiagramBuilder } from "@/tools/ai/ai-db-schema-diagram-builder/manifest";
import { manifest as aiDockerfileBuilder } from "@/tools/ai/ai-dockerfile-builder/manifest";
import { manifest as aiDomainNameGenerator } from "@/tools/ai/ai-domain-name-generator/manifest";
import { manifest as aiEmailDraftGenerator } from "@/tools/ai/ai-email-draft-generator/manifest";
import { manifest as aiEmojiTranslator } from "@/tools/ai/ai-emoji-translator/manifest";
import { manifest as aiEssayOutlineGenerator } from "@/tools/ai/ai-essay-outline-generator/manifest";
import { manifest as aiFaqGenerator } from "@/tools/ai/ai-faq-generator/manifest";
import { manifest as aiFictionStoryGenerator } from "@/tools/ai/ai-fiction-story-generator/manifest";
import { manifest as aiFinancialGoalPlanner } from "@/tools/ai/ai-financial-goal-planner/manifest";
import { manifest as aiFlashcardQaGenerator } from "@/tools/ai/ai-flashcard-qa-generator/manifest";
import { manifest as aiGiftIdeaGenerator } from "@/tools/ai/ai-gift-idea-generator/manifest";
import { manifest as aiGitCommitMessageGenerator } from "@/tools/ai/ai-git-commit-message-generator/manifest";
import { manifest as aiGrammarCorrectionTool } from "@/tools/ai/ai-grammar-correction-tool/manifest";
import { manifest as aiHtaccessRedirectGenerator } from "@/tools/ai/ai-htaccess-redirect-generator/manifest";
import { manifest as aiHtmlLandingPageGenerator } from "@/tools/ai/ai-html-landing-page-generator/manifest";
import { manifest as aiInstagramBioGenerator } from "@/tools/ai/ai-instagram-bio-generator/manifest";
import { manifest as aiInterviewQuestionGenerator } from "@/tools/ai/ai-interview-question-generator/manifest";
import { manifest as aiJargonSimplifier } from "@/tools/ai/ai-jargon-simplifier/manifest";
import { manifest as aiJsObjectToJsonSchemaConverter } from "@/tools/ai/ai-js-object-to-json-schema-converter/manifest";
import { manifest as aiJsonMockDataGenerator } from "@/tools/ai/ai-json-mock-data-generator/manifest";
import { manifest as aiKeywordExtractor } from "@/tools/ai/ai-keyword-extractor/manifest";
import { manifest as aiKubernetesManifestGenerator } from "@/tools/ai/ai-kubernetes-manifest-generator/manifest";
import { manifest as aiLinkedinBioOptimizer } from "@/tools/ai/ai-linkedin-bio-optimizer/manifest";
import { manifest as aiLogicalFallacyDetector } from "@/tools/ai/ai-logical-fallacy-detector/manifest";
import { manifest as aiMarkdownReadmeGenerator } from "@/tools/ai/ai-markdown-readme-generator/manifest";
import { manifest as aiMarkdownTableGenerator } from "@/tools/ai/ai-markdown-table-generator/manifest";
import { manifest as aiMathWordProblemSolver } from "@/tools/ai/ai-math-word-problem-solver/manifest";
import { manifest as aiMeetingMinutesSummarizer } from "@/tools/ai/ai-meeting-minutes-summarizer/manifest";
import { manifest as aiMermaidFlowchartGenerator } from "@/tools/ai/ai-mermaid-flowchart-generator/manifest";
import { manifest as aiMetaTagBuilder } from "@/tools/ai/ai-meta-tag-builder/manifest";
import { manifest as aiMultiLanguageTranslator } from "@/tools/ai/ai-multi-language-translator/manifest";
import { manifest as aiNewsletterSubjectLineAbTester } from "@/tools/ai/ai-newsletter-subject-line-ab-tester/manifest";
import { manifest as aiNginxConfigRuleBuilder } from "@/tools/ai/ai-nginx-config-rule-builder/manifest";
import { manifest as aiParagraphSummarizer } from "@/tools/ai/ai-paragraph-summarizer/manifest";
import { manifest as aiParaphrasingRewriterTool } from "@/tools/ai/ai-paraphrasing-rewriter-tool/manifest";
import { manifest as aiPassiveActiveVoiceConverter } from "@/tools/ai/ai-passive-active-voice-converter/manifest";
import { manifest as aiPassiveAggressiveEmailTranslator } from "@/tools/ai/ai-passive-aggressive-email-translator/manifest";
import { manifest as aiPodcastEpisodePlanner } from "@/tools/ai/ai-podcast-episode-planner/manifest";
import { manifest as aiPoemLyricsWriter } from "@/tools/ai/ai-poem-lyrics-writer/manifest";
import { manifest as aiPresentationOutlineGenerator } from "@/tools/ai/ai-presentation-outline-generator/manifest";
import { manifest as aiPressReleaseDraftBuilder } from "@/tools/ai/ai-press-release-draft-builder/manifest";
import { manifest as aiProductDescriptionWriter } from "@/tools/ai/ai-product-description-writer/manifest";
import { manifest as aiProductFeaturePrioritizationHelper } from "@/tools/ai/ai-product-feature-prioritization-helper/manifest";
import { manifest as aiPromptImprover } from "@/tools/ai/ai-prompt-improver/manifest";
import { manifest as aiRecipeGenerator } from "@/tools/ai/ai-recipe-generator/manifest";
import { manifest as aiRedditPostTitleOptimizer } from "@/tools/ai/ai-reddit-post-title-optimizer/manifest";
import { manifest as aiRegexBuilder } from "@/tools/ai/ai-regex-builder/manifest";
import { manifest as aiResumeBulletPointOptimizer } from "@/tools/ai/ai-resume-bullet-point-optimizer/manifest";
import { manifest as aiRobotsTxt } from "@/tools/ai/ai-robots-txt/manifest";
import { manifest as aiSalaryNegotiationScriptWriter } from "@/tools/ai/ai-salary-negotiation-script-writer/manifest";
import { manifest as aiSentimentAnalysisTool } from "@/tools/ai/ai-sentiment-analysis-tool/manifest";
import { manifest as aiShellBashScriptWriter } from "@/tools/ai/ai-shell-bash-script-writer/manifest";
import { manifest as aiSloganTaglineGenerator } from "@/tools/ai/ai-slogan-tagline-generator/manifest";
import { manifest as aiSocialMediaCaptionWriter } from "@/tools/ai/ai-social-media-caption-writer/manifest";
import { manifest as aiSqlQueryGenerator } from "@/tools/ai/ai-sql-query-generator/manifest";
import { manifest as aiStudyGuideGenerator } from "@/tools/ai/ai-study-guide-generator/manifest";
import { manifest as aiSvgVectorArtGenerator } from "@/tools/ai/ai-svg-vector-art-generator/manifest";
import { manifest as aiSwotAnalysisCreator } from "@/tools/ai/ai-swot-analysis-creator/manifest";
import { manifest as aiTailwindCssPaletteGenerator } from "@/tools/ai/ai-tailwind-css-palette-generator/manifest";
import { manifest as aiTargetAudienceDemographicsProfiler } from "@/tools/ai/ai-target-audience-demographics-profiler/manifest";
import { manifest as aiTechStackRecommender } from "@/tools/ai/ai-tech-stack-recommender/manifest";
import { manifest as aiTextBasedAdventureGameEngine } from "@/tools/ai/ai-text-based-adventure-game-engine/manifest";
import { manifest as aiTextSimplifierEli5 } from "@/tools/ai/ai-text-simplifier-eli5/manifest";
import { manifest as aiTextToImageGenerator } from "@/tools/ai/ai-text-to-image-generator/manifest";
import { manifest as aiThesisStatementGenerator } from "@/tools/ai/ai-thesis-statement-generator/manifest";
import { manifest as aiTravelItineraryPlanner } from "@/tools/ai/ai-travel-itinerary-planner/manifest";
import { manifest as aiTypescriptInterfaceGenerator } from "@/tools/ai/ai-typescript-interface-generator/manifest";
import { manifest as aiUnitTestCaseGenerator } from "@/tools/ai/ai-unit-test-case-generator/manifest";
import { manifest as aiUserPersonaCreator } from "@/tools/ai/ai-user-persona-creator/manifest";
import { manifest as aiUserStoryCreator } from "@/tools/ai/ai-user-story-creator/manifest";
import { manifest as aiVideoScriptOutliner } from "@/tools/ai/ai-video-script-outliner/manifest";
import { manifest as aiWebsiteSitemapGenerator } from "@/tools/ai/ai-website-sitemap-generator/manifest";
import { manifest as aiWeeklyMealPlanner } from "@/tools/ai/ai-weekly-meal-planner/manifest";
import { manifest as aiWorkoutPlanner } from "@/tools/ai/ai-workout-planner/manifest";
import { manifest as addSubtractDateCalculator } from "@/tools/developer/add-subtract-date-calculator/manifest";
import { manifest as ageCalculator } from "@/tools/developer/age-calculator/manifest";
import { manifest as awkCommandBuilderTester } from "@/tools/developer/awk-command-builder-tester/manifest";
import { manifest as bashScriptGeneratorBoilerplate } from "@/tools/developer/bash-script-generator-boilerplate/manifest";
import { manifest as businessWorkingDaysCalculator } from "@/tools/developer/business-working-days-calculator/manifest";
import { manifest as chmodCalculator } from "@/tools/developer/chmod-calculator/manifest";
import { manifest as connectionStringBuilderParser } from "@/tools/developer/connection-string-builder-parser/manifest";
import { manifest as countdownTimerGenerator } from "@/tools/developer/countdown-timer-generator/manifest";
import { manifest as createTableGenerator } from "@/tools/developer/create-table-generator/manifest";
import { manifest as creditCardTestNumberGenerator } from "@/tools/developer/credit-card-test-number-generator/manifest";
import { manifest as csvToSqlInsertConverter } from "@/tools/developer/csv-to-sql-insert-converter/manifest";
import { manifest as databaseSchemaDiff } from "@/tools/developer/database-schema-diff/manifest";
import { manifest as dateDifferenceCalculator } from "@/tools/developer/date-difference-calculator/manifest";
import { manifest as dateFormatConverterStrftime } from "@/tools/developer/date-format-converter-strftime/manifest";
import { manifest as dayOfTheWeekFinder } from "@/tools/developer/day-of-the-week-finder/manifest";
import { manifest as diceRollerRandomPicker } from "@/tools/developer/dice-roller-random-picker/manifest";
import { manifest as emailAddressGeneratorValidator } from "@/tools/developer/email-address-generator-validator/manifest";
import { manifest as erDiagramDesigner } from "@/tools/developer/er-diagram-designer/manifest";
import { manifest as fakeDataGenerator } from "@/tools/developer/fake-data-generator/manifest";
import { manifest as ibanGeneratorValidator } from "@/tools/developer/iban-generator-validator/manifest";
import { manifest as inBrowserSqlPlayground } from "@/tools/developer/in-browser-sql-playground/manifest";
import { manifest as isbnGeneratorValidator } from "@/tools/developer/isbn-generator-validator/manifest";
import { manifest as iso8601DateParserFormatter } from "@/tools/developer/iso-8601-date-parser-formatter/manifest";
import { manifest as jqPlaygroundFilterBuilder } from "@/tools/developer/jq-playground-filter-builder/manifest";
import { manifest as julianDateAstronomicalTimeConverter } from "@/tools/developer/julian-date-astronomical-time-converter/manifest";
import { manifest as luhnCreditCardValidator } from "@/tools/developer/luhn-credit-card-validator/manifest";
import { manifest as mockCsvDataGenerator } from "@/tools/developer/mock-csv-data-generator/manifest";
import { manifest as mockGraphqlResponseGenerator } from "@/tools/developer/mock-graphql-response-generator/manifest";
import { manifest as mockSqlDataGenerator } from "@/tools/developer/mock-sql-data-generator/manifest";
import { manifest as mongodbAggregationPipelineBuilder } from "@/tools/developer/mongodb-aggregation-pipeline-builder/manifest";
import { manifest as mongodbQueryBuilder } from "@/tools/developer/mongodb-query-builder/manifest";
import { manifest as naughtyStringGenerator } from "@/tools/developer/naughty-string-generator/manifest";
import { manifest as numberBaseConverter } from "@/tools/developer/number-base-converter/manifest";
import { manifest as onlineStopwatchTimer } from "@/tools/developer/online-stopwatch-timer/manifest";
import { manifest as phoneNumberGeneratorValidator } from "@/tools/developer/phone-number-generator-validator/manifest";
import { manifest as printableCalendarGenerator } from "@/tools/developer/printable-calendar-generator/manifest";
import { manifest as randomDateTimeGenerator } from "@/tools/developer/random-date-time-generator/manifest";
import { manifest as randomIpMacAddressGenerator } from "@/tools/developer/random-ip-mac-address-generator/manifest";
import { manifest as randomNumberGeneratorSeeded } from "@/tools/developer/random-number-generator-seeded/manifest";
import { manifest as randomUserProfileGenerator } from "@/tools/developer/random-user-profile-generator/manifest";
import { manifest as recurringDateRruleGenerator } from "@/tools/developer/recurring-date-rrule-generator/manifest";
import { manifest as redisCommandReferenceBuilder } from "@/tools/developer/redis-command-reference-builder/manifest";
import { manifest as relativeTimeFormatter } from "@/tools/developer/relative-time-formatter/manifest";
import { manifest as sampleJsonMockApiResponseGenerator } from "@/tools/developer/sample-json-mock-api-response-generator/manifest";
import { manifest as sedCommandBuilderTester } from "@/tools/developer/sed-command-builder-tester/manifest";
import { manifest as shellCommandExplainer } from "@/tools/developer/shell-command-explainer/manifest";
import { manifest as sqlDdlToErDiagramGenerator } from "@/tools/developer/sql-ddl-to-er-diagram-generator/manifest";
import { manifest as sqlDialectConverter } from "@/tools/developer/sql-dialect-converter/manifest";
import { manifest as sqlExplainPlanVisualizer } from "@/tools/developer/sql-explain-plan-visualizer/manifest";
import { manifest as sqlFormatterBeautifier } from "@/tools/developer/sql-formatter-beautifier/manifest";
import { manifest as sqlIndexAdvisor } from "@/tools/developer/sql-index-advisor/manifest";
import { manifest as sqlJoinVisualizer } from "@/tools/developer/sql-join-visualizer/manifest";
import { manifest as sqlMinifier } from "@/tools/developer/sql-minifier/manifest";
import { manifest as sqlResultToCsvJsonExporter } from "@/tools/developer/sql-result-to-csv-json-exporter/manifest";
import { manifest as sqlToOrmCodeConverter } from "@/tools/developer/sql-to-orm-code-converter/manifest";
import { manifest as testDataAnonymizer } from "@/tools/developer/test-data-anonymizer/manifest";
import { manifest as testDummyFileGenerator } from "@/tools/developer/test-dummy-file-generator/manifest";
import { manifest as testIdGenerator } from "@/tools/developer/test-id-generator/manifest";
import { manifest as timeDurationCalculator } from "@/tools/developer/time-duration-calculator/manifest";
import { manifest as timeUnitConverter } from "@/tools/developer/time-unit-converter/manifest";
import { manifest as timeZoneAbbreviationUtcOffsetReference } from "@/tools/developer/time-zone-abbreviation-utc-offset-reference/manifest";
import { manifest as timeZoneConverter } from "@/tools/developer/time-zone-converter/manifest";
import { manifest as unixTimestampEpochConverter } from "@/tools/developer/unix-timestamp-epoch-converter/manifest";
import { manifest as userAgentStringGeneratorParser } from "@/tools/developer/user-agent-string-generator-parser/manifest";
import { manifest as visualSqlQueryBuilder } from "@/tools/developer/visual-sql-query-builder/manifest";
import { manifest as weekNumberIsoCalculator } from "@/tools/developer/week-number-iso-calculator/manifest";
import { manifest as worldClockMeetingPlanner } from "@/tools/developer/world-clock-meeting-planner/manifest";
import { manifest as ansiEscapeCodeTerminalColorGenerator } from "@/tools/developer/ansi-escape-code-terminal-color-generator/manifest";
import { manifest as bashPromptPs1Generator } from "@/tools/developer/bash-prompt-ps1-generator/manifest";
import { manifest as bashrcZshrcAliasConfigManager } from "@/tools/developer/bashrc-zshrc-alias-config-manager/manifest";
import { manifest as bitwiseOperationCalculator } from "@/tools/developer/bitwise-operation-calculator/manifest";
import { manifest as bitShiftRotateVisualizer } from "@/tools/developer/bit-shift-rotate-visualizer/manifest";
import { manifest as bitFieldBitmaskFlagsDesignerDecoder } from "@/tools/developer/bit-field-bitmask-flags-designer-decoder/manifest";
import { manifest as endiannessByteOrderConverter } from "@/tools/developer/endianness-byte-order-converter/manifest";
import { manifest as dotfilesManagerGenerator } from "@/tools/developer/dotfiles-manager-generator/manifest";
import { manifest as findCommandBuilder } from "@/tools/developer/find-command-builder/manifest";
import { manifest as globPatternTester } from "@/tools/developer/glob-pattern-tester/manifest";
import { manifest as grepRipgrepCommandBuilder } from "@/tools/developer/grep-ripgrep-command-builder/manifest";
import { manifest as rsyncCommandBuilder } from "@/tools/developer/rsync-command-builder/manifest";
import { manifest as tarArchiveCommandBuilder } from "@/tools/developer/tar-archive-command-builder/manifest";
import { manifest as tmuxConfigGeneratorCheatsheet } from "@/tools/developer/tmux-config-generator-cheatsheet/manifest";
import { manifest as vimCheatsheetKeybindingReference } from "@/tools/developer/vim-cheatsheet-keybinding-reference/manifest";
import { manifest as sshConfigGenerator } from "@/tools/developer/ssh-config-generator/manifest";
import { manifest as manPageTldrCommandReference } from "@/tools/developer/man-page-tldr-command-reference/manifest";
import { manifest as exitCodeSignalReference } from "@/tools/developer/exit-code-signal-reference/manifest";
import { manifest as twosComplementSignedIntegerCalculator } from "@/tools/developer/twos-complement-signed-integer-calculator/manifest";
import { manifest as crontabGenerator } from "@/tools/developer/crontab-generator/manifest";
import { manifest as markdownLiveEditorPreviewer } from "@/tools/developer/markdown-live-editor-previewer/manifest";
import { manifest as markdownTableGenerator } from "@/tools/developer/markdown-table-generator/manifest";
import { manifest as markdownTableOfContentsGenerator } from "@/tools/developer/markdown-table-of-contents-generator/manifest";
import { manifest as readmeGenerator } from "@/tools/developer/readme-generator/manifest";
import { manifest as githubBadgeShieldsIoGenerator } from "@/tools/developer/github-badge-shields-io-generator/manifest";
import { manifest as mermaidDiagramLiveEditor } from "@/tools/developer/mermaid-diagram-live-editor/manifest";
import { manifest as plantumlDiagramEditor } from "@/tools/developer/plantuml-diagram-editor/manifest";
import { manifest as markdownToSlidesPresentationGenerator } from "@/tools/developer/markdown-to-slides-presentation-generator/manifest";
import { manifest as markdownSyntaxCheatsheetReference } from "@/tools/developer/markdown-syntax-cheatsheet-reference/manifest";
import { manifest as markdownLinterFormatter } from "@/tools/developer/markdown-linter-formatter/manifest";
import { manifest as ieee754FloatingPointConverter } from "@/tools/developer/ieee-754-floating-point-converter/manifest";
import { manifest as fixedPointQFormatConverter } from "@/tools/developer/fixed-point-q-format-converter/manifest";
import { manifest as bigIntegerArbitraryPrecisionCalculator } from "@/tools/developer/big-integer-arbitrary-precision-calculator/manifest";
import { manifest as hexDumpHexViewerEditor } from "@/tools/developer/hex-dump-hex-viewer-editor/manifest";
import { manifest as binaryFileSignatureMagicNumberInspector } from "@/tools/developer/binary-file-signature-magic-number-inspector/manifest";
import { manifest as asciiArtTextBannerGenerator } from "@/tools/developer/ascii-art-text-banner-generator/manifest";
import { manifest as integerDataTypeRangeOverflowReference } from "@/tools/developer/integer-data-type-range-overflow-reference/manifest";
import { manifest as romanNumeralConverter } from "@/tools/developer/roman-numeral-converter/manifest";
import { manifest as scientificEngineeringNotationConverter } from "@/tools/developer/scientific-engineering-notation-converter/manifest";
import { manifest as modularArithmeticGcdLcmCalculator } from "@/tools/developer/modular-arithmetic-gcd-lcm-calculator/manifest";
import { manifest as primeNumberCheckerFactorizationTool } from "@/tools/developer/prime-number-checker-factorization-tool/manifest";
import { manifest as asciiUnicodeCodePointExplorer } from "@/tools/developer/ascii-unicode-code-point-explorer/manifest";
import { manifest as checksumParityBitCalculator } from "@/tools/developer/checksum-parity-bit-calculator/manifest";
import { manifest as grayCodeConverter } from "@/tools/developer/gray-code-converter/manifest";
import { manifest as hammingCodeErrorCorrectionCalculator } from "@/tools/developer/hamming-code-error-correction-calculator/manifest";
import { manifest as ipv4SubnetCalculatorCidrVlsm } from "@/tools/developer/ipv4-subnet-calculator-cidr-vlsm/manifest";
import { manifest as ipv6SubnetCalculator } from "@/tools/developer/ipv6-subnet-calculator/manifest";
import { manifest as cidrIpRangeNetmaskConverter } from "@/tools/developer/cidr-ip-range-netmask-converter/manifest";
import { manifest as ipAddressFormatConverter } from "@/tools/developer/ip-address-format-converter/manifest";
import { manifest as ipv6AddressExpanderCompressorValidator } from "@/tools/developer/ipv6-address-expander-compressor-validator/manifest";
import { manifest as macAddressVendorOuiLookupFormatter } from "@/tools/developer/mac-address-vendor-oui-lookup-formatter/manifest";
import { manifest as dnsRecordLookupReference } from "@/tools/developer/dns-record-lookup-reference/manifest";
import { manifest as reverseDnsPtrLookupGenerator } from "@/tools/developer/reverse-dns-ptr-lookup-generator/manifest";
import { manifest as dnsPropagationCheckerReference } from "@/tools/developer/dns-propagation-checker-reference/manifest";
import { manifest as whoisDomainIpLookup } from "@/tools/developer/whois-domain-ip-lookup/manifest";
import { manifest as spfRecordGeneratorValidator } from "@/tools/developer/spf-record-generator-validator/manifest";
import { manifest as dkimRecordGeneratorValidator } from "@/tools/developer/dkim-record-generator-validator/manifest";
import { manifest as dmarcRecordGeneratorValidator } from "@/tools/developer/dmarc-record-generator-validator/manifest";
import { manifest as sslTlsCertificateDecoderChecker } from "@/tools/developer/ssl-tls-certificate-decoder-checker/manifest";
import { manifest as wellKnownCommonPortsReference } from "@/tools/developer/well-known-common-ports-reference/manifest";
import { manifest as pingLatencyTesterBrowser } from "@/tools/developer/ping-latency-tester-browser/manifest";
import { manifest as tracerouteVisualizer } from "@/tools/developer/traceroute-visualizer/manifest";
import { manifest as publicIpGeolocationLookup } from "@/tools/developer/public-ip-geolocation-lookup/manifest";
import { manifest as dnsOverHttpsDohQueryTool } from "@/tools/developer/dns-over-https-doh-query-tool/manifest";
import { manifest as cidrAggregatorNetworkSummarizer } from "@/tools/developer/cidr-aggregator-network-summarizer/manifest";
import { manifest as sortingAlgorithmVisualizer } from "@/tools/developer/sorting-algorithm-visualizer/manifest";
import { manifest as pathfindingAlgorithmVisualizer } from "@/tools/developer/pathfinding-algorithm-visualizer/manifest";
import { manifest as binarySearchTreeBstVisualizer } from "@/tools/developer/binary-search-tree-bst-visualizer/manifest";
import { manifest as heapPriorityQueueVisualizer } from "@/tools/developer/heap-priority-queue-visualizer/manifest";
import { manifest as triePrefixTreeVisualizer } from "@/tools/developer/trie-prefix-tree-visualizer/manifest";
import { manifest as avlTreeVisualizer } from "@/tools/developer/avl-tree-visualizer/manifest";
import { manifest as redBlackTreeVisualizer } from "@/tools/developer/red-black-tree-visualizer/manifest";
import { manifest as brokenBacklinkFinder } from "@/tools/seo/broken-backlink-finder/manifest";
import { manifest as brokenLinkChecker } from "@/tools/seo/broken-link-checker/manifest";
import { manifest as coreWebVitalsAnalyzer } from "@/tools/seo/core-web-vitals-analyzer/manifest";
import { manifest as gtmDatalayerHelper } from "@/tools/seo/gtm-datalayer-helper/manifest";
import { manifest as metaRobotsTester } from "@/tools/seo/meta-robots-tester/manifest";
import { manifest as mobileFriendlyTester } from "@/tools/seo/mobile-friendly-tester/manifest";
import { manifest as referringDomainsExplorer } from "@/tools/seo/referring-domains-explorer/manifest";
import { manifest as sslHttpsChecker } from "@/tools/seo/ssl-https-checker/manifest";
import { manifest as openGraphSocialCardGenerator } from "@/tools/seo/open-graph-social-card-generator/manifest";
import { manifest as twitterCardPreviewTool } from "@/tools/seo/twitter-card-preview-tool/manifest";

import { manifest as imageLensFlare } from "@/tools/image/image-lens-flare/manifest";
import { manifest as imageBloomTool } from "@/tools/image/image-bloom-tool/manifest";
import { manifest as imageAsciiBw } from "@/tools/image/image-ascii-bw/manifest";
import { manifest as imageCharcoalTool } from "@/tools/image/image-charcoal-tool/manifest";
import { manifest as imageOilPaint } from "@/tools/image/image-oil-paint/manifest";
import { manifest as imageWatercolor } from "@/tools/image/image-watercolor/manifest";
import { manifest as imagePencilSketch } from "@/tools/image/image-pencil-sketch/manifest";
import { manifest as imageNeonGlow } from "@/tools/image/image-neon-glow/manifest";
import { manifest as imageDuotoneMaker } from "@/tools/image/image-duotone-maker/manifest";
import { manifest as imageThermalCam } from "@/tools/image/image-thermal-cam/manifest";
import { manifest as textReverseWords } from "@/tools/text/text-reverse-words/manifest";
import { manifest as textScrambler } from "@/tools/text/text-scrambler/manifest";
import { manifest as textMirrorText } from "@/tools/text/text-mirror-text/manifest";
import { manifest as textRainbowText } from "@/tools/text/text-rainbow-text/manifest";
import { manifest as textTypewriterEffect } from "@/tools/text/text-typewriter-effect/manifest";
import { manifest as fractionCalculator } from "@/tools/calculators/fraction-calculator/manifest";
import { manifest as ratioCalculator } from "@/tools/calculators/ratio-calculator/manifest";
import { manifest as probabilityCalc } from "@/tools/calculators/probability-calc/manifest";
import { manifest as oddsCalculator } from "@/tools/calculators/odds-calculator/manifest";
import { manifest as scaleCalculator } from "@/tools/calculators/scale-calculator/manifest";
import { manifest as subnetMaskValidator } from "@/tools/network-security/subnet-mask-validator/manifest";
import { manifest as tlsVersionChecker } from "@/tools/network-security/tls-version-checker/manifest";
import { manifest as certSigningRequestGen } from "@/tools/network-security/cert-signing-request-gen/manifest";
import { manifest as passwordPolicyChecker } from "@/tools/network-security/password-policy-checker/manifest";
import { manifest as hashIdentifier } from "@/tools/network-security/hash-identifier/manifest";
import { manifest as meetingRoomBooker } from "@/tools/business/meeting-room-booker/manifest";
import { manifest as businessCardMaker } from "@/tools/business/business-card-maker/manifest";
import { manifest as inventoryTracker } from "@/tools/business/inventory-tracker/manifest";
import { manifest as projectBudgetCalc } from "@/tools/business/project-budget-calc/manifest";
import { manifest as contractDateCalc } from "@/tools/business/contract-date-calc/manifest";
import { manifest as vocabularyTrainer } from "@/tools/education/vocabulary-trainer/manifest";
import { manifest as quizMaker } from "@/tools/education/quiz-maker/manifest";
import { manifest as mathDrillGenerator } from "@/tools/education/math-drill-generator/manifest";
import { manifest as periodicTableLookup } from "@/tools/education/periodic-table-lookup/manifest";
import { manifest as grammarCheckerBasic } from "@/tools/education/grammar-checker-basic/manifest";
import { manifest as socialMediaPostScheduler } from "@/tools/social/social-media-post-scheduler/manifest";
import { manifest as hashtagDensityChecker } from "@/tools/social/hashtag-density-checker/manifest";
import { manifest as socialMediaInfluencerCalc } from "@/tools/social/social-media-influencer-calc/manifest";
import { manifest as socialMediaAbTester } from "@/tools/social/social-media-ab-tester/manifest";
import { manifest as socialMediaStoryTemplate } from "@/tools/social/social-media-story-template/manifest";
import { manifest as imageClaheTool } from "@/tools/image/image-clahe-tool/manifest";
import { manifest as imageStarryNight } from "@/tools/image/image-starry-night/manifest";
import { manifest as imageDotPattern } from "@/tools/image/image-dot-pattern/manifest";
import { manifest as imageScreenTone } from "@/tools/image/image-screen-tone/manifest";
import { manifest as imageCrosshatch } from "@/tools/image/image-crosshatch/manifest";
import { manifest as imagePlasmaEffect } from "@/tools/image/image-plasma-effect/manifest";
import { manifest as imageFractalTool } from "@/tools/image/image-fractal-tool/manifest";
import { manifest as imageRainbowNoise } from "@/tools/image/image-rainbow-noise/manifest";
import { manifest as imageOldPhoto } from "@/tools/image/image-old-photo/manifest";
import { manifest as imageTvStatic } from "@/tools/image/image-tv-static/manifest";
import { manifest as textBinaryToOctal } from "@/tools/text/text-binary-to-octal/manifest";
import { manifest as textOctalToBinary } from "@/tools/text/text-octal-to-binary/manifest";
import { manifest as textHexToText } from "@/tools/text/text-hex-to-text/manifest";
import { manifest as textTextToHex } from "@/tools/text/text-text-to-hex/manifest";
import { manifest as textBase32Encoder } from "@/tools/text/text-base32-encoder/manifest";
import { manifest as textBase58Encoder } from "@/tools/text/text-base58-encoder/manifest";
import { manifest as textBase85Encoder } from "@/tools/text/text-base85-encoder/manifest";
import { manifest as textUrlDecode } from "@/tools/text/text-url-decode/manifest";
import { manifest as textHtmlDecode } from "@/tools/text/text-html-decode/manifest";
import { manifest as textXmlEscape } from "@/tools/text/text-xml-escape/manifest";
import { manifest as concentrationCalc } from "@/tools/calculators/concentration-calc/manifest";
import { manifest as molarityCalc } from "@/tools/calculators/molarity-calc/manifest";
import { manifest as dilutionCalc } from "@/tools/calculators/dilution-calc/manifest";
import { manifest as enzymeActivityCalc } from "@/tools/calculators/enzyme-activity-calc/manifest";
import { manifest as molecularWeightCalc } from "@/tools/calculators/molecular-weight-calc/manifest";
import { manifest as subnetCidrMerger } from "@/tools/network-security/subnet-cidr-merger/manifest";
import { manifest as ipv4RangeSplitter } from "@/tools/network-security/ipv4-range-splitter/manifest";
import { manifest as portRangeScannerRef } from "@/tools/network-security/port-range-scanner-ref/manifest";
import { manifest as wifiPasswordGen } from "@/tools/network-security/wifi-password-gen/manifest";
import { manifest as pemKeyParser } from "@/tools/network-security/pem-key-parser/manifest";
import { manifest as audioFormatReference } from "@/tools/audio-video/audio-format-reference/manifest";
import { manifest as videoFormatReference } from "@/tools/audio-video/video-format-reference/manifest";
import { manifest as codecComparison } from "@/tools/audio-video/codec-comparison/manifest";
import { manifest as bitrateCalc } from "@/tools/audio-video/bitrate-calc/manifest";
import { manifest as sampleRateConverter } from "@/tools/audio-video/sample-rate-converter/manifest";
import { manifest as flashcardImporter } from "@/tools/education/flashcard-importer/manifest";
import { manifest as lessonPlanGenerator } from "@/tools/education/lesson-plan-generator/manifest";
import { manifest as gradeCalc } from "@/tools/education/grade-calc/manifest";
import { manifest as gpaCalculator } from "@/tools/education/gpa-calculator/manifest";
import { manifest as rubricMaker } from "@/tools/education/rubric-maker/manifest";
import { manifest as socialMediaContestRunner } from "@/tools/social/social-media-contest-runner/manifest";
import { manifest as socialMediaGiveaway } from "@/tools/social/social-media-giveaway/manifest";
import { manifest as socialContentCalendar } from "@/tools/social/social-content-calendar/manifest";
import { manifest as socialEngagementPredictor } from "@/tools/social/social-engagement-predictor/manifest";
import { manifest as socialHashtagGenerator } from "@/tools/social/social-hashtag-generator/manifest";
import { manifest as employeeShiftTrader } from "@/tools/business/employee-shift-trader/manifest";
import { manifest as inventoryForecast } from "@/tools/business/inventory-forecast/manifest";
import { manifest as markupCalcAdv } from "@/tools/business/markup-calc-adv/manifest";
import { manifest as breakEvenAnalyzer } from "@/tools/business/break-even-analyzer/manifest";
import { manifest as cashFlowProjector } from "@/tools/business/cash-flow-projector/manifest";
import { manifest as imageHistogramViewer } from "@/tools/image/image-histogram-viewer/manifest";
import { manifest as imageAnnotationTool } from "@/tools/image/image-annotation-tool/manifest";
import { manifest as imageFrameMaker } from "@/tools/image/image-frame-maker/manifest";
import { manifest as imageTextCaption } from "@/tools/image/image-text-caption/manifest";
import { manifest as imageMemeGenerator } from "@/tools/image/image-meme-generator/manifest";
import { manifest as imagePassportPhoto } from "@/tools/image/image-passport-photo/manifest";
import { manifest as imageProfilePicCropper } from "@/tools/image/image-profile-pic-cropper/manifest";
import { manifest as imagePlaceholderGen } from "@/tools/image/image-placeholder-gen/manifest";
import { manifest as imageSolidColorGen } from "@/tools/image/image-solid-color-gen/manifest";
import { manifest as imageUpscaler } from "@/tools/image/image-upscaler/manifest";
import { manifest as textAcronymExpander } from "@/tools/text/text-acronym-expander/manifest";
import { manifest as textOxfordCommaFixer } from "@/tools/text/text-oxford-comma-fixer/manifest";
import { manifest as textSentenceSplitter } from "@/tools/text/text-sentence-splitter/manifest";
import { manifest as textMorseEncoder } from "@/tools/text/text-morse-encoder/manifest";
import { manifest as textPigLatinDecoder } from "@/tools/text/text-pig-latin-decoder/manifest";
import { manifest as dataUnitConverter } from "@/tools/calculators/data-unit-converter/manifest";
import { manifest as percentageOfCalc } from "@/tools/calculators/percentage-of-calc/manifest";
import { manifest as mortgageInsuranceCalc } from "@/tools/calculators/mortgage-insurance-calc/manifest";
import { manifest as stampDutyCalc } from "@/tools/calculators/stamp-duty-calc/manifest";
import { manifest as capitalGainsCalc } from "@/tools/calculators/capital-gains-calc/manifest";
import { manifest as audioReverbReference } from "@/tools/audio-video/audio-reverb-reference/manifest";
import { manifest as audioNoiseFloorRef } from "@/tools/audio-video/audio-noise-floor-ref/manifest";
import { manifest as videoFpsReference } from "@/tools/audio-video/video-fps-reference/manifest";
import { manifest as videoBitrateGuide } from "@/tools/audio-video/video-bitrate-guide/manifest";
import { manifest as audioLufsReference } from "@/tools/audio-video/audio-lufs-reference/manifest";
import { manifest as flashcardDeckOrganizer } from "@/tools/education/flashcard-deck-organizer/manifest";
import { manifest as classScheduleMaker } from "@/tools/education/class-schedule-maker/manifest";
import { manifest as wordSearchMaker } from "@/tools/education/word-search-maker/manifest";
import { manifest as crosswordClueGen } from "@/tools/education/crossword-clue-gen/manifest";
import { manifest as assignmentRubricMaker } from "@/tools/education/assignment-rubric-maker/manifest";
import { manifest as socialMediaBioOptimizer } from "@/tools/social/social-media-bio-optimizer/manifest";
import { manifest as socialThreadGenerator } from "@/tools/social/social-thread-generator/manifest";
import { manifest as socialPollCreator } from "@/tools/social/social-poll-creator/manifest";
import { manifest as socialContentIdeas } from "@/tools/social/social-content-ideas/manifest";
import { manifest as socialEngagementTracker2 } from "@/tools/social/social-engagement-tracker-2/manifest";
import { manifest as invoiceTemplateGen } from "@/tools/business/invoice-template-gen/manifest";
import { manifest as purchaseOrderGen } from "@/tools/business/purchase-order-gen/manifest";
import { manifest as taxCalculatorPro } from "@/tools/business/tax-calculator-pro/manifest";
import { manifest as depreciationCalc } from "@/tools/business/depreciation-calc/manifest";
import { manifest as inventoryReorderCalc } from "@/tools/business/inventory-reorder-calc/manifest";
import { manifest as imageHalftoneGenerator } from "@/tools/image/image-halftone-generator/manifest";
import { manifest as imageCartoonizer } from "@/tools/image/image-cartoonizer/manifest";
import { manifest as imageTransparentPngMaker } from "@/tools/image/image-transparent-png-maker/manifest";
import { manifest as imageDpiChanger } from "@/tools/image/image-dpi-changer/manifest";
import { manifest as imagePrintSizeCalc } from "@/tools/image/image-print-size-calc/manifest";
import { manifest as imageTilingPattern } from "@/tools/image/image-tiling-pattern/manifest";
import { manifest as imagePolaroidMaker } from "@/tools/image/image-polaroid-maker/manifest";
import { manifest as imageInstagramGrid } from "@/tools/image/image-instagram-grid/manifest";
import { manifest as imageGifMaker } from "@/tools/image/image-gif-maker/manifest";
import { manifest as imageDiffCompare } from "@/tools/image/image-diff-compare/manifest";
import { manifest as textAcronymGenerator } from "@/tools/text/text-acronym-generator/manifest";
import { manifest as textHeadlineAnalyzer } from "@/tools/text/text-headline-analyzer/manifest";
import { manifest as textHiddenCharsDetector } from "@/tools/text/text-hidden-chars-detector/manifest";
import { manifest as textLetterCounter } from "@/tools/text/text-letter-counter/manifest";
import { manifest as textPalindromeChecker } from "@/tools/text/text-palindrome-checker/manifest";
import { manifest as textSyllableCounter } from "@/tools/text/text-syllable-counter/manifest";
import { manifest as textReducer } from "@/tools/text/text-reducer/manifest";
import { manifest as textAntonymFinder } from "@/tools/text/text-antonym-finder/manifest";
import { manifest as textClicheFinder } from "@/tools/text/text-cliche-finder/manifest";
import { manifest as textReadingLevel } from "@/tools/text/text-reading-level/manifest";
import { manifest as binaryCalculator } from "@/tools/calculators/binary-calculator/manifest";
import { manifest as hexadecimalCalculator } from "@/tools/calculators/hexadecimal-calculator/manifest";
import { manifest as fibonacciGenerator } from "@/tools/calculators/fibonacci-generator/manifest";
import { manifest as standardDeviationCalc } from "@/tools/calculators/standard-deviation-calc/manifest";
import { manifest as scientificNotationConverter } from "@/tools/calculators/scientific-notation-converter/manifest";
import { manifest as audioConverterRef } from "@/tools/audio-video/audio-converter-ref/manifest";
import { manifest as videoCompressionGuide } from "@/tools/audio-video/video-compression-guide/manifest";
import { manifest as audioTrimmerRef } from "@/tools/audio-video/audio-trimmer-ref/manifest";
import { manifest as videoMergerRef } from "@/tools/audio-video/video-merger-ref/manifest";
import { manifest as audioEqualizerRef } from "@/tools/audio-video/audio-equalizer-ref/manifest";
import { manifest as batesNumberingTool } from "@/tools/pdf/bates-numbering-tool/manifest";
import { manifest as pdfDeskewTool } from "@/tools/pdf/pdf-deskew-tool/manifest";
import { manifest as pdfCombinePages } from "@/tools/pdf/pdf-combine-pages/manifest";
import { manifest as pdfCropToContent } from "@/tools/pdf/pdf-crop-to-content/manifest";
import { manifest as pdfScanOptimizer } from "@/tools/pdf/pdf-scan-optimizer/manifest";
import { manifest as burnRateCalc } from "@/tools/business/burn-rate-calc/manifest";
import { manifest as churnRateCalc } from "@/tools/business/churn-rate-calc/manifest";
import { manifest as annuityCalculator } from "@/tools/business/annuity-calculator/manifest";
import { manifest as bondYieldCalc } from "@/tools/business/bond-yield-calc/manifest";
import { manifest as checklistCreator } from "@/tools/business/checklist-creator/manifest";
import { manifest as anagramSolver } from "@/tools/education/anagram-solver/manifest";
import { manifest as brailleTranslator } from "@/tools/education/braille-translator/manifest";
import { manifest as chemicalEquationBalancer } from "@/tools/education/chemical-equation-balancer/manifest";
import { manifest as bibliographyGenerator } from "@/tools/education/bibliography-generator/manifest";
import { manifest as binaryDecimalHexConverter } from "@/tools/education/binary-decimal-hex-converter/manifest";
import { manifest as argon2ParamCalculator } from "@/tools/network-security/argon2-param-calculator/manifest";
import { manifest as rsaEncryptionTool } from "@/tools/network-security/rsa-encryption-tool/manifest";
import { manifest as xssSanitizer } from "@/tools/network-security/xss-sanitizer/manifest";
import { manifest as sslExpiryTracker } from "@/tools/network-security/ssl-expiry-tracker/manifest";
import { manifest as nslookupReference } from "@/tools/network-security/nslookup-reference/manifest";
import { manifest as imageColorContrastChecker } from "@/tools/image/image-color-contrast-checker/manifest";
import { manifest as imageColorMixer } from "@/tools/image/image-color-mixer/manifest";
import { manifest as imageFaviconGenerator } from "@/tools/image/image-favicon-generator/manifest";
import { manifest as imageAppIconGenerator } from "@/tools/image/image-app-icon-generator/manifest";
import { manifest as imageGifOptimizer } from "@/tools/image/image-gif-optimizer/manifest";
import { manifest as imageGifSplitter } from "@/tools/image/image-gif-splitter/manifest";
import { manifest as imageDimensionsInspector } from "@/tools/image/image-dimensions-inspector/manifest";
import { manifest as imageNoiseTextureGen } from "@/tools/image/image-noise-texture-gen/manifest";
import { manifest as imagePhotoGrid } from "@/tools/image/image-photo-grid/manifest";
import { manifest as imageVintageFilter } from "@/tools/image/image-vintage-filter/manifest";
import { manifest as toneGenerator } from "@/tools/audio-video/tone-generator/manifest";
import { manifest as noiseGenerator } from "@/tools/audio-video/noise-generator/manifest";
import { manifest as metronome } from "@/tools/audio-video/metronome/manifest";
import { manifest as bpmDetector } from "@/tools/audio-video/bpm-detector/manifest";
import { manifest as subtitleEditor } from "@/tools/audio-video/subtitle-editor/manifest";
import { manifest as videoAspectRatioChanger } from "@/tools/audio-video/video-aspect-ratio-changer/manifest";
import { manifest as videoLoopMaker } from "@/tools/audio-video/video-loop-maker/manifest";
import { manifest as slowMotionMaker } from "@/tools/audio-video/slow-motion-maker/manifest";
import { manifest as timeLapseMaker } from "@/tools/audio-video/time-lapse-maker/manifest";
import { manifest as audiogramMaker } from "@/tools/audio-video/audiogram-maker/manifest";
import { manifest as textActiveVoiceSuggester } from "@/tools/text/text-active-voice-suggester/manifest";
import { manifest as textDefinitionLookup } from "@/tools/text/text-definition-lookup/manifest";
import { manifest as textBibliographyCitation } from "@/tools/text/text-bibliography-citation/manifest";
import { manifest as textAbstractGenerator } from "@/tools/text/text-abstract-generator/manifest";
import { manifest as textReadingTimeEstimator } from "@/tools/text/text-reading-time-estimator/manifest";
import { manifest as textWordCloudData } from "@/tools/text/text-word-cloud-data/manifest";
import { manifest as textGrammarFixer } from "@/tools/text/text-grammar-fixer/manifest";
import { manifest as textPlagiarismChecker } from "@/tools/text/text-plagiarism-checker/manifest";
import { manifest as textToneAnalyzer } from "@/tools/text/text-tone-analyzer/manifest";
import { manifest as textKeywordExtractor } from "@/tools/text/text-keyword-extractor/manifest";
import { manifest as calorieCalculator } from "@/tools/calculators/calorie-calculator/manifest";
import { manifest as salaryTaxCalculator } from "@/tools/calculators/salary-tax-calculator/manifest";
import { manifest as stepsToMilesConverter } from "@/tools/calculators/steps-to-miles-converter/manifest";
import { manifest as speedConverter } from "@/tools/calculators/speed-converter/manifest";
import { manifest as areaConverter } from "@/tools/calculators/area-converter/manifest";
import { manifest as accelerationForceCalc } from "@/tools/education/acceleration-force-calc/manifest";
import { manifest as threeDShapeConstructor } from "@/tools/education/3d-shape-constructor/manifest";
import { manifest as audiobookPlayerRef } from "@/tools/education/audiobook-player-ref/manifest";
import { manifest as periodicTableQuiz } from "@/tools/education/periodic-table-quiz/manifest";
import { manifest as unitConversionTutor } from "@/tools/education/unit-conversion-tutor/manifest";
import { manifest as arrCalculator } from "@/tools/business/arr-calculator/manifest";
import { manifest as cryptoPriceWidget } from "@/tools/business/crypto-price-widget/manifest";
import { manifest as stockTickerWidget } from "@/tools/business/stock-ticker-widget/manifest";
import { manifest as emailSignatureGenerator } from "@/tools/business/email-signature-generator/manifest";
import { manifest as meetingMinutesTemplate } from "@/tools/business/meeting-minutes-template/manifest";
import { manifest as htaccessRulesGenerator } from "@/tools/network-security/htaccess-rules-generator/manifest";
import { manifest as freeProxyVerifier } from "@/tools/network-security/free-proxy-verifier/manifest";
import { manifest as mxBlacklistChecker } from "@/tools/network-security/mx-blacklist-checker/manifest";
import { manifest as blacklistIpChecker } from "@/tools/network-security/blacklist-ip-checker/manifest";
import { manifest as userAgentGenerator } from "@/tools/network-security/user-agent-generator/manifest";
import { manifest as jwtDebugger } from "@/tools/network-security/jwt-debugger/manifest";
import { manifest as fileHashValidator } from "@/tools/network-security/file-hash-validator/manifest";
import { manifest as macAddressVendorLookup } from "@/tools/network-security/mac-address-vendor-lookup/manifest";
import { manifest as passwordStrengthMeter } from "@/tools/network-security/password-strength-meter/manifest";
import { manifest as strongPasswordGenerator } from "@/tools/network-security/strong-password-generator/manifest";
import { manifest as hashingTool } from "@/tools/network-security/hashing-tool/manifest";
import { manifest as emailHeaderAnalyzer } from "@/tools/network-security/email-header-analyzer/manifest";
import { manifest as userAgentParser } from "@/tools/network-security/user-agent-parser/manifest";
import { manifest as cspGenerator } from "@/tools/network-security/csp-generator/manifest";
import { manifest as cidrIpCalculator } from "@/tools/network-security/cidr-ip-calculator/manifest";
import { manifest as seoContentScorecardAudit } from "@/tools/seo/seo-content-scorecard-audit/manifest";
import { manifest as titleTagCtrEstimator } from "@/tools/seo/title-tag-ctr-estimator/manifest";
import { manifest as googleSerpSnippetPreview } from "@/tools/seo/google-serp-snippet-preview/manifest";
import { manifest as metaDescriptionAbTester } from "@/tools/seo/meta-description-ab-tester/manifest";
import { manifest as addLineNumbers } from "@/tools/developer/add-line-numbers/manifest";
import { manifest as cssTransformGenerator } from "@/tools/developer/css-transform-generator/manifest";
import { manifest as cssFontFaceGenerator } from "@/tools/developer/css-font-face-generator/manifest";
import { manifest as cssTextShadowGenerator } from "@/tools/developer/css-text-shadow-generator/manifest";
import { manifest as argon2HashGenerator } from "@/tools/developer/argon2-hash-generator/manifest";
import { manifest as cssBorderRadiusGenerator } from "@/tools/developer/css-border-radius-generator/manifest";
import { manifest as cssBlendModePreviewer } from "@/tools/developer/css-blend-mode-previewer/manifest";
import { manifest as cssTriangleGenerator } from "@/tools/developer/css-triangle-generator/manifest";
import { manifest as cssSpecificityCalculator } from "@/tools/developer/css-specificity-calculator/manifest";
import { manifest as cssSelectorTester } from "@/tools/developer/css-selector-tester/manifest";
import { manifest as atbashCipher } from "@/tools/developer/atbash-cipher/manifest";
import { manifest as cssTransitionGenerator } from "@/tools/developer/css-transition-generator/manifest";
import { manifest as cssButtonGenerator } from "@/tools/developer/css-button-generator/manifest";
import { manifest as autoprefixer } from "@/tools/developer/autoprefixer/manifest";
import { manifest as bcryptGeneratorVerifier } from "@/tools/developer/bcrypt-generator-verifier/manifest";
import { manifest as cssBeautifier } from "@/tools/developer/css-beautifier/manifest";
import { manifest as cssColorFormatConverter } from "@/tools/developer/css-color-format-converter/manifest";
import { manifest as cssGlassmorphismGenerator } from "@/tools/developer/css-glassmorphism-generator/manifest";
import { manifest as base58EncodeDecode } from "@/tools/developer/base58-encode-decode/manifest";
import { manifest as base64ImageEncodeDecode } from "@/tools/developer/base64-image-encode-decode/manifest";
import { manifest as cssNeumorphismGenerator } from "@/tools/developer/css-neumorphism-generator/manifest";
import { manifest as cssBackgroundPatternGenerator } from "@/tools/developer/css-background-pattern-generator/manifest";
import { manifest as cssFilterGenerator } from "@/tools/developer/css-filter-generator/manifest";
import { manifest as cssCubicBezierEditor } from "@/tools/developer/css-cubic-bezier-editor/manifest";
import { manifest as cssScrollbarStyler } from "@/tools/developer/css-scrollbar-styler/manifest";
import { manifest as cssClipPathGenerator } from "@/tools/developer/css-clip-path-generator/manifest";
import { manifest as aesEncryptDecrypt } from "@/tools/developer/aes-encrypt-decrypt/manifest";
import { manifest as cssUnitsConverter } from "@/tools/developer/css-units-converter/manifest";
import { manifest as cssAnimationKeyframesGenerator } from "@/tools/developer/css-animation-keyframes-generator/manifest";
import { manifest as corsTesterConfigGenerator } from "@/tools/developer/cors-tester-config-generator/manifest";
import { manifest as base64ToHexConverter } from "@/tools/developer/base64-to-hex-converter/manifest";
import { manifest as base32EncodeDecode } from "@/tools/developer/base32-encode-decode/manifest";
import { manifest as cssLoaderSpinnerGenerator } from "@/tools/developer/css-loader-spinner-generator/manifest";
import { manifest as cssMinifier } from "@/tools/developer/css-minifier/manifest";
import { manifest as cssBoxShadowGenerator } from "@/tools/developer/css-box-shadow-generator/manifest";
import { manifest as cssFlexboxPlayground } from "@/tools/developer/css-flexbox-playground/manifest";
import { manifest as cssGridGenerator } from "@/tools/developer/css-grid-generator/manifest";
import { manifest as base64EncodeDecode } from "@/tools/developer/base64-encode-decode/manifest";
import { manifest as cssGradientGenerator } from "@/tools/developer/css-gradient-generator/manifest";
import { manifest as binaryEncodeDecode } from "@/tools/developer/binary-encode-decode/manifest";
import { manifest as cssMediaQueryGenerator } from "@/tools/developer/css-media-query-generator/manifest";
import { manifest as cssTooltipGenerator } from "@/tools/developer/css-tooltip-generator/manifest";
import { manifest as arrowFunctionConverter } from "@/tools/developer/arrow-function-converter/manifest";
import { manifest as cssAspectRatioHelper } from "@/tools/developer/css-aspect-ratio-helper/manifest";
import { manifest as crc32Calculator } from "@/tools/developer/crc32-calculator/manifest";

import { manifest as redirectGenerator } from "@/tools/seo/redirect-generator/manifest";
import { manifest as serpFeatureDetector } from "@/tools/seo/serp-feature-detector/manifest";
import { manifest as anchorTextOptimizerAnalyzer } from "@/tools/seo/anchor-text-optimizer-analyzer/manifest";
import { manifest as canonicalTagChecker } from "@/tools/seo/canonical-tag-checker/manifest";
import { manifest as contentWordCountTool } from "@/tools/seo/content-word-count-tool/manifest";
import { manifest as imageSaturationHueEditor } from "@/tools/image/image-saturation-hue-editor/manifest";
import { manifest as colorBlindnessSimulator } from "@/tools/image/color-blindness-simulator/manifest";
import { manifest as aspectRatioCropPresets } from "@/tools/image/aspect-ratio-crop-presets/manifest";
import { manifest as gifResizer } from "@/tools/image/gif-resizer/manifest";
import { manifest as noiseTextureGenerator } from "@/tools/image/noise-texture-generator/manifest";
import { manifest as bulkImageConverter } from "@/tools/image/bulk-image-converter/manifest";
import { manifest as memeGenerator } from "@/tools/image/meme-generator/manifest";
import { manifest as base64ToImageDecoder } from "@/tools/image/base64-to-image-decoder/manifest";
import { manifest as imageSharpen } from "@/tools/image/image-sharpen/manifest";
import { manifest as hexRgbHslConverter } from "@/tools/image/hex-rgb-hsl-converter/manifest";
import { manifest as imageBackgroundChanger } from "@/tools/image/image-background-changer/manifest";
import { manifest as roundCornersTool } from "@/tools/image/round-corners-tool/manifest";
import { manifest as svgOptimizerMinifier } from "@/tools/image/svg-optimizer-minifier/manifest";
import { manifest as photoGridMaker } from "@/tools/image/photo-grid-maker/manifest";
import { manifest as complementaryColorFinder } from "@/tools/image/complementary-color-finder/manifest";
import { manifest as imageSpriteSheetGenerator } from "@/tools/image/image-sprite-sheet-generator/manifest";
import { manifest as imageBrightnessContrastEditor } from "@/tools/image/image-brightness-contrast-editor/manifest";
import { manifest as imageTextCaptionAdder } from "@/tools/image/image-text-caption-adder/manifest";
import { manifest as imagePlaceholderGenerator } from "@/tools/image/image-placeholder-generator/manifest";
import { manifest as bulkImageResizer } from "@/tools/image/bulk-image-resizer/manifest";
import { manifest as imageExifStripper } from "@/tools/image/image-exif-stripper/manifest";
import { manifest as imageColorPicker } from "@/tools/image/image-color-picker/manifest";
import { manifest as bulkWatermark } from "@/tools/image/bulk-watermark/manifest";
import { manifest as screenshotBeautifier } from "@/tools/image/screenshot-beautifier/manifest";
import { manifest as appIconGenerator } from "@/tools/image/app-icon-generator/manifest";
import { manifest as imageDrawingMarkup } from "@/tools/image/image-drawing-markup/manifest";
import { manifest as gifMaker } from "@/tools/image/gif-maker/manifest";
import { manifest as imageToSvgVectorizer } from "@/tools/image/image-to-svg-vectorizer/manifest";
import { manifest as spriteSheetSplitter } from "@/tools/image/sprite-sheet-splitter/manifest";
import { manifest as browserFrameMockup } from "@/tools/image/browser-frame-mockup/manifest";
import { manifest as qrCodeScanner } from "@/tools/image/qr-code-scanner/manifest";
import { manifest as gradientImageGenerator } from "@/tools/image/gradient-image-generator/manifest";
import { manifest as svgToPngConverter } from "@/tools/image/svg-to-png-converter/manifest";
import { manifest as imageFilterEffects } from "@/tools/image/image-filter-effects/manifest";
import { manifest as blobShapeGenerator } from "@/tools/image/blob-shape-generator/manifest";
import { manifest as colorPaletteExtractor } from "@/tools/image/color-palette-extractor/manifest";
import { manifest as webpAnimationMaker } from "@/tools/image/webp-animation-maker/manifest";
import { manifest as pngToIcoConverter } from "@/tools/image/png-to-ico-converter/manifest";
import { manifest as imageExifViewer } from "@/tools/image/image-exif-viewer/manifest";
import { manifest as imageSteganographyDecoder } from "@/tools/image/image-steganography-decoder/manifest";
import { manifest as solidColorImageGenerator } from "@/tools/image/solid-color-image-generator/manifest";
import { manifest as imageFormatConverter } from "@/tools/image/image-format-converter/manifest";
import { manifest as waveDividerSvgGenerator } from "@/tools/image/wave-divider-svg-generator/manifest";
import { manifest as faviconGenerator } from "@/tools/image/favicon-generator/manifest";
import { manifest as apngMaker } from "@/tools/image/apng-maker/manifest";
import { manifest as qrCodeGeneratorImage } from "@/tools/image/qr-code-generator-image/manifest";
import { manifest as photoVintageRetroFilter } from "@/tools/image/photo-vintage-retro-filter/manifest";
import { manifest as deviceMockupGenerator } from "@/tools/image/device-mockup-generator/manifest";
import { manifest as imageRotatorFlipper } from "@/tools/image/image-rotator-flipper/manifest";
import { manifest as gifOptimizer } from "@/tools/image/gif-optimizer/manifest";
import { manifest as duotoneImageMaker } from "@/tools/image/duotone-image-maker/manifest";
import { manifest as profilePictureCropper } from "@/tools/image/profile-picture-cropper/manifest";
import { manifest as colorShadesTintsGenerator } from "@/tools/image/color-shades-tints-generator/manifest";
import { manifest as patternGeneratorSvgCss } from "@/tools/image/pattern-generator-svg-css/manifest";
import { manifest as gifSplitter } from "@/tools/image/gif-splitter/manifest";
import { manifest as passportIdPhotoMaker } from "@/tools/image/passport-id-photo-maker/manifest";
import { manifest as dummyImageGenerator } from "@/tools/image/dummy-image-generator/manifest";
import { manifest as imageSteganographyHide } from "@/tools/image/image-steganography-hide/manifest";
import { manifest as bulkImageCompressor } from "@/tools/image/bulk-image-compressor/manifest";
import { manifest as colorMixerBlender } from "@/tools/image/color-mixer-blender/manifest";
import { manifest as imageToBase64Encoder } from "@/tools/image/image-to-base64-encoder/manifest";
import { manifest as colorContrastChecker } from "@/tools/image/color-contrast-checker/manifest";
import { manifest as virustotalStyleScanner } from "@/tools/network-security/virustotal-style-scanner/manifest";
import { manifest as contentReadabilitySeoAnalyzer } from "@/tools/network-security/content-readability-seo-analyzer/manifest";
import { manifest as keywordDensityAnalyzerSeo } from "@/tools/network-security/keyword-density-analyzer-seo/manifest";
import { manifest as apiAuthenticationHeaderBuilder } from "@/tools/network-security/api-authentication-header-builder/manifest";
import { manifest as cryptographicKeyGenerator } from "@/tools/network-security/cryptographic-key-generator/manifest";
import { manifest as dmarcRecordAnalyzer } from "@/tools/network-security/dmarc-record-analyzer/manifest";
import { manifest as corsTest } from "@/tools/network-security/cors-test/manifest";
import { manifest as dnssecValidator } from "@/tools/network-security/dnssec-validator/manifest";
import { manifest as tracerouteOnline } from "@/tools/network-security/traceroute-online/manifest";
import { manifest as pingOnline } from "@/tools/network-security/ping-online/manifest";
import { manifest as hstsPreloadChecker } from "@/tools/network-security/hsts-preload-checker/manifest";
import { manifest as sslTlsCertificateValidator } from "@/tools/network-security/ssl-tls-certificate-validator/manifest";
import { manifest as httpSecurityHeadersTest } from "@/tools/network-security/http-security-headers-test/manifest";
import { manifest as sslTlsCipherSuiteAnalyzer } from "@/tools/network-security/ssl-tls-cipher-suite-analyzer/manifest";
import { manifest as whoisDomainChecker } from "@/tools/network-security/whois-domain-checker/manifest";
import { manifest as termsConditionsGenerator } from "@/tools/network-security/terms-conditions-generator/manifest";
import { manifest as cookieConsentBannerGenerator } from "@/tools/network-security/cookie-consent-banner-generator/manifest";
import { manifest as torNodeChecker } from "@/tools/network-security/tor-node-checker/manifest";
import { manifest as dnsLeakTest } from "@/tools/network-security/dns-leak-test/manifest";
import { manifest as spfRecordChecker } from "@/tools/network-security/spf-record-checker/manifest";
import { manifest as portScan } from "@/tools/network-security/port-scan/manifest";
import { manifest as subdomainFinder } from "@/tools/network-security/subdomain-finder/manifest";
import { manifest as disclaimerGenerator } from "@/tools/network-security/disclaimer-generator/manifest";
import { manifest as ipGeolocation } from "@/tools/network-security/ip-geolocation/manifest";
import { manifest as proxyVpnDetection } from "@/tools/network-security/proxy-vpn-detection/manifest";
import { manifest as webrtcLeakTest } from "@/tools/network-security/webrtc-leak-test/manifest";
import { manifest as dkimRecordValidator } from "@/tools/network-security/dkim-record-validator/manifest";
import { manifest as robotsTxtParserValidator } from "@/tools/network-security/robots-txt-parser-validator/manifest";
import { manifest as myIpAddress } from "@/tools/network-security/my-ip-address/manifest";
import { manifest as reverseIpLookup } from "@/tools/network-security/reverse-ip-lookup/manifest";
import { manifest as urlSandboxLinkScanner } from "@/tools/network-security/url-sandbox-link-scanner/manifest";
import { manifest as privacyPolicyGenerator } from "@/tools/network-security/privacy-policy-generator/manifest";
import { manifest as breachPwnedEmailChecker } from "@/tools/network-security/breach-pwned-email-checker/manifest";

import { manifest as htmlFormBuilder } from "@/tools/developer/html-form-builder/manifest";
import { manifest as jsonSchemaValidator } from "@/tools/developer/json-schema-validator/manifest";
import { manifest as html5SemanticChecker } from "@/tools/developer/html5-semantic-checker/manifest";
import { manifest as htmlEmailCssInliner } from "@/tools/developer/html-email-css-inliner/manifest";
import { manifest as jsonValidator } from "@/tools/developer/json-validator/manifest";
import { manifest as htmlEscapeUnescape } from "@/tools/developer/html-escape-unescape/manifest";
import { manifest as jsonSchemaGenerator } from "@/tools/developer/json-schema-generator/manifest";
import { manifest as hmacGenerator } from "@/tools/developer/hmac-generator/manifest";
import { manifest as dataUriGenerator } from "@/tools/developer/data-uri-generator/manifest";
import { manifest as csvColumnReorder } from "@/tools/developer/csv-column-reorder/manifest";
import { manifest as hexEncodeDecode } from "@/tools/developer/hex-encode-decode/manifest";
import { manifest as jsonFlattener } from "@/tools/developer/json-flattener/manifest";
import { manifest as jsonToCsv } from "@/tools/developer/json-to-csv/manifest";
import { manifest as jsonDiffCompare } from "@/tools/developer/json-diff-compare/manifest";
import { manifest as regexTester } from "@/tools/developer/regex-tester/manifest";
import { manifest as csvToJson } from "@/tools/developer/csv-to-json/manifest";
import { manifest as htmlToPlainText } from "@/tools/developer/html-to-plain-text/manifest";
import { manifest as cronExpressionBuilder } from "@/tools/developer/cron-expression-builder/manifest";
import { manifest as fileHashCalculator } from "@/tools/developer/file-hash-calculator/manifest";
import { manifest as htmlLivePreviewEditor } from "@/tools/developer/html-live-preview-editor/manifest";
import { manifest as htmlToJsxConverter } from "@/tools/developer/html-to-jsx-converter/manifest";
import { manifest as urlEncodeDecode } from "@/tools/developer/url-encode-decode/manifest";
import { manifest as regexGenerator } from "@/tools/developer/regex-generator/manifest";
import { manifest as htmlValidator } from "@/tools/developer/html-validator/manifest";
import { manifest as uuidGeneratorV2 } from "@/tools/developer/uuid-generator-v2/manifest";
import { manifest as jsonViewerTree } from "@/tools/developer/json-viewer-tree/manifest";
import { manifest as htmlImageExtractor } from "@/tools/developer/html-image-extractor/manifest";
import { manifest as dataUriDecoder } from "@/tools/developer/data-uri-decoder/manifest";
import { manifest as markdownPreview } from "@/tools/developer/markdown-preview/manifest";
import { manifest as htmlToPugConverter } from "@/tools/developer/html-to-pug-converter/manifest";
import { manifest as checksumVerifier } from "@/tools/developer/checksum-verifier/manifest";
import { manifest as htmlToMarkdown } from "@/tools/developer/html-to-markdown/manifest";
import { manifest as htmlMinifier } from "@/tools/developer/html-minifier/manifest";
import { manifest as jsonToCClass } from "@/tools/developer/json-to-c-class/manifest";
import { manifest as base64DecodeImage } from "@/tools/developer/base64-decode-image/manifest";
import { manifest as htmlEntityEncodeDecode } from "@/tools/developer/html-entity-encode-decode/manifest";
import { manifest as htmlBoilerplateGenerator } from "@/tools/developer/html-boilerplate-generator/manifest";
import { manifest as jsonMinifier } from "@/tools/developer/json-minifier/manifest";
import { manifest as htmlLinkExtractor } from "@/tools/developer/html-link-extractor/manifest";
import { manifest as jsonToGoStruct } from "@/tools/developer/json-to-go-struct/manifest";
import { manifest as jsonKeySorter } from "@/tools/developer/json-key-sorter/manifest";
import { manifest as gzipDeflateText } from "@/tools/developer/gzip-deflate-text/manifest";
import { manifest as htmlBeautifier } from "@/tools/developer/html-beautifier/manifest";
import { manifest as markdownToHtml } from "@/tools/developer/markdown-to-html/manifest";
import { manifest as htmlTableToCsv } from "@/tools/developer/html-table-to-csv/manifest";
import { manifest as htmlTableGenerator } from "@/tools/developer/html-table-generator/manifest";
import { manifest as hexToBase64Converter } from "@/tools/developer/hex-to-base64-converter/manifest";
import { manifest as pdfExtractImages } from "@/tools/pdf/pdf-extract-images/manifest";
import { manifest as pdfCrop } from "@/tools/pdf/pdf-crop/manifest";
import { manifest as pdfToMarkdown } from "@/tools/pdf/pdf-to-markdown/manifest";
import { manifest as pdfToImages } from "@/tools/pdf/pdf-to-images/manifest";
import { manifest as pdfToSingleImage } from "@/tools/pdf/pdf-to-single-image/manifest";
import { manifest as pdfToWord } from "@/tools/pdf/pdf-to-word/manifest";
import { manifest as pdfToHtml } from "@/tools/pdf/pdf-to-html/manifest";
import { manifest as pdfAddMargins } from "@/tools/pdf/pdf-add-margins/manifest";
import { manifest as pdfToJson } from "@/tools/pdf/pdf-to-json/manifest";
import { manifest as pdfUnlock } from "@/tools/pdf/pdf-unlock/manifest";
import { manifest as pdfAddBorder } from "@/tools/pdf/pdf-add-border/manifest";
import { manifest as pdfPageLabels } from "@/tools/pdf/pdf-page-labels/manifest";
import { manifest as pdfAddStamp } from "@/tools/pdf/pdf-add-stamp/manifest";
import { manifest as pdfExtractAttachments } from "@/tools/pdf/pdf-extract-attachments/manifest";
import { manifest as pdfCompress } from "@/tools/pdf/pdf-compress/manifest";
import { manifest as pdfAddBackground } from "@/tools/pdf/pdf-add-background/manifest";
import { manifest as pdfBwOptimize } from "@/tools/pdf/pdf-bw-optimize/manifest";
import { manifest as pdfToPowerpoint } from "@/tools/pdf/pdf-to-powerpoint/manifest";
import { manifest as pdfPermissions } from "@/tools/pdf/pdf-permissions/manifest";
import { manifest as pdfToGif } from "@/tools/pdf/pdf-to-gif/manifest";
import { manifest as pdfDownsampleImages } from "@/tools/pdf/pdf-downsample-images/manifest";
import { manifest as pdfTocGenerator } from "@/tools/pdf/pdf-toc-generator/manifest";
import { manifest as pdfAddAttachment } from "@/tools/pdf/pdf-add-attachment/manifest";
import { manifest as pdfRotate } from "@/tools/pdf/pdf-rotate/manifest";
import { manifest as pdfAddPageNumbers } from "@/tools/pdf/pdf-add-page-numbers/manifest";
import { manifest as pdfMetadata } from "@/tools/pdf/pdf-metadata/manifest";
import { manifest as pdfAddHeaderFooter } from "@/tools/pdf/pdf-add-header-footer/manifest";
import { manifest as pdfToXml } from "@/tools/pdf/pdf-to-xml/manifest";
import { manifest as pdfToSvg } from "@/tools/pdf/pdf-to-svg/manifest";
import { manifest as pdfDespeckle } from "@/tools/pdf/pdf-despeckle/manifest";
import { manifest as pdfBookmarks } from "@/tools/pdf/pdf-bookmarks/manifest";
import { manifest as pdfExtractText } from "@/tools/pdf/pdf-extract-text/manifest";
import { manifest as pdfSplit } from "@/tools/pdf/pdf-split/manifest";
import { manifest as pdfMerge } from "@/tools/pdf/pdf-merge/manifest";
import { manifest as pdfDeskew } from "@/tools/pdf/pdf-deskew/manifest";
import { manifest as pdfExtractPages } from "@/tools/pdf/pdf-extract-pages/manifest";
import { manifest as pdfToRtf } from "@/tools/pdf/pdf-to-rtf/manifest";
import { manifest as pdfToExcel } from "@/tools/pdf/pdf-to-excel/manifest";
import { manifest as pdfLinearize } from "@/tools/pdf/pdf-linearize/manifest";
import { manifest as pdfAddWatermark } from "@/tools/pdf/pdf-add-watermark/manifest";
import { manifest as pdfOcr } from "@/tools/pdf/pdf-ocr/manifest";
import { manifest as pdfRemoveWatermark } from "@/tools/pdf/pdf-remove-watermark/manifest";
import { manifest as pdfDeletePages } from "@/tools/pdf/pdf-delete-pages/manifest";
import { manifest as pdfProtect } from "@/tools/pdf/pdf-protect/manifest";
import { manifest as pdfToTiff } from "@/tools/pdf/pdf-to-tiff/manifest";
import { manifest as pdfToEpub } from "@/tools/pdf/pdf-to-epub/manifest";
import { manifest as pdfReorderPages } from "@/tools/pdf/pdf-reorder-pages/manifest";
import { manifest as pdfRepair } from "@/tools/pdf/pdf-repair/manifest";

import { manifest as cssVariablesGenerator } from "@/tools/developer/css-variables-generator/manifest";
import { manifest as slugGeneratorTool } from "@/tools/developer/slug-generator-tool/manifest";
import { manifest as punycodeConverter } from "@/tools/developer/punycode-converter/manifest";
import { manifest as lessToCss } from "@/tools/developer/less-to-css/manifest";
import { manifest as jsLinter } from "@/tools/developer/js-linter/manifest";
import { manifest as countOccurrences } from "@/tools/developer/count-occurrences/manifest";
import { manifest as totpGeneratorTool } from "@/tools/developer/totp-generator-tool/manifest";
import { manifest as wordCharCounter } from "@/tools/developer/word-char-counter/manifest";
import { manifest as removeDuplicateLines } from "@/tools/developer/remove-duplicate-lines/manifest";
import { manifest as cssSpriteTool } from "@/tools/developer/css-sprite-tool/manifest";
import { manifest as commonjsToEsm } from "@/tools/developer/commonjs-to-esm/manifest";
import { manifest as jsonToGraphqlSchema } from "@/tools/developer/json-to-graphql-schema/manifest";
import { manifest as sortLinesTool } from "@/tools/developer/sort-lines-tool/manifest";
import { manifest as jwtVerifier } from "@/tools/developer/jwt-verifier/manifest";
import { manifest as rateLimitCalculator } from "@/tools/developer/rate-limit-calculator/manifest";
import { manifest as randomStringGenerator } from "@/tools/developer/random-string-generator/manifest";
import { manifest as percentEncoding } from "@/tools/developer/percent-encoding/manifest";
import { manifest as stringReverser } from "@/tools/developer/string-reverser/manifest";
import { manifest as stringEscape } from "@/tools/developer/string-escape/manifest";
import { manifest as pbkdf2Generator } from "@/tools/developer/pbkdf2-generator/manifest";
import { manifest as openGraphTagGenerator } from "@/tools/developer/open-graph-tag-generator/manifest";
import { manifest as sha3HashGenerator } from "@/tools/developer/sha3-hash-generator/manifest";
import { manifest as findReplaceMulti } from "@/tools/developer/find-replace-multi/manifest";
import { manifest as cssToScss } from "@/tools/developer/css-to-scss/manifest";
import { manifest as mockApiGenerator } from "@/tools/developer/mock-api-generator/manifest";
import { manifest as jsBundleAnalyzer } from "@/tools/developer/js-bundle-analyzer/manifest";
import { manifest as secretKeyGenerator } from "@/tools/developer/secret-key-generator/manifest";
import { manifest as graphqlExplorer } from "@/tools/developer/graphql-explorer/manifest";
import { manifest as jsonToKotlin } from "@/tools/developer/json-to-kotlin/manifest";
import { manifest as jsonToRust } from "@/tools/developer/json-to-rust/manifest";
import { manifest as removeLineBreaks } from "@/tools/developer/remove-line-breaks/manifest";
import { manifest as jsonToTypescript } from "@/tools/developer/json-to-typescript/manifest";
import { manifest as jsxToJs } from "@/tools/developer/jsx-to-js/manifest";
import { manifest as utf8Viewer } from "@/tools/developer/utf8-viewer/manifest";
import { manifest as sseTester } from "@/tools/developer/sse-tester/manifest";
import { manifest as openapiViewer } from "@/tools/developer/openapi-viewer/manifest";
import { manifest as jsonToYaml } from "@/tools/developer/json-to-yaml/manifest";
import { manifest as quotedPrintable } from "@/tools/developer/quoted-printable/manifest";
import { manifest as htmlEntityReference } from "@/tools/developer/html-entity-reference/manifest";
import { manifest as jsonRpcBuilder } from "@/tools/developer/json-rpc-builder/manifest";
import { manifest as scssToCss } from "@/tools/developer/scss-to-css/manifest";
import { manifest as typescriptPlayground } from "@/tools/developer/typescript-playground/manifest";
import { manifest as cssGridBuilder } from "@/tools/developer/css-grid-builder/manifest";
import { manifest as sha1HashGenerator } from "@/tools/developer/sha1-hash-generator/manifest";
import { manifest as jsToTypescript } from "@/tools/developer/js-to-typescript/manifest";
import { manifest as nanoidGenerator } from "@/tools/developer/nanoid-generator/manifest";
import { manifest as jsonToQueryString } from "@/tools/developer/json-to-query-string/manifest";
import { manifest as jsUnitTestRunner } from "@/tools/developer/js-unit-test-runner/manifest";
import { manifest as faviconLinkGenerator } from "@/tools/developer/favicon-link-generator/manifest";
import { manifest as iframeGenerator } from "@/tools/developer/iframe-generator/manifest";
import { manifest as jsonpathEvaluator } from "@/tools/developer/jsonpath-evaluator/manifest";
import { manifest as curlBuilder } from "@/tools/developer/curl-builder/manifest";
import { manifest as ecdsaKeyGenerator } from "@/tools/developer/ecdsa-key-generator/manifest";
import { manifest as removeConsoleLog } from "@/tools/developer/remove-console-log/manifest";
import { manifest as randomBytesGenerator } from "@/tools/developer/random-bytes-generator/manifest";
import { manifest as cssResetGenerator } from "@/tools/developer/css-reset-generator/manifest";
import { manifest as urlSafeBase64Tool } from "@/tools/developer/url-safe-base64-tool/manifest";
import { manifest as xorCipher } from "@/tools/developer/xor-cipher/manifest";
import { manifest as jsMinifier } from "@/tools/developer/js-minifier/manifest";
import { manifest as rsaKeyGenerator } from "@/tools/developer/rsa-key-generator/manifest";
import { manifest as jsPlayground } from "@/tools/developer/js-playground/manifest";
import { manifest as jsObfuscator } from "@/tools/developer/js-obfuscator/manifest";
import { manifest as jwtGenerator } from "@/tools/developer/jwt-generator/manifest";
import { manifest as trimWhitespace } from "@/tools/developer/trim-whitespace/manifest";
import { manifest as tsToJs } from "@/tools/developer/ts-to-js/manifest";
import { manifest as cacheControlBuilder } from "@/tools/developer/cache-control-builder/manifest";
import { manifest as jsonToPython } from "@/tools/developer/json-to-python/manifest";
import { manifest as textToArray } from "@/tools/developer/text-to-array/manifest";
import { manifest as jsonToJava } from "@/tools/developer/json-to-java/manifest";
import { manifest as tailwindToCss } from "@/tools/developer/tailwind-to-css/manifest";
import { manifest as webhookTester } from "@/tools/developer/webhook-tester/manifest";
import { manifest as whitespaceDetector } from "@/tools/developer/whitespace-detector/manifest";
import { manifest as ndjsonViewer } from "@/tools/developer/ndjson-viewer/manifest";
import { manifest as rsaEncryptDecryptTool } from "@/tools/developer/rsa-encrypt-decrypt-tool/manifest";
import { manifest as varToLetConst } from "@/tools/developer/var-to-let-const/manifest";
import { manifest as passphraseGenerator } from "@/tools/developer/passphrase-generator/manifest";
import { manifest as sha256HashGenerator } from "@/tools/developer/sha256-hash-generator/manifest";
import { manifest as openapiToClient } from "@/tools/developer/openapi-to-client/manifest";
import { manifest as contentNegotiationHelper } from "@/tools/developer/content-negotiation-helper/manifest";
import { manifest as textDiff } from "@/tools/developer/text-diff/manifest";
import { manifest as jsonEscapeUnescape } from "@/tools/developer/json-escape-unescape/manifest";
import { manifest as morseCodeConverter } from "@/tools/developer/morse-code-converter/manifest";
import { manifest as jsonToJsObject } from "@/tools/developer/json-to-js-object/manifest";
import { manifest as semverCalculator } from "@/tools/developer/semver-calculator/manifest";
import { manifest as websocketTester } from "@/tools/developer/websocket-tester/manifest";
import { manifest as curlToCode } from "@/tools/developer/curl-to-code/manifest";
import { manifest as jsComplexityAnalyzer } from "@/tools/developer/js-complexity-analyzer/manifest";
import { manifest as jsonToSql } from "@/tools/developer/json-to-sql/manifest";
import { manifest as reverseLines } from "@/tools/developer/reverse-lines/manifest";
import { manifest as jsDeobfuscator } from "@/tools/developer/js-deobfuscator/manifest";
import { manifest as callbackToPromise } from "@/tools/developer/callback-to-promise/manifest";
import { manifest as jsonToToml } from "@/tools/developer/json-to-toml/manifest";
import { manifest as unicodeEscape } from "@/tools/developer/unicode-escape/manifest";
import { manifest as multiToSingleLine } from "@/tools/developer/multi-to-single-line/manifest";
import { manifest as jsdocGenerator } from "@/tools/developer/jsdoc-generator/manifest";
import { manifest as jsBeautifier } from "@/tools/developer/js-beautifier/manifest";
import { manifest as jsonToXml } from "@/tools/developer/json-to-xml/manifest";
import { manifest as restApiClient } from "@/tools/developer/rest-api-client/manifest";
import { manifest as esmToCommonjs } from "@/tools/developer/esm-to-commonjs/manifest";
import { manifest as uuidV1Tool } from "@/tools/developer/uuid-v1-tool/manifest";
import { manifest as sha512HashGenerator } from "@/tools/developer/sha512-hash-generator/manifest";
import { manifest as cssUnusedRules } from "@/tools/developer/css-unused-rules/manifest";
import { manifest as uuidV4Tool } from "@/tools/developer/uuid-v4-tool/manifest";
import { manifest as ulidGenerator } from "@/tools/developer/ulid-generator/manifest";
import { manifest as uuidV5Tool } from "@/tools/developer/uuid-v5-tool/manifest";
import { manifest as md5HashGenerator } from "@/tools/developer/md5-hash-generator/manifest";
import { manifest as rot13Rot47 } from "@/tools/developer/rot13-rot47/manifest";
import { manifest as scryptGenerator } from "@/tools/developer/scrypt-generator/manifest";
import { manifest as httpHeadersAnalyzer } from "@/tools/developer/http-headers-analyzer/manifest";
import { manifest as pdfSanitize } from "@/tools/pdf/pdf-sanitize/manifest";
import { manifest as pdfWordCount } from "@/tools/pdf/pdf-word-count/manifest";
import { manifest as pdfMergeBookmarks } from "@/tools/pdf/pdf-merge-bookmarks/manifest";
import { manifest as pdfNUp } from "@/tools/pdf/pdf-n-up/manifest";
import { manifest as pdfSplitAdvanced } from "@/tools/pdf/pdf-split-advanced/manifest";
import { manifest as pdfAutoRotate } from "@/tools/pdf/pdf-auto-rotate/manifest";
import { manifest as officeToPdf } from "@/tools/pdf/office-to-pdf/manifest";
import { manifest as pdfInsertPages } from "@/tools/pdf/pdf-insert-pages/manifest";
import { manifest as pdfScaleFit } from "@/tools/pdf/pdf-scale-fit/manifest";
import { manifest as pdfSpellCheck } from "@/tools/pdf/pdf-spell-check/manifest";
import { manifest as pdfRenameContent } from "@/tools/pdf/pdf-rename-content/manifest";
import { manifest as pdfGrayscale } from "@/tools/pdf/pdf-grayscale/manifest";
import { manifest as pdfMetadataViewer } from "@/tools/pdf/pdf-metadata-viewer/manifest";
import { manifest as pdfSummarizeAi } from "@/tools/pdf/pdf-summarize-ai/manifest";
import { manifest as pdfPageLabelEditor } from "@/tools/pdf/pdf-page-label-editor/manifest";
import { manifest as pdfPageReorderCustom } from "@/tools/pdf/pdf-page-reorder-custom/manifest";
import { manifest as pdfStampDocument } from "@/tools/pdf/pdf-stamp-document/manifest";
import { manifest as pdfFindReplace } from "@/tools/pdf/pdf-find-replace/manifest";
import { manifest as pdfPageSize } from "@/tools/pdf/pdf-page-size/manifest";
import { manifest as pdfOcrSearchable } from "@/tools/pdf/pdf-ocr-searchable/manifest";
import { manifest as pdfBatchProcessor } from "@/tools/pdf/pdf-batch-processor/manifest";
import { manifest as pdfPageBlankInsert } from "@/tools/pdf/pdf-page-blank-insert/manifest";
import { manifest as pdfAttachmentEmbed } from "@/tools/pdf/pdf-attachment-embed/manifest";
import { manifest as pdfPageDeleteRange } from "@/tools/pdf/pdf-page-delete-range/manifest";
import { manifest as pdfBorderFrame } from "@/tools/pdf/pdf-border-frame/manifest";
import { manifest as pdfTocFromHeadings } from "@/tools/pdf/pdf-toc-from-headings/manifest";
import { manifest as pdfExtractAnnotations } from "@/tools/pdf/pdf-extract-annotations/manifest";
import { manifest as pdfToOdt } from "@/tools/pdf/pdf-to-odt/manifest";
import { manifest as pdfVisualDiff } from "@/tools/pdf/pdf-visual-diff/manifest";
import { manifest as pdfCompareDiff } from "@/tools/pdf/pdf-compare-diff/manifest";
import { manifest as pdfPermanentRedact } from "@/tools/pdf/pdf-permanent-redact/manifest";
import { manifest as pdfFontLister } from "@/tools/pdf/pdf-font-lister/manifest";
import { manifest as pdfMarginPadding } from "@/tools/pdf/pdf-margin-padding/manifest";
import { manifest as pdfTranslate } from "@/tools/pdf/pdf-translate/manifest";
import { manifest as pdfOrganize } from "@/tools/pdf/pdf-organize/manifest";
import { manifest as pdfUaAccessibility } from "@/tools/pdf/pdf-ua-accessibility/manifest";
import { manifest as pdfAutoRedactPii } from "@/tools/pdf/pdf-auto-redact-pii/manifest";
import { manifest as pdfToPdfa } from "@/tools/pdf/pdf-to-pdfa/manifest";
import { manifest as pdfPortfolioBuilder } from "@/tools/pdf/pdf-portfolio-builder/manifest";
import { manifest as pdfHyperlinkEditor } from "@/tools/pdf/pdf-hyperlink-editor/manifest";
import { manifest as pdfHighlightExtractor } from "@/tools/pdf/pdf-highlight-extractor/manifest";
import { manifest as pdfDigitalSignature } from "@/tools/pdf/pdf-digital-signature/manifest";
import { manifest as pdfThumbnailSheet } from "@/tools/pdf/pdf-thumbnail-sheet/manifest";
import { manifest as pdf2upJoin } from "@/tools/pdf/pdf-2up-join/manifest";
import { manifest as pdfProtectEncrypt } from "@/tools/pdf/pdf-protect-encrypt/manifest";
import { manifest as pdfAnnotate } from "@/tools/pdf/pdf-annotate/manifest";
import { manifest as pdfSplitByBookmarks } from "@/tools/pdf/pdf-split-by-bookmarks/manifest";
import { manifest as pdfFontEmbedder } from "@/tools/pdf/pdf-font-embedder/manifest";
import { manifest as pdfExtractTextBulk } from "@/tools/pdf/pdf-extract-text-bulk/manifest";
import { manifest as pdfBatchPipeline } from "@/tools/pdf/pdf-batch-pipeline/manifest";
import { manifest as pdfDuplicatePages } from "@/tools/pdf/pdf-duplicate-pages/manifest";
import { manifest as pdfBackgroundImage } from "@/tools/pdf/pdf-background-image/manifest";
import { manifest as pdfExportFormData } from "@/tools/pdf/pdf-export-form-data/manifest";
import { manifest as pdfPosterSplit } from "@/tools/pdf/pdf-poster-split/manifest";
import { manifest as pdfMeasureCalibrate } from "@/tools/pdf/pdf-measure-calibrate/manifest";
import { manifest as pdfAnnotationSummary } from "@/tools/pdf/pdf-annotation-summary/manifest";
import { manifest as pdfSplitSpreads } from "@/tools/pdf/pdf-split-spreads/manifest";
import { manifest as pdfMeasureTool } from "@/tools/pdf/pdf-measure-tool/manifest";
import { manifest as pdfExtractAttachmentsBulk } from "@/tools/pdf/pdf-extract-attachments-bulk/manifest";
import { manifest as pdfDocumentAssembler } from "@/tools/pdf/pdf-document-assembler/manifest";
import { manifest as pdfImportFormData } from "@/tools/pdf/pdf-import-form-data/manifest";
import { manifest as pdfXExport } from "@/tools/pdf/pdf-x-export/manifest";
import { manifest as pdfLayersEditor } from "@/tools/pdf/pdf-layers-editor/manifest";
import { manifest as pdfPageRotateRange } from "@/tools/pdf/pdf-page-rotate-range/manifest";
import { manifest as pdfHighlightMarkup } from "@/tools/pdf/pdf-highlight-markup/manifest";
import { manifest as pdfBookmarksFromText } from "@/tools/pdf/pdf-bookmarks-from-text/manifest";
import { manifest as webpageToPdf } from "@/tools/pdf/webpage-to-pdf/manifest";
import { manifest as pdfStampConfidential } from "@/tools/pdf/pdf-stamp-confidential/manifest";
import { manifest as pdfLayersManager } from "@/tools/pdf/pdf-layers-manager/manifest";
import { manifest as pdfReadability } from "@/tools/pdf/pdf-readability/manifest";
import { manifest as pdfStampAdvanced } from "@/tools/pdf/pdf-stamp-advanced/manifest";
import { manifest as pdfTablesCsv } from "@/tools/pdf/pdf-tables-csv/manifest";
import { manifest as pdfSplitBySize } from "@/tools/pdf/pdf-split-by-size/manifest";
import { manifest as pdfAiChat } from "@/tools/pdf/pdf-ai-chat/manifest";
import { manifest as pdfRedactPattern } from "@/tools/pdf/pdf-redact-pattern/manifest";
import { manifest as pdfReverseOrder } from "@/tools/pdf/pdf-reverse-order/manifest";
import { manifest as pdfAddPageNumbersAdvanced } from "@/tools/pdf/pdf-add-page-numbers-advanced/manifest";
import { manifest as pdfFlipbook } from "@/tools/pdf/pdf-flipbook/manifest";
import { manifest as pdfCompressTarget } from "@/tools/pdf/pdf-compress-target/manifest";
import { manifest as pdfFullTextSearch } from "@/tools/pdf/pdf-full-text-search/manifest";
import { manifest as pdfMergeCombineMultiple } from "@/tools/pdf/pdf-merge-combine-multiple/manifest";
import { manifest as pdfDrawSignature } from "@/tools/pdf/pdf-draw-signature/manifest";
import { manifest as pdfExtractImagesBulk } from "@/tools/pdf/pdf-extract-images-bulk/manifest";
import { manifest as pdfInvertColors } from "@/tools/pdf/pdf-invert-colors/manifest";
import { manifest as pdfWatermarkAdvanced } from "@/tools/pdf/pdf-watermark-advanced/manifest";
import { manifest as pdfTranslateDevice } from "@/tools/pdf/pdf-translate-device/manifest";
import { manifest as epubToPdfTool } from "@/tools/pdf/epub-to-pdf-tool/manifest";
import { manifest as pdfCleanMetadata } from "@/tools/pdf/pdf-clean-metadata/manifest";
import { manifest as pdfPageExtractRange } from "@/tools/pdf/pdf-page-extract-range/manifest";
import { manifest as pdfBookletPrint } from "@/tools/pdf/pdf-booklet-print/manifest";
import { manifest as imageToPdfTool } from "@/tools/pdf/image-to-pdf-tool/manifest";
import { manifest as pdfRepairTool } from "@/tools/pdf/pdf-repair-tool/manifest";
import { manifest as pdfToPdfx } from "@/tools/pdf/pdf-to-pdfx/manifest";
import { manifest as pdfRotatePermanent } from "@/tools/pdf/pdf-rotate-permanent/manifest";
import { manifest as pdfSummarizer } from "@/tools/pdf/pdf-summarizer/manifest";
import { manifest as pdfFillForm } from "@/tools/pdf/pdf-fill-form/manifest";
import { manifest as pdfInterleaveMerge } from "@/tools/pdf/pdf-interleave-merge/manifest";
import { manifest as pdfChat } from "@/tools/pdf/pdf-chat/manifest";
import { manifest as pdfPageResizeIndividual } from "@/tools/pdf/pdf-page-resize-individual/manifest";
import { manifest as pdfRedactSearch } from "@/tools/pdf/pdf-redact-search/manifest";
import { manifest as pdfTextToSpeech } from "@/tools/pdf/pdf-text-to-speech/manifest";
import { manifest as pdfHeaderFooterAdvanced } from "@/tools/pdf/pdf-header-footer-advanced/manifest";
import { manifest as pdfRemoveBlankPages } from "@/tools/pdf/pdf-remove-blank-pages/manifest";
import { manifest as pdfFormBuilder } from "@/tools/pdf/pdf-form-builder/manifest";

import { manifest as pdfOrganizeTool } from "@/tools/pdf/pdf-organize-tool/manifest";
import { manifest as pdfAutoRedactPiiTool } from "@/tools/pdf/pdf-auto-redact-pii-tool/manifest";
import { manifest as pdfMeasureDistanceArea } from "@/tools/pdf/pdf-measure-distance-area/manifest";
import { manifest as pdfToPdfxPrint } from "@/tools/pdf/pdf-to-pdfx-print/manifest";
import { manifest as pdfHyperlinkEditorTool } from "@/tools/pdf/pdf-hyperlink-editor-tool/manifest";
import { manifest as pdfImportFormDataTool } from "@/tools/pdf/pdf-import-form-data-tool/manifest";
import { manifest as pdfDigitalSignatureTool } from "@/tools/pdf/pdf-digital-signature-tool/manifest";
import { manifest as pdfMergeBookmarksTool } from "@/tools/pdf/pdf-merge-bookmarks-tool/manifest";
import { manifest as pdfCompressTargetSize } from "@/tools/pdf/pdf-compress-target-size/manifest";
import { manifest as pdfHighlightExtractorTool } from "@/tools/pdf/pdf-highlight-extractor-tool/manifest";
import { manifest as pdfInterleaveMergeTool } from "@/tools/pdf/pdf-interleave-merge-tool/manifest";
import { manifest as pdfFullTextSearchTool } from "@/tools/pdf/pdf-full-text-search-tool/manifest";
import { manifest as pdfAnnotateTool } from "@/tools/pdf/pdf-annotate-tool/manifest";
import { manifest as pdfDrawSignatureTool } from "@/tools/pdf/pdf-draw-signature-tool/manifest";
import { manifest as pdfFontListerTool } from "@/tools/pdf/pdf-font-lister-tool/manifest";
import { manifest as pdfAnnotationSummaryTool } from "@/tools/pdf/pdf-annotation-summary-tool/manifest";
import { manifest as pdfNUpBooklet } from "@/tools/pdf/pdf-n-up-booklet/manifest";
import { manifest as pdfDocumentAssemblerTool } from "@/tools/pdf/pdf-document-assembler-tool/manifest";
import { manifest as pdfLayersOcgManager } from "@/tools/pdf/pdf-layers-ocg-manager/manifest";
import { manifest as pdf2upJoinTool } from "@/tools/pdf/pdf-2up-join-tool/manifest";
import { manifest as pdfDuplicatePagesTool } from "@/tools/pdf/pdf-duplicate-pages-tool/manifest";
import { manifest as pdfAutoRotateTool } from "@/tools/pdf/pdf-auto-rotate-tool/manifest";
import { manifest as pdfFlipbookGenerator } from "@/tools/pdf/pdf-flipbook-generator/manifest";
import { manifest as pdfFindReplaceTool } from "@/tools/pdf/pdf-find-replace-tool/manifest";
import { manifest as pdfFontEmbedderTool } from "@/tools/pdf/pdf-font-embedder-tool/manifest";
import { manifest as pdfWordCountTool } from "@/tools/pdf/pdf-word-count-tool/manifest";
import { manifest as pdfFormBuilderTool } from "@/tools/pdf/pdf-form-builder-tool/manifest";
import { manifest as pdfToPdfaArchive } from "@/tools/pdf/pdf-to-pdfa-archive/manifest";
import { manifest as pdfExportFormDataTool } from "@/tools/pdf/pdf-export-form-data-tool/manifest";
import { manifest as pdfLayersOcgEditor } from "@/tools/pdf/pdf-layers-ocg-editor/manifest";
import { manifest as pdfCropMarksBleed } from "@/tools/pdf/pdf-crop-marks-bleed/manifest";
import { manifest as pdfStampOverlayTool } from "@/tools/pdf/pdf-stamp-overlay-tool/manifest";
import { manifest as pdfBatchProcessorTool } from "@/tools/pdf/pdf-batch-processor-tool/manifest";
import { manifest as pdfRenameFromContent } from "@/tools/pdf/pdf-rename-from-content/manifest";
import { manifest as pdfSpellCheckTool } from "@/tools/pdf/pdf-spell-check-tool/manifest";
import { manifest as pdfPortfolioBuilderTool } from "@/tools/pdf/pdf-portfolio-builder-tool/manifest";
import { manifest as pdfTextToSpeechTool } from "@/tools/pdf/pdf-text-to-speech-tool/manifest";
import { manifest as pdfReverseOrderTool } from "@/tools/pdf/pdf-reverse-order-tool/manifest";
import { manifest as pdfFillFormTool } from "@/tools/pdf/pdf-fill-form-tool/manifest";
import { manifest as pdfHighlightMarkupTool } from "@/tools/pdf/pdf-highlight-markup-tool/manifest";
import { manifest as pdfInsertPagesTool } from "@/tools/pdf/pdf-insert-pages-tool/manifest";
import { manifest as pdfExtractAnnotationsTool } from "@/tools/pdf/pdf-extract-annotations-tool/manifest";
import { manifest as pdfMetadataViewerTool } from "@/tools/pdf/pdf-metadata-viewer-tool/manifest";
import { manifest as pdfPageLabelEditorTool } from "@/tools/pdf/pdf-page-label-editor-tool/manifest";
import { manifest as pdfThumbnailContactSheet } from "@/tools/pdf/pdf-thumbnail-contact-sheet/manifest";
import { manifest as pdfReadabilityStats } from "@/tools/pdf/pdf-readability-stats/manifest";
import { manifest as pdfRedactPatternTool } from "@/tools/pdf/pdf-redact-pattern-tool/manifest";
import { manifest as pdfSplitSpreadsTool } from "@/tools/pdf/pdf-split-spreads-tool/manifest";
import { manifest as pdfPermanentRedactTool } from "@/tools/pdf/pdf-permanent-redact-tool/manifest";
import { manifest as pdfMeasureCalibrateTool } from "@/tools/pdf/pdf-measure-calibrate-tool/manifest";
import { manifest as jsPlaygroundRepl } from "@/tools/developer/js-playground-repl/manifest";
import { manifest as jsonToTsInterface } from "@/tools/developer/json-to-ts-interface/manifest";
import { manifest as gitlabCiGenerator } from "@/tools/developer/gitlab-ci-generator/manifest";
import { manifest as jsonToJavaPojo } from "@/tools/developer/json-to-java-pojo/manifest";
import { manifest as cssResetNormalize } from "@/tools/developer/css-reset-normalize/manifest";
import { manifest as gitCommandBuilder } from "@/tools/developer/git-command-builder/manifest";
import { manifest as jsBundleSizeAnalyzer } from "@/tools/developer/js-bundle-size-analyzer/manifest";
import { manifest as dockerfileGenerator } from "@/tools/developer/dockerfile-generator/manifest";
import { manifest as jsToTypescriptConverter } from "@/tools/developer/js-to-typescript-converter/manifest";
import { manifest as jsObjectToJson } from "@/tools/developer/js-object-to-json/manifest";
import { manifest as helmValuesHelper } from "@/tools/developer/helm-values-helper/manifest";
import { manifest as cssAnimationGenerator } from "@/tools/developer/css-animation-generator/manifest";
import { manifest as markdownToHtmlConverter } from "@/tools/developer/markdown-to-html-converter/manifest";
import { manifest as javascriptMinifier } from "@/tools/developer/javascript-minifier/manifest";
import { manifest as jsonToPythonClass } from "@/tools/developer/json-to-python-class/manifest";
import { manifest as cssToScssConverter } from "@/tools/developer/css-to-scss-converter/manifest";
import { manifest as lessToCssCompiler } from "@/tools/developer/less-to-css-compiler/manifest";
import { manifest as codeToImage } from "@/tools/developer/code-to-image/manifest";
import { manifest as mergeConflictResolver } from "@/tools/developer/merge-conflict-resolver/manifest";
import { manifest as astExplorer } from "@/tools/developer/ast-explorer/manifest";
import { manifest as changelogGenerator } from "@/tools/developer/changelog-generator/manifest";
import { manifest as kubernetesManifest } from "@/tools/developer/kubernetes-manifest/manifest";
import { manifest as dependencyGraphVisualizer } from "@/tools/developer/dependency-graph-visualizer/manifest";
import { manifest as gitDiffViewer } from "@/tools/developer/git-diff-viewer/manifest";
import { manifest as eslintConfigGenerator } from "@/tools/developer/eslint-config-generator/manifest";
import { manifest as columnExtractor } from "@/tools/developer/column-extractor/manifest";
import { manifest as jsonFlattenerTool } from "@/tools/developer/json-flattener-tool/manifest";
import { manifest as mockRestApi } from "@/tools/developer/mock-rest-api/manifest";
import { manifest as apacheHtaccessGenerator } from "@/tools/developer/apache-htaccess-generator/manifest";
import { manifest as jsonToJsLiteral } from "@/tools/developer/json-to-js-literal/manifest";
import { manifest as multiLineToSingle } from "@/tools/developer/multi-line-to-single/manifest";
import { manifest as jsonToRustStruct } from "@/tools/developer/json-to-rust-struct/manifest";
import { manifest as makefileGenerator } from "@/tools/developer/makefile-generator/manifest";
import { manifest as githubActionsGenerator } from "@/tools/developer/github-actions-generator/manifest";
import { manifest as conventionalCommitBuilder } from "@/tools/developer/conventional-commit-builder/manifest";
import { manifest as javascriptObfuscator } from "@/tools/developer/javascript-obfuscator/manifest";
import { manifest as jwtSigner } from "@/tools/developer/jwt-signer/manifest";
import { manifest as jsLinterBrowser } from "@/tools/developer/js-linter-browser/manifest";
import { manifest as javascriptBeautifier } from "@/tools/developer/javascript-beautifier/manifest";
import { manifest as jsonToKotlinClass } from "@/tools/developer/json-to-kotlin-class/manifest";
import { manifest as gitBranchNaming } from "@/tools/developer/git-branch-naming/manifest";
import { manifest as jsxToJsCompiler } from "@/tools/developer/jsx-to-js-compiler/manifest";
import { manifest as graphqlClient } from "@/tools/developer/graphql-client/manifest";
import { manifest as circleciConfigGenerator } from "@/tools/developer/circleci-config-generator/manifest";

import { manifest as pdfBookletPrintLayout } from "@/tools/pdf/pdf-booklet-print-layout/manifest";
import { manifest as pdfSanitizeRemoveJs } from "@/tools/pdf/pdf-sanitize-remove-js/manifest";
import { manifest as bwScanOptimizer } from "@/tools/pdf/bw-scan-optimizer/manifest";
import { manifest as pdfDeskewStraighten } from "@/tools/pdf/pdf-deskew-straighten/manifest";
import { manifest as pdfUaAccessibilityTool } from "@/tools/pdf/pdf-ua-accessibility-tool/manifest";
import { manifest as pdfSummarizeAiTool } from "@/tools/pdf/pdf-summarize-ai-tool/manifest";
import { manifest as pdfMeasureCalibrateDistance } from "@/tools/pdf/pdf-measure-calibrate-distance/manifest";
import { manifest as pdfScaleFitPage } from "@/tools/pdf/pdf-scale-fit-page/manifest";
import { manifest as pdfCropContentAutotrim } from "@/tools/pdf/pdf-crop-content-autotrim/manifest";
import { manifest as pdfDigitalSignatureCert } from "@/tools/pdf/pdf-digital-signature-cert/manifest";
import { manifest as pdfPageResizeIndividualTool } from "@/tools/pdf/pdf-page-resize-individual-tool/manifest";
import { manifest as pdfGrayscaleTool } from "@/tools/pdf/pdf-grayscale-tool/manifest";
import { manifest as pdfHeaderFooterAdv } from "@/tools/pdf/pdf-header-footer-adv/manifest";
import { manifest as pdfPageDeleteRangeTool } from "@/tools/pdf/pdf-page-delete-range-tool/manifest";
import { manifest as pdfHyperlinkEditorPdf } from "@/tools/pdf/pdf-hyperlink-editor-pdf/manifest";
import { manifest as pdfLinearizeWeb } from "@/tools/pdf/pdf-linearize-web/manifest";
import { manifest as pdfLayersOcgEditorTool } from "@/tools/pdf/pdf-layers-ocg-editor-tool/manifest";
import { manifest as pdfMarginPaddingTool } from "@/tools/pdf/pdf-margin-padding-tool/manifest";
import { manifest as pdfDespeckleClean } from "@/tools/pdf/pdf-despeckle-clean/manifest";
import { manifest as pdfRepairCorrupt } from "@/tools/pdf/pdf-repair-corrupt/manifest";
import { manifest as pdfSplitAdvancedTool } from "@/tools/pdf/pdf-split-advanced-tool/manifest";
import { manifest as pdfPageExtractRangeTool } from "@/tools/pdf/pdf-page-extract-range-tool/manifest";
import { manifest as pdfPortfolioPackageBuilder } from "@/tools/pdf/pdf-portfolio-package-builder/manifest";
import { manifest as pdfWatermarkAdvancedTool } from "@/tools/pdf/pdf-watermark-advanced-tool/manifest";
import { manifest as pdfSummarizerAi } from "@/tools/pdf/pdf-summarizer-ai/manifest";
import { manifest as pdfFontListerEmbedder } from "@/tools/pdf/pdf-font-lister-embedder/manifest";
import { manifest as pdfStampConfidentialTool } from "@/tools/pdf/pdf-stamp-confidential-tool/manifest";
import { manifest as pdfAiChatQa } from "@/tools/pdf/pdf-ai-chat-qa/manifest";
import { manifest as pdfBackgroundImageTool } from "@/tools/pdf/pdf-background-image-tool/manifest";
import { manifest as pdfMergeCombineMultipleTool } from "@/tools/pdf/pdf-merge-combine-multiple-tool/manifest";
import { manifest as pdfFontEmbedderSubsetter } from "@/tools/pdf/pdf-font-embedder-subsetter/manifest";
import { manifest as pdfPosterTileSplit } from "@/tools/pdf/pdf-poster-tile-split/manifest";
import { manifest as pdfBorderFrameTool } from "@/tools/pdf/pdf-border-frame-tool/manifest";
import { manifest as pdfAddPageNumbersAdv } from "@/tools/pdf/pdf-add-page-numbers-adv/manifest";
import { manifest as pdfPageBlankInsertTool } from "@/tools/pdf/pdf-page-blank-insert-tool/manifest";
import { manifest as epubToPdfConverter } from "@/tools/pdf/epub-to-pdf-converter/manifest";
import { manifest as imageToPdfJpgPng } from "@/tools/pdf/image-to-pdf-jpg-png/manifest";
import { manifest as pdfProtectUnlock } from "@/tools/pdf/pdf-protect-unlock/manifest";
import { manifest as pdfPageSizeChange } from "@/tools/pdf/pdf-page-size-change/manifest";
import { manifest as pdfChatQa } from "@/tools/pdf/pdf-chat-qa/manifest";
import { manifest as pdfPageLabelsEditor } from "@/tools/pdf/pdf-page-labels-editor/manifest";
import { manifest as pdfDrawSignaturePlace } from "@/tools/pdf/pdf-draw-signature-place/manifest";
import { manifest as pdfPageRotateRangeTool } from "@/tools/pdf/pdf-page-rotate-range-tool/manifest";
import { manifest as pdfTranslateLayout } from "@/tools/pdf/pdf-translate-layout/manifest";
import { manifest as pdfTablesToCsv } from "@/tools/pdf/pdf-tables-to-csv/manifest";
import { manifest as officeToPdfConverter } from "@/tools/pdf/office-to-pdf-converter/manifest";
import { manifest as pdfStampAdvancedTool } from "@/tools/pdf/pdf-stamp-advanced-tool/manifest";
import { manifest as pdfExportFormDataFdf } from "@/tools/pdf/pdf-export-form-data-fdf/manifest";
import { manifest as pdfPageReorderCustomTool } from "@/tools/pdf/pdf-page-reorder-custom-tool/manifest";
import { manifest as pdfDocumentInfoViewer } from "@/tools/pdf/pdf-document-info-viewer/manifest";
import { manifest as pdfCompareDiffTool } from "@/tools/pdf/pdf-compare-diff-tool/manifest";
import { manifest as pdfFormCreatorBuilder } from "@/tools/pdf/pdf-form-creator-builder/manifest";
import { manifest as webpageUrlToPdf } from "@/tools/pdf/webpage-url-to-pdf/manifest";
import { manifest as batesNumberingLegal } from "@/tools/pdf/bates-numbering-legal/manifest";
import { manifest as pdfBookmarksOutlineEditor } from "@/tools/pdf/pdf-bookmarks-outline-editor/manifest";
import { manifest as pdfAttachmentEmbedTool } from "@/tools/pdf/pdf-attachment-embed-tool/manifest";
import { manifest as pdfFillFormsTool } from "@/tools/pdf/pdf-fill-forms-tool/manifest";
import { manifest as pdfRedactSearchTool } from "@/tools/pdf/pdf-redact-search-tool/manifest";
import { manifest as pdfInvertColorsTool } from "@/tools/pdf/pdf-invert-colors-tool/manifest";
import { manifest as pdfImportFormDataFdf } from "@/tools/pdf/pdf-import-form-data-fdf/manifest";
import { manifest as textTxtToPdf } from "@/tools/pdf/text-txt-to-pdf/manifest";
import { manifest as pdfOverlayStampDocument } from "@/tools/pdf/pdf-overlay-stamp-document/manifest";
import { manifest as jsonToRustStructV2 } from "@/tools/developer/json-to-rust-struct-v2/manifest";
import { manifest as ndjsonViewerTool } from "@/tools/developer/ndjson-viewer-tool/manifest";
import { manifest as apiAuthHeaderBuilder } from "@/tools/developer/api-auth-header-builder/manifest";
import { manifest as uuidV4Generator } from "@/tools/developer/uuid-v4-generator/manifest";
import { manifest as regexToCode } from "@/tools/developer/regex-to-code/manifest";
import { manifest as envFileParser } from "@/tools/developer/env-file-parser/manifest";
import { manifest as tomlToJsonConverter } from "@/tools/developer/toml-to-json-converter/manifest";
import { manifest as jsonFlattenerToolV2 } from "@/tools/developer/json-flattener-tool-v2/manifest";
import { manifest as typescriptToJs } from "@/tools/developer/typescript-to-js/manifest";
import { manifest as sha1HashTool } from "@/tools/developer/sha1-hash-tool/manifest";
import { manifest as openapiToClientSdk } from "@/tools/developer/openapi-to-client-sdk/manifest";
import { manifest as regexReplaceTool } from "@/tools/developer/regex-replace-tool/manifest";
import { manifest as jsxToJsCompilerV2 } from "@/tools/developer/jsx-to-js-compiler-v2/manifest";
import { manifest as gitattributesGenerator } from "@/tools/developer/gitattributes-generator/manifest";
import { manifest as sha512HashTool } from "@/tools/developer/sha512-hash-tool/manifest";
import { manifest as nginxConfigGenerator } from "@/tools/developer/nginx-config-generator/manifest";
import { manifest as dockerComposeGenerator } from "@/tools/developer/docker-compose-generator/manifest";
import { manifest as openapiViewerEditor } from "@/tools/developer/openapi-viewer-editor/manifest";
import { manifest as jsonToPythonClassV2 } from "@/tools/developer/json-to-python-class-v2/manifest";
import { manifest as jsObjectToJsonConverter } from "@/tools/developer/js-object-to-json-converter/manifest";
import { manifest as jwtGeneratorSigner } from "@/tools/developer/jwt-generator-signer/manifest";
import { manifest as jsBeautifierFormatter } from "@/tools/developer/js-beautifier-formatter/manifest";
import { manifest as textDiffCompare } from "@/tools/developer/text-diff-compare/manifest";
import { manifest as uuidV5Generator } from "@/tools/developer/uuid-v5-generator/manifest";
import { manifest as queryStringParser } from "@/tools/developer/query-string-parser/manifest";
import { manifest as websocketClient } from "@/tools/developer/websocket-client/manifest";
import { manifest as sortLinesToolV2 } from "@/tools/developer/sort-lines-tool-v2/manifest";
import { manifest as textToArrayConverter } from "@/tools/developer/text-to-array-converter/manifest";
import { manifest as xmlToJsonConverter } from "@/tools/developer/xml-to-json-converter/manifest";
import { manifest as wordCharLineCounter } from "@/tools/developer/word-char-line-counter/manifest";
import { manifest as cssGridTemplateBuilder } from "@/tools/developer/css-grid-template-builder/manifest";
import { manifest as editorconfigGenerator } from "@/tools/developer/editorconfig-generator/manifest";
import { manifest as protobufDecoder } from "@/tools/developer/protobuf-decoder/manifest";
import { manifest as secretKeyBase64 } from "@/tools/developer/secret-key-base64/manifest";
import { manifest as scryptHashTool } from "@/tools/developer/scrypt-hash-tool/manifest";
import { manifest as jsonToJavaPojoV2 } from "@/tools/developer/json-to-java-pojo-v2/manifest";
import { manifest as jsonToTsInterfaceV2 } from "@/tools/developer/json-to-ts-interface-v2/manifest";
import { manifest as systemdUnitGenerator } from "@/tools/developer/systemd-unit-generator/manifest";
import { manifest as rsaKeyPairGenerator } from "@/tools/developer/rsa-key-pair-generator/manifest";
import { manifest as stringEscapeTool } from "@/tools/developer/string-escape-tool/manifest";
import { manifest as jsonRpcRequestBuilder } from "@/tools/developer/json-rpc-request-builder/manifest";
import { manifest as curlToCodeConverter } from "@/tools/developer/curl-to-code-converter/manifest";
import { manifest as semverCalculatorTool } from "@/tools/developer/semver-calculator-tool/manifest";
import { manifest as jsdocCommentGenerator } from "@/tools/developer/jsdoc-comment-generator/manifest";
import { manifest as regexCheatsheet } from "@/tools/developer/regex-cheatsheet/manifest";
import { manifest as regexMatchHighlighter } from "@/tools/developer/regex-match-highlighter/manifest";
import { manifest as uuidV1Generator } from "@/tools/developer/uuid-v1-generator/manifest";
import { manifest as webhookInspector } from "@/tools/developer/webhook-inspector/manifest";
import { manifest as scssToCssCompiler } from "@/tools/developer/scss-to-css-compiler/manifest";
import { manifest as totp2faGenerator } from "@/tools/developer/totp-2fa-generator/manifest";
import { manifest as reverseLinesText } from "@/tools/developer/reverse-lines-text/manifest";
import { manifest as sourceMapVisualizer } from "@/tools/developer/source-map-visualizer/manifest";
import { manifest as tailwindToCssTool } from "@/tools/developer/tailwind-to-css-tool/manifest";
import { manifest as prettierConfigGenerator } from "@/tools/developer/prettier-config-generator/manifest";
import { manifest as gitignoreGenerator } from "@/tools/developer/gitignore-generator/manifest";
import { manifest as packageJsonGenerator } from "@/tools/developer/package-json-generator/manifest";
import { manifest as consoleLogRemover } from "@/tools/developer/console-log-remover/manifest";
import { manifest as sha3HashTool } from "@/tools/developer/sha3-hash-tool/manifest";
import { manifest as regexTesterDebugger } from "@/tools/developer/regex-tester-debugger/manifest";
import { manifest as cronParserReadable } from "@/tools/developer/cron-parser-readable/manifest";
import { manifest as yamlToJsonConverter } from "@/tools/developer/yaml-to-json-converter/manifest";
import { manifest as cssSpriteGeneratorTool } from "@/tools/developer/css-sprite-generator-tool/manifest";
import { manifest as svgToJsxConverter } from "@/tools/developer/svg-to-jsx-converter/manifest";
import { manifest as jsonToKotlinClassV2 } from "@/tools/developer/json-to-kotlin-class-v2/manifest";
import { manifest as svgPathEditor } from "@/tools/developer/svg-path-editor/manifest";
import { manifest as cssUnusedRulesFinder } from "@/tools/developer/css-unused-rules-finder/manifest";
import { manifest as tsconfigGenerator } from "@/tools/developer/tsconfig-generator/manifest";
import { manifest as regexExplainer } from "@/tools/developer/regex-explainer/manifest";
import { manifest as curlCommandBuilder } from "@/tools/developer/curl-command-builder/manifest";
import { manifest as shellScriptLinter } from "@/tools/developer/shell-script-linter/manifest";
import { manifest as utf8ByteViewer } from "@/tools/developer/utf8-byte-viewer/manifest";
import { manifest as dockerignoreGenerator } from "@/tools/developer/dockerignore-generator/manifest";
import { manifest as quotedPrintableTool } from "@/tools/developer/quoted-printable-tool/manifest";
import { manifest as sha256HashTool } from "@/tools/developer/sha256-hash-tool/manifest";

export const TOOLS: readonly ToolManifest[] = [
  bmiCalculator,
  discountCalculator,
  emiCalculator,
  mortgageCalculator,
  percentageCalculator,
  simpleInterestCalculator,
  sipCalculator,
  tipCalculator,
  unitConverterLength,
  compoundInterestCalculator,
  gstCalculator,
  scientificCalculator,
  weightUnitConverter,
  temperatureConverter,
  fuelCostCalculator,
  dataStorageConverter,
  base64,
  hashGenerator,
  jsonFormatter,
  urlEncoder,
  uuidGenerator,
  asciiArtGenerator,
  barcodeGenerator,
  bulkImageRenamerOptimizer,
  colorPicker,
  imageCompressor,
  photoMosaicGenerator,
  pixelArtMaker,
  imageResizer,
  imageCropper,
  imageRotator,
  imageFlipper,
  imageToBase64,
  base64ToImage,
  imageWatermarkAdder,
  imageColorInverter,
  imageGrayscaleConverter,
  imageSepiaFilter,
  imageBlurTool,
  imageSharpener,
  imageBrightnessAdjuster,
  imageContrastAdjuster,
  imageSaturationAdjuster,
  imageHueRotator,
  imageThumbnailMaker,
  imageBgRemoverSimple,
  imageCollageMaker,
  imageColorExtractor,
  imageEdgeDetector,
  imageNoiseReducer,
  imageVignetteTool,
  imageGradientMaker,
  imageBorderAdder,
  imageRoundCorners,
  imagePixelateTool,
  imagePosterizeTool,
  imageThresholdTool,
  imageChannelMixer,
  imageFisheyeTool,
  imageDrosteEffect,
  imageGlitchArt,
  imagePixelSorter,
  imageColorPickerTool,
  imageExposureAdjuster,
  imageGammaCorrector,
  imageDitherTool,
  imageSolarizeTool,
  imageEmbossTool,
  imageAnaglyphMaker,
  imageKaleidoscope,
  imageTileMaker,
  imageStitcher,
  imageSplitter,
  imageGifFrameExtractor,
  imageColorOverlay,
  imageMosaicBlend,
  imageDehazeTool,
  imageShadowsHighlights,
  bcryptHashGenerator,
  cspEvaluator,
  dataUrlConverter,
  httpStatusCodeReference,
  ipSubnetCalculator,
  jwtDecoder,
  mimeTypeLookup,
  passwordGenerator,
  totpGenerator,
  aes256EncryptorDecryptor,
  passwordStrengthChecker,
  htaccessGenerator,
  sshKeyFingerprintExplorer,
  hashVerifier,
  textEntropyCalculator,
  macAddressGenerator,
  uuidVersionDetector,
  secureRandomGenerator,
  certificatePemParser,
  cronExpressionParser,
  jwtClaimExtractor,
  dnsRecordValidator,
  ipv6SubnetCalc,
  httpHeaderParser,
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
  textReverser,
  textTrimmer,
  textRepeater,
  textSorter,
  morseCodeTranslator,
  loremIpsumGenerator,
  textFinderReplacer,
  textStatistics,
  textDeduplicator,
  textEncoderDecoder,
  textColumnFormatter,
  textIndentationFixer,
  textAligner,
  textRedactor,
  unicodeExplorer,
  textWidthMeasurer,
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
  azw3ToPdfConverter,
  bulkFileTimestampChanger,
  djvuToPdfConverter,
  encodingDetector,
  epubToPdfConverter,
  fileTreePrinter,
  fileTypeDetector,
  lineEndingConverter,
  mobiToPdfConverter,
  pdfFormFlattener,
  pdfPageOrganizer,
  pdfToXpsConverter,
  textEncodingConverter,
  xpsToPdfConverter,
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
  timesheetCalc,
  meetingDurationCalc,
  payslipGenerator,
  shiftScheduler,
  workOrderGenerator,
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
  pdfPowerpointConverterV2,  aiAltTextGenerator,
  aiAnalogiesGenerator,
  aiApiPayloadMockingTool,
  aiArticleHeadlineGenerator,
  aiBiasChecker,
  aiBookSummaryGenerator,
  aiBrandPositioningStatementGenerator,
  aiBrandToneOfVoiceBuilder,
  aiBusinessNameIdeator,
  aiBusinessPitchDeckOutlineGenerator,
  aiCharacterNameGenerator,
  aiChatbotEmulator,
  aiChromeExtensionBoilerplateGenerator,
  aiCitationFormatter,
  aiCodeConverter,
  aiCodeDebugger,
  aiCodeExplainer,
  aiCodingPatternRefactorer,
  aiColdEmailPersonalizer,
  aiCompetitorAnalysisFramework,
  aiCopywritingFrameworkAssistant,
  aiCoverLetterWriter,
  aiCronJobSchedulerBuilder,
  aiCssUiComponentGenerator,
  aiCtaGenerator,
  aiCustomerSupportScriptWriter,
  aiDbSchemaDiagramBuilder,
  aiDockerfileBuilder,
  aiDomainNameGenerator,
  aiEmailDraftGenerator,
  aiEmojiTranslator,
  aiEssayOutlineGenerator,
  aiFaqGenerator,
  aiFictionStoryGenerator,
  aiFinancialGoalPlanner,
  aiFlashcardQaGenerator,
  aiGiftIdeaGenerator,
  aiGitCommitMessageGenerator,
  aiGrammarCorrectionTool,
  aiHtaccessRedirectGenerator,
  aiHtmlLandingPageGenerator,
  aiInstagramBioGenerator,
  aiInterviewQuestionGenerator,
  aiJargonSimplifier,
  aiJsObjectToJsonSchemaConverter,
  aiJsonMockDataGenerator,
  aiKeywordExtractor,
  aiKubernetesManifestGenerator,
  aiLinkedinBioOptimizer,
  aiLogicalFallacyDetector,
  aiMarkdownReadmeGenerator,
  aiMarkdownTableGenerator,
  aiMathWordProblemSolver,
  aiMeetingMinutesSummarizer,
  aiMermaidFlowchartGenerator,
  aiMetaTagBuilder,
  aiMultiLanguageTranslator,
  aiNewsletterSubjectLineAbTester,
  aiNginxConfigRuleBuilder,
  aiParagraphSummarizer,
  aiParaphrasingRewriterTool,
  aiPassiveActiveVoiceConverter,
  aiPassiveAggressiveEmailTranslator,
  aiPodcastEpisodePlanner,
  aiPoemLyricsWriter,
  aiPresentationOutlineGenerator,
  aiPressReleaseDraftBuilder,
  aiProductDescriptionWriter,
  aiProductFeaturePrioritizationHelper,
  aiPromptImprover,
  aiRecipeGenerator,
  aiRedditPostTitleOptimizer,
  aiRegexBuilder,
  aiResumeBulletPointOptimizer,
  aiRobotsTxt,
  aiSalaryNegotiationScriptWriter,
  aiSentimentAnalysisTool,
  aiShellBashScriptWriter,
  aiSloganTaglineGenerator,
  aiSocialMediaCaptionWriter,
  aiSqlQueryGenerator,
  aiStudyGuideGenerator,
  aiSvgVectorArtGenerator,
  aiSwotAnalysisCreator,
  aiTailwindCssPaletteGenerator,
  aiTargetAudienceDemographicsProfiler,
  aiTechStackRecommender,
  aiTextBasedAdventureGameEngine,
  aiTextSimplifierEli5,
  aiTextToImageGenerator,
  aiThesisStatementGenerator,
  aiTravelItineraryPlanner,
  aiTypescriptInterfaceGenerator,
  aiUnitTestCaseGenerator,
  aiUserPersonaCreator,
  aiUserStoryCreator,
  aiVideoScriptOutliner,
  aiWebsiteSitemapGenerator,
  aiWeeklyMealPlanner,
  aiWorkoutPlanner,  addSubtractDateCalculator,
  ageCalculator,
  awkCommandBuilderTester,
  bashScriptGeneratorBoilerplate,
  businessWorkingDaysCalculator,
  chmodCalculator,
  connectionStringBuilderParser,
  countdownTimerGenerator,
  createTableGenerator,
  creditCardTestNumberGenerator,
  csvToSqlInsertConverter,
  databaseSchemaDiff,
  dateDifferenceCalculator,
  dateFormatConverterStrftime,
  dayOfTheWeekFinder,
  diceRollerRandomPicker,
  emailAddressGeneratorValidator,
  erDiagramDesigner,
  fakeDataGenerator,
  ibanGeneratorValidator,
  inBrowserSqlPlayground,
  isbnGeneratorValidator,
  iso8601DateParserFormatter,
  jqPlaygroundFilterBuilder,
  julianDateAstronomicalTimeConverter,
  luhnCreditCardValidator,
  mockCsvDataGenerator,
  mockGraphqlResponseGenerator,
  mockSqlDataGenerator,
  mongodbAggregationPipelineBuilder,
  mongodbQueryBuilder,
  naughtyStringGenerator,
  numberBaseConverter,
  onlineStopwatchTimer,
  phoneNumberGeneratorValidator,
  printableCalendarGenerator,
  randomDateTimeGenerator,
  randomIpMacAddressGenerator,
  randomNumberGeneratorSeeded,
  randomUserProfileGenerator,
  recurringDateRruleGenerator,
  redisCommandReferenceBuilder,
  relativeTimeFormatter,
  sampleJsonMockApiResponseGenerator,
  sedCommandBuilderTester,
  shellCommandExplainer,
  sqlDdlToErDiagramGenerator,
  sqlDialectConverter,
  sqlExplainPlanVisualizer,
  sqlFormatterBeautifier,
  sqlIndexAdvisor,
  sqlJoinVisualizer,
  sqlMinifier,
  sqlResultToCsvJsonExporter,
  sqlToOrmCodeConverter,
  testDataAnonymizer,
  testDummyFileGenerator,
  testIdGenerator,
  timeDurationCalculator,
  timeUnitConverter,
  timeZoneAbbreviationUtcOffsetReference,
  timeZoneConverter,
  unixTimestampEpochConverter,
  userAgentStringGeneratorParser,
  visualSqlQueryBuilder,
  weekNumberIsoCalculator,
  worldClockMeetingPlanner,  ansiEscapeCodeTerminalColorGenerator,
  bashPromptPs1Generator,
  bashrcZshrcAliasConfigManager,
  bitwiseOperationCalculator,
  bitShiftRotateVisualizer,
  bitFieldBitmaskFlagsDesignerDecoder,
  endiannessByteOrderConverter,
  dotfilesManagerGenerator,
  findCommandBuilder,
  globPatternTester,
  grepRipgrepCommandBuilder,
  rsyncCommandBuilder,
  tarArchiveCommandBuilder,
  tmuxConfigGeneratorCheatsheet,
  vimCheatsheetKeybindingReference,
  sshConfigGenerator,
  manPageTldrCommandReference,
  exitCodeSignalReference,
  twosComplementSignedIntegerCalculator,
  crontabGenerator,
  markdownLiveEditorPreviewer,
  markdownTableGenerator,
  markdownTableOfContentsGenerator,
  readmeGenerator,
  githubBadgeShieldsIoGenerator,
  mermaidDiagramLiveEditor,
  plantumlDiagramEditor,
  markdownToSlidesPresentationGenerator,
  markdownSyntaxCheatsheetReference,
  markdownLinterFormatter,
  ieee754FloatingPointConverter,
  fixedPointQFormatConverter,
  bigIntegerArbitraryPrecisionCalculator,
  hexDumpHexViewerEditor,
  binaryFileSignatureMagicNumberInspector,
  asciiArtTextBannerGenerator,
  integerDataTypeRangeOverflowReference,
  romanNumeralConverter,
  scientificEngineeringNotationConverter,
  modularArithmeticGcdLcmCalculator,
  primeNumberCheckerFactorizationTool,
  asciiUnicodeCodePointExplorer,
  checksumParityBitCalculator,
  grayCodeConverter,
  hammingCodeErrorCorrectionCalculator,
  ipv4SubnetCalculatorCidrVlsm,
  ipv6SubnetCalculator,
  cidrIpRangeNetmaskConverter,
  ipAddressFormatConverter,
  ipv6AddressExpanderCompressorValidator,
  macAddressVendorOuiLookupFormatter,
  dnsRecordLookupReference,
  reverseDnsPtrLookupGenerator,
  dnsPropagationCheckerReference,
  whoisDomainIpLookup,
  spfRecordGeneratorValidator,
  dkimRecordGeneratorValidator,
  dmarcRecordGeneratorValidator,
  sslTlsCertificateDecoderChecker,
  wellKnownCommonPortsReference,
  pingLatencyTesterBrowser,
  tracerouteVisualizer,
  publicIpGeolocationLookup,
  dnsOverHttpsDohQueryTool,
  cidrAggregatorNetworkSummarizer,
  sortingAlgorithmVisualizer,
  pathfindingAlgorithmVisualizer,
  binarySearchTreeBstVisualizer,
  heapPriorityQueueVisualizer,
  triePrefixTreeVisualizer,
  avlTreeVisualizer,
  redBlackTreeVisualizer,
  brokenBacklinkFinder,
  brokenLinkChecker,
  coreWebVitalsAnalyzer,
  gtmDatalayerHelper,
  metaRobotsTester,
  mobileFriendlyTester,
  referringDomainsExplorer,
  sslHttpsChecker,
  openGraphSocialCardGenerator,
  twitterCardPreviewTool,
  imageLensFlare,
  imageBloomTool,
  imageAsciiBw,
  imageCharcoalTool,
  imageOilPaint,
  imageWatercolor,
  imagePencilSketch,
  imageNeonGlow,
  imageDuotoneMaker,
  imageThermalCam,
  textReverseWords,
  textScrambler,
  textMirrorText,
  textRainbowText,
  textTypewriterEffect,
  fractionCalculator,
  ratioCalculator,
  probabilityCalc,
  oddsCalculator,
  scaleCalculator,
  subnetMaskValidator,
  tlsVersionChecker,
  certSigningRequestGen,
  passwordPolicyChecker,
  hashIdentifier,
  meetingRoomBooker,
  businessCardMaker,
  inventoryTracker,
  projectBudgetCalc,
  contractDateCalc,
  vocabularyTrainer,
  quizMaker,
  mathDrillGenerator,
  periodicTableLookup,
  grammarCheckerBasic,
  socialMediaPostScheduler,
  hashtagDensityChecker,
  socialMediaInfluencerCalc,
  socialMediaAbTester,
  socialMediaStoryTemplate,
  imageClaheTool,
  imageStarryNight,
  imageDotPattern,
  imageScreenTone,
  imageCrosshatch,
  imagePlasmaEffect,
  imageFractalTool,
  imageRainbowNoise,
  imageOldPhoto,
  imageTvStatic,
  textBinaryToOctal,
  textOctalToBinary,
  textHexToText,
  textTextToHex,
  textBase32Encoder,
  textBase58Encoder,
  textBase85Encoder,
  textUrlDecode,
  textHtmlDecode,
  textXmlEscape,
  concentrationCalc,
  molarityCalc,
  dilutionCalc,
  enzymeActivityCalc,
  molecularWeightCalc,
  subnetCidrMerger,
  ipv4RangeSplitter,
  portRangeScannerRef,
  wifiPasswordGen,
  pemKeyParser,
  audioFormatReference,
  videoFormatReference,
  codecComparison,
  bitrateCalc,
  sampleRateConverter,
  flashcardImporter,
  lessonPlanGenerator,
  gradeCalc,
  gpaCalculator,
  rubricMaker,
  socialMediaContestRunner,
  socialMediaGiveaway,
  socialContentCalendar,
  socialEngagementPredictor,
  socialHashtagGenerator,
  employeeShiftTrader,
  inventoryForecast,
  markupCalcAdv,
  breakEvenAnalyzer,
  cashFlowProjector,
  imageHistogramViewer,
  imageAnnotationTool,
  imageFrameMaker,
  imageTextCaption,
  imageMemeGenerator,
  imagePassportPhoto,
  imageProfilePicCropper,
  imagePlaceholderGen,
  imageSolidColorGen,
  imageUpscaler,
  textAcronymExpander,
  textOxfordCommaFixer,
  textSentenceSplitter,
  textMorseEncoder,
  textPigLatinDecoder,
  dataUnitConverter,
  percentageOfCalc,
  mortgageInsuranceCalc,
  stampDutyCalc,
  capitalGainsCalc,
  audioReverbReference,
  audioNoiseFloorRef,
  videoFpsReference,
  videoBitrateGuide,
  audioLufsReference,
  flashcardDeckOrganizer,
  classScheduleMaker,
  wordSearchMaker,
  crosswordClueGen,
  assignmentRubricMaker,
  socialMediaBioOptimizer,
  socialThreadGenerator,
  socialPollCreator,
  socialContentIdeas,
  socialEngagementTracker2,
  invoiceTemplateGen,
  purchaseOrderGen,
  taxCalculatorPro,
  depreciationCalc,
  inventoryReorderCalc,
  imageHalftoneGenerator,
  imageCartoonizer,
  imageTransparentPngMaker,
  imageDpiChanger,
  imagePrintSizeCalc,
  imageTilingPattern,
  imagePolaroidMaker,
  imageInstagramGrid,
  imageGifMaker,
  imageDiffCompare,
  textAcronymGenerator,
  textHeadlineAnalyzer,
  textHiddenCharsDetector,
  textLetterCounter,
  textPalindromeChecker,
  textSyllableCounter,
  textReducer,
  textAntonymFinder,
  textClicheFinder,
  textReadingLevel,
  binaryCalculator,
  hexadecimalCalculator,
  fibonacciGenerator,
  standardDeviationCalc,
  scientificNotationConverter,
  audioConverterRef,
  videoCompressionGuide,
  audioTrimmerRef,
  videoMergerRef,
  audioEqualizerRef,
  batesNumberingTool,
  pdfDeskewTool,
  pdfCombinePages,
  pdfCropToContent,
  pdfScanOptimizer,
  burnRateCalc,
  churnRateCalc,
  annuityCalculator,
  bondYieldCalc,
  checklistCreator,
  anagramSolver,
  brailleTranslator,
  chemicalEquationBalancer,
  bibliographyGenerator,
  binaryDecimalHexConverter,
  argon2ParamCalculator,
  rsaEncryptionTool,
  xssSanitizer,
  sslExpiryTracker,
  nslookupReference,
  imageColorContrastChecker,
  imageColorMixer,
  imageFaviconGenerator,
  imageAppIconGenerator,
  imageGifOptimizer,
  imageGifSplitter,
  imageDimensionsInspector,
  imageNoiseTextureGen,
  imagePhotoGrid,
  imageVintageFilter,
  toneGenerator,
  noiseGenerator,
  metronome,
  bpmDetector,
  subtitleEditor,
  videoAspectRatioChanger,
  videoLoopMaker,
  slowMotionMaker,
  timeLapseMaker,
  audiogramMaker,
  textActiveVoiceSuggester,
  textDefinitionLookup,
  textBibliographyCitation,
  textAbstractGenerator,
  textReadingTimeEstimator,
  textWordCloudData,
  textGrammarFixer,
  textPlagiarismChecker,
  textToneAnalyzer,
  textKeywordExtractor,
  calorieCalculator,
  salaryTaxCalculator,
  stepsToMilesConverter,
  speedConverter,
  areaConverter,
  accelerationForceCalc,
  threeDShapeConstructor,
  audiobookPlayerRef,
  periodicTableQuiz,
  unitConversionTutor,
  arrCalculator,
  cryptoPriceWidget,
  stockTickerWidget,
  emailSignatureGenerator,
  meetingMinutesTemplate,
  htaccessRulesGenerator,
  freeProxyVerifier,
  mxBlacklistChecker,
  blacklistIpChecker,
  userAgentGenerator,

  jwtDebugger,
  fileHashValidator,
  macAddressVendorLookup,
  passwordStrengthMeter,
  strongPasswordGenerator,
  hashingTool,
  emailHeaderAnalyzer,
  userAgentParser,
  cspGenerator,
  cidrIpCalculator,
  seoContentScorecardAudit,
  titleTagCtrEstimator,
  googleSerpSnippetPreview,
  metaDescriptionAbTester,
  addLineNumbers,
  cssTransformGenerator,
  cssFontFaceGenerator,
  cssTextShadowGenerator,
  argon2HashGenerator,
  cssBorderRadiusGenerator,
  cssBlendModePreviewer,
  cssTriangleGenerator,
  cssSpecificityCalculator,
  cssSelectorTester,
  atbashCipher,
  cssTransitionGenerator,
  cssButtonGenerator,
  autoprefixer,
  bcryptGeneratorVerifier,
  cssBeautifier,
  cssColorFormatConverter,
  cssGlassmorphismGenerator,
  base58EncodeDecode,
  base64ImageEncodeDecode,
  cssNeumorphismGenerator,
  cssBackgroundPatternGenerator,
  cssFilterGenerator,
  cssCubicBezierEditor,
  cssScrollbarStyler,
  cssClipPathGenerator,
  aesEncryptDecrypt,
  cssUnitsConverter,
  cssAnimationKeyframesGenerator,
  corsTesterConfigGenerator,
  base64ToHexConverter,
  base32EncodeDecode,
  cssLoaderSpinnerGenerator,
  cssMinifier,
  cssBoxShadowGenerator,
  cssFlexboxPlayground,
  cssGridGenerator,
  base64EncodeDecode,
  cssGradientGenerator,
  binaryEncodeDecode,
  cssMediaQueryGenerator,
  cssTooltipGenerator,
  arrowFunctionConverter,
  cssAspectRatioHelper,
  crc32Calculator,

  redirectGenerator,
  serpFeatureDetector,
  anchorTextOptimizerAnalyzer,
  canonicalTagChecker,
  contentWordCountTool,
  imageSaturationHueEditor,
  colorBlindnessSimulator,
  aspectRatioCropPresets,
  gifResizer,
  noiseTextureGenerator,
  bulkImageConverter,
  memeGenerator,
  base64ToImageDecoder,
  imageSharpen,
  hexRgbHslConverter,
  imageBackgroundChanger,
  roundCornersTool,
  svgOptimizerMinifier,
  photoGridMaker,
  complementaryColorFinder,
  imageSpriteSheetGenerator,
  imageBrightnessContrastEditor,
  imageTextCaptionAdder,
  imagePlaceholderGenerator,
  bulkImageResizer,
  imageExifStripper,
  imageColorPicker,
  bulkWatermark,
  screenshotBeautifier,
  appIconGenerator,
  imageDrawingMarkup,
  gifMaker,
  imageToSvgVectorizer,
  spriteSheetSplitter,
  browserFrameMockup,
  qrCodeScanner,
  gradientImageGenerator,
  svgToPngConverter,
  imageFilterEffects,
  blobShapeGenerator,
  colorPaletteExtractor,
  webpAnimationMaker,
  pngToIcoConverter,
  imageExifViewer,
  imageSteganographyDecoder,
  solidColorImageGenerator,
  imageFormatConverter,
  waveDividerSvgGenerator,
  faviconGenerator,
  apngMaker,
  qrCodeGeneratorImage,
  photoVintageRetroFilter,
  deviceMockupGenerator,
  imageRotatorFlipper,
  gifOptimizer,
  duotoneImageMaker,
  profilePictureCropper,
  colorShadesTintsGenerator,
  patternGeneratorSvgCss,
  gifSplitter,
  passportIdPhotoMaker,
  dummyImageGenerator,
  imageSteganographyHide,
  bulkImageCompressor,
  colorMixerBlender,
  imageToBase64Encoder,
  colorContrastChecker,
  virustotalStyleScanner,
  contentReadabilitySeoAnalyzer,
  keywordDensityAnalyzerSeo,
  apiAuthenticationHeaderBuilder,
  cryptographicKeyGenerator,
  dmarcRecordAnalyzer,
  corsTest,
  dnssecValidator,
  tracerouteOnline,
  pingOnline,
  hstsPreloadChecker,
  sslTlsCertificateValidator,
  httpSecurityHeadersTest,
  sslTlsCipherSuiteAnalyzer,
  whoisDomainChecker,
  termsConditionsGenerator,
  cookieConsentBannerGenerator,
  torNodeChecker,
  dnsLeakTest,
  spfRecordChecker,
  portScan,
  subdomainFinder,
  disclaimerGenerator,
  ipGeolocation,
  proxyVpnDetection,
  webrtcLeakTest,
  dkimRecordValidator,
  robotsTxtParserValidator,
  myIpAddress,
  reverseIpLookup,
  urlSandboxLinkScanner,
  privacyPolicyGenerator,
  breachPwnedEmailChecker,

  htmlFormBuilder,
  jsonSchemaValidator,
  html5SemanticChecker,
  htmlEmailCssInliner,
  jsonValidator,
  htmlEscapeUnescape,
  jsonSchemaGenerator,
  hmacGenerator,
  dataUriGenerator,
  csvColumnReorder,
  hexEncodeDecode,
  jsonFlattener,
  jsonToCsv,
  jsonDiffCompare,
  regexTester,
  csvToJson,
  htmlToPlainText,
  cronExpressionBuilder,
  fileHashCalculator,
  htmlLivePreviewEditor,
  htmlToJsxConverter,
  urlEncodeDecode,
  regexGenerator,
  htmlValidator,
  uuidGeneratorV2,
  jsonViewerTree,
  htmlImageExtractor,
  dataUriDecoder,
  markdownPreview,
  htmlToPugConverter,
  checksumVerifier,
  htmlToMarkdown,
  htmlMinifier,
  jsonToCClass,
  base64DecodeImage,
  htmlEntityEncodeDecode,
  htmlBoilerplateGenerator,
  jsonMinifier,
  htmlLinkExtractor,
  jsonToGoStruct,
  jsonKeySorter,
  gzipDeflateText,
  htmlBeautifier,
  markdownToHtml,
  htmlTableToCsv,
  htmlTableGenerator,
  hexToBase64Converter,
  pdfExtractImages,
  pdfCrop,
  pdfToMarkdown,
  pdfToImages,
  pdfToSingleImage,
  pdfToWord,
  pdfToHtml,
  pdfAddMargins,
  pdfToJson,
  pdfUnlock,
  pdfAddBorder,
  pdfPageLabels,
  pdfAddStamp,
  pdfExtractAttachments,
  pdfCompress,
  pdfAddBackground,
  pdfBwOptimize,
  pdfToPowerpoint,
  pdfPermissions,
  pdfToGif,
  pdfDownsampleImages,
  pdfTocGenerator,
  pdfAddAttachment,
  pdfRotate,
  pdfAddPageNumbers,
  pdfMetadata,
  pdfAddHeaderFooter,
  pdfToXml,
  pdfToSvg,
  pdfDespeckle,
  pdfBookmarks,
  pdfExtractText,
  pdfSplit,
  pdfMerge,
  pdfDeskew,
  pdfExtractPages,
  pdfToRtf,
  pdfToExcel,
  pdfLinearize,
  pdfAddWatermark,
  pdfOcr,
  pdfRemoveWatermark,
  pdfDeletePages,
  pdfProtect,
  pdfToTiff,
  pdfToEpub,
  pdfReorderPages,
  pdfRepair,

  cssVariablesGenerator,
  slugGeneratorTool,
  punycodeConverter,
  lessToCss,
  jsLinter,
  countOccurrences,
  totpGeneratorTool,
  wordCharCounter,
  removeDuplicateLines,
  cssSpriteTool,
  commonjsToEsm,
  jsonToGraphqlSchema,
  sortLinesTool,
  jwtVerifier,
  rateLimitCalculator,
  randomStringGenerator,
  percentEncoding,
  stringReverser,
  stringEscape,
  pbkdf2Generator,
  openGraphTagGenerator,
  sha3HashGenerator,
  findReplaceMulti,
  cssToScss,
  mockApiGenerator,
  jsBundleAnalyzer,
  secretKeyGenerator,
  graphqlExplorer,
  jsonToKotlin,
  jsonToRust,
  removeLineBreaks,
  jsonToTypescript,
  jsxToJs,
  utf8Viewer,
  sseTester,
  openapiViewer,
  jsonToYaml,
  quotedPrintable,
  htmlEntityReference,
  jsonRpcBuilder,
  scssToCss,
  typescriptPlayground,
  cssGridBuilder,
  sha1HashGenerator,
  jsToTypescript,
  nanoidGenerator,
  jsonToQueryString,
  jsUnitTestRunner,
  faviconLinkGenerator,
  iframeGenerator,
  jsonpathEvaluator,
  curlBuilder,
  ecdsaKeyGenerator,
  removeConsoleLog,
  randomBytesGenerator,
  cssResetGenerator,
  urlSafeBase64Tool,
  xorCipher,
  jsMinifier,
  rsaKeyGenerator,
  jsPlayground,
  jsObfuscator,
  jwtGenerator,
  trimWhitespace,
  tsToJs,
  cacheControlBuilder,
  jsonToPython,
  textToArray,
  jsonToJava,
  tailwindToCss,
  webhookTester,
  whitespaceDetector,
  ndjsonViewer,
  rsaEncryptDecryptTool,
  varToLetConst,
  passphraseGenerator,
  sha256HashGenerator,
  openapiToClient,
  contentNegotiationHelper,
  textDiff,
  jsonEscapeUnescape,
  morseCodeConverter,
  jsonToJsObject,
  semverCalculator,
  websocketTester,
  curlToCode,
  jsComplexityAnalyzer,
  jsonToSql,
  reverseLines,
  jsDeobfuscator,
  callbackToPromise,
  jsonToToml,
  unicodeEscape,
  multiToSingleLine,
  jsdocGenerator,
  jsBeautifier,
  jsonToXml,
  restApiClient,
  esmToCommonjs,
  uuidV1Tool,
  sha512HashGenerator,
  cssUnusedRules,
  uuidV4Tool,
  ulidGenerator,
  uuidV5Tool,
  md5HashGenerator,
  rot13Rot47,
  scryptGenerator,
  httpHeadersAnalyzer,
  pdfSanitize,
  pdfWordCount,
  pdfMergeBookmarks,
  pdfNUp,
  pdfSplitAdvanced,
  pdfAutoRotate,
  officeToPdf,
  pdfInsertPages,
  pdfScaleFit,
  pdfSpellCheck,
  pdfRenameContent,
  pdfGrayscale,
  pdfMetadataViewer,
  pdfSummarizeAi,
  pdfPageLabelEditor,
  pdfPageReorderCustom,
  pdfStampDocument,
  pdfFindReplace,
  pdfPageSize,
  pdfOcrSearchable,
  pdfBatchProcessor,
  pdfPageBlankInsert,
  pdfAttachmentEmbed,
  pdfPageDeleteRange,
  pdfBorderFrame,
  pdfTocFromHeadings,
  pdfExtractAnnotations,
  pdfToOdt,
  pdfVisualDiff,
  pdfCompareDiff,
  pdfPermanentRedact,
  pdfFontLister,
  pdfMarginPadding,
  pdfTranslate,
  pdfOrganize,
  pdfUaAccessibility,
  pdfAutoRedactPii,
  pdfToPdfa,
  pdfPortfolioBuilder,
  pdfHyperlinkEditor,
  pdfHighlightExtractor,
  pdfDigitalSignature,
  pdfThumbnailSheet,
  pdf2upJoin,
  pdfProtectEncrypt,
  pdfAnnotate,
  pdfSplitByBookmarks,
  pdfFontEmbedder,
  pdfExtractTextBulk,
  pdfBatchPipeline,
  pdfDuplicatePages,
  pdfBackgroundImage,
  pdfExportFormData,
  pdfPosterSplit,
  pdfMeasureCalibrate,
  pdfAnnotationSummary,
  pdfSplitSpreads,
  pdfMeasureTool,
  pdfExtractAttachmentsBulk,
  pdfDocumentAssembler,
  pdfImportFormData,
  pdfXExport,
  pdfLayersEditor,
  pdfPageRotateRange,
  pdfHighlightMarkup,
  pdfBookmarksFromText,
  webpageToPdf,
  pdfStampConfidential,
  pdfLayersManager,
  pdfReadability,
  pdfStampAdvanced,
  pdfTablesCsv,
  pdfSplitBySize,
  pdfAiChat,
  pdfRedactPattern,
  pdfReverseOrder,
  pdfAddPageNumbersAdvanced,
  pdfFlipbook,
  pdfCompressTarget,
  pdfFullTextSearch,
  pdfMergeCombineMultiple,
  pdfDrawSignature,
  pdfExtractImagesBulk,
  pdfInvertColors,
  pdfWatermarkAdvanced,
  pdfTranslateDevice,
  epubToPdfTool,
  pdfCleanMetadata,
  pdfPageExtractRange,
  pdfBookletPrint,
  imageToPdfTool,
  pdfRepairTool,
  pdfToPdfx,
  pdfRotatePermanent,
  pdfSummarizer,
  pdfFillForm,
  pdfInterleaveMerge,
  pdfChat,
  pdfPageResizeIndividual,
  pdfRedactSearch,
  pdfTextToSpeech,
  pdfHeaderFooterAdvanced,
  pdfRemoveBlankPages,
  pdfFormBuilder,

  pdfOrganizeTool,
  pdfAutoRedactPiiTool,
  pdfMeasureDistanceArea,
  pdfToPdfxPrint,
  pdfHyperlinkEditorTool,
  pdfImportFormDataTool,
  pdfDigitalSignatureTool,
  pdfMergeBookmarksTool,
  pdfCompressTargetSize,
  pdfHighlightExtractorTool,
  pdfInterleaveMergeTool,
  pdfFullTextSearchTool,
  pdfAnnotateTool,
  pdfDrawSignatureTool,
  pdfFontListerTool,
  pdfAnnotationSummaryTool,
  pdfNUpBooklet,
  pdfDocumentAssemblerTool,
  pdfLayersOcgManager,
  pdf2upJoinTool,
  pdfDuplicatePagesTool,
  pdfAutoRotateTool,
  pdfFlipbookGenerator,
  pdfFindReplaceTool,
  pdfFontEmbedderTool,
  pdfWordCountTool,
  pdfFormBuilderTool,
  pdfToPdfaArchive,
  pdfExportFormDataTool,
  pdfLayersOcgEditor,
  pdfCropMarksBleed,
  pdfStampOverlayTool,
  pdfBatchProcessorTool,
  pdfRenameFromContent,
  pdfSpellCheckTool,
  pdfPortfolioBuilderTool,
  pdfTextToSpeechTool,
  pdfReverseOrderTool,
  pdfFillFormTool,
  pdfHighlightMarkupTool,
  pdfInsertPagesTool,
  pdfExtractAnnotationsTool,
  pdfMetadataViewerTool,
  pdfPageLabelEditorTool,
  pdfThumbnailContactSheet,
  pdfReadabilityStats,
  pdfRedactPatternTool,
  pdfSplitSpreadsTool,
  pdfPermanentRedactTool,
  pdfMeasureCalibrateTool,
  jsPlaygroundRepl,
  jsonToTsInterface,
  gitlabCiGenerator,
  jsonToJavaPojo,
  cssResetNormalize,
  gitCommandBuilder,
  jsBundleSizeAnalyzer,
  dockerfileGenerator,
  jsToTypescriptConverter,
  jsObjectToJson,
  helmValuesHelper,
  cssAnimationGenerator,
  markdownToHtmlConverter,
  javascriptMinifier,
  jsonToPythonClass,
  cssToScssConverter,
  lessToCssCompiler,
  codeToImage,
  mergeConflictResolver,
  astExplorer,
  changelogGenerator,
  kubernetesManifest,
  dependencyGraphVisualizer,
  gitDiffViewer,
  eslintConfigGenerator,
  columnExtractor,
  jsonFlattenerTool,
  mockRestApi,
  apacheHtaccessGenerator,
  jsonToJsLiteral,
  multiLineToSingle,
  jsonToRustStruct,
  makefileGenerator,
  githubActionsGenerator,
  conventionalCommitBuilder,
  javascriptObfuscator,
  jwtSigner,
  jsLinterBrowser,
  javascriptBeautifier,
  jsonToKotlinClass,
  gitBranchNaming,
  jsxToJsCompiler,
  graphqlClient,
  circleciConfigGenerator,

  pdfBookletPrintLayout,
  pdfSanitizeRemoveJs,
  bwScanOptimizer,
  pdfDeskewStraighten,
  pdfUaAccessibilityTool,
  pdfSummarizeAiTool,
  pdfMeasureCalibrateDistance,
  pdfScaleFitPage,
  pdfCropContentAutotrim,
  pdfDigitalSignatureCert,
  pdfPageResizeIndividualTool,
  pdfGrayscaleTool,
  pdfHeaderFooterAdv,
  pdfPageDeleteRangeTool,
  pdfHyperlinkEditorPdf,
  pdfLinearizeWeb,
  pdfLayersOcgEditorTool,
  pdfMarginPaddingTool,
  pdfDespeckleClean,
  pdfRepairCorrupt,
  pdfSplitAdvancedTool,
  pdfPageExtractRangeTool,
  pdfPortfolioPackageBuilder,
  pdfWatermarkAdvancedTool,
  pdfSummarizerAi,
  pdfFontListerEmbedder,
  pdfStampConfidentialTool,
  pdfAiChatQa,
  pdfBackgroundImageTool,
  pdfMergeCombineMultipleTool,
  pdfFontEmbedderSubsetter,
  pdfPosterTileSplit,
  pdfBorderFrameTool,
  pdfAddPageNumbersAdv,
  pdfPageBlankInsertTool,
  epubToPdfConverter,
  imageToPdfJpgPng,
  pdfProtectUnlock,
  pdfPageSizeChange,
  pdfChatQa,
  pdfPageLabelsEditor,
  pdfDrawSignaturePlace,
  pdfPageRotateRangeTool,
  pdfTranslateLayout,
  pdfTablesToCsv,
  officeToPdfConverter,
  pdfStampAdvancedTool,
  pdfExportFormDataFdf,
  pdfPageReorderCustomTool,
  pdfDocumentInfoViewer,
  pdfCompareDiffTool,
  pdfFormCreatorBuilder,
  webpageUrlToPdf,
  batesNumberingLegal,
  pdfBookmarksOutlineEditor,
  pdfAttachmentEmbedTool,
  pdfFillFormsTool,
  pdfRedactSearchTool,
  pdfInvertColorsTool,
  pdfImportFormDataFdf,
  textTxtToPdf,
  pdfOverlayStampDocument,
  jsonToRustStructV2,
  ndjsonViewerTool,
  apiAuthHeaderBuilder,
  uuidV4Generator,
  regexToCode,
  envFileParser,
  tomlToJsonConverter,
  jsonFlattenerToolV2,
  typescriptToJs,
  sha1HashTool,
  openapiToClientSdk,
  regexReplaceTool,
  jsxToJsCompilerV2,
  gitattributesGenerator,
  sha512HashTool,
  nginxConfigGenerator,
  dockerComposeGenerator,
  openapiViewerEditor,
  jsonToPythonClassV2,
  jsObjectToJsonConverter,
  jwtGeneratorSigner,
  jsBeautifierFormatter,
  textDiffCompare,
  uuidV5Generator,
  queryStringParser,
  websocketClient,
  sortLinesToolV2,
  textToArrayConverter,
  xmlToJsonConverter,
  wordCharLineCounter,
  cssGridTemplateBuilder,
  editorconfigGenerator,
  protobufDecoder,
  secretKeyBase64,
  scryptHashTool,
  jsonToJavaPojoV2,
  jsonToTsInterfaceV2,
  systemdUnitGenerator,
  rsaKeyPairGenerator,
  stringEscapeTool,
  jsonRpcRequestBuilder,
  curlToCodeConverter,
  semverCalculatorTool,
  jsdocCommentGenerator,
  regexCheatsheet,
  regexMatchHighlighter,
  uuidV1Generator,
  webhookInspector,
  scssToCssCompiler,
  totp2faGenerator,
  reverseLinesText,
  sourceMapVisualizer,
  tailwindToCssTool,
  prettierConfigGenerator,
  gitignoreGenerator,
  packageJsonGenerator,
  consoleLogRemover,
  sha3HashTool,
  regexTesterDebugger,
  cronParserReadable,
  yamlToJsonConverter,
  cssSpriteGeneratorTool,
  svgToJsxConverter,
  jsonToKotlinClassV2,
  svgPathEditor,
  cssUnusedRulesFinder,
  tsconfigGenerator,
  regexExplainer,
  curlCommandBuilder,
  shellScriptLinter,
  utf8ByteViewer,
  dockerignoreGenerator,
  quotedPrintableTool,
  sha256HashTool,
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
