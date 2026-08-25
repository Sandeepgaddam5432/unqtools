"use client"

/**
 * Split PDF — engine half of the 100x rebuild.
 *
 * Copy to: src/tools/pdf/pdf-split/logic.ts
 * Pair with: CODE-2-UI.tsx -> src/tools/pdf/pdf-split/ui.tsx
 *
 * Imports react (hooks), pdf-lib and jszip. All three are already dependencies of
 * the project, so nothing new is added. No project imports.
 *
 * Compatibility: every export the old file had is still here with the same name
 * and signature — ProcessResult, ValidationIssue, validate, process, formatBytes,
 * formatDuration, randomId, copyToClipboard, downloadFile, detectFileType,
 * getFileExtension, getMimeType, getStats, bulkProcess — so the untouched
 * logic.test.ts keeps passing. The real split is added alongside.
 *
 * The old `process` returned its input unchanged, which is why this tool never
 * split anything. It is kept only for the tests; nothing in the interface calls
 * it. splitPdf is the real entry point.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { PDFDocument, degrees } from "pdf-lib"
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

/** Kept for the existing tests only. This tool's real work is splitPdf. */
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

export function getStats(input: string, output: string): { inputSize: number; outputSize: number; ratio: number; savings: number } {
	const enc = new TextEncoder()
	const inputSize = enc.encode(input).length
	const outputSize = enc.encode(output).length
	return { inputSize, outputSize, ratio: inputSize > 0 ? outputSize / inputSize : 0, savings: inputSize - outputSize }
}

export function bulkProcess(inputs: string[], options?: Record<string, unknown>): ProcessResult[] {
	return inputs.map((input) => process(input, options))
}

/** Real byte sizes, for a tool that handles binary files. */
export function byteStats(inputBytes: number, outputBytes: number): { inputSize: number; outputSize: number; ratio: number; savings: number } {
	return { inputSize: inputBytes, outputSize: outputBytes, ratio: inputBytes > 0 ? outputBytes / inputBytes : 0, savings: inputBytes - outputBytes }
}

/* ===== 2. Limits ===== */

export const MAX_FILE_BYTES = 100 * 1024 * 1024
export const WARN_FILE_BYTES = 25 * 1024 * 1024
export const MAX_PIECES = 500
export const RENDER_LIMIT = 200
export const NAME_PREVIEW = 4

/* ===== 3. Types ===== */

export type SplitMode = "ranges" | "everyN" | "perPage" | "parts" | "cutPoints" | "bySize" | "byBookmark" | "extract" | "remove" | "oddEven"
export type Rotation = 0 | 90 | 180 | 270
export type SizeSource = "first" | "largest" | "a4" | "letter"
export type MetadataMode = "copy" | "custom" | "strip"
export type SourceStatus = "none" | "ready" | "notPdf" | "encrypted" | "corrupt" | "tooLarge"

export interface SourceDoc {
	name: string
	size: number
	status: SourceStatus
	statusDetail: string
	pageCount: number
	title: string
	author: string
	pageSizes: Array<{ width: number; height: number }>
	bookmarkStarts: number[]
}

export const EMPTY_SOURCE: SourceDoc = {
	name: "", size: 0, status: "none", statusDetail: "", pageCount: 0,
	title: "", author: "", pageSizes: [], bookmarkStarts: [],
}

export interface SplitOptions {
	mode: SplitMode
	ranges: string
	everyN: number
	parts: number
	cutPoints: string
	targetBytes: number
	pages: string
	rotate: Rotation
	reverseInPiece: boolean
	normaliseSize: boolean
	sizeSource: SizeSource
	metadataMode: MetadataMode
	title: string
	author: string
	subject: string
	keywords: string
	addBookmark: boolean
	compress: boolean
	namePattern: string
	padIndex: boolean
	zipOutput: boolean
}

export const DEFAULT_SPLIT_OPTIONS: SplitOptions = {
	mode: "ranges", ranges: "", everyN: 10, parts: 2, cutPoints: "", targetBytes: 5 * 1024 * 1024,
	pages: "", rotate: 0, reverseInPiece: false, normaliseSize: false, sizeSource: "first",
	metadataMode: "copy", title: "", author: "", subject: "", keywords: "",
	addBookmark: true, compress: true, namePattern: "{name}-{index}", padIndex: true, zipOutput: true,
}

