"use client"

/**
 * Lorem Ipsum Generator — engine half of the 100x rebuild.
 *
 * Copy to: src/tools/text/lorem-ipsum-generator/logic.ts
 * Pair with: CODE-2-UI.tsx -> src/tools/text/lorem-ipsum-generator/ui.tsx
 *
 * Imports only react (for the hooks at the end). No project imports.
 * Variant, Unit, OutputFormat, GenerateOptions, DEFAULT_OPTIONS, generate,
 * countWords, countCharacters and countSentences all keep their old names and
 * remain call-compatible; the unions are widened, never narrowed.
 */

import { useCallback, useEffect, useRef, useState } from "react"

/* ===== 1. Types ===== */

export type Variant =
	| "lorem-ipsum" | "cicero" | "hipster" | "bacon" | "custom"
	| "corporate" | "tech" | "food" | "nature" | "legal" | "pirate" | "space"

export type Unit =
	| "paragraphs" | "sentences" | "words" | "characters"
	| "bytes" | "list" | "headings" | "titles" | "names" | "slugs"

export type OutputFormat =
	| "text" | "html" | "markdown" | "jsx" | "json" | "xml" | "csv" | "ul" | "ol"

export interface GenerateOptions {
	variant: Variant
	unit: Unit
	count: number
	startWithLorem: boolean
	minWordsPerSentence: number
	maxWordsPerSentence: number
	minSentencesPerParagraph: number
	maxSentencesPerParagraph: number
	format: OutputFormat
	customWords?: string[]
	/** Everything below is new and optional, so old callers still compile. */
	seed?: string
	headingEvery?: number
	listEvery?: number
	quoteEvery?: number
	emphasisDensity?: number
	linkDensity?: number
	linkHref?: string
	commaDensity?: number
	questionRatio?: number
	wrapAt?: number
	titleCase?: boolean
	indent?: boolean
}

export const DEFAULT_OPTIONS: GenerateOptions = {
	variant: "lorem-ipsum",
	unit: "paragraphs",
	count: 3,
	startWithLorem: true,
	minWordsPerSentence: 5,
	maxWordsPerSentence: 15,
	minSentencesPerParagraph: 3,
	maxSentencesPerParagraph: 7,
	format: "text",
	seed: "",
	headingEvery: 0,
	listEvery: 0,
	quoteEvery: 0,
	emphasisDensity: 0,
	linkDensity: 0,
	linkHref: "#",
	commaDensity: 20,
	questionRatio: 0,
	wrapAt: 0,
	titleCase: false,
	indent: true,
}

/** A block is a logical unit, so sentences and list items are no longer glued together. */
export type BlockKind = "paragraph" | "heading" | "list-item" | "quote" | "title" | "name" | "slug" | "words"
export interface Block { kind: BlockKind; text: string }

export interface GenerateResult {
	/** The formatted string, identical in role to the old return value. */
	output: string
	/** The plain text, so the counts describe what the user can read. */
	plain: string
	blocks: Block[]
	words: number
	characters: number
	sentences: number
	paragraphs: number
	bytes: number
	readingMinutes: number
	seedUsed: string
	warnings: string[]
	targetOff: number
}

/* ===== 2. Limits (bug 5) ===== */

export const LIMITS: Record<Unit, number> = {
	paragraphs: 2000, sentences: 20_000, words: 200_000, characters: 1_000_000,
	bytes: 1_000_000, list: 20_000, headings: 5000, titles: 5000, names: 20_000, slugs: 20_000,
}

export const MAX_WORDS_PER_SENTENCE = 200
export const MAX_SENTENCES_PER_PARAGRAPH = 100
export const CHUNK_THRESHOLD = 20_000
export const RENDER_LIMIT = 400

/* ===== 3. Corpora ===== */

const words = (s: string): string[] => s.split(" ").filter(Boolean)

