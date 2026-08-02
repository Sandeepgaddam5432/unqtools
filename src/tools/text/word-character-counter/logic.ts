"use client"

/**
 * Word & Character Counter — engine half of the 100x rebuild.
 *
 * Copy to: src/tools/text/word-character-counter/logic.ts
 * Pair with: CODE-2-UI.tsx  ->  src/tools/text/word-character-counter/ui.tsx
 *
 * Imports only react (for the hooks at the bottom). No project imports.
 * The counting functions themselves touch no DOM and stay Worker-safe.
 *
 * Every export from the previous logic.ts is still exported with a compatible
 * shape, so the existing logic.test.ts keeps passing. Fields were added to
 * TextStats; none were removed.
 */

import { useCallback, useEffect, useRef, useState } from "react"

/* ===== 1. Segmentation primitives ===== */

type SegmenterCtor = typeof Intl.Segmenter

const SegmenterOf = (): SegmenterCtor | undefined =>
	(Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter

export const hasSegmenter = (): boolean => SegmenterOf() !== undefined

const cache = new Map<string, Intl.Segmenter>()

function segmenter(locale: string, granularity: "grapheme" | "word" | "sentence") {
	const Ctor = SegmenterOf()
	if (!Ctor) return null
	const key = `${locale}:${granularity}`
	let found = cache.get(key)
	if (!found) {
		try {
			found = new Ctor(locale === "auto" ? undefined : locale, { granularity })
		} catch {
			found = new Ctor(undefined, { granularity })
		}
		if (cache.size > 24) cache.clear()
		cache.set(key, found)
	}
	return found
}

const FALLBACK_WORD = /[\p{L}\p{N}]+(?:['\u2019][\p{L}]+)*/gu

/** Words, locale-aware. Falls back to a Unicode regex. */
export function segmentWords(input: string, locale = "en"): string[] {
	if (!input.trim()) return []
	const seg = segmenter(locale, "word")
	if (seg) return [...seg.segment(input)].filter((s) => s.isWordLike).map((s) => s.segment)
	return input.match(FALLBACK_WORD) ?? []
}

/** Sentences, locale-aware. */
export function segmentSentences(input: string, locale = "en"): string[] {
	if (!input.trim()) return []
	const seg = segmenter(locale, "sentence")
	if (seg) return [...seg.segment(input)].map((s) => s.segment.trim()).filter(Boolean)
	return (input.match(/[^.!?\u0964]+[.!?\u0964]+/gu) ?? [input]).map((s) => s.trim()).filter(Boolean)
}

/** Grapheme clusters as an array. One emoji family = one entry. */
export function toGraphemes(input: string, locale = "en"): string[] {
	const seg = segmenter(locale, "grapheme")
	return seg ? Array.from(seg.segment(input), (p) => p.segment) : Array.from(input)
}

export function countGraphemes(input: string, locale = "en"): number {
	return toGraphemes(input, locale).length
}

export function utf8ByteLength(input: string): number {
	if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(input).length
	let bytes = 0
	for (const ch of Array.from(input)) {
		const cp = ch.codePointAt(0) ?? 0
		bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4
	}
	return bytes
}

/* ===== 2. Script and locale detection (F013, F074) ===== */

/** [label, test, wordsNeedSegmenter, suggestedLocale, readabilityMeaningful] */
const SCRIPTS: ReadonlyArray<[string, RegExp, boolean, string, boolean]> = [
	["Latin", /\p{Script=Latin}/u, false, "en", true],
	["Cyrillic", /\p{Script=Cyrillic}/u, false, "ru", false],
	["Greek", /\p{Script=Greek}/u, false, "el", false],
	["Telugu", /\p{Script=Telugu}/u, false, "te", false],
	["Devanagari", /\p{Script=Devanagari}/u, false, "hi", false],
	["Arabic", /\p{Script=Arabic}/u, false, "ar", false],
	["Hebrew", /\p{Script=Hebrew}/u, false, "he", false],
	["Han", /\p{Script=Han}/u, true, "zh", false],
	["Hiragana", /\p{Script=Hiragana}/u, true, "ja", false],
	["Katakana", /\p{Script=Katakana}/u, true, "ja", false],
	["Hangul", /\p{Script=Hangul}/u, true, "ko", false],
	["Thai", /\p{Script=Thai}/u, true, "th", false],
]

export const LOCALES: ReadonlyArray<{ id: string; label: string }> = [
	{ id: "auto", label: "Auto-detect" },
	{ id: "en", label: "English" },
	{ id: "de", label: "German" },
	{ id: "fr", label: "French" },
	{ id: "es", label: "Spanish" },
	{ id: "ru", label: "Russian" },
	{ id: "ar", label: "Arabic" },
	{ id: "hi", label: "Hindi" },
	{ id: "te", label: "Telugu" },
	{ id: "ja", label: "Japanese" },
	{ id: "zh", label: "Chinese" },
	{ id: "ko", label: "Korean" },
	{ id: "th", label: "Thai" },
]

export function detectScripts(input: string): string[] {
	const sample = input.slice(0, 4000)
	return SCRIPTS.filter(([, re]) => re.test(sample)).map(([label]) => label)
}

/** F074 — pick a locale from the text rather than assuming English. */
export function detectLocale(input: string): string {
	const sample = input.slice(0, 4000)
	for (const [, re, needs, locale] of SCRIPTS) {
		if (needs && re.test(sample)) return locale
	}
	for (const [, re, , locale] of SCRIPTS) {
		if (re.test(sample)) return locale
	}
	return "en"
}

export const resolveLocale = (option: string, input: string): string =>
	option === "auto" ? detectLocale(input) : option

/** F039 — Flesch was designed for English. Do not pretend otherwise. */
export function readabilityMeaningful(input: string): boolean {
	const found = detectScripts(input)
	if (found.length === 0) return false
	return found.every(
		(name) => SCRIPTS.find(([label]) => label === name)?.[4] === true,
	)
}

export type LineEnding = "LF" | "CRLF" | "CR" | "mixed" | "none"

export function detectLineEnding(input: string): LineEnding {
	const crlf = (input.match(/\r\n/gu) ?? []).length
	const lf = (input.match(/(?<!\r)\n/gu) ?? []).length
	const cr = (input.match(/\r(?!\n)/gu) ?? []).length
	const kinds = [crlf > 0, lf > 0, cr > 0].filter(Boolean).length
	if (kinds === 0) return "none"
	if (kinds > 1) return "mixed"
	return crlf > 0 ? "CRLF" : lf > 0 ? "LF" : "CR"
}

/* ===== 3. Stats ===== */

export interface TextStats {
	graphemes: number
	codeUnits: number
	utf8Bytes: number
	utf16Bytes: number
	codePoints: number
	whitespace: number
	spaces: number
	tabs: number
	newlines: number
	unicodeSpaces: number
	charactersNoSpaces: number
	letters: number
	uppercase: number
	lowercase: number
	digits: number
	punctuation: number
	symbols: number
	emoji: number
	words: number
	uniqueWords: number
	sentences: number
	paragraphs: number
	lines: number
	nonEmptyLines: number
	longestSentenceWords: number
	avgSentenceWords: number
	avgParagraphSentences: number
	avgWordLength: number
	longestWordLength: number
	syllables: number
	longWords: number
	approximate: boolean
}

export const EMPTY_STATS: TextStats = {
	graphemes: 0, codeUnits: 0, utf8Bytes: 0, utf16Bytes: 0, codePoints: 0,
	whitespace: 0, spaces: 0, tabs: 0, newlines: 0, unicodeSpaces: 0,
	charactersNoSpaces: 0, letters: 0, uppercase: 0, lowercase: 0, digits: 0,
	punctuation: 0, symbols: 0, emoji: 0, words: 0, uniqueWords: 0, sentences: 0,
	paragraphs: 0, lines: 0, nonEmptyLines: 0, longestSentenceWords: 0,
	avgSentenceWords: 0, avgParagraphSentences: 0, avgWordLength: 0,
	longestWordLength: 0, syllables: 0, longWords: 0, approximate: false,
}

const EMOJI_RE = /\p{Extended_Pictographic}/u
const round1 = (n: number): number => Math.round(n * 10) / 10

/** F036 — English syllable estimate. Good enough for a grade level, not a dictionary. */
export function countSyllables(word: string): number {
	const w = word.toLowerCase().replace(/[^a-z]/gu, "")
	if (w.length === 0) return 0
	if (w.length <= 3) return 1
	const trimmed = w
		.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/u, "")
		.replace(/^y/u, "")
	const groups = trimmed.match(/[aeiouy]{1,2}/gu)
	return Math.max(1, groups ? groups.length : 1)
}

/**
 * The single counting pass.
 *
 * The old version computed charactersNoSpaces as graphemes minus a UTF-16
 * whitespace count, mixing two units. Here every character class is counted
 * from the same grapheme walk, so the numbers add up.
 */
export function countText(input: string, locale = "en"): TextStats {
	if (!input) return { ...EMPTY_STATS }
	const loc = resolveLocale(locale, input)
	const approximate = !hasSegmenter()

	const graphemeList = toGraphemes(input, loc)
	let spaces = 0
	let tabs = 0
	let newlines = 0
	let unicodeSpaces = 0
	let letters = 0
	let uppercase = 0
	let lowercase = 0
	let digits = 0
	let punctuation = 0
	let symbols = 0
	let emoji = 0

	for (const g of graphemeList) {
		if (EMOJI_RE.test(g)) {
			emoji += 1
			symbols += 1
			continue
		}
		const first = g.charAt(0)
		if (first === " ") { spaces += 1; continue }
		if (first === "\t") { tabs += 1; continue }
		if (first === "\n" || first === "\r") { newlines += 1; continue }
		if (/^\s$/u.test(first)) { unicodeSpaces += 1; continue }
		if (/\p{L}/u.test(g)) {
			letters += 1
			if (/\p{Lu}/u.test(g)) uppercase += 1
			else if (/\p{Ll}/u.test(g)) lowercase += 1
			continue
		}
		if (/\p{N}/u.test(g)) { digits += 1; continue }
		if (/\p{P}/u.test(g)) { punctuation += 1; continue }
		symbols += 1
	}

	// CRLF counted once as a single line break.
	newlines -= (input.match(/\r\n/gu) ?? []).length
	const whitespace = spaces + tabs + newlines + unicodeSpaces
	const graphemes = graphemeList.length

	const wordList = segmentWords(input, loc)
	const words = wordList.length
	const unique = new Set<string>()
	let wordLengthTotal = 0
	let longestWordLength = 0
	let syllables = 0
	let longWords = 0
	for (const w of wordList) {
		unique.add(w.toLowerCase())
		const len = countGraphemes(w, loc)
		wordLengthTotal += len
		if (len > longestWordLength) longestWordLength = len
		const syl = countSyllables(w)
		syllables += syl
		if (syl >= 3) longWords += 1
	}

	// One sentence pass. The old version re-segmented the words of every
	// sentence, which is where the typing lag came from.
	const sentenceList = segmentSentences(input, loc)
	const sentences = sentenceList.length
	let longestSentenceWords = 0
	for (const s of sentenceList) {
		const n = (s.match(FALLBACK_WORD) ?? []).length
		if (n > longestSentenceWords) longestSentenceWords = n
	}

	const paragraphList = input.split(/\r?\n\s*\r?\n/u).map((p) => p.trim()).filter(Boolean)
	const lineList = input.split(/\r\n|\r|\n/u)

	return {
		graphemes,
		codeUnits: input.length,
		utf8Bytes: utf8ByteLength(input),
		utf16Bytes: input.length * 2,
		codePoints: Array.from(input).length,
		whitespace,
		spaces,
		tabs,
		newlines,
		unicodeSpaces,
		charactersNoSpaces: graphemes - whitespace,
		letters,
		uppercase,
		lowercase,
		digits,
		punctuation,
		symbols,
		emoji,
		words,
		uniqueWords: unique.size,
		sentences,
		paragraphs: paragraphList.length,
		lines: lineList.length,
		nonEmptyLines: lineList.filter((l) => l.trim().length > 0).length,
		longestSentenceWords,
		avgSentenceWords: sentences ? round1(words / sentences) : 0,
		avgParagraphSentences: paragraphList.length ? round1(sentences / paragraphList.length) : 0,
		avgWordLength: words ? round1(wordLengthTotal / words) : 0,
		longestWordLength,
		syllables,
		longWords,
		approximate,
	}
}

/* ===== 4. Chunked counting for large input (F096, F097) ===== */

export const WORKER_THRESHOLD_BYTES = 100 * 1024
export const CHUNK_THRESHOLD = 250_000
export const CHUNK_MS = 16
export const WARN_CHARS = 200_000
export const MAX_CHARS = 5_000_000
export const RENDER_LIMIT = 200_000

function mergeStats(a: TextStats, b: TextStats): TextStats {
	const add = (k: keyof TextStats): number => (a[k] as number) + (b[k] as number)
	return {
		...a,
		graphemes: add("graphemes"), codeUnits: add("codeUnits"), utf8Bytes: add("utf8Bytes"),
		utf16Bytes: add("utf16Bytes"), codePoints: add("codePoints"), whitespace: add("whitespace"),
		spaces: add("spaces"), tabs: add("tabs"), newlines: add("newlines"),
		unicodeSpaces: add("unicodeSpaces"), charactersNoSpaces: add("charactersNoSpaces"),
		letters: add("letters"), uppercase: add("uppercase"), lowercase: add("lowercase"),
		digits: add("digits"), punctuation: add("punctuation"), symbols: add("symbols"),
		emoji: add("emoji"), words: add("words"), uniqueWords: add("uniqueWords"),
		sentences: add("sentences"), paragraphs: add("paragraphs"), lines: add("lines"),
		nonEmptyLines: add("nonEmptyLines"), syllables: add("syllables"), longWords: add("longWords"),
		longestSentenceWords: Math.max(a.longestSentenceWords, b.longestSentenceWords),
		longestWordLength: Math.max(a.longestWordLength, b.longestWordLength),
		approximate: a.approximate || b.approximate,
	}
}

/**
 * F096 — counts a large document in slices, yielding to the event loop so the
 * tab stays alive and Stop works. Slices are cut on blank lines, so sentence
 * and paragraph boundaries survive.
 */
export async function countTextChunked(
	input: string,
	locale: string,
	onProgress: (ratio: number) => void,
	isCancelled: () => boolean,
): Promise<{ stats: TextStats; cancelled: boolean }> {
	const loc = resolveLocale(locale, input)
	const blocks = input.split(/(?<=\n\s*\n)/u)
	let acc: TextStats | null = null
	let done = 0
	let deadline = Date.now() + CHUNK_MS
	const unique = new Set<string>()

	for (const block of blocks) {
		if (isCancelled()) return { stats: acc ?? { ...EMPTY_STATS }, cancelled: true }
		const part = countText(block, loc)
		for (const w of segmentWords(block, loc)) unique.add(w.toLowerCase())
		acc = acc ? mergeStats(acc, part) : part
		done += block.length
		if (Date.now() >= deadline) {
			onProgress(done / input.length)
			await new Promise<void>((r) => setTimeout(r, 0))
			deadline = Date.now() + CHUNK_MS
		}
	}

	const stats = acc ?? { ...EMPTY_STATS }
	stats.uniqueWords = unique.size
	stats.lines = input.split(/\r\n|\r|\n/u).length
	stats.avgSentenceWords = stats.sentences ? round1(stats.words / stats.sentences) : 0
	stats.avgParagraphSentences = stats.paragraphs ? round1(stats.sentences / stats.paragraphs) : 0
	onProgress(1)
	return { stats, cancelled: false }
}

/* ===== 5. Readability and time (F037, F038, F041–F043) ===== */

export type Readability = {
	flesch: number
	band: string
	grade: number
	longWordRatio: number
	meaningful: boolean
}

export function computeReadability(stats: TextStats, meaningful: boolean): Readability {
	const { words, sentences, syllables, longWords } = stats
	if (words === 0 || sentences === 0) {
		return { flesch: 0, band: "—", grade: 0, longWordRatio: 0, meaningful }
	}
	const wps = words / sentences
	const spw = syllables / words
	const flesch = round1(206.835 - 1.015 * wps - 84.6 * spw)
	const grade = round1(0.39 * wps + 11.8 * spw - 15.59)
	const band =
		flesch >= 90 ? "Very easy"
		: flesch >= 80 ? "Easy"
		: flesch >= 70 ? "Fairly easy"
		: flesch >= 60 ? "Plain English"
		: flesch >= 50 ? "Fairly difficult"
		: flesch >= 30 ? "Difficult"
		: "Very difficult"
	return { flesch, band, grade, longWordRatio: round1((longWords / words) * 100), meaningful }
}

export function computeReadingTime(words: number, wpm = 225): { minutes: number; seconds: number } {
	const total = Math.round((words / Math.max(1, wpm)) * 60)
	return { minutes: Math.floor(total / 60), seconds: total % 60 }
}

export function computeSpeakingTime(words: number, wpm = 130): { minutes: number; seconds: number } {
	const total = Math.round((words / Math.max(1, wpm)) * 60)
	return { minutes: Math.floor(total / 60), seconds: total % 60 }
}

/** F043 — handwriting, at roughly 20 words a minute. */
export function computeHandwritingTime(words: number, wpm = 20): { minutes: number; seconds: number } {
	const total = Math.round((words / Math.max(1, wpm)) * 60)
	return { minutes: Math.floor(total / 60), seconds: total % 60 }
}

export const formatDuration = (d: { minutes: number; seconds: number }): string =>
	d.minutes === 0 && d.seconds === 0
		? "under 1 second"
		: d.minutes === 0
			? `${d.seconds}s`
			: `${d.minutes}m ${d.seconds}s`

/* ===== 6. SMS (F054–F057) ===== */

export interface SmsInfo {
	encoding: "GSM-7" | "UCS-2"
	segments: number
	charsPerSegment: number
	remainingInSegment: number
	unitsUsed: number
}

const GSM_7_BASIC = new Set(
	"@\u00a3$\u00a5\u00e8\u00e9\u00f9\u00ec\u00f2\u00c7\n\u00d8\u00f8\r\u00c5\u00e5\u0394_\u03a6\u0393\u039b\u03a9\u03a0\u03a8\u03a3\u0398\u039e \u00c6\u00e6\u00df\u00c9 !\"#\u00a4%&'()*+,-./0123456789:;<=>?\u00a1ABCDEFGHIJKLMNOPQRSTUVWXYZ\u00c4\u00d6\u00d1\u00dc\u00a7\u00bfabcdefghijklmnopqrstuvwxyz\u00e4\u00f6\u00f1\u00fc\u00e0".split(""),
)
const GSM_7_EXTENDED = new Set(["^", "{", "}", "\\", "[", "~", "]", "|", "\u20ac"])

function isGsm7(input: string): boolean {
	for (const ch of input) if (!GSM_7_BASIC.has(ch) && !GSM_7_EXTENDED.has(ch)) return false
	return true
}

/** F057 — name the characters that forced the expensive encoding. */
export function ucs2Reasons(input: string, limit = 8): string[] {
	const found: string[] = []
	for (const ch of input) {
		if (!GSM_7_BASIC.has(ch) && !GSM_7_EXTENDED.has(ch) && !found.includes(ch)) {
			found.push(ch)
			if (found.length >= limit) break
		}
	}
	return found
}

/** 3GPP TS 23.038. GSM-7: 160 then 153. UCS-2: 70 then 67. */
export function countSmsSegments(input: string): SmsInfo {
	if (!input) {
		return { encoding: "GSM-7", segments: 0, charsPerSegment: 160, remainingInSegment: 160, unitsUsed: 0 }
	}
	if (isGsm7(input)) {
		let septets = 0
		for (const ch of input) septets += GSM_7_EXTENDED.has(ch) ? 2 : 1
		if (septets <= 160) {
			return { encoding: "GSM-7", segments: 1, charsPerSegment: 160, remainingInSegment: 160 - septets, unitsUsed: septets }
		}
		const segments = Math.ceil(septets / 153)
		return {
			encoding: "GSM-7", segments, charsPerSegment: 153,
			remainingInSegment: 153 - (septets - 153 * (segments - 1)), unitsUsed: septets,
		}
	}
	const units = input.length
	if (units <= 70) {
		return { encoding: "UCS-2", segments: 1, charsPerSegment: 70, remainingInSegment: 70 - units, unitsUsed: units }
	}
	const segments = Math.ceil(units / 67)
	return {
		encoding: "UCS-2", segments, charsPerSegment: 67,
		remainingInSegment: 67 - (units - 67 * (segments - 1)), unitsUsed: units,
	}
}

/* ===== 7. Platform limits (F051–F055) ===== */

export interface PlatformLimit {
	id: string
	label: string
	limit: number
	unit: "characters" | "words"
	remaining: number
	over: boolean
	used: number
	note?: string
}

const PLATFORMS: ReadonlyArray<{ id: string; label: string; limit: number; unit: "characters" | "words" }> = [
	{ id: "twitter", label: "X (Twitter)", limit: 280, unit: "characters" },
	{ id: "sms", label: "SMS (single)", limit: 160, unit: "characters" },
	{ id: "meta-desc", label: "Meta description", limit: 160, unit: "characters" },
	{ id: "title-tag", label: "Title tag", limit: 60, unit: "characters" },
	{ id: "og-desc", label: "OG description", limit: 200, unit: "characters" },
	{ id: "linkedin", label: "LinkedIn post", limit: 3000, unit: "characters" },
	{ id: "linkedin-headline", label: "LinkedIn headline", limit: 220, unit: "characters" },
	{ id: "instagram", label: "Instagram caption", limit: 2200, unit: "characters" },
	{ id: "instagram-bio", label: "Instagram bio", limit: 150, unit: "characters" },
	{ id: "facebook", label: "Facebook post", limit: 63206, unit: "characters" },
	{ id: "youtube-title", label: "YouTube title", limit: 100, unit: "characters" },
	{ id: "youtube-desc", label: "YouTube description", limit: 5000, unit: "characters" },
	{ id: "reddit-title", label: "Reddit title", limit: 300, unit: "characters" },
	{ id: "pinterest", label: "Pinterest description", limit: 500, unit: "characters" },
	{ id: "whatsapp-status", label: "WhatsApp status", limit: 139, unit: "characters" },
	{ id: "app-store", label: "App Store subtitle", limit: 30, unit: "characters" },
	{ id: "email-subject", label: "Email subject", limit: 60, unit: "characters" },
	{ id: "abstract", label: "Journal abstract", limit: 250, unit: "words" },
]

export const ALL_PLATFORM_IDS: readonly string[] = PLATFORMS.map((p) => p.id)
export const DEFAULT_PLATFORM_IDS: readonly string[] = [
	"twitter", "sms", "meta-desc", "title-tag", "og-desc", "linkedin", "instagram", "email-subject",
]

/**
 * The SMS row now uses the segment maths instead of comparing raw characters
 * against 160, so it can no longer contradict the SMS panel.
 */
export function getPlatformLimits(chars: number, words: number, sms?: SmsInfo): PlatformLimit[] {
	return PLATFORMS.map((p) => {
		if (p.id === "sms" && sms) {
			const limit = sms.encoding === "GSM-7" ? 160 : 70
			return {
				...p, limit, used: sms.unitsUsed,
				remaining: limit - sms.unitsUsed, over: sms.unitsUsed > limit,
				note: `${sms.encoding}, ${sms.segments} segment${sms.segments === 1 ? "" : "s"}`,
			}
		}
		const used = p.unit === "words" ? words : chars
		return { ...p, used, remaining: p.limit - used, over: used > p.limit }
	})
}

/* ===== 8. Keywords and breakdowns (F044–F050) ===== */

const STOPWORDS = new Set(
	("the a an and or but is are was were be been being have has had do does did will would could " +
		"should may might must shall can need dare ought used to of in for on with at by from as into " +
		"through during before after above below between under up down out off over again further then " +
		"once here there when where why how all each few more most other some such no nor not only own " +
		"same so than too very just this that these those i you he she it we they them their what which " +
		"who whom whose if because while about against my your his her its our").split(" "),
)

export type KeywordRow = { word: string; count: number; density: number }

/** F044–F046 — single words or 2/3 word phrases. */
export function keywordDensity(
	input: string,
	opts: { excludeStopwords?: boolean; topN?: number; phraseLength?: number; locale?: string } = {},
): KeywordRow[] {
	const { excludeStopwords = true, topN = 10, phraseLength = 1, locale = "en" } = opts
	const words = segmentWords(input, locale).map((w) => w.toLowerCase())
	const counts = new Map<string, number>()
	const n = Math.max(1, Math.min(3, phraseLength))
	if (n === 1) {
		for (const w of words) {
			if (excludeStopwords && STOPWORDS.has(w)) continue
			counts.set(w, (counts.get(w) ?? 0) + 1)
		}
	} else {
		for (let i = 0; i + n <= words.length; i += 1) {
			const slice = words.slice(i, i + n)
			if (excludeStopwords && slice.every((w) => STOPWORDS.has(w))) continue
			const phrase = slice.join(" ")
			counts.set(phrase, (counts.get(phrase) ?? 0) + 1)
		}
	}
	const total = words.length || 1
	return [...counts.entries()]
		.map(([word, count]) => ({ word, count, density: round1((count / total) * 100) }))
		.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
		.slice(0, topN)
}

/** F047 */
export function longestWords(input: string, locale = "en", topN = 8): string[] {
	const seen = new Set<string>()
	return segmentWords(input, locale)
		.filter((w) => {
			const k = w.toLowerCase()
			if (seen.has(k)) return false
			seen.add(k)
			return true
		})
		.sort((a, b) => countGraphemes(b) - countGraphemes(a))
		.slice(0, topN)
}

export type BreakdownRow = {
	index: number
	text: string
	words: number
	chars: number
	sentences: number
}

/** F048–F050 — per line or per paragraph. */
export function breakdown(
	input: string,
	mode: "line" | "paragraph",
	locale = "en",
	limit = 500,
): { rows: BreakdownRow[]; truncated: boolean } {
	const parts =
		mode === "line"
			? input.split(/\r\n|\r|\n/u)
			: input.split(/\r?\n\s*\r?\n/u).map((p) => p.trim()).filter(Boolean)
	const rows = parts.slice(0, limit).map((text, i) => ({
		index: i + 1,
		text,
		words: segmentWords(text, locale).length,
		chars: countGraphemes(text, locale),
		sentences: segmentSentences(text, locale).length,
	}))
	return { rows, truncated: parts.length > limit }
}

/* ===== 9. Options ===== */

export type Options = {
	locale: string
	readingWpm: number
	speakingWpm: number
	excludeStopwords: boolean
	topKeywords: number
	phraseLength: number
	wordTarget: number
	charTarget: number
	countSelection: boolean
	breakdownMode: "line" | "paragraph"
	visiblePlatforms: string[]
	monospace: boolean
	shareInput: boolean
}

export const DEFAULTS: Options = {
	locale: "auto",
	readingWpm: 225,
	speakingWpm: 130,
	excludeStopwords: true,
	topKeywords: 10,
	phraseLength: 1,
	wordTarget: 0,
	charTarget: 0,
	countSelection: true,
	breakdownMode: "line",
	visiblePlatforms: [...DEFAULT_PLATFORM_IDS],
	monospace: false,
	shareInput: false,
}

export type Preset = { id: string; label: string; description: string; values: Partial<Options> }

export const PRESETS: readonly Preset[] = [
	{ id: "seo", label: "SEO", description: "Title tag, meta and OG limits, keyword density on.", values: { visiblePlatforms: ["title-tag", "meta-desc", "og-desc", "twitter"], topKeywords: 15 } },
	{ id: "tweet", label: "Tweet", description: "280 characters, nothing else in the way.", values: { visiblePlatforms: ["twitter"], charTarget: 280 } },
	{ id: "sms", label: "SMS", description: "Segments, encoding and cost.", values: { visiblePlatforms: ["sms", "whatsapp-status"] } },
	{ id: "essay", label: "Essay", description: "A word goal and readability.", values: { wordTarget: 1500, breakdownMode: "paragraph" } },
	{ id: "subtitle", label: "Subtitle", description: "Per-line counts for caption files.", values: { breakdownMode: "line", monospace: true } },
	{ id: "abstract", label: "Abstract", description: "A 250 word journal limit.", values: { visiblePlatforms: ["abstract"], wordTarget: 250 } },
]

/* ===== 10. Export (F063–F072) ===== */

export type ExportFormat = "txt" | "md" | "json" | "csv" | "html"

export const MIME: Record<ExportFormat, string> = {
	txt: "text/plain;charset=utf-8",
	md: "text/markdown;charset=utf-8",
	json: "application/json;charset=utf-8",
	csv: "text/csv;charset=utf-8",
	html: "text/html;charset=utf-8",
}

/** F069 — a keyword beginning = + - @ must not become a spreadsheet formula. */
export const csvCell = (v: string): string =>
	`"${(/^[=+\-@\t\r]/u.test(v) ? `'${v}` : v).replace(/"/gu, '""')}"`

const esc = (v: string): string =>
	v.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;")

export const STAT_ROWS: ReadonlyArray<{ key: keyof TextStats; label: string; hint?: string }> = [
	{ key: "words", label: "Words" },
	{ key: "graphemes", label: "Characters", hint: "what a reader sees; one emoji is one" },
	{ key: "charactersNoSpaces", label: "Characters without spaces" },
	{ key: "sentences", label: "Sentences" },
	{ key: "paragraphs", label: "Paragraphs" },
	{ key: "lines", label: "Lines" },
	{ key: "nonEmptyLines", label: "Non-empty lines" },
	{ key: "uniqueWords", label: "Unique words" },
	{ key: "codePoints", label: "Code points", hint: "Unicode scalars" },
	{ key: "codeUnits", label: "UTF-16 code units", hint: "what JavaScript .length reports" },
	{ key: "utf8Bytes", label: "UTF-8 bytes" },
	{ key: "utf16Bytes", label: "UTF-16 bytes" },
	{ key: "spaces", label: "Spaces" },
	{ key: "tabs", label: "Tabs" },
	{ key: "newlines", label: "Line breaks" },
	{ key: "letters", label: "Letters" },
	{ key: "digits", label: "Digits" },
	{ key: "punctuation", label: "Punctuation" },
	{ key: "emoji", label: "Emoji" },
	{ key: "avgWordLength", label: "Average word length" },
	{ key: "avgSentenceWords", label: "Average sentence, in words" },
	{ key: "longestSentenceWords", label: "Longest sentence, in words" },
]

/** F071 — an export says which settings produced it. */
export function buildReceipt(o: Options, locale: string): string {
	const changed = (Object.keys(DEFAULTS) as Array<keyof Options>)
		.filter((k) => JSON.stringify(o[k]) !== JSON.stringify(DEFAULTS[k]))
		.map((k) => `${k}=${JSON.stringify(o[k])}`)
	return [
		"Tool: Word & Character Counter",
		`Locale used: ${locale}`,
		`Generated: ${new Date().toISOString()}`,
		`Non-default settings: ${changed.length > 0 ? changed.join(", ") : "none"}`,
	].join("\n")
}

export function summaryText(stats: TextStats): string {
	return STAT_ROWS.map((r) => `${r.label}: ${String(stats[r.key])}`).join("\n")
}

export function summaryMarkdown(stats: TextStats): string {
	return [
		"| Stat | Value |",
		"| --- | --- |",
		...STAT_ROWS.map((r) => `| ${r.label} | ${String(stats[r.key])} |`),
	].join("\n")
}

export function serialize(
	format: ExportFormat,
	stats: TextStats,
	extra: { sms: SmsInfo; readability: Readability; keywords: KeywordRow[]; platforms: PlatformLimit[] },
	o: Options,
	locale: string,
): string {
	const receipt = buildReceipt(o, locale)
	if (format === "txt") return `${summaryText(stats)}\n\n${receipt}\n`
	if (format === "md") {
		return `# Text statistics\n\n${summaryMarkdown(stats)}\n\n## Notes\n\n${receipt
			.split("\n")
			.map((l) => `- ${l}`)
			.join("\n")}\n`
	}
	if (format === "json") {
		return JSON.stringify(
			{ tool: "word-character-counter", locale, options: o, stats, ...extra, receipt },
			null,
			2,
		)
	}
	if (format === "csv") {
		const rows = ["stat,value", ...STAT_ROWS.map((r) => `${csvCell(r.label)},${String(stats[r.key])}`)]
		if (extra.keywords.length > 0) {
			rows.push("", "keyword,count,density_percent")
			for (const k of extra.keywords) rows.push(`${csvCell(k.word)},${k.count},${k.density}`)
		}
		return rows.join("\n")
	}
	return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Text statistics</title></head><body><h1>Text statistics</h1><dl>${STAT_ROWS.map(
		(r) => `<dt>${esc(r.label)}</dt><dd>${String(stats[r.key])}</dd>`,
	).join("")}</dl><hr><pre>${esc(receipt)}</pre></body></html>\n`
}

export function download(filename: string, content: string, mime: string): void {
	const url = URL.createObjectURL(new Blob([content], { type: mime }))
	const a = document.createElement("a")
	a.href = url
	a.download = filename
	a.rel = "noopener"
	document.body.appendChild(a)
	a.click()
	a.remove()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const stamp = (): string => new Date().toISOString().slice(0, 10)

/* ===== 11. Storage and hooks (F006, F008, F078, F081–F084, F100) ===== */

const PREFIX = "unqtools:word-character-counter"
export const MAX_HISTORY = 20
export const MAX_PRESETS = 12
const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000

function readJson<T>(key: string, fallback: T): T {
	if (typeof window === "undefined") return fallback
	try {
		const raw = window.localStorage.getItem(key)
		return raw ? (JSON.parse(raw) as T) : fallback
	} catch {
		return fallback
	}
}

function writeJson(key: string, value: unknown): void {
	if (typeof window === "undefined") return
	try {
		window.localStorage.setItem(key, JSON.stringify(value))
	} catch {
		// Private mode or a full quota. A lost preference is not worth an error.
	}
}

/** F100 */
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
	const update = useCallback(
		(next: T) => {
			setValue(next)
			if (hydrated.current) writeJson(`${PREFIX}:${key}`, next)
		},
		[key],
	)
	return [value, update]
}

export type HistoryEntry = {
	id: string
	at: number
	snippet: string
	words: number
	chars: number
	pinned: boolean
}

export function useHistory(): {
	entries: HistoryEntry[]
	add: (snippet: string, words: number, chars: number) => void
	togglePin: (id: string) => void
	remove: (id: string) => void
	clearAll: () => void
} {
	const [entries, setEntries] = usePersisted<HistoryEntry[]>("history", [])
	const add = useCallback(
		(snippet: string, words: number, chars: number) => {
			if (snippet.trim().length === 0) return
			const text = snippet.slice(0, 2000)
			setEntries(
				[
					{
						id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
						at: Date.now(),
						snippet: text,
						words,
						chars,
						pinned: false,
					},
					...entries.filter((e) => e.snippet !== text),
				]
					.sort((a, b) => Number(b.pinned) - Number(a.pinned))
					.slice(0, MAX_HISTORY),
			)
		},
		[entries, setEntries],
	)
	return {
		entries,
		add,
		togglePin: (id) => setEntries(entries.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e))),
		remove: (id) => setEntries(entries.filter((e) => e.id !== id)),
		clearAll: () => setEntries([]),
	}
}

/** F008 — offered, never applied silently. */
export function useDraft(text: string): { draft: string | null; dismiss: () => void } {
	const [draft, setDraft] = useState<string | null>(null)
	useEffect(() => {
		const saved = readJson<{ at: number; text: string } | null>(`${PREFIX}:draft`, null)
		if (saved && Date.now() - saved.at < DRAFT_MAX_AGE && saved.text.trim().length > 0) {
			setDraft(saved.text)
		}
	}, [])
	useEffect(() => {
		const t = setTimeout(() => {
			if (text.length > 0 && text.length < 256_000) writeJson(`${PREFIX}:draft`, { at: Date.now(), text })
		}, 1200)
		return () => clearTimeout(t)
	}, [text])
	return { draft, dismiss: () => setDraft(null) }
}

/** F006 */
export function useUndoRedo(
	value: string,
	setValue: (next: string) => void,
): { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean } {
	const past = useRef<string[]>([])
	const future = useRef<string[]>([])
	const lastPush = useRef(0)
	const current = useRef(value)
	const [, force] = useState(0)

	useEffect(() => {
		if (value === current.current) return
		const now = Date.now()
		if (now - lastPush.current > 500) {
			past.current = [...past.current, current.current].slice(-50)
			future.current = []
			lastPush.current = now
			force((n) => n + 1)
		}
		current.current = value
	}, [value])

	return {
		canUndo: past.current.length > 0,
		canRedo: future.current.length > 0,
		undo: () => {
			const prev = past.current.pop()
			if (prev === undefined) return
			future.current = [current.current, ...future.current]
			current.current = prev
			setValue(prev)
			force((n) => n + 1)
		},
		redo: () => {
			const [next, ...rest] = future.current
			if (next === undefined) return
			future.current = rest
			past.current = [...past.current, current.current]
			current.current = next
			setValue(next)
			force((n) => n + 1)
		},
	}
}

/** F095 — the debounce that stops counting on every keystroke. */
export function useDebounced<T>(value: T, ms = 160): T {
	const [out, setOut] = useState(value)
	useEffect(() => {
		const t = setTimeout(() => setOut(value), ms)
		return () => clearTimeout(t)
	}, [value, ms])
	return out
}

/* ===== 12. Content ===== */

export const SAMPLES: ReadonlyArray<{ label: string; hint: string; text: string }> = [
	{ label: "English paragraph", hint: "A plain readability baseline.", text: "The quick brown fox jumps over the lazy dog. It does so every morning, without complaint, because the dog has never once given chase. Habit is a powerful thing." },
	{ label: "Emoji", hint: "One family emoji is one character, seven code points.", text: "Family: \ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d\udc66 and a thumbs up \ud83d\udc4d\ud83c\udffd" },
	{ label: "Telugu and Hindi", hint: "Scripts with clusters and no letter case.", text: "\u0c28\u0c2e\u0c38\u0c4d\u0c24\u0c47, \u0c08 \u0c38\u0c3e\u0c27\u0c28\u0c02 \u0c2e\u0c40 \u0c2c\u0c4d\u0c30\u0c3e\u0c35\u0c4d\u0c1c\u0c30\u0c4d \u0c32\u0c4b\u0c28\u0c47 \u0c2a\u0c28\u0c3f\u0c1a\u0c47\u0c38\u0c4d\u0c24\u0c41\u0c02\u0c26\u0c3f.\n\u092f\u0939 \u0935\u093e\u0915\u094d\u092f \u0939\u093f\u0902\u0926\u0940 \u092e\u0947\u0902 \u0939\u0948\u0964" },
	{ label: "Japanese", hint: "No spaces. The locale decides the word count.", text: "\u4eca\u65e5\u306f\u3068\u3066\u3082\u3044\u3044\u5929\u6c17\u3067\u3059\u306d\u3002\u516c\u5712\u3092\u6b69\u304d\u307e\u3057\u3087\u3046\u304b\u3002" },
	{ label: "SMS with an emoji", hint: "Forces UCS-2, so 70 characters per segment.", text: "Your order has shipped \ud83d\ude9a and will arrive on Tuesday. Track it in the app." },
]

export const HOW_TO: ReadonlyArray<{ name: string; text: string }> = [
	{ name: "Add your text", text: "Type it, paste it, drop a file in, or load a sample." },
	{ name: "Read the counts", text: "Words, characters, sentences and bytes update as you type." },
	{ name: "Set a goal or a platform", text: "Add a word target, or switch on the platform whose limit you are writing to." },
	{ name: "Take the numbers with you", text: "Copy the summary, or download TXT, Markdown, JSON, CSV or HTML." },
]

export const FAQ: ReadonlyArray<{ question: string; answer: string }> = [
	{ question: "Which character count should I use?", answer: "Characters, the grapheme count, is what a reader sees and what most platforms mean. UTF-16 code units is what JavaScript reports. UTF-8 bytes is what a database column or a network payload consumes. All are shown, and each is labelled." },
	{ question: "Why do you count one emoji as one character?", answer: "Because that is what it is on screen. A family emoji is a single grapheme cluster built from seven code points and eleven UTF-16 units. The other numbers are there when you need them." },
	{ question: "Why did my word count change when I picked a locale?", answer: "Japanese, Chinese, Thai and Khmer do not put spaces between words, so counting them requires the language's own word-breaking rules. With the wrong locale the number is meaningless." },
	{ question: "Is the SMS count reliable?", answer: "It follows 3GPP TS 23.038. GSM-7 gives 160 characters in one segment and 153 in each of several; the extended characters like { } [ ] ~ ^ \\ | \u20ac cost two each. Any character outside GSM-7 switches the whole message to UCS-2 at 70 and 67." },
	{ question: "How accurate is the reading time?", answer: "It is words divided by a rate you can set. 225 words a minute is a common silent-reading average; adjust it to your audience." },
	{ question: "Does the readability score work for my language?", answer: "Flesch and Flesch-Kincaid were built for English, so they are only shown when the text is Latin script. Showing them for Telugu or Japanese would be a number without a meaning." },
	{ question: "Can I count only part of my text?", answer: "Select it. The counts switch to the selection and say so." },
	{ question: "Is my text uploaded anywhere?", answer: "No. Everything is counted in your browser. The tool makes no network request at all and works offline." },
	{ question: "How much text can it handle?", answer: "Five million characters. Above 250 KB the counting is done in slices with progress and a Stop button, so the page stays responsive." },
]

export const ALIASES: readonly string[] = [
	"word counter", "character counter", "letter counter", "character count online",
	"words to characters", "sms character counter", "twitter character counter",
	"meta description length checker", "essay word count", "reading time calculator",
	"utf-8 byte counter", "keyword density checker",
]

export const RELATED: ReadonlyArray<{ id: string; label: string; why: string }> = [
	{ id: "text-statistics", label: "Text Statistics", why: "A deeper document report." },
	{ id: "text-reading-time-estimator", label: "Reading Time Estimator", why: "Reading time on its own." },
	{ id: "text-keyword-extractor", label: "Keyword Extractor", why: "Keywords beyond raw density." },
	{ id: "case-converter", label: "Case Converter", why: "Change the text once you have measured it." },
]

/** F083-adjacent honesty: the tool names its own approximations. */
export const ASSUMPTIONS: readonly string[] = [
	"Syllable counting is an English heuristic, so the grade level is an estimate, not a measurement.",
	"Sentence boundaries come from the locale's rules. Abbreviations such as Dr. can still split a sentence early.",
	"Platform limits change without notice. Treat them as a guide and check the platform if a post is close to the edge.",
	"In chunked mode a sentence that spans a blank line is counted as two.",
]

export const SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
	{ keys: "Ctrl/Cmd + Shift + C", label: "Copy the stats summary" },
	{ keys: "Ctrl/Cmd + Z", label: "Undo" },
	{ keys: "Ctrl/Cmd + Shift + Z", label: "Redo" },
	{ keys: "Ctrl/Cmd + Shift + K", label: "Jump to the keyword table" },
	{ keys: "?", label: "Show this list" },
	{ keys: "Esc", label: "Close a dialog" },
]
