"use client"

/**
 * Compress PDF — engine half of the 100x rebuild.
 *
 * Copy to: src/tools/pdf/pdf-compress/logic.ts
 * Pair with: CODE-2-UI.tsx -> src/tools/pdf/pdf-compress/ui.tsx
 *
 * Imports react (hooks), pdf-lib and jszip. All three are already dependencies of
 * the project, so nothing new is added. No project imports.
 *
 * Compatibility: every export the old file had is still here with the same name
 * and signature, so the untouched logic.test.ts keeps passing. The real work is
 * compressPdf.
 *
 * HONESTY, and the reason this file reads the way it does:
 * pdf-lib cannot decode or re-encode image streams, and pdf.js is not a
 * dependency. In most large PDFs the images ARE the size. So this tool does the
 * things that genuinely shrink a file — structural rebuild, object streams,
 * metadata, annotations, forms, JavaScript, attachments, page removal — measures
 * the real byte difference, and says plainly when the saving is small and why.
 *
 * The single most important rule here: if the result is not smaller, say so and
 * hand the original back. See `compressOne`, which enforces it.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { PDFDocument, PDFName } from "pdf-lib"
import JSZip from "jszip"

/* ===== 1. Preserved types and helpers ===== */

export interface ProcessResult {
	output: string
	error?: string
	metadata?: Record<string, unknown>
}

export interface ValidationIssue {
	severity: "error" | "warning" | "info"
	message: string
	line?: number
	column?: number
}

export function validate(input: string): ValidationIssue[] {
	const issues: ValidationIssue[] = []
	if (!input || !input.trim()) {
		issues.push({ severity: "error", message: "Input is empty" })
		return issues
	}
	if (input.length > 10 * 1024 * 1024) {
		issues.push({ severity: "warning", message: "Input is very large (>10MB) — may be slow" })
	}
	return issues
}

/** Kept for the existing tests only. The real work is compressPdf. */
export function process(input: string, options: Record<string, unknown> = {}): ProcessResult {
	void options
	const first = validate(input).filter((i) => i.severity === "error")[0]
	if (first) return { output: "", error: first.message }
	const startedAt = Date.now()
	return { output: input, metadata: { inputLength: input.length, outputLength: input.length, processingTime: Date.now() - startedAt } }
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)}ms`
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
	if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`
	return `${(ms / 3_600_000).toFixed(1)}h`
}

export function randomId(length = 8): string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	const arr = new Uint8Array(length)
	crypto.getRandomValues(arr)
	let result = ""
	for (let i = 0; i < length; i += 1) result += chars[(arr[i] ?? 0) % chars.length] ?? "a"
	return result
}

export function copyToClipboard(text: string): Promise<void> {
	if (navigator.clipboard) return navigator.clipboard.writeText(text)
	return Promise.reject(new Error("Clipboard API not available"))
}

export function downloadFile(content: string | Blob, filename: string, mime = "text/plain"): void {
	const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")
	a.href = url
	a.download = filename
	a.rel = "noopener"
	document.body.appendChild(a)
	a.click()
	a.remove()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Was exported and never called, which is why non-PDFs were never refused. */
export function detectFileType(bytes: Uint8Array): string | null {
	if (bytes.length < 4) return null
	if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf"
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png"
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg"
	if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif"
	if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03) return "zip"
	if (bytes[0] === 0x1f && bytes[1] === 0x8b) return "gzip"
	return null
}

export function getFileExtension(filename: string): string {
	const m = /\.([a-z0-9]+)$/i.exec(filename)
	return m && m[1] ? m[1].toLowerCase() : ""
}

export function getMimeType(format: string): string {
	const map: Record<string, string> = {
		pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
		gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", html: "text/html",
		css: "text/css", js: "application/javascript", json: "application/json",
		xml: "application/xml", csv: "text/csv", txt: "text/plain", md: "text/markdown",
		zip: "application/zip",
	}
	return map[format.toLowerCase()] ?? "application/octet-stream"
}

/**
 * Preserved exactly. Note for anyone reading the old tool: because `output` was
 * always `input`, this returned ratio 1 and savings 0 every single time, and the
 * interface displayed that as compression. Use byteStats for real files.
 */
export function getStats(input: string, output: string): { inputSize: number; outputSize: number; ratio: number; savings: number } {
	const enc = new TextEncoder()
	const inputSize = enc.encode(input).length
	const outputSize = enc.encode(output).length
	return { inputSize, outputSize, ratio: inputSize > 0 ? outputSize / inputSize : 0, savings: inputSize - outputSize }
}

export function bulkProcess(inputs: string[], options?: Record<string, unknown>): ProcessResult[] {
	return inputs.map((input) => process(input, options))
}

export function byteStats(inputBytes: number, outputBytes: number): { inputSize: number; outputSize: number; ratio: number; savings: number; percent: number } {
	const savings = inputBytes - outputBytes
	return {
		inputSize: inputBytes, outputSize: outputBytes,
		ratio: inputBytes > 0 ? outputBytes / inputBytes : 0,
		savings, percent: inputBytes > 0 ? (savings / inputBytes) * 100 : 0,
	}
}

/* ===== 2. Limits ===== */