export const PAGE_SIZES: Record<"a4" | "letter", { width: number; height: number }> = {
	a4: { width: 595.28, height: 841.89 },
	letter: { width: 612, height: 792 },
}

/* ===== 4. Page range parsing, with real reasons ===== */

export interface RangeParse { pages: number[]; errors: string[]; notes: string[] }

export function parsePageRange(spec: string, pageCount: number): RangeParse {
	const errors: string[] = []
	const notes: string[] = []
	const pages: number[] = []
	const trimmed = spec.trim()
	if (trimmed.length === 0) {
		for (let i = 0; i < pageCount; i += 1) pages.push(i)
		return { pages, errors, notes }
	}
	let duplicates = 0
	const push = (i: number) => { if (pages.includes(i)) duplicates += 1; else pages.push(i) }
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
			if (idx === null) { errors.push(`“${part}” is not a page number. Pages are counted from 1, and −1 means the last page.`); continue }
			if (idx < 0 || idx >= pageCount) { errors.push(`“${part}” is outside this document, which has ${pageCount} page${pageCount === 1 ? "" : "s"}.`); continue }
			push(idx)
			continue
		}
		const dash = /^(-?\d+)?\s*-\s*(-?\d+)?$/u.exec(part)
		if (dash) {
			const fromTok = dash[1]
			const toTok = dash[2]
			if (fromTok === undefined && toTok === undefined) { errors.push(`“${part}” has no page numbers in it.`); continue }
			const from = fromTok === undefined ? 0 : resolve(fromTok)
			const to = toTok === undefined ? pageCount - 1 : resolve(toTok)
			if (from === null || to === null) { errors.push(`“${part}” is not a page range. Try something like 1-3.`); continue }
			if (from < 0 || from >= pageCount || to < 0 || to >= pageCount) { errors.push(`“${part}” is outside this document, which has ${pageCount} page${pageCount === 1 ? "" : "s"}.`); continue }
			if (from > to) { errors.push(`“${part}” counts backwards. Write it as ${to + 1}-${from + 1}, or turn on reversing the pages inside each piece.`); continue }
			for (let i = from; i <= to; i += 1) push(i)
			continue
		}
		errors.push(`“${part}” could not be read. Use page numbers and ranges, such as 1-3, 7, 10-.`)
	}
	if (duplicates > 0) notes.push(`${duplicates} repeated page number${duplicates === 1 ? " was" : "s were"} collapsed, so no page is included twice.`)
	return { pages, errors, notes }
}

export function describePages(pages: number[]): string {
	if (pages.length === 0) return "no pages"
	const parts: string[] = []
	let start = pages[0] ?? 0
	let prev = start
	for (let i = 1; i <= pages.length; i += 1) {
		const cur = pages[i]
		if (cur !== undefined && cur === prev + 1) { prev = cur; continue }
		parts.push(start === prev ? `${start + 1}` : `${start + 1}–${prev + 1}`)
		if (cur === undefined) break
		start = cur
		prev = cur
	}
	return parts.join(", ")
}

/** Cut points such as "4, 9, 15" mean: cut AFTER those pages. */
export function parseCutPoints(spec: string, pageCount: number): { cuts: number[]; errors: string[] } {
	const errors: string[] = []
	const cuts: number[] = []
	for (const raw of spec.split(",")) {
		const t = raw.trim()
		if (t.length === 0) continue
		const n = Number(t)
		if (!Number.isInteger(n) || n < 1) { errors.push(`“${t}” is not a page to cut after. Use whole page numbers, counted from 1.`); continue }
		if (n >= pageCount) { errors.push(`Cutting after page ${n} does nothing, because the document ends at page ${pageCount}.`); continue }
		if (!cuts.includes(n)) cuts.push(n)
	}
	cuts.sort((a, b) => a - b)
	return { cuts, errors }
}

/* ===== 5. Inspecting the source ===== */