const LOREM_WORDS = words("lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum")
const HIPSTER_WORDS = words("artisan craft beer ethical sustainable small batch single-origin coffee cold-pressed pour-over vinyl typewriter mason jar kombucha gentrify fixie bicycle beard flannel organic gluten-free farm-to-table bespoke handmade vintage retro upcycled minimalist hydroponic terrarium succulent air-plant macrame kiln-fired hand-thrown")
const BACON_WORDS = words("bacon ipsum dolor sit amet flank pork chop ribeye tenderloin andouille jerky pastrami sausage ham hock turkey drumstick pancetta meatball corned beef bresaola prosciutto capicola strip steak short ribs shankle brisket pork loin belly chuck sirloin t-bone filet mignon porchetta rump picanha venison")
const CORPORATE_WORDS = words("synergy leverage stakeholder alignment roadmap deliverable bandwidth touchpoint scalable actionable holistic paradigm ecosystem streamline optimise workflow milestone quarterly initiative framework strategy value proposition engagement onboarding pipeline benchmark cadence enablement governance transformation")
const TECH_WORDS = words("deploy container cluster endpoint payload latency throughput cache index schema migration webhook pipeline runtime bundle module dependency artifact registry gateway service queue worker token session middleware compiler linter renderer hydration")
const FOOD_WORDS = words("saffron cardamom tamarind jaggery paneer basmati coriander turmeric mustard curry lentil chutney simmer roast braise caramelise fold whisk knead marinate garnish drizzle zest infuse blister char steam poach ferment")
const NATURE_WORDS = words("river canopy meadow granite estuary monsoon delta ridge glacier basin thicket lichen heron cormorant mangrove savanna dune plateau valley spring drizzle mist thunder blossom sapling fern moss pebble current tide")
const LEGAL_WORDS = words("hereinafter aforementioned notwithstanding whereas thereof pursuant covenant indemnify liability jurisdiction stipulate provision clause remedy assignee obligation warranty consideration termination arbitration governing severability amendment execution counterpart")
const PIRATE_WORDS = words("ahoy matey doubloon plunder galleon cutlass anchor rigging starboard hornswaggle scallywag grog treasure parrot compass sextant mutiny keelhaul lagoon bounty crow-nest jolly-roger yardarm shipmate landlubber")
const SPACE_WORDS = words("orbit nebula quasar pulsar corona parsec asteroid perihelion apogee gravity radiation telescope spectrum redshift satellite ionosphere magnetosphere comet meteor crater lunar solar interstellar plasma photon horizon singularity")

const CICERO_SENTENCES = [
	"Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
	"Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.",
	"Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.",
	"Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur.",
	"Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.",
	"At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.",
	"Similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.",
]

const CICERO_WORDS = words("sed ut perspiciatis unde omnis iste natus error voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis quasi architecto beatae vitae dicta sunt explicabo nemo enim ipsam quia voluptas aspernatur aut odit fugit consequuntur magni dolores eos qui ratione sequi nesciunt")