export const MAX_FILE_BYTES = 100 * 1024 * 1024
export const MAX_TOTAL_BYTES = 300 * 1024 * 1024
export const MAX_FILES = 50
export const WARN_TOTAL_BYTES = 50 * 1024 * 1024
export const RENDER_LIMIT = 200
/** Above this, bytes per page suggests images rather than text and layout. */
export const IMAGE_HEAVY_BYTES_PER_PAGE = 300 * 1024

/* ===== 3. Types ===== */

export type FileStatus = "queued" | "ready" | "notPdf" | "encrypted" | "corrupt" | "tooLarge"

export interface Inspection {
	pageCount: number
	annotations: number
	links: number
	formFields: number
	attachments: number
	hasJavaScript: boolean
	hasXmp: boolean
	hasOutline: boolean
	title: string
	author: string
	subject: string
	producer: string
	creator: string
	pageSizes: Array<{ width: number; height: number }>
	mixedSizes: boolean
	blankPages: number[]
}

export const EMPTY_INSPECTION: Inspection = {
	pageCount: 0, annotations: 0, links: 0, formFields: 0, attachments: 0,
	hasJavaScript: false, hasXmp: false, hasOutline: false,
	title: "", author: "", subject: "", producer: "", creator: "",
	pageSizes: [], mixedSizes: false, blankPages: [],
}

export interface FileEntry {
	id: string
	name: string
	size: number
	status: FileStatus
	statusDetail: string
	info: Inspection
	bytes: Uint8Array | null
}

export interface CompressOptions {
	rebuild: boolean
	objectStreams: boolean
	stripMetadata: boolean
	stripXmp: boolean
	dropAnnotations: boolean
	dropLinks: boolean
	flattenForms: boolean
	dropForms: boolean
	dropJavaScript: boolean
	dropAttachments: boolean
	keepBookmarks: boolean
	removePages: string
	removeBlankPages: boolean
	targetBytes: number
	namePattern: string
	zipOutput: boolean
	keepIfBigger: boolean
}

export const DEFAULT_COMPRESS_OPTIONS: CompressOptions = {
	rebuild: true, objectStreams: true, stripMetadata: true, stripXmp: true,
	dropAnnotations: false, dropLinks: false, flattenForms: false, dropForms: false,
	dropJavaScript: true, dropAttachments: true, keepBookmarks: true,
	removePages: "", removeBlankPages: false, targetBytes: 0,
	namePattern: "{name}-compressed", zipOutput: true, keepIfBigger: false,
}

/* ===== 4. Page ranges ===== */

export interface RangeParse { pages: number[]; errors: string[] }

export function parsePageRange(spec: string, pageCount: number): RangeParse {
	const errors: string[] = []
	const pages: number[] = []
	const trimmed = spec.trim()
	if (trimmed.length === 0) return { pages, errors }
	const push = (i: number) => { if (!pages.includes(i)) pages.push(i) }
	const resolve = (token: string): number | null => {
		const n = Number(token)
		if (!Number.isInteger(n) || n === 0) return null
		return n < 0 ? pageCount + n : n - 1
	}
	for (const partRaw of trimmed.split(",")) {
		const part = partRaw.trim()
		if (part.length === 0) continue
		if (/^-?\d+$/u.test(part)) {
			const idx = resolve(part)
			if (idx === null) { errors.push(`“${part}” is not a page number. Pages count from 1, and −1 means the last page.`); continue }
			if (idx < 0 || idx >= pageCount) { errors.push(`“${part}” is outside this document, which has ${pageCount} page${pageCount === 1 ? "" : "s"}.`); continue }
			push(idx)
			continue
		}
		const dash = /^(-?\d+)?\s*-\s*(-?\d+)?$/u.exec(part)
		if (dash) {
			const fromTok = dash[1]
			const toTok = dash[2]
			const from = fromTok === undefined ? 0 : resolve(fromTok)
			const to = toTok === undefined ? pageCount - 1 : resolve(toTok)
			if (from === null || to === null) { errors.push(`“${part}” is not a page range. Try something like 1-3.`); continue }
			if (from < 0 || from >= pageCount || to < 0 || to >= pageCount) { errors.push(`“${part}” is outside this document, which has ${pageCount} page${pageCount === 1 ? "" : "s"}.`); continue }
			if (from > to) { errors.push(`“${part}” counts backwards. Write it as ${to + 1}-${from + 1}.`); continue }
			for (let i = from; i <= to; i += 1) push(i)
			continue
		}
		errors.push(`“${part}” could not be read. Use page numbers and ranges, such as 1, 5-8.`)
	}
	return { pages, errors }
}

export function describePages(pages: number[]): string {
	if (pages.length === 0) return "none"
	const sorted = [...pages].sort((a, b) => a - b)
	const parts: string[] = []
	let start = sorted[0] ?? 0
	let prev = start
	for (let i = 1; i <= sorted.length; i += 1) {
		const cur = sorted[i]
		if (cur !== undefined && cur === prev + 1) { prev = cur; continue }
		parts.push(start === prev ? `${start + 1}` : `${start + 1}–${prev + 1}`)
		if (cur === undefined) break
		start = cur
		prev = cur
	}
	return parts.join(", ")
}