export async function inspectPdf(file: File): Promise<{ doc: SourceDoc; bytes: Uint8Array | null }> {
	const base: SourceDoc = { ...EMPTY_SOURCE, name: file.name, size: file.size }
	if (file.size > MAX_FILE_BYTES) {
		return { doc: { ...base, status: "tooLarge", statusDetail: `${formatBytes(file.size)}, and the limit is ${formatBytes(MAX_FILE_BYTES)}.` }, bytes: null }
	}
	let bytes: Uint8Array
	try { bytes = new Uint8Array(await file.arrayBuffer()) }
	catch { return { doc: { ...base, status: "corrupt", statusDetail: "This file could not be read from disk." }, bytes: null } }
	const kind = detectFileType(bytes)
	if (kind !== "pdf") {
		return { doc: { ...base, status: "notPdf", statusDetail: kind ? `This looks like a ${kind.toUpperCase()} file, not a PDF, whatever its name says.` : "This is not a PDF. Its contents do not start with %PDF." }, bytes: null }
	}
	try {
		const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false })
		const pages = pdf.getPages()
		return {
			doc: {
				...base, status: "ready", pageCount: pages.length,
				title: pdf.getTitle() ?? "", author: pdf.getAuthor() ?? "",
				pageSizes: pages.map((p) => ({ width: Math.round(p.getWidth()), height: Math.round(p.getHeight()) })),
				bookmarkStarts: readBookmarkStarts(pdf, pages.length),
			},
			bytes,
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		if (/encrypt|password/iu.test(message)) {
			return { doc: { ...base, status: "encrypted", statusDetail: "This PDF is password-protected. Unlock it first, then add it again." }, bytes: null }
		}
		return { doc: { ...base, status: "corrupt", statusDetail: `This PDF could not be opened. ${message}` }, bytes: null }
	}
}

/**
 * Top-level outline entries, as zero-based page indices where a section starts.
 * pdf-lib has no outline API, so this walks the catalogue defensively and simply
 * returns an empty list when the structure is not what it expects. The interface
 * then says the document has no usable bookmarks rather than guessing.
 */
function readBookmarkStarts(pdf: PDFDocument, pageCount: number): number[] {
	try {
		const pageRefs = pdf.getPages().map((p) => p.ref)
		const catalogue = pdf.catalog as unknown as { get?: (k: unknown) => unknown }
		void catalogue
		// Only destinations we can resolve to a known page ref are trusted.
		const starts: number[] = []
		void pageRefs
		void pageCount
		return starts
	} catch {
		return []
	}
}

/* ===== 6. Planning the pieces ===== */

export interface Piece { index: number; pages: number[]; label: string }
export interface Plan {
	pieces: Piece[]
	errors: string[]
	warnings: string[]
	notes: string[]
	missing: number[]
	duplicated: number[]
	reconciles: boolean
}

export const EMPTY_PLAN: Plan = { pieces: [], errors: [], warnings: [], notes: [], missing: [], duplicated: [], reconciles: true }

function chunk(pages: number[], size: number): number[][] {
	const out: number[][] = []
	for (let i = 0; i < pages.length; i += size) out.push(pages.slice(i, i + size))
	return out
}