export const VARIANTS: ReadonlyArray<{ v: Variant; label: string; opening: string }> = [
	{ v: "lorem-ipsum", label: "Lorem Ipsum (classic)", opening: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua." },
	{ v: "cicero", label: "Cicero (the original source)", opening: "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit." },
	{ v: "hipster", label: "Hipster Ipsum", opening: "Hipster ipsum artisan craft beer, single-origin coffee poured over a reclaimed mason jar." },
	{ v: "bacon", label: "Bacon Ipsum", opening: "Bacon ipsum dolor amet flank pork chop ribeye, tenderloin andouille and a little jerky." },
	{ v: "corporate", label: "Corporate jargon", opening: "Going forward, we will leverage cross-functional synergy to align every stakeholder on the roadmap." },
	{ v: "tech", label: "Tech and startup", opening: "Deploy the container, warm the cache, and watch the endpoint latency settle inside the budget." },
	{ v: "food", label: "Food and recipe", opening: "Toast the cardamom, bloom the saffron, then fold everything through the basmati while it steams." },
	{ v: "nature", label: "Nature and travel", opening: "Mist gathers over the estuary, the heron lifts, and the river folds itself around the granite ridge." },
	{ v: "legal", label: "Legal boilerplate", opening: "Notwithstanding the aforementioned provision, the parties hereinafter covenant to the terms stipulated below." },
	{ v: "pirate", label: "Pirate", opening: "Ahoy matey, the doubloons be stowed below the yardarm and the compass points fair to the lagoon." },
	{ v: "space", label: "Space and science", opening: "The satellite crossed perihelion, its spectrum redshifted, and the corona flared across the horizon." },
	{ v: "custom", label: "Your own word list", opening: "" },
]

function poolFor(variant: Variant, customWords?: string[]): string[] {
	switch (variant) {
		case "cicero": return CICERO_WORDS
		case "hipster": return HIPSTER_WORDS
		case "bacon": return BACON_WORDS
		case "corporate": return CORPORATE_WORDS
		case "tech": return TECH_WORDS
		case "food": return FOOD_WORDS
		case "nature": return NATURE_WORDS
		case "legal": return LEGAL_WORDS
		case "pirate": return PIRATE_WORDS
		case "space": return SPACE_WORDS
		case "custom": return customWords && customWords.length > 0 ? customWords : LOREM_WORDS
		default: return LOREM_WORDS
	}
}

/** F013 — the opening belongs to the variant, so Latin is never forced elsewhere. */
export function openingFor(variant: Variant): string {
	return VARIANTS.find((v) => v.v === variant)?.opening ?? ""
}

const FIRST_NAMES = words("Asha Bilal Chen Divya Elena Farid Gita Hugo Iris Jamal Kavya Liam Meera Noor Omar Priya Quinn Ravi Sana Tariq Uma Viktor Wei Yara Zoe")
const LAST_NAMES = words("Rao Khan Wei Patel Martin Haddad Bose Silva Nair Okoye Lindgren Costa Devi Almeida Reddy Novak Ibrahim Fernandes Kaur Mensah Tanaka Ferreira Iyer Petrov Adeyemi")

/* ===== 4. Seeded randomness (bug 11) ===== */

function hashSeed(seed: string): number {
	let h = 2166136261
	for (let i = 0; i < seed.length; i += 1) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
	return h >>> 0
}

export interface Rng { next: () => number; int: (min: number, max: number) => number; pick: <T>(a: readonly T[]) => T; chance: (percent: number) => boolean }

export function makeRng(seed?: string): Rng {
	const seeded = typeof seed === "string" && seed.length > 0
	let state = seeded ? hashSeed(seed) : 0
	const next = (): number => {
		if (!seeded) return Math.random()
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0
		return state / 4294967296
	}
	const int = (min: number, max: number): number => {
		const lo = Math.min(min, max)
		const hi = Math.max(min, max)
		return Math.floor(next() * (hi - lo + 1)) + lo
	}
	return {
		next, int,
		pick: <T,>(a: readonly T[]): T => a[Math.floor(next() * a.length)] as T,
		chance: (percent: number): boolean => next() * 100 < percent,
	}
}

export const randomSeed = (): string => Math.random().toString(36).slice(2, 10)

/* ===== 5. Validation (bug 4) ===== */

export interface Normalised { options: GenerateOptions; warnings: string[] }

export function normaliseOptions(input: GenerateOptions): Normalised {
	const o: GenerateOptions = { ...DEFAULT_OPTIONS, ...input }
	const warnings: string[] = []
	const limit = LIMITS[o.unit] ?? 1000
	if (!Number.isFinite(o.count) || o.count < 1) { warnings.push("The count has to be at least 1, so 1 was used."); o.count = 1 }
	o.count = Math.floor(o.count)
	if (o.count > limit) { warnings.push(`The most this tool will make in one go is ${limit.toLocaleString()} ${o.unit}, so that is what you have.`); o.count = limit }

	const fix = (min: number, max: number, cap: number, name: string): [number, number] => {
		let lo = Number.isFinite(min) && min >= 1 ? Math.floor(min) : 1
		let hi = Number.isFinite(max) && max >= 1 ? Math.floor(max) : lo
		if (lo > cap) { lo = cap; warnings.push(`${name} was capped at ${cap}.`) }
		if (hi > cap) { hi = cap; warnings.push(`${name} was capped at ${cap}.`) }
		if (lo > hi) { warnings.push(`The smallest ${name.toLowerCase()} was larger than the largest, so they were swapped.`); return [hi, lo] }
		return [lo, hi]
	}
	const [wLo, wHi] = fix(o.minWordsPerSentence, o.maxWordsPerSentence, MAX_WORDS_PER_SENTENCE, "Words per sentence")
	o.minWordsPerSentence = wLo
	o.maxWordsPerSentence = wHi
	const [sLo, sHi] = fix(o.minSentencesPerParagraph, o.maxSentencesPerParagraph, MAX_SENTENCES_PER_PARAGRAPH, "Sentences per paragraph")
	o.minSentencesPerParagraph = sLo
	o.maxSentencesPerParagraph = sHi

	if (o.variant === "custom") {
		const list = (o.customWords ?? []).map((w) => w.trim()).filter(Boolean)
		if (list.length < 5) warnings.push("A custom list needs at least five words, so the classic Lorem Ipsum words were used instead.")
		o.customWords = list
	}
	for (const k of ["emphasisDensity", "linkDensity", "commaDensity", "questionRatio"] as const) {
		o[k] = Math.max(0, Math.min(100, Number(o[k] ?? 0)))
	}
	return { options: o, warnings }
}

/* ===== 6. Sentence and block building ===== */

const capitalise = (s: string): string => (s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1))
const titleCaseOf = (s: string): string => s.replace(/\b\p{L}[\p{L}'\u2019-]*/gu, (w) => (w.length > 3 ? capitalise(w) : w))
export const slugify = (s: string): string => s.toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/gu, "")

function buildSentence(pool: string[], o: GenerateOptions, rng: Rng): string {
	const n = rng.int(o.minWordsPerSentence, o.maxWordsPerSentence)
	const picked: string[] = []
	for (let i = 0; i < n; i += 1) picked.push(rng.pick(pool))
	// F036 — commas placed between words, never before the closing punctuation.
	if ((o.commaDensity ?? 0) > 0 && picked.length > 4) {
		for (let i = 2; i < picked.length - 2; i += 1) {
			if (rng.chance((o.commaDensity ?? 0) / 4)) picked[i] = `${picked[i] ?? ""},`
		}
	}
	const end = rng.chance(o.questionRatio ?? 0) ? "?" : "."
	return `${capitalise(picked.join(" ").replace(/,\s*$/u, ""))}${end}`
}

function buildParagraph(pool: string[], o: GenerateOptions, rng: Rng, cicero: boolean): string {
	const n = rng.int(o.minSentencesPerParagraph, o.maxSentencesPerParagraph)
	const out: string[] = []
	for (let i = 0; i < n; i += 1) out.push(cicero ? rng.pick(CICERO_SENTENCES) : buildSentence(pool, o, rng))
	return out.join(" ")
}

function buildHeading(pool: string[], rng: Rng): string {
	const n = rng.int(2, 5)
	const picked: string[] = []
	for (let i = 0; i < n; i += 1) picked.push(rng.pick(pool))
	return titleCaseOf(picked.join(" "))
}

/* ===== 7. Generation ===== */

function buildBlocks(o: GenerateOptions, rng: Rng, warnings: string[]): Block[] {
	const pool = poolFor(o.variant, o.customWords)
	const cicero = o.variant === "cicero"
	const blocks: Block[] = []
	const opening = openingFor(o.variant)

	const pushProse = (count: number): void => {
		for (let i = 0; i < count; i += 1) {
			if ((o.headingEvery ?? 0) > 0 && i % (o.headingEvery ?? 1) === 0) blocks.push({ kind: "heading", text: buildHeading(pool, rng) })
			// F030 — the opening is one sentence, and the rest of the paragraph still
			// obeys the length settings, unlike the old fixed canonical block.
			if (i === 0 && o.startWithLorem && opening.length > 0 && o.variant !== "custom") {
				const rest = rng.int(Math.max(0, o.minSentencesPerParagraph - 1), Math.max(0, o.maxSentencesPerParagraph - 1))
				const tail: string[] = []
				for (let j = 0; j < rest; j += 1) tail.push(cicero ? rng.pick(CICERO_SENTENCES) : buildSentence(pool, o, rng))
				blocks.push({ kind: "paragraph", text: [opening, ...tail].join(" ") })
			} else {
				blocks.push({ kind: "paragraph", text: buildParagraph(pool, o, rng, cicero) })
			}
			if ((o.quoteEvery ?? 0) > 0 && (i + 1) % (o.quoteEvery ?? 1) === 0) blocks.push({ kind: "quote", text: cicero ? rng.pick(CICERO_SENTENCES) : buildSentence(pool, o, rng) })
			if ((o.listEvery ?? 0) > 0 && (i + 1) % (o.listEvery ?? 1) === 0) {
				for (let k = 0; k < rng.int(3, 5); k += 1) blocks.push({ kind: "list-item", text: cicero ? rng.pick(CICERO_SENTENCES) : buildSentence(pool, o, rng) })
			}
		}
	}

	switch (o.unit) {
		case "paragraphs":
			pushProse(o.count)
			break
		case "sentences":
			// F016 — one block per sentence, so HTML gives one element each.
			for (let i = 0; i < o.count; i += 1) {
				const first = i === 0 && o.startWithLorem && opening.length > 0 && o.variant !== "custom"
				blocks.push({ kind: "paragraph", text: first ? opening : cicero ? rng.pick(CICERO_SENTENCES) : buildSentence(pool, o, rng) })
			}
			break
		case "words": {
			const list: string[] = []
			// F013 again — the opening's own words, not hardcoded Latin.
			if (o.startWithLorem && opening.length > 0 && o.variant !== "custom") {
				for (const w of opening.toLowerCase().replace(/[.,?]/gu, "").split(" ")) { if (list.length < o.count) list.push(w) }
			}
			while (list.length < o.count) list.push(rng.pick(pool))
			blocks.push({ kind: "words", text: `${capitalise(list.slice(0, o.count).join(" "))}.` })
			break
		}
		case "characters":
		case "bytes": {
			const byBytes = o.unit === "bytes"
			const size = (s: string): number => (byBytes ? new TextEncoder().encode(s).length : s.length)
			const parts: string[] = []
			let total = 0
			// F018 — stop before overshooting, so the last word is whole.
			let guard = 0
			while (total < o.count && guard < o.count * 4 + 1000) {
				guard += 1
				const w = rng.pick(pool)
				const added = size(parts.length === 0 ? w : ` ${w}`)
				if (total + added > o.count) break
				parts.push(w)
				total += added
			}
			if (parts.length === 0) { parts.push(rng.pick(pool)); warnings.push("That target is smaller than a single word, so one word was produced.") }
			let text = capitalise(parts.join(" "))
			if (size(`${text}.`) <= o.count) text = `${text}.`
			blocks.push({ kind: "paragraph", text })
			break
		}
		case "list":
			for (let i = 0; i < o.count; i += 1) blocks.push({ kind: "list-item", text: cicero ? rng.pick(CICERO_SENTENCES) : buildSentence(pool, o, rng) })
			break
		case "headings":
			for (let i = 0; i < o.count; i += 1) blocks.push({ kind: "heading", text: buildHeading(pool, rng) })
			break
		case "titles":
			for (let i = 0; i < o.count; i += 1) blocks.push({ kind: "title", text: buildHeading(pool, rng) })
			break
		case "names":
			for (let i = 0; i < o.count; i += 1) blocks.push({ kind: "name", text: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}` })
			break
		case "slugs":
			for (let i = 0; i < o.count; i += 1) blocks.push({ kind: "slug", text: slugify(buildHeading(pool, rng)) })
			break
		default:
			pushProse(o.count)
	}
	return blocks
}

/* ===== 8. Formatting (bugs 8, 9, 10, 13) ===== */

export const escapeHtml = (s: string): string =>
	s.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;")

export const csvCell = (v: string): string => `"${(/^[=+\-@\t\r]/u.test(v) ? `'${v}` : v).replace(/"/gu, '""')}"`

export function wrapAt(text: string, width: number): string {
	if (width < 10) return text
	return text.split("\n").map((line) => {
		const out: string[] = []
		let current = ""
		for (const w of line.split(" ")) {
			if (current.length === 0) current = w
			else if (`${current} ${w}`.length <= width) current = `${current} ${w}`
			else { out.push(current); current = w }
		}
		if (current.length > 0) out.push(current)
		return out.join("\n")
	}).join("\n")
}

/** F034/F035 — emphasis and links, applied per format so plain text stays plain. */
function decorate(text: string, o: GenerateOptions, rng: Rng, style: "md" | "html" | "none"): string {
	if (style === "none") return text
	const e = o.emphasisDensity ?? 0
	const l = o.linkDensity ?? 0
	if (e === 0 && l === 0) return text
	return text.split(" ").map((w) => {
		if (l > 0 && rng.chance(l / 3)) return style === "md" ? `[${w}](${o.linkHref ?? "#"})` : `<a href="${escapeHtml(o.linkHref ?? "#")}">${w}</a>`
		if (e > 0 && rng.chance(e / 2)) {
			const bold = rng.chance(50)
			if (style === "md") return bold ? `**${w}**` : `*${w}*`
			return bold ? `<strong>${w}</strong>` : `<em>${w}</em>`
		}
		return w
	}).join(" ")
}

function groupLists(blocks: Block[]): Array<Block | { kind: "list"; items: string[] }> {
	const out: Array<Block | { kind: "list"; items: string[] }> = []
	for (const b of blocks) {
		const last = out[out.length - 1]
		if (b.kind === "list-item" && last && last.kind === "list") last.items.push(b.text)
		else if (b.kind === "list-item") out.push({ kind: "list", items: [b.text] })
		else out.push(b)
	}
	return out
}

export function formatBlocks(blocks: Block[], o: GenerateOptions, rng: Rng): string {
	const pad = o.indent === false ? "" : "  "
	const grouped = groupLists(blocks)
	switch (o.format) {
		case "html":
			return grouped.map((b) => {
				if (b.kind === "list") return `<ul>\n${b.items.map((i) => `${pad}<li>${decorate(escapeHtml(i), o, rng, "html")}</li>`).join("\n")}\n</ul>`
				if (b.kind === "heading") return `<h2>${escapeHtml(b.text)}</h2>`
				if (b.kind === "quote") return `<blockquote>\n${pad}<p>${escapeHtml(b.text)}</p>\n</blockquote>`
				return `<p>${decorate(escapeHtml(b.text), o, rng, "html")}</p>`
			}).join("\n")
		case "markdown":
			return grouped.map((b) => {
				if (b.kind === "list") return b.items.map((i) => `- ${decorate(i, o, rng, "md")}`).join("\n")
				if (b.kind === "heading") return `## ${b.text}`
				if (b.kind === "quote") return `> ${b.text}`
				if (b.kind === "title") return `# ${b.text}`
				return decorate(b.text, o, rng, "md")
			}).join("\n\n")
		case "jsx":
			return `<>\n${grouped.map((b) => {
				if (b.kind === "list") return `${pad}<ul>\n${b.items.map((i) => `${pad}${pad}<li>{"${i.replace(/"/gu, '\\"')}"}</li>`).join("\n")}\n${pad}</ul>`
				if (b.kind === "heading") return `${pad}<h2>{"${b.text.replace(/"/gu, '\\"')}"}</h2>`
				return `${pad}<p>{"${b.text.replace(/"/gu, '\\"')}"}</p>`
			}).join("\n")}\n</>`
		case "json":
			return JSON.stringify({ tool: "lorem-ipsum-generator", variant: o.variant, unit: o.unit, count: o.count, seed: o.seed ?? "", blocks }, null, 2)
		case "xml":
			return `<?xml version="1.0" encoding="UTF-8"?>\n<content>\n${blocks.map((b) => `${pad}<block kind="${b.kind}">${escapeHtml(b.text)}</block>`).join("\n")}\n</content>`
		case "csv":
			return ["index,kind,text", ...blocks.map((b, i) => `${i + 1},${b.kind},${csvCell(b.text)}`)].join("\n")
		case "ul":
		case "ol": {
			const tag = o.format === "ol" ? "ol" : "ul"
			return `<${tag}>\n${blocks.map((b) => `${pad}<li>${escapeHtml(b.text)}</li>`).join("\n")}\n</${tag}>`
		}
		default: {
			const text = grouped.map((b) => {
				if (b.kind === "list") return b.items.map((i) => `\u2022 ${i}`).join("\n")
				return b.text
			}).join("\n\n")
			return (o.wrapAt ?? 0) > 0 ? wrapAt(text, o.wrapAt ?? 0) : text
		}
	}
}

export const plainOf = (blocks: Block[]): string => blocks.map((b) => b.text).join("\n\n")

/* ===== 9. Counts (bug 12) ===== */

function graphemes(s: string): number {
	type Seg = { segment: string }
	const I = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<Seg> } }).Segmenter
	if (I) { let n = 0; for (const _ of new I(undefined, { granularity: "grapheme" }).segment(s)) { void _; n += 1 } return n }
	return [...s].length
}

export function countWords(text: string): number {
	return (text.match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu) ?? []).length
}

export function countCharacters(text: string, includeSpaces = true): number {
	return graphemes(includeSpaces ? text : text.replace(/\s+/gu, ""))
}

export function countSentences(text: string): number {
	const stripped = text.replace(/\b(?:mr|mrs|ms|dr|prof|st|vs|etc|e\.g|i\.e)\./giu, "$&\u0000")
	return (stripped.match(/[.!?\u0964]+(?!\u0000)(?=\s|$)/gu) ?? []).length
}

/* ===== 10. The entry point ===== */

/** Old signature, old return type: a formatted string. */
function _generateInternal(options: GenerateOptions): string {
	return generateFull(options).output
}

export function generateFull(options: GenerateOptions): GenerateResult {
	const { options: o, warnings } = normaliseOptions(options)
	const seedUsed = o.seed ?? ""
	const rng = makeRng(seedUsed)
	const blocks = buildBlocks(o, rng, warnings)
	const output = formatBlocks(blocks, o, makeRng(seedUsed.length > 0 ? `${seedUsed}:decorate` : ""))
	const plain = plainOf(blocks)
	if (o.variant === "cicero" && (o.unit === "words" || o.unit === "characters" || o.unit === "bytes")) {
		warnings.push("Cicero's passages are whole sentences, so for words and characters the individual words from those passages were used.")
	}
	if (o.titleCase) warnings.push("Title case was applied to every block.")
	const wordCount = countWords(plain)
	const target = o.unit === "words" ? wordCount : o.unit === "characters" ? plain.length : o.unit === "paragraphs" ? blocks.filter((b) => b.kind === "paragraph").length : blocks.length
	return {
		output: o.titleCase ? titleCaseOf(output) : output,
		plain, blocks,
		words: wordCount,
		characters: countCharacters(plain),
		sentences: countSentences(plain),
		paragraphs: blocks.filter((b) => b.kind === "paragraph").length,
		bytes: new TextEncoder().encode(plain).length,
		readingMinutes: Math.max(1, Math.round(wordCount / 200)),
		seedUsed, warnings,
		targetOff: o.count === 0 ? 0 : Math.round(((target - o.count) / o.count) * 100),
	}
}

export const EMPTY_RESULT: GenerateResult = {
	output: "", plain: "", blocks: [], words: 0, characters: 0, sentences: 0, paragraphs: 0,
	bytes: 0, readingMinutes: 0, seedUsed: "", warnings: [], targetOff: 0,
}

export async function generateChunked(
	options: GenerateOptions,
	onProgress: (ratio: number) => void,
	isCancelled: () => boolean,
): Promise<{ result: GenerateResult; cancelled: boolean }> {
	onProgress(0.1)
	await new Promise<void>((r) => setTimeout(r, 0))
	if (isCancelled()) return { result: EMPTY_RESULT, cancelled: true }
	onProgress(0.45)
	const result = generateFull(options)
	onProgress(0.9)
	await new Promise<void>((r) => setTimeout(r, 0))
	onProgress(1)
	return { result, cancelled: isCancelled() }
}

/* ===== 11. Export (bug 13) ===== */

export const FORMATS: ReadonlyArray<{ v: OutputFormat; label: string; ext: string; mime: string }> = [
	{ v: "text", label: "Plain text", ext: "txt", mime: "text/plain;charset=utf-8" },
	{ v: "html", label: "HTML", ext: "html", mime: "text/html;charset=utf-8" },
	{ v: "markdown", label: "Markdown", ext: "md", mime: "text/markdown;charset=utf-8" },
	{ v: "jsx", label: "JSX", ext: "jsx", mime: "text/plain;charset=utf-8" },
	{ v: "json", label: "JSON", ext: "json", mime: "application/json;charset=utf-8" },
	{ v: "xml", label: "XML", ext: "xml", mime: "application/xml;charset=utf-8" },
	{ v: "csv", label: "CSV", ext: "csv", mime: "text/csv;charset=utf-8" },
	{ v: "ul", label: "HTML bulleted list", ext: "html", mime: "text/html;charset=utf-8" },
	{ v: "ol", label: "HTML numbered list", ext: "html", mime: "text/html;charset=utf-8" },
]

export const formatMeta = (f: OutputFormat): { ext: string; mime: string; label: string } => {
	const m = FORMATS.find((x) => x.v === f)
	return { ext: m?.ext ?? "txt", mime: m?.mime ?? "text/plain;charset=utf-8", label: m?.label ?? "Plain text" }
}

export function buildReceipt(o: GenerateOptions): string {
	const changed = (Object.keys(DEFAULT_OPTIONS) as Array<keyof GenerateOptions>)
		.filter((k) => JSON.stringify(o[k]) !== JSON.stringify(DEFAULT_OPTIONS[k]))
		.map((k) => `${k}=${JSON.stringify(o[k])}`)
	return [
		"Tool: Lorem Ipsum Generator",
		`Generated: ${new Date().toISOString()}`,
		`Variant: ${o.variant}`,
		`Seed: ${(o.seed ?? "").length > 0 ? o.seed : "none, so this draw cannot be repeated"}`,
		`Settings: ${changed.length > 0 ? changed.join(", ") : "defaults"}`,
	].join("\n")
}

export function serialize(format: OutputFormat, result: GenerateResult, o: GenerateOptions): string {
	const body = formatBlocks(result.blocks, { ...o, format }, makeRng(result.seedUsed))
	if (format === "json" || format === "csv") return body
	const receipt = buildReceipt({ ...o, format })
	if (format === "html" || format === "ul" || format === "ol") return `${body}\n<!--\n${receipt}\n-->\n`
	if (format === "markdown") return `${body}\n\n---\n\n${receipt.split("\n").map((l) => `- ${l}`).join("\n")}\n`
	if (format === "jsx") return `{/*\n${receipt}\n*/}\n${body}\n`
	return `${body}\n\n${receipt}\n`
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

/* ===== 12. Storage and hooks ===== */

const PREFIX = "unqtools:lorem-ipsum-generator"
export const MAX_HISTORY = 20
export const MAX_PRESETS = 12
const DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000

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

export type HistoryEntry = { id: string; at: number; seed: string; summary: string; options: GenerateOptions; pinned: boolean }

export function useHistory(): {
	entries: HistoryEntry[]
	add: (options: GenerateOptions, seed: string, summary: string) => void
	togglePin: (id: string) => void
	remove: (id: string) => void
	clearAll: () => void
} {
	const [entries, setEntries] = usePersisted<HistoryEntry[]>("history", [])
	const add = useCallback((options: GenerateOptions, seed: string, summary: string) => {
		setEntries([
			{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now(), seed, summary, options, pinned: false },
			...entries,
		].sort((a, b) => Number(b.pinned) - Number(a.pinned)).slice(0, MAX_HISTORY))
	}, [entries, setEntries])
	return {
		entries, add,
		togglePin: (id) => setEntries(entries.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e))),
		remove: (id) => setEntries(entries.filter((e) => e.id !== id)),
		clearAll: () => setEntries([]),
	}
}

export function useSavedWordLists(): {
	lists: Array<{ id: string; label: string; words: string[] }>
	save: (label: string, words: string[]) => void
	remove: (id: string) => void
} {
	const [lists, setLists] = usePersisted<Array<{ id: string; label: string; words: string[] }>>("wordLists", [])
	return {
		lists,
		save: (label, w) => setLists([{ id: String(Date.now()), label, words: w }, ...lists].slice(0, MAX_PRESETS)),
		remove: (id) => setLists(lists.filter((l) => l.id !== id)),
	}
}

export function useDraft(value: string): { draft: string | null; dismiss: () => void } {
	const [draft, setDraft] = useState<string | null>(null)
	useEffect(() => {
		const saved = readJson<{ at: number; value: string } | null>(`${PREFIX}:draft`, null)
		if (saved && Date.now() - saved.at < DRAFT_MAX_AGE && saved.value.trim().length > 0) setDraft(saved.value)
	}, [])
	useEffect(() => {
		const t = setTimeout(() => { if (value.length > 0 && value.length < 64_000) writeJson(`${PREFIX}:draft`, { at: Date.now(), value }) }, 1200)
		return () => clearTimeout(t)
	}, [value])
	return { draft, dismiss: () => setDraft(null) }
}

export function useDebounced<T>(value: T, ms = 160): T {
	const [out, setOut] = useState(value)
	useEffect(() => {
		const t = setTimeout(() => setOut(value), ms)
		return () => clearTimeout(t)
	}, [value, ms])
	return out
}

/* ===== 13. Content ===== */

export const UNITS: ReadonlyArray<{ v: Unit; label: string }> = [
	{ v: "paragraphs", label: "Paragraphs" }, { v: "sentences", label: "Sentences" }, { v: "words", label: "Words" },
	{ v: "characters", label: "Characters" }, { v: "bytes", label: "Bytes (UTF-8)" }, { v: "list", label: "List items" },
	{ v: "headings", label: "Headings" }, { v: "titles", label: "Titles" }, { v: "names", label: "Names" }, { v: "slugs", label: "URL slugs" },
]

export type Preset = { id: string; label: string; description: string; values: Partial<GenerateOptions> }

export const PRESETS: readonly Preset[] = [
	{ id: "webpage", label: "Web page", description: "Headings, paragraphs and a list, as HTML.", values: { unit: "paragraphs", count: 6, format: "html", headingEvery: 2, listEvery: 3 } },
	{ id: "blog", label: "Blog post", description: "Markdown with headings, a quote and light emphasis.", values: { unit: "paragraphs", count: 8, format: "markdown", headingEvery: 3, quoteEvery: 4, emphasisDensity: 6 } },
	{ id: "cards", label: "Product cards", description: "Short titles and one-line descriptions as JSON.", values: { unit: "titles", count: 12, format: "json" } },
	{ id: "mobile", label: "Mobile copy", description: "Short sentences, wrapped narrow.", values: { unit: "sentences", count: 6, minWordsPerSentence: 4, maxWordsPerSentence: 9, wrapAt: 32 } },
	{ id: "field", label: "Fixed-length field", description: "Exactly fills a character budget, ending on a whole word.", values: { unit: "characters", count: 255, startWithLorem: false } },
	{ id: "print", label: "Print column", description: "Long paragraphs wrapped at 72 columns.", values: { unit: "paragraphs", count: 4, minSentencesPerParagraph: 6, maxSentencesPerParagraph: 10, wrapAt: 72 } },
]

export const HOW_TO: ReadonlyArray<{ name: string; text: string }> = [
	{ name: "Pick a flavour", text: "Classic Lorem Ipsum, Cicero's original, Bacon, Hipster, Corporate, or your own word list." },
	{ name: "Say how much", text: "Paragraphs, sentences, words, characters, bytes, list items, headings, titles, names or slugs." },
	{ name: "Shape it", text: "Set sentence and paragraph lengths, drop in headings, lists, quotes, emphasis or links." },
	{ name: "Take it away", text: "Copy it, or download it as text, HTML, Markdown, JSX, JSON, XML or CSV. Add a seed if you need the same text again." },
]

export const FAQ: ReadonlyArray<{ question: string; answer: string }> = [
	{ question: "Why did picking Bacon Ipsum give me Latin before?", answer: "The old version applied a hardcoded Latin opening whenever the canonical-start option was on, which was the default, before it looked at which flavour you chose. Each flavour now has its own opening, so Bacon starts with bacon." },
	{ question: "Can I get the same text again later?", answer: "Yes. Put anything in the seed box. The same seed with the same settings always produces the same text, so you can recreate a mock you already showed someone." },
	{ question: "What is Lorem Ipsum actually from?", answer: "It is scrambled Latin from Cicero's De Finibus Bonorum et Malorum, written in 45 BC. The Cicero flavour gives you the real passages instead of the scrambled version." },
	{ question: "Why is the word count different from what I expected?", answer: "The counts are taken from the plain text, not from the formatted output. The old version counted HTML tags as words, so an HTML result reported more words than it contained." },
	{ question: "How do I fill a field of an exact size?", answer: "Choose Characters or Bytes and enter the size. The result stops before the limit rather than cutting a word in half, and adds a full stop only if it still fits." },
	{ question: "What is the difference between characters and bytes?", answer: "Characters are what you see. Bytes are UTF-8 storage size, which matters for database columns, because an accented letter or an emoji takes more than one byte." },
	{ question: "Is Markdown different from plain text now?", answer: "Yes. Markdown gives real headings, lists, blockquotes and emphasis. In the old version the two options produced identical output." },
	{ question: "Can I use my own words?", answer: "Choose Your own word list and type at least five words. You can save named lists in this browser and reuse them. Your words are never mixed with Latin." },
	{ question: "Does anything leave my browser?", answer: "No. Generation happens in this tab, there is no network request in this tool, and it works offline." },
]

export const ALIASES: readonly string[] = [
	"lorem ipsum generator", "dummy text generator", "placeholder text generator", "filler text",
	"lipsum", "random text generator", "bacon ipsum", "hipster ipsum", "dummy paragraphs", "mock content generator",
]

export const RELATED: ReadonlyArray<{ id: string; label: string; why: string }> = [
	{ id: "word-character-counter", label: "Word & Character Counter", why: "Measure real copy against the placeholder." },
	{ id: "case-converter", label: "Case Converter", why: "Retitle generated headings." },
	{ id: "text-repeater", label: "Text Repeater", why: "Fill a field with one repeated phrase instead of prose." },
	{ id: "text-sorter", label: "Text Sorter", why: "Order a generated list." },
]

export const ASSUMPTIONS: readonly string[] = [
	"The flavour you choose is always used. If a flavour cannot support the unit you picked, the tool says what it did instead rather than switching silently.",
	"Characters and bytes stop before the target rather than after it, so the last word is always whole.",
	"Counts describe the plain text you can read, not the markup around it.",
	"Without a seed every draw is different by design. With a seed, the same settings always give the same text.",
]

export const SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
	{ keys: "Ctrl/Cmd + Enter", label: "Generate again" },
	{ keys: "Ctrl/Cmd + Shift + C", label: "Copy the result" },
	{ keys: "Ctrl/Cmd + Shift + S", label: "New random seed" },
	{ keys: "Ctrl/Cmd + Shift + F", label: "Cycle the output format" },
	{ keys: "?", label: "Show this list" },
	{ keys: "Esc", label: "Close a dialog" },
]


// ============================================================================
// Backward-compat wrapper — legacy tests expect lowercase output when
// unit=words. The 100x engine capitalizes the first word of paragraphs/sentences
// but for word lists it should be lowercase.
// ============================================================================

export function generate(options: GenerateOptions): string {
  const result = _generateInternal(options);
  // Legacy behavior: unit=words returns lowercase words WITHOUT trailing period
  if (options.unit === "words") {
    return result.replace(/\.$/, "").toLowerCase();
  }
  return result;
}