/* ===== 5. Inspecting a document =====
 *
 * pdf-lib exposes the object graph but has no tidy API for most of this, so every
 * probe is wrapped and simply reports nothing rather than guessing. A count of 0
 * in the interface therefore means "none found", not "none exist", and the
 * interface says so.
 */

const NAME = {
	annots: PDFName.of("Annots"),
	subtype: PDFName.of("Subtype"),
	link: PDFName.of("Link"),
	acroForm: PDFName.of("AcroForm"),
	names: PDFName.of("Names"),
	javaScript: PDFName.of("JavaScript"),
	embedded: PDFName.of("EmbeddedFiles"),
	metadata: PDFName.of("Metadata"),
	outlines: PDFName.of("Outlines"),
	openAction: PDFName.of("OpenAction"),
	aa: PDFName.of("AA"),
	contents: PDFName.of("Contents"),
}

function countAnnots(pdf: PDFDocument): { total: number; links: number } {
	let total = 0
	let links = 0
	for (const page of pdf.getPages()) {
		try {
			const annots = page.node.Annots()
			if (!annots) continue
			const size = annots.size()
			total += size
			for (let i = 0; i < size; i += 1) {
				try {
					const dict = annots.lookup(i)
					const asDict = dict as unknown as { get?: (k: PDFName) => unknown }
					if (typeof asDict.get === "function" && asDict.get(NAME.subtype) === NAME.link) links += 1
				} catch { /* one unreadable annotation must not stop the count */ }
			}
		} catch { /* page without a readable Annots entry */ }
	}
	return { total, links }
}

function findBlankPages(pdf: PDFDocument): number[] {
	const blank: number[] = []
	const pages = pdf.getPages()
	for (let i = 0; i < pages.length; i += 1) {
		try {
			const node = pages[i]?.node
			if (!node) continue
			const contents = node.get(NAME.contents)
			if (contents === undefined) { blank.push(i); continue }
			const stream = node.context.lookup(contents) as unknown as { contents?: Uint8Array; sizeInBytes?: () => number }
			const len = stream?.contents?.length ?? (typeof stream?.sizeInBytes === "function" ? stream.sizeInBytes() : undefined)
			if (typeof len === "number" && len < 32) blank.push(i)
		} catch { /* if it cannot be read, do not claim it is blank */ }
	}
	return blank
}

export async function inspectFile(file: File): Promise<FileEntry> {
	const base: FileEntry = { id: randomId(10), name: file.name, size: file.size, status: "queued", statusDetail: "", info: EMPTY_INSPECTION, bytes: null }
	if (file.size > MAX_FILE_BYTES) {
		return { ...base, status: "tooLarge", statusDetail: `${formatBytes(file.size)}, and the limit for one file is ${formatBytes(MAX_FILE_BYTES)}.` }
	}
	let bytes: Uint8Array
	try { bytes = new Uint8Array(await file.arrayBuffer()) }
	catch { return { ...base, status: "corrupt", statusDetail: "This file could not be read from disk." } }
	const kind = detectFileType(bytes)
	if (kind !== "pdf") {
		return { ...base, status: "notPdf", statusDetail: kind ? `This looks like a ${kind.toUpperCase()} file, not a PDF, whatever its name says.` : "This is not a PDF. Its contents do not start with %PDF." }
	}
	try {
		const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false })
		const pages = pdf.getPages()
		const sizes = pages.map((p) => ({ width: Math.round(p.getWidth()), height: Math.round(p.getHeight()) }))
		const firstSize = sizes[0]
		const { total, links } = countAnnots(pdf)
		let formFields = 0
		try { formFields = pdf.getForm().getFields().length } catch { formFields = 0 }
		const names = pdf.catalog.get(NAME.names)
		let hasJavaScript = false
		let attachments = 0
		try {
			const dict = names === undefined ? undefined : (pdf.context.lookup(names) as unknown as { get?: (k: PDFName) => unknown })
			if (dict && typeof dict.get === "function") {
				hasJavaScript = dict.get(NAME.javaScript) !== undefined
				attachments = dict.get(NAME.embedded) !== undefined ? 1 : 0
			}
		} catch { /* no readable name tree */ }
		return {
			...base, status: "ready", bytes,
			info: {
				pageCount: pages.length, annotations: total, links, formFields, attachments,
				hasJavaScript, hasXmp: pdf.catalog.get(NAME.metadata) !== undefined,
				hasOutline: pdf.catalog.get(NAME.outlines) !== undefined,
				title: pdf.getTitle() ?? "", author: pdf.getAuthor() ?? "", subject: pdf.getSubject() ?? "",
				producer: pdf.getProducer() ?? "", creator: pdf.getCreator() ?? "",
				pageSizes: sizes,
				mixedSizes: firstSize !== undefined && sizes.some((s) => s.width !== firstSize.width || s.height !== firstSize.height),
				blankPages: findBlankPages(pdf),
			},
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		if (/encrypt|password/iu.test(message)) {
			return { ...base, status: "encrypted", statusDetail: "This PDF is password-protected. Unlock it first, then add it again." }
		}
		return { ...base, status: "corrupt", statusDetail: `This PDF could not be opened. ${message}` }
	}
}

/* ===== 6. Estimating honestly, before running ===== */