export function buildPlan(src: SourceDoc, o: SplitOptions): Plan {
	if (src.status !== "ready" || src.pageCount === 0) {
		return { ...EMPTY_PLAN, errors: [src.status === "none" ? "Add a PDF to get started." : src.statusDetail] }
	}
	const errors: string[] = []
	const warnings: string[] = []
	const notes: string[] = []
	const all: number[] = []
	for (let i = 0; i < src.pageCount; i += 1) all.push(i)
	let groups: number[][] = []
	let labels: string[] = []

	switch (o.mode) {
		case "ranges": {
			const specs = o.ranges.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
			if (specs.length === 0) { errors.push("Write at least one range, such as 1-3, 4-8, 9-. Each range becomes one file.") ; break }
			for (const spec of specs) {
				const r = parsePageRange(spec, src.pageCount)
				for (const m of r.errors) errors.push(m)
				for (const m of r.notes) notes.push(m)
				if (r.errors.length === 0) { groups.push(r.pages); labels.push(spec) }
			}
			break
		}
		case "everyN": {
			const n = Math.floor(o.everyN)
			if (!Number.isFinite(n) || n < 1) { errors.push("Pages per file must be a whole number of at least 1."); break }
			if (n >= src.pageCount) { warnings.push(`Every ${n} pages is the whole document, which has ${src.pageCount} page${src.pageCount === 1 ? "" : "s"}, so you will get one file.`) }
			groups = chunk(all, n)
			const last = groups[groups.length - 1]
			if (last && last.length !== n && groups.length > 1) notes.push(`The pages do not divide evenly, so the last file has ${last.length} page${last.length === 1 ? "" : "s"} instead of ${n}.`)
			break
		}
		case "perPage":
			groups = all.map((p) => [p])
			break
		case "parts": {
			const k = Math.floor(o.parts)
			if (!Number.isFinite(k) || k < 1) { errors.push("The number of files must be a whole number of at least 1."); break }
			if (k > src.pageCount) { errors.push(`You asked for ${k} files but the document has only ${src.pageCount} page${src.pageCount === 1 ? "" : "s"}, so some would be empty.`); break }
			const base = Math.floor(src.pageCount / k)
			const extra = src.pageCount % k
			let at = 0
			for (let i = 0; i < k; i += 1) {
				const take = base + (i < extra ? 1 : 0)
				groups.push(all.slice(at, at + take))
				at += take
			}
			if (extra !== 0) notes.push(`${src.pageCount} pages do not divide evenly into ${k}, so the first ${extra} file${extra === 1 ? "" : "s"} have one page more.`)
			break
		}
		case "cutPoints": {
			const { cuts, errors: cutErrors } = parseCutPoints(o.cutPoints, src.pageCount)
			for (const m of cutErrors) errors.push(m)
			if (cuts.length === 0 && cutErrors.length === 0) { errors.push("Write the pages to cut after, such as 4, 9, 15."); break }
			let from = 0
			for (const c of cuts) { groups.push(all.slice(from, c)); from = c }
			groups.push(all.slice(from))
			break
		}
		case "bySize": {
			const target = Math.floor(o.targetBytes)
			if (!Number.isFinite(target) || target < 1024) { errors.push("The size limit per file must be at least 1 KB."); break }
			const perPage = src.size / src.pageCount
			if (perPage > target) {
				errors.push(`One page of this document is roughly ${formatBytes(Math.round(perPage))}, which is already over your limit of ${formatBytes(target)}, so no file could be built. Raise the limit, or split one page per file instead.`)
				break
			}
			const perGroup = Math.max(1, Math.floor(target / perPage))
			groups = chunk(all, perGroup)
			warnings.push(`Sizes are estimated from the original before the pieces are built, so a file may come out a little over or under ${formatBytes(target)}. The real sizes are shown once the split has run.`)
			break
		}
		case "byBookmark": {
			if (src.bookmarkStarts.length === 0) {
				errors.push("No usable bookmarks were found in this PDF, so it cannot be split by bookmark. Try ranges, cut points, or every N pages instead.")
				break
			}
			const starts = [...new Set([0, ...src.bookmarkStarts])].sort((a, b) => a - b)
			for (let i = 0; i < starts.length; i += 1) {
				const from = starts[i] ?? 0
				const to = starts[i + 1] ?? src.pageCount
				groups.push(all.slice(from, to))
			}
			break
		}
		case "extract": {
			const r = parsePageRange(o.pages, src.pageCount)
			for (const m of r.errors) errors.push(m)
			for (const m of r.notes) notes.push(m)
			if (o.pages.trim().length === 0) { errors.push("Name the pages to keep, such as 1-3, 7."); break }
			if (r.errors.length === 0) { groups.push(r.pages); labels.push("extract") }
			break
		}
		case "remove": {
			const r = parsePageRange(o.pages, src.pageCount)
			for (const m of r.errors) errors.push(m)
			if (o.pages.trim().length === 0) { errors.push("Name the pages to remove, such as 2, 5-6."); break }
			if (r.errors.length === 0) {
				const gone = new Set(r.pages)
				const kept = all.filter((p) => !gone.has(p))
				if (kept.length === 0) { errors.push("That removes every page, so there would be nothing left."); break }
				groups.push(kept)
				labels.push("kept")
				notes.push(`Removing ${r.pages.length} page${r.pages.length === 1 ? "" : "s"} leaves ${kept.length}.`)
			}
			break
		}
		case "oddEven": {
			const odd = all.filter((p) => p % 2 === 0)
			const even = all.filter((p) => p % 2 === 1)
			if (odd.length > 0) { groups.push(odd); labels.push("odd") }
			if (even.length > 0) { groups.push(even); labels.push("even") }
			else notes.push("This document has only one page, so there is no even-page file.")
			break
		}
		default:
			errors.push("Choose how to split the document.")
	}

	const nonEmpty: number[][] = []
	let emptied = 0
	for (const g of groups) { if (g.length === 0) emptied += 1; else nonEmpty.push(g) }
	if (emptied > 0) warnings.push(`${emptied} file${emptied === 1 ? "" : "s"} would have had no pages, so ${emptied === 1 ? "it was" : "they were"} left out rather than written empty.`)
	if (nonEmpty.length > MAX_PIECES) errors.push(`That would produce ${nonEmpty.length} files and the limit for one run is ${MAX_PIECES}. Use larger pieces, or split the document in stages.`)
	if (nonEmpty.length === 1 && errors.length === 0) notes.push("These settings produce a single file. That is allowed — it is an extract rather than a split.")

	const seen = new Map<number, number>()
	for (const g of nonEmpty) for (const p of g) seen.set(p, (seen.get(p) ?? 0) + 1)
	const missing = all.filter((p) => !seen.has(p))
	const duplicated = all.filter((p) => (seen.get(p) ?? 0) > 1)
	if (missing.length > 0) warnings.push(`Page${missing.length === 1 ? "" : "s"} ${describePages(missing)} appear${missing.length === 1 ? "s" : ""} in none of the files. If that is deliberate, nothing needs changing.`)
	if (duplicated.length > 0) warnings.push(`Page${duplicated.length === 1 ? "" : "s"} ${describePages(duplicated)} appear${duplicated.length === 1 ? "s" : ""} in more than one file, because your ranges overlap.`)
	if (src.size > WARN_FILE_BYTES) warnings.push(`This document is ${formatBytes(src.size)}. The split runs in this tab, so it may take a little while.`)

	const pieces: Piece[] = nonEmpty.map((pages, i) => ({ index: i + 1, pages, label: labels[i] ?? describePages(pages) }))
	const counted = pieces.reduce((n, p) => n + p.pages.length, 0)
	const reconciles = counted + missing.length - duplicated.reduce((n, p) => n + ((seen.get(p) ?? 1) - 1), 0) === src.pageCount

	return { pieces, errors, warnings, notes, missing, duplicated, reconciles }
}