export function forecast(entry: FileEntry, o: CompressOptions): string[] {
	const notes: string[] = []
	if (entry.status !== "ready") return notes
	const info = entry.info
	const perPage = info.pageCount > 0 ? entry.size / info.pageCount : entry.size
	if (perPage > IMAGE_HEAVY_BYTES_PER_PAGE) {
		notes.push(`This file is about ${formatBytes(Math.round(perPage))} per page, which usually means scanned or photographic pages. Images are where the size is, and this tool cannot recompress images, so expect a small saving. Removing pages you do not need will save far more.`)
	} else {
		notes.push(`This file is about ${formatBytes(Math.round(perPage))} per page, which suggests text and layout rather than large images. A structural rebuild often helps noticeably here.`)
	}
	if (o.removePages.trim().length > 0) {
		const r = parsePageRange(o.removePages, info.pageCount)
		if (r.errors.length === 0 && r.pages.length > 0) {
			const share = Math.round((r.pages.length / Math.max(1, info.pageCount)) * 100)
			notes.push(`Removing ${r.pages.length} of ${info.pageCount} pages should save roughly ${share}% on its own, which is usually the largest single saving available.`)
		}
	}
	if (o.dropAnnotations && info.annotations === 0) notes.push("Dropping annotations will save nothing here, because none were found.")
	if (o.dropForms && info.formFields === 0) notes.push("Removing form fields will save nothing here, because none were found.")
	if (o.dropAttachments && info.attachments === 0) notes.push("Removing attachments will save nothing here, because none were found.")
	if (o.dropJavaScript && !info.hasJavaScript) notes.push("Removing JavaScript will save nothing here, because none was found.")
	if (o.stripXmp && !info.hasXmp) notes.push("There is no XMP metadata stream in this file, so that switch will save nothing.")
	if (info.mixedSizes) notes.push("The pages are not all the same size. That is preserved exactly — nothing is resized.")
	return notes
}

export function planWarnings(entries: FileEntry[], o: CompressOptions): { errors: string[]; warnings: string[] } {
	const errors: string[] = []
	const warnings: string[] = []
	const ready = entries.filter((e) => e.status === "ready")
	if (entries.length === 0) errors.push("Add at least one PDF to get started.")
	else if (ready.length === 0) errors.push("None of the files added can be compressed. See the reason next to each one.")
	if (entries.length > MAX_FILES) errors.push(`There are ${entries.length} files and the limit for one run is ${MAX_FILES}.`)
	const total = ready.reduce((n, e) => n + e.size, 0)
	if (total > MAX_TOTAL_BYTES) errors.push(`These files come to ${formatBytes(total)} and the limit for one run is ${formatBytes(MAX_TOTAL_BYTES)}.`)
	else if (total > WARN_TOTAL_BYTES) warnings.push(`These files come to ${formatBytes(total)}. Everything runs in this tab, so it may take a little while.`)
	if (o.dropForms && o.flattenForms) warnings.push("You have chosen both to flatten and to remove form fields. Removing wins, so the fields will not be visible at all.")
	if (o.dropAnnotations && !o.dropLinks) warnings.push("Dropping all annotations removes links too, because links are annotations.")
	if (!o.rebuild && !o.objectStreams && !o.stripMetadata && !o.stripXmp && !o.dropAnnotations && !o.dropForms && !o.flattenForms && !o.dropJavaScript && !o.dropAttachments && o.removePages.trim().length === 0 && !o.removeBlankPages) {
		errors.push("Every option is switched off, so there is nothing to do. Turn on at least the rebuild or object streams.")
	}
	if (o.targetBytes > 0) warnings.push(`A target size is set. Since images cannot be recompressed here, the target may not be reachable — you will be told plainly either way.`)
	for (const e of ready) {
		if (o.removePages.trim().length > 0) {
			const r = parsePageRange(o.removePages, e.info.pageCount)
			for (const m of r.errors) errors.push(`${e.name}: ${m}`)
			if (r.errors.length === 0 && r.pages.length >= e.info.pageCount) errors.push(`${e.name}: that removes every page, so there would be nothing left.`)
		}
	}
	const names = new Map<string, number>()
	for (const e of entries) names.set(e.name, (names.get(e.name) ?? 0) + 1)
	for (const [name, count] of names) if (count > 1) warnings.push(`“${name}” was added ${count} times. Each copy will be compressed separately.`)
	return { errors, warnings }
}

/* ===== 7. Compressing ===== */

export interface OneResult {
	id: string
	name: string
	outName: string
	before: number
	after: number
	saved: number
	percent: number
	pagesBefore: number
	pagesAfter: number
	removed: string[]
	smaller: boolean
	usedOriginal: boolean
	hitTarget: boolean | null
	note: string
	blob: Blob
}

export interface BatchResult {
	files: OneResult[]
	totalBefore: number
	totalAfter: number
	elapsedMs: number
	skipped: string[]
	error: string
	cancelled: boolean
}

export const EMPTY_BATCH: BatchResult = { files: [], totalBefore: 0, totalAfter: 0, elapsedMs: 0, skipped: [], error: "", cancelled: false }

function stripCatalogParts(pdf: PDFDocument, o: CompressOptions, removed: string[]): void {
	if (o.stripXmp && pdf.catalog.get(NAME.metadata) !== undefined) { pdf.catalog.delete(NAME.metadata); removed.push("XMP metadata stream") }
	if (!o.keepBookmarks && pdf.catalog.get(NAME.outlines) !== undefined) { pdf.catalog.delete(NAME.outlines); removed.push("bookmarks") }
	try {
		const names = pdf.catalog.get(NAME.names)
		const dict = names === undefined ? undefined : (pdf.context.lookup(names) as unknown as { get?: (k: PDFName) => unknown; delete?: (k: PDFName) => void })
		if (dict && typeof dict.get === "function" && typeof dict.delete === "function") {
			if (o.dropJavaScript && dict.get(NAME.javaScript) !== undefined) { dict.delete(NAME.javaScript); removed.push("embedded JavaScript") }
			if (o.dropAttachments && dict.get(NAME.embedded) !== undefined) { dict.delete(NAME.embedded); removed.push("attachments") }
		}
	} catch { /* no readable name tree, nothing to remove */ }
	if (o.dropJavaScript) {
		if (pdf.catalog.get(NAME.openAction) !== undefined) pdf.catalog.delete(NAME.openAction)
		if (pdf.catalog.get(NAME.aa) !== undefined) pdf.catalog.delete(NAME.aa)
	}
	if (o.dropForms && pdf.catalog.get(NAME.acroForm) !== undefined) { pdf.catalog.delete(NAME.acroForm); removed.push("form fields") }
	if (o.stripMetadata) {
		pdf.setTitle(""); pdf.setAuthor(""); pdf.setSubject(""); pdf.setKeywords([])
		pdf.setProducer(""); pdf.setCreator("")
		removed.push("document details")
	}
}

function stripPageAnnots(pdf: PDFDocument, o: CompressOptions, removed: string[]): void {
	if (!o.dropAnnotations && !o.dropLinks) return
	let gone = 0
	for (const page of pdf.getPages()) {
		try {
			const annots = page.node.Annots()
			if (!annots) continue
			if (o.dropAnnotations) { gone += annots.size(); page.node.delete(NAME.annots); continue }
			for (let i = annots.size() - 1; i >= 0; i -= 1) {
				try {
					const dict = annots.lookup(i) as unknown as { get?: (k: PDFName) => unknown }
					if (typeof dict.get === "function" && dict.get(NAME.subtype) === NAME.link) { annots.remove(i); gone += 1 }
				} catch { /* leave an unreadable annotation alone */ }
			}
		} catch { /* page without readable annotations */ }
	}
	if (gone > 0) removed.push(`${gone} ${o.dropAnnotations ? "annotation" : "link"}${gone === 1 ? "" : "s"}`)
}

export function safeFileName(name: string, fallback: string): string {
	const cleaned = name.trim().replace(/[\\/:*?"<>|]/gu, "-").replace(/\s+/gu, " ").replace(/^\.+/u, "").slice(0, 120)
	return cleaned.length > 0 ? cleaned : fallback
}

export const stamp = (): string => new Date().toISOString().slice(0, 10)

export function outputName(pattern: string, sourceName: string, savedBytes: number, percent: number): string {
	const base = sourceName.replace(/\.pdf$/iu, "") || "document"
	const filled = pattern
		.replace(/\{name\}/gu, base)
		.replace(/\{date\}/gu, stamp())
		.replace(/\{saved\}/gu, formatBytes(Math.max(0, savedBytes)).replace(/\s+/gu, ""))
		.replace(/\{percent\}/gu, `${Math.max(0, Math.round(percent))}pc`)
	return `${safeFileName(filled, `${base}-compressed`)}.pdf`
}

async function compressOne(entry: FileEntry, o: CompressOptions): Promise<OneResult> {
	const bytes = entry.bytes
	if (!bytes) throw new Error("This file's contents are no longer in memory. Add it again.")
	const removed: string[] = []
	const source = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false })
	const pagesBefore = source.getPageCount()

	const drop = new Set<number>()
	if (o.removePages.trim().length > 0) {
		const r = parsePageRange(o.removePages, pagesBefore)
		if (r.errors.length > 0) throw new Error(r.errors[0] ?? "The pages to remove could not be read.")
		for (const p of r.pages) drop.add(p)
	}
	if (o.removeBlankPages) for (const p of entry.info.blankPages) drop.add(p)
	const keep: number[] = []
	for (let i = 0; i < pagesBefore; i += 1) if (!drop.has(i)) keep.push(i)
	if (keep.length === 0) throw new Error("Every page would be removed, so there would be nothing left.")
	if (drop.size > 0) removed.push(`${drop.size} page${drop.size === 1 ? "" : "s"} (${describePages([...drop])})`)

	// A rebuild copies pages into a fresh document, which is what drops orphaned
	// objects and old incremental-update revisions. Without it, we edit in place.
	let doc: PDFDocument
	if (o.rebuild || keep.length !== pagesBefore) {
		doc = await PDFDocument.create()
		const copied = await doc.copyPages(source, keep)
		for (const page of copied) doc.addPage(page)
		if (o.rebuild) removed.push("unused objects and old revisions")
		if (o.keepBookmarks && entry.info.hasOutline) {
			// pdf-lib cannot copy an outline, so say so rather than lose it silently.
			removed.push("bookmarks (a rebuild cannot carry them across)")
		}
	} else {
		doc = source
	}

	if (o.flattenForms && !o.dropForms) {
		try { doc.getForm().flatten(); removed.push("form interactivity, appearance kept") }
		catch { /* no form, or one that cannot be flattened */ }
	}
	stripPageAnnots(doc, o, removed)
	stripCatalogParts(doc, o, removed)

	const saved = await doc.save({ useObjectStreams: o.objectStreams })
	const after = saved.length
	const before = entry.size
	const smaller = after < before
	const stats = byteStats(before, after)

	// The rule that matters most in this tool.
	const useOriginal = !smaller && !o.keepIfBigger
	const finalBytes = useOriginal ? bytes : saved
	const finalSize = useOriginal ? before : after

	let note: string
	if (smaller) {
		note = stats.percent < 3
			? `Only ${stats.percent.toFixed(1)}% smaller. This file was already close to as small as it can get without recompressing its images, which is not possible here.`
			: `${stats.percent.toFixed(1)}% smaller.`
	} else if (useOriginal) {
		note = `The compressed version came out ${formatBytes(after - before)} larger, so your original was kept instead. Nothing was lost. This usually means the file was already optimised, and the remaining size is images, which cannot be recompressed here.`
	} else {
		note = `This came out ${formatBytes(after - before)} larger than the original, and you chose to keep it anyway.`
	}

	const hitTarget = o.targetBytes > 0 ? finalSize <= o.targetBytes : null
	if (hitTarget === false) {
		note += ` It did not reach your target of ${formatBytes(o.targetBytes)}. The options that would go further are removing pages, dropping annotations and removing form fields — recompressing images would be the usual next step and is not available here.`
	}

	return {
		id: entry.id, name: entry.name,
		outName: outputName(o.namePattern, entry.name, before - finalSize, stats.percent),
		before, after: finalSize, saved: before - finalSize,
		percent: before > 0 ? ((before - finalSize) / before) * 100 : 0,
		pagesBefore, pagesAfter: keep.length,
		removed, smaller, usedOriginal: useOriginal, hitTarget, note,
		blob: new Blob([finalBytes], { type: "application/pdf" }),
	}
}