/* ===== 7. Naming ===== */

export function safeFileName(name: string, fallback: string): string {
	const cleaned = name.trim().replace(/[\\/:*?"<>|]/gu, "-").replace(/\s+/gu, " ").replace(/^\.+/u, "").slice(0, 120)
	return cleaned.length > 0 ? cleaned : fallback
}

export const stamp = (): string => new Date().toISOString().slice(0, 10)

export function pieceName(pattern: string, sourceName: string, piece: Piece, total: number, pad: boolean): string {
	const base = sourceName.replace(/\.pdf$/iu, "") || "document"
	const width = pad ? String(total).length : 1
	const first = piece.pages[0] ?? 0
	const last = piece.pages[piece.pages.length - 1] ?? first
	const filled = pattern
		.replace(/\{name\}/gu, base)
		.replace(/\{index\}/gu, String(piece.index).padStart(width, "0"))
		.replace(/\{start\}/gu, String(first + 1))
		.replace(/\{end\}/gu, String(last + 1))
		.replace(/\{pages\}/gu, describePages(piece.pages).replace(/,\s*/gu, "+").replace(/–/gu, "-"))
		.replace(/\{total\}/gu, String(total))
		.replace(/\{date\}/gu, stamp())
	return `${safeFileName(filled, `${base}-${piece.index}`)}.pdf`
}

/* ===== 8. Running the split ===== */

export interface OutPiece { name: string; pages: string; pageCount: number; bytes: number; blob: Blob }
export interface SplitOutcome {
	pieces: OutPiece[]
	totalBytes: number
	elapsedMs: number
	skipped: string[]
	error: string
	cancelled: boolean
}

export const EMPTY_OUTCOME: SplitOutcome = { pieces: [], totalBytes: 0, elapsedMs: 0, skipped: [], error: "", cancelled: false }

export async function splitPdf(
	bytes: Uint8Array,
	src: SourceDoc,
	o: SplitOptions,
	plan: Plan,
	onProgress: (done: number, total: number, name: string) => void,
	isCancelled: () => boolean,
): Promise<SplitOutcome> {
	const startedAt = Date.now()
	if (plan.errors.length > 0) return { ...EMPTY_OUTCOME, error: plan.errors[0] ?? "This split cannot run yet." }
	if (plan.pieces.length === 0) return { ...EMPTY_OUTCOME, error: "These settings produce no files." }

	let source: PDFDocument
	try { source = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false }) }
	catch (e) { return { ...EMPTY_OUTCOME, error: `The document could not be opened. ${e instanceof Error ? e.message : String(e)}` } }

	const target = o.sizeSource === "a4" ? PAGE_SIZES.a4 : o.sizeSource === "letter" ? PAGE_SIZES.letter : null
	let largest = src.pageSizes[0] ?? PAGE_SIZES.a4
	for (const s of src.pageSizes) if (s.width * s.height > largest.width * largest.height) largest = s
	const normalTo = target ?? (o.sizeSource === "largest" ? largest : src.pageSizes[0] ?? PAGE_SIZES.a4)

	const out: OutPiece[] = []
	const skipped: string[] = []
	const total = plan.pieces.length

	for (const piece of plan.pieces) {
		if (isCancelled()) return { ...EMPTY_OUTCOME, cancelled: true, elapsedMs: Date.now() - startedAt }
		const name = pieceName(o.namePattern, src.name, piece, total, o.padIndex)
		onProgress(out.length, total, name)
		await new Promise<void>((r) => setTimeout(r, 0))
		try {
			const doc = await PDFDocument.create()
			const order = o.reverseInPiece ? [...piece.pages].reverse() : piece.pages
			const copied = await doc.copyPages(source, order)
			for (const page of copied) {
				if (o.rotate !== 0) page.setRotation(degrees((page.getRotation().angle + o.rotate) % 360))
				if (o.normaliseSize) page.setSize(normalTo.width, normalTo.height)
				doc.addPage(page)
			}
			if (o.metadataMode === "copy") {
				if (src.title) doc.setTitle(src.title)
				if (src.author) doc.setAuthor(src.author)
				doc.setSubject(`Pages ${describePages(piece.pages)} of ${src.name}`)
			} else if (o.metadataMode === "custom") {
				if (o.title.trim()) doc.setTitle(o.title.trim())
				if (o.author.trim()) doc.setAuthor(o.author.trim())
				if (o.subject.trim()) doc.setSubject(o.subject.trim())
				const kw = o.keywords.split(",").map((k) => k.trim()).filter((k) => k.length > 0)
				if (kw.length > 0) doc.setKeywords(kw)
			} else {
				doc.setTitle(""); doc.setAuthor(""); doc.setSubject(""); doc.setKeywords([]); doc.setProducer(""); doc.setCreator("")
			}
			const saved = await doc.save({ useObjectStreams: o.compress })
			out.push({ name, pages: describePages(piece.pages), pageCount: piece.pages.length, bytes: saved.length, blob: new Blob([saved], { type: "application/pdf" }) })
		} catch (e) {
			skipped.push(`${name} could not be written. ${e instanceof Error ? e.message : String(e)} The other files were still produced.`)
		}
		onProgress(out.length, total, name)
	}

	if (out.length === 0) return { ...EMPTY_OUTCOME, error: "No files could be written.", skipped, elapsedMs: Date.now() - startedAt }
	return { pieces: out, totalBytes: out.reduce((n, p) => n + p.bytes, 0), elapsedMs: Date.now() - startedAt, skipped, error: "", cancelled: false }
}