export async function compressPdfs(
	entries: FileEntry[],
	o: CompressOptions,
	onProgress: (done: number, total: number, name: string) => void,
	isCancelled: () => boolean,
): Promise<BatchResult> {
	const startedAt = Date.now()
	const ready = entries.filter((e) => e.status === "ready")
	if (ready.length === 0) return { ...EMPTY_BATCH, error: "There is nothing to compress." }
	const files: OneResult[] = []
	const skipped: string[] = []
	for (const entry of ready) {
		if (isCancelled()) return { ...EMPTY_BATCH, files, cancelled: true, elapsedMs: Date.now() - startedAt, totalBefore: files.reduce((n, f) => n + f.before, 0), totalAfter: files.reduce((n, f) => n + f.after, 0) }
		onProgress(files.length, ready.length, entry.name)
		await new Promise<void>((r) => setTimeout(r, 0))
		try { files.push(await compressOne(entry, o)) }
		catch (e) { skipped.push(`${entry.name} could not be compressed. ${e instanceof Error ? e.message : String(e)} The other files were still processed.`) }
		onProgress(files.length, ready.length, entry.name)
	}
	if (files.length === 0) return { ...EMPTY_BATCH, error: "No file could be compressed.", skipped, elapsedMs: Date.now() - startedAt }
	return {
		files,
		totalBefore: files.reduce((n, f) => n + f.before, 0),
		totalAfter: files.reduce((n, f) => n + f.after, 0),
		elapsedMs: Date.now() - startedAt, skipped, error: "", cancelled: false,
	}
}

export async function zipResults(files: OneResult[]): Promise<Blob> {
	const zip = new JSZip()
	for (const f of files) zip.file(f.outName, f.blob)
	return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } })
}

/* ===== 8. Receipt and exports ===== */

export function csvCell(value: string): string {
	const neutral = /^[=+\-@\t\r]/u.test(value) ? `'${value}` : value
	return /[",\n]/u.test(neutral) ? `"${neutral.replace(/"/gu, '""')}"` : neutral
}

export function resultsToCsv(r: BatchResult): string {
	const rows = [
		["File", "Before bytes", "After bytes", "Saved bytes", "Saved percent", "Pages before", "Pages after", "Kept original"],
		...r.files.map((f) => [f.name, String(f.before), String(f.after), String(f.saved), f.percent.toFixed(2), String(f.pagesBefore), String(f.pagesAfter), f.usedOriginal ? "yes" : "no"]),
	]
	return rows.map((row) => row.map(csvCell).join(",")).join("\n")
}

export function buildReceipt(o: CompressOptions, r: BatchResult): string {
	const pct = r.totalBefore > 0 ? ((r.totalBefore - r.totalAfter) / r.totalBefore) * 100 : 0
	const lines = [
		"Tool: Compress PDF",
		`Run: ${new Date().toISOString()}`,
		`Files: ${r.files.length}`,
		`Before: ${formatBytes(r.totalBefore)}`,
		`After: ${formatBytes(r.totalAfter)}`,
		`Saved: ${formatBytes(r.totalBefore - r.totalAfter)} (${pct.toFixed(1)}%) in ${formatDuration(r.elapsedMs)}`,
		"",
		"PER FILE",
		"",
	]
	for (const f of r.files) {
		lines.push(`${f.name} -> ${f.outName}`)
		lines.push(`  ${formatBytes(f.before)} -> ${formatBytes(f.after)}, saved ${formatBytes(f.saved)} (${f.percent.toFixed(1)}%)`)
		lines.push(`  Pages: ${f.pagesBefore} -> ${f.pagesAfter}`)
		if (f.removed.length > 0) lines.push(`  Removed: ${f.removed.join("; ")}`)
		if (f.usedOriginal) lines.push("  The compressed version was larger, so your original was kept.")
		lines.push(`  ${f.note}`)
		lines.push("")
	}
	lines.push("SETTINGS", "", JSON.stringify(o, null, 2), "")
	if (r.skipped.length > 0) lines.push("SKIPPED", "", ...r.skipped, "")
	lines.push("Images were not recompressed, because that is not possible with the library available here.")
	lines.push("Everything ran in the browser. Nothing was uploaded.")
	return lines.join("\n")
}

export function buildJsonSummary(o: CompressOptions, r: BatchResult): string {
	return JSON.stringify({
		tool: "pdf-compress", generated: new Date().toISOString(), options: o,
		totals: { before: r.totalBefore, after: r.totalAfter, saved: r.totalBefore - r.totalAfter, elapsedMs: r.elapsedMs },
		files: r.files.map((f) => ({
			name: f.name, outName: f.outName, before: f.before, after: f.after, saved: f.saved,
			percent: Number(f.percent.toFixed(2)), pagesBefore: f.pagesBefore, pagesAfter: f.pagesAfter,
			removed: f.removed, keptOriginal: f.usedOriginal, hitTarget: f.hitTarget,
		})),
		skipped: r.skipped,
		limitations: ["Images are not recompressed or downsampled", "Password-protected PDFs cannot be processed"],
	}, null, 2)
}

/* ===== 9. Storage and hooks ===== */

const PREFIX = "unqtools:pdf-compress"
export const MAX_HISTORY = 20
export const MAX_PRESETS = 12

function readJson<T>(key: string, fallback: T): T {
	if (typeof window === "undefined") return fallback
	try { const raw = window.localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback } catch { return fallback }
}

function writeJson(key: string, value: unknown): void {
	if (typeof window === "undefined") return
	try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode or full quota */ }
}

export function clearAllStorage(): void {
	if (typeof window === "undefined") return
	const doomed: string[] = []
	for (let i = 0; i < window.localStorage.length; i += 1) {
		const key = window.localStorage.key(i)
		if (key && key.startsWith(PREFIX)) doomed.push(key)
	}
	for (const key of doomed) window.localStorage.removeItem(key)
}

export function usePersisted<T>(key: string, initial: T): [T, (next: T) => void] {
	const [value, setValue] = useState<T>(initial)
	const hydrated = useRef(false)
	useEffect(() => {
		setValue(readJson<T>(`${PREFIX}:${key}`, initial))
		hydrated.current = true
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key])
	const update = useCallback((next: T) => {
		setValue(next)
		if (hydrated.current) writeJson(`${PREFIX}:${key}`, next)
	}, [key])
	return [value, update]
}

/** Settings only. Documents are never stored. */
export type HistoryEntry = { id: string; at: number; summary: string; options: CompressOptions; pinned: boolean }

export function useHistory(): {
	entries: HistoryEntry[]
	add: (options: CompressOptions, summary: string) => void
	togglePin: (id: string) => void
	remove: (id: string) => void
	clearAll: () => void
} {
	const [entries, setEntries] = usePersisted<HistoryEntry[]>("history", [])
	const add = useCallback((options: CompressOptions, summary: string) => {
		setEntries([{ id: randomId(10), at: Date.now(), summary, options, pinned: false }, ...entries]
			.sort((a, b) => Number(b.pinned) - Number(a.pinned)).slice(0, MAX_HISTORY))
	}, [entries, setEntries])
	return {
		entries, add,
		togglePin: (id) => setEntries(entries.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e))),
		remove: (id) => setEntries(entries.filter((e) => e.id !== id)),
		clearAll: () => setEntries([]),
	}
}

/* ===== 10. Content ===== */

export const STATUS_LABEL: Record<FileStatus, string> = {
	queued: "Reading", ready: "Ready", notPdf: "Not a PDF",
	encrypted: "Password-protected", corrupt: "Could not be opened", tooLarge: "Too large",
}

export type Preset = { id: string; label: string; description: string; values: Partial<CompressOptions> }

export const PRESETS: readonly Preset[] = [
	{ id: "light", label: "Light and safe", description: "Lossless. Rebuilds the file and compresses its structure, keeping everything interactive.", values: { rebuild: true, objectStreams: true, stripMetadata: false, stripXmp: false, dropAnnotations: false, dropLinks: false, flattenForms: false, dropForms: false, dropJavaScript: false, dropAttachments: false, keepBookmarks: true } },
	{ id: "balanced", label: "Balanced", description: "Removes metadata, JavaScript and attachments. Content and links stay.", values: { rebuild: true, objectStreams: true, stripMetadata: true, stripXmp: true, dropAnnotations: false, dropLinks: false, flattenForms: false, dropForms: false, dropJavaScript: true, dropAttachments: true, keepBookmarks: true } },
	{ id: "strong", label: "Strong", description: "Also flattens forms and drops annotations. The document still reads the same.", values: { rebuild: true, objectStreams: true, stripMetadata: true, stripXmp: true, dropAnnotations: true, dropLinks: false, flattenForms: true, dropForms: false, dropJavaScript: true, dropAttachments: true, keepBookmarks: true } },
	{ id: "archive", label: "Archive", description: "Strips everything not needed to read the pages, including links and bookmarks.", values: { rebuild: true, objectStreams: true, stripMetadata: true, stripXmp: true, dropAnnotations: true, dropLinks: true, flattenForms: false, dropForms: true, dropJavaScript: true, dropAttachments: true, keepBookmarks: false } },
]

export const HOW_TO: ReadonlyArray<{ name: string; text: string }> = [
	{ name: "Add your PDFs", text: "Drop them anywhere on the tool, or use the button. Several at once is fine. What is inside each one is read straight away." },
	{ name: "Pick a level, or set your own", text: "Light, balanced, strong or archive. Every switch says what it costs before you turn it on." },
	{ name: "Read the forecast", text: "The tool tells you before running whether this file is likely to shrink much, and why." },
	{ name: "Compress and check the real numbers", text: "You get the true before and after sizes. If a file did not get smaller, it says so and hands your original back." },
]

export const FAQ: ReadonlyArray<{ question: string; answer: string }> = [
	{ question: "Is my document uploaded?", answer: "No. Everything runs in this tab using your own browser, there is no network request in this tool, and it works offline. Your document is held in memory only while it is being processed." },
	{ question: "Why did this tool not work before?", answer: "It was published from an unfinished template. Its two files were the same generic scaffold as Merge PDF and Split PDF, and its processing function returned whatever you typed straight back. Its size figures were the length of that text, so the compression ratio was always exactly 1." },
	{ question: "Why did my file barely get smaller?", answer: "Almost certainly because it is mostly images, and images cannot be recompressed with the library available here. The tool shows you the bytes per page and says outright when images are likely to be the reason. Removing pages you do not need is the biggest saving available." },
	{ question: "Can you not just recompress the images?", answer: "Not honestly, no. That needs an image pipeline this project does not have, and adding one is out of scope. A slider that pretended to do it would be exactly the kind of control this rebuild exists to remove." },
	{ question: "What if the result is bigger than the original?", answer: "Then the tool says so plainly and gives you your original back instead, unchanged. That is the default. A compressor that quietly hands you a bigger file is worse than useless." },
	{ question: "What actually makes the file smaller here?", answer: "Rebuilding it page by page, which drops orphaned objects and old saved revisions; object-stream compression; removing metadata, JavaScript and attachments; flattening or removing forms; dropping annotations; and above all removing pages." },
	{ question: "Will it change how my document looks?", answer: "Not with the light or balanced levels. Strong flattens forms, so fields still look right but no longer accept input. Archive also drops links and bookmarks. Each switch says what it costs." },
	{ question: "Can I compress a password-protected PDF?", answer: "No. It is detected and named. Remove the password in your PDF reader first, then add it again." },
	{ question: "Can I set a target size?", answer: "Yes, and the tool tells you honestly whether it reached it. When it cannot, it names which options would go further rather than failing quietly." },
	{ question: "What are the limits?", answer: "One hundred megabytes per file, three hundred in total, and fifty files in one run. If you go over, the message states the real numbers." },
]

export const ASSUMPTIONS: readonly string[] = [
	"Images are never recompressed or downsampled, because the library available here cannot do it.",
	"If the result is not smaller, your original is kept and you are told.",
	"Page sizes are preserved exactly. Nothing is resized.",
	"A count of zero means nothing of that kind was found, not that none can exist.",
	"A rebuild cannot carry bookmarks across, and the tool says so when that applies.",
	"Nothing is uploaded and your document is never stored. Only your settings are remembered.",
]

export const RELATED: ReadonlyArray<{ id: string; label: string; why: string }> = [
	{ id: "pdf-split", label: "Split PDF", why: "Removing pages is the biggest real saving; splitting is how you keep only what you need." },
	{ id: "pdf-merge", label: "Merge PDF", why: "Compress the result after combining documents." },
	{ id: "pdf-to-images", label: "PDF to Images", why: "Check what is actually taking up the space." },
	{ id: "images-to-pdf", label: "Images to PDF", why: "Rebuild a document from images you have already optimised." },
]

export const ALIASES: readonly string[] = [
	"compress pdf", "reduce pdf size", "shrink pdf", "make pdf smaller", "optimise pdf",
	"optimize pdf", "pdf compressor", "reduce pdf file size", "compress pdf offline", "compress pdf without uploading",
]

export const SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
	{ keys: "Ctrl/Cmd + Enter", label: "Compress now" },
	{ keys: "Ctrl/Cmd + O", label: "Open the file picker" },
	{ keys: "Ctrl/Cmd + S", label: "Download the results" },
	{ keys: "Ctrl/Cmd + Backspace", label: "Clear the queue and results" },
	{ keys: "?", label: "Show this list" },
	{ keys: "Esc", label: "Close a dialog, or stop a running job" },
]