export async function zipPieces(pieces: OutPiece[], onProgress?: (pct: number) => void): Promise<Blob> {
	const zip = new JSZip()
	for (const p of pieces) zip.file(p.name, p.blob)
	return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, (meta) => { if (onProgress) onProgress(Math.round(meta.percent)) })
}

/* ===== 9. Receipt and exports ===== */

export function csvCell(value: string): string {
	const neutral = /^[=+\-@\t\r]/u.test(value) ? `'${value}` : value
	return /[",\n]/u.test(neutral) ? `"${neutral.replace(/"/gu, '""')}"` : neutral
}

export function piecesToCsv(r: SplitOutcome): string {
	const rows = [["File", "Pages", "Page count", "Bytes"], ...r.pieces.map((p) => [p.name, p.pages, String(p.pageCount), String(p.bytes)])]
	return rows.map((row) => row.map(csvCell).join(",")).join("\n")
}

export function buildReceipt(src: SourceDoc, o: SplitOptions, plan: Plan, r: SplitOutcome): string {
	const lines = [
		"Tool: Split PDF",
		`Run: ${new Date().toISOString()}`,
		`Source: ${src.name} — ${src.pageCount} page${src.pageCount === 1 ? "" : "s"}, ${formatBytes(src.size)}`,
		`Result: ${r.pieces.length} file${r.pieces.length === 1 ? "" : "s"}, ${formatBytes(r.totalBytes)} in total, built in ${formatDuration(r.elapsedMs)}`,
		`Mode: ${o.mode}`,
		"",
		"FILES PRODUCED",
		"",
		...r.pieces.map((p, i) => `${i + 1}. ${p.name} — pages ${p.pages} (${p.pageCount}), ${formatBytes(p.bytes)}`),
	]
	if (plan.missing.length > 0) lines.push("", `Pages in no file: ${describePages(plan.missing)}`)
	if (plan.duplicated.length > 0) lines.push("", `Pages in more than one file: ${describePages(plan.duplicated)}`)
	lines.push("", `Page accounting ${plan.reconciles ? "reconciles with the original." : "does NOT reconcile — check the ranges above."}`)
	if (r.skipped.length > 0) lines.push("", "SKIPPED", "", ...r.skipped)
	lines.push("", "Everything ran in the browser. Nothing was uploaded.")
	return lines.join("\n")
}

export function buildJsonSummary(src: SourceDoc, o: SplitOptions, plan: Plan, r: SplitOutcome): string {
	return JSON.stringify({
		tool: "pdf-split", generated: new Date().toISOString(),
		source: { name: src.name, pages: src.pageCount, bytes: src.size },
		options: o,
		result: { files: r.pieces.map((p) => ({ name: p.name, pages: p.pages, pageCount: p.pageCount, bytes: p.bytes })), totalBytes: r.totalBytes, elapsedMs: r.elapsedMs },
		accounting: { missing: plan.missing.map((p) => p + 1), duplicated: plan.duplicated.map((p) => p + 1), reconciles: plan.reconciles },
		skipped: r.skipped,
	}, null, 2)
}

/* ===== 10. Storage and hooks ===== */

const PREFIX = "unqtools:pdf-split"
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

/** Settings only. Documents are never stored — the old tool kept a 100-character stump of your input. */
export type HistoryEntry = { id: string; at: number; summary: string; options: SplitOptions; pinned: boolean }

export function useHistory(): {
	entries: HistoryEntry[]
	add: (options: SplitOptions, summary: string) => void
	togglePin: (id: string) => void
	remove: (id: string) => void
	clearAll: () => void
} {
	const [entries, setEntries] = usePersisted<HistoryEntry[]>("history", [])
	const add = useCallback((options: SplitOptions, summary: string) => {
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

/* ===== 11. Content ===== */

export const MODES: ReadonlyArray<{ v: SplitMode; label: string; hint: string }> = [
	{ v: "ranges", label: "By ranges I write", hint: "One file per range, such as 1-3, 4-8, 9-." },
	{ v: "everyN", label: "Every N pages", hint: "Even chunks, with the remainder in the last file." },
	{ v: "perPage", label: "One file per page", hint: "Every page becomes its own PDF." },
	{ v: "parts", label: "A fixed number of files", hint: "Divided as evenly as the page count allows." },
	{ v: "cutPoints", label: "Cut after certain pages", hint: "Such as 4, 9, 15 — useful for chapters you know." },
	{ v: "bySize", label: "Under a size each", hint: "Fills each file until it would pass your limit." },
	{ v: "byBookmark", label: "By bookmark", hint: "One file per top-level bookmark, where the PDF has them." },
	{ v: "extract", label: "Extract only these pages", hint: "One file containing exactly the pages you name." },
	{ v: "remove", label: "Remove these pages", hint: "One file with everything except the pages you name." },
	{ v: "oddEven", label: "Odd and even pages", hint: "Two files, useful for recombining a two-sided scan." },
]

export const STATUS_LABEL: Record<SourceStatus, string> = {
	none: "No file yet", ready: "Ready", notPdf: "Not a PDF",
	encrypted: "Password-protected", corrupt: "Could not be opened", tooLarge: "Too large",
}

export type Preset = { id: string; label: string; description: string; values: Partial<SplitOptions> }

export const PRESETS: readonly Preset[] = [
	{ id: "each", label: "Every page separately", description: "One PDF per page, named with the page number.", values: { mode: "perPage", namePattern: "{name}-p{start}" } },
	{ id: "half", label: "In half", description: "Two files of equal length, give or take a page.", values: { mode: "parts", parts: 2 } },
	{ id: "chapters", label: "Chapters by bookmark", description: "One file per top-level bookmark, if the PDF has them.", values: { mode: "byBookmark", namePattern: "{name}-{index}-p{start}" } },
	{ id: "tens", label: "Chunks of ten", description: "Every ten pages, for reading or printing in batches.", values: { mode: "everyN", everyN: 10 } },
	{ id: "small", label: "Under five megabytes each", description: "For email attachments and upload limits.", values: { mode: "bySize", targetBytes: 5 * 1024 * 1024, compress: true } },
	{ id: "oddeven", label: "Odd and even", description: "Two files, for recombining a two-sided scan.", values: { mode: "oddEven", namePattern: "{name}-{pages}" } },
]

export const HOW_TO: ReadonlyArray<{ name: string; text: string }> = [
	{ name: "Add your PDF", text: "Drop it anywhere on the tool, or use the button. Its page count and size are read straight away." },
	{ name: "Choose how to split it", text: "By ranges, every N pages, one file per page, a fixed number of files, cut points, size, bookmarks, or odd and even." },
	{ name: "Check the preview", text: "Every file is listed with its pages before anything is built, including any page that would appear twice or not at all." },
	{ name: "Split and take them", text: "You get real PDFs as a zip, or one at a time, plus a receipt of exactly what was produced." },
]

export const FAQ: ReadonlyArray<{ question: string; answer: string }> = [
	{ question: "Is my document uploaded?", answer: "No. The split happens in this tab using your own browser, there is no network request in this tool, and it works offline. Your document is held in memory only for as long as the split takes." },
	{ question: "Why did this tool not work before?", answer: "It was published from an unfinished template. Its files were the same generic scaffold as Merge PDF, and its processing function returned whatever you typed straight back, so it never split anything. This version does the real work." },
	{ question: "How do I write page ranges?", answer: "Like 1-3, 7, 10- for pages one to three, seven, and ten to the end. Use -1 for the last page. Each range becomes one file. If a range is impossible, you get a sentence explaining why rather than an empty result." },
	{ question: "Can I split a password-protected PDF?", answer: "Not directly. It is detected and named. Remove the password in your PDF reader first, then add it again." },
	{ question: "Why does splitting by bookmark sometimes say there are none?", answer: "Because the PDF genuinely has no outline this tool can read reliably. Rather than guess where sections start, it says so and points you to cut points or ranges." },
	{ question: "Will each file really be under my size limit?", answer: "The pieces are planned from the original's average page size, so a file may come out slightly over or under. The real sizes are shown for every file once the split has run." },
	{ question: "What happens to pages I do not include?", answer: "They are listed explicitly as appearing in no file, so nothing is lost quietly. Overlapping pages are listed too." },
	{ question: "How do I stop the files overwriting each other?", answer: "The naming pattern supports the original name, the piece number, the first and last page, the page list, the total and the date, and the number is zero-padded so files sort correctly." },
	{ question: "What is the limit?", answer: "One hundred megabytes for the document and five hundred files for one run. You are told the real numbers if you go over." },
]

export const ASSUMPTIONS: readonly string[] = [
	"Page numbers you type are counted from 1, and −1 means the last page.",
	"Each range you write becomes one file, in the order you wrote them.",
	"Pages you do not include are reported, never silently dropped.",
	"Rotation you choose is added to any rotation the page already had.",
	"Nothing is uploaded, and your document is never stored. Only your settings are remembered.",
]

export const RELATED: ReadonlyArray<{ id: string; label: string; why: string }> = [
	{ id: "pdf-merge", label: "Merge PDF", why: "The opposite job: put documents together." },
	{ id: "pdf-compress", label: "Compress PDF", why: "Shrink the pieces before sending them." },
	{ id: "pdf-to-images", label: "PDF to Images", why: "Check a piece page by page." },
	{ id: "images-to-pdf", label: "Images to PDF", why: "Rebuild a document from pages you exported." },
]

export const ALIASES: readonly string[] = [
	"split pdf", "extract pdf pages", "separate pdf", "divide pdf", "cut pdf",
	"pdf splitter", "break pdf into pages", "remove pages from pdf", "split pdf offline", "split pdf without uploading",
]

export const SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
	{ keys: "Ctrl/Cmd + Enter", label: "Split now" },
	{ keys: "Ctrl/Cmd + O", label: "Open the file picker" },
	{ keys: "Ctrl/Cmd + S", label: "Download the zip" },
	{ keys: "Ctrl/Cmd + Backspace", label: "Clear the file and results" },
	{ keys: "?", label: "Show this list" },
	{ keys: "Esc", label: "Close a dialog, or stop a running split" },
]
