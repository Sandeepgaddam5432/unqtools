"use client"

/**
 * Word & Character Counter — UI half of the 100x rebuild.
 * Copy to: src/tools/text/word-character-counter/ui.tsx
 * Pair with: CODE-1-ENGINE.ts -> src/tools/text/word-character-counter/logic.ts
 * Imports: react, lucide-react, ./logic. Nothing else.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check, Copy, Download, Eraser, FileUp, Info, Keyboard, Lightbulb, Link2, Pin, Redo2, RotateCcw, ShieldCheck, SquareStack, Trash2, Undo2, X } from "lucide-react"
import { ALIASES, ALL_PLATFORM_IDS, ASSUMPTIONS, DEFAULTS, EMPTY_STATS, FAQ, HOW_TO, LOCALES, MAX_CHARS, MAX_PRESETS, MIME, PRESETS, RELATED, RENDER_LIMIT, SAMPLES, SHORTCUTS, STAT_ROWS, WARN_CHARS, breakdown, clearAllStorage, computeHandwritingTime, computeReadability, computeReadingTime, computeSpeakingTime, countSmsSegments, countText, countTextChunked, csvCell, detectLineEnding, detectScripts, download, formatDuration, getPlatformLimits, keywordDensity, longestWords, readabilityMeaningful, resolveLocale, serialize, stamp, summaryMarkdown, summaryText, useDebounced, useDraft, useHistory, usePersisted, useUndoRedo } from "./logic"
import type { BreakdownRow, ExportFormat, KeywordRow, Options, TextStats } from "./logic"

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
const CHIP = `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted ${FOCUS}`
const INPUT = `w-full rounded-md border bg-background px-3 py-2 text-sm ${FOCUS}`
const BOX = "rounded-lg border bg-card p-4"

function Button({ children, onClick, variant = "ghost", disabled, title, type = "button" }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; disabled?: boolean; title?: string; type?: "button" | "submit" }) {
	const styles = variant === "primary" ? "bg-primary text-primary-foreground hover:opacity-90" : variant === "danger" ? "border border-destructive/40 text-destructive hover:bg-destructive/10" : "border hover:bg-muted"
	return <button type={type} onClick={onClick} disabled={disabled} title={title} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles} ${FOCUS}`}>{children}</button>
}

function CopyButton({ value, label = "Copy", announce }: { value: string; label?: string; announce: (m: string) => void }) {
	const [done, setDone] = useState(false)
	return <Button title={`${label} to clipboard`} onClick={() => { void navigator.clipboard.writeText(value).then(() => { setDone(true); announce(`${label}: copied`); setTimeout(() => setDone(false), 1400) }).catch(() => announce("Copying failed. Your browser blocked clipboard access.")) }}>{done ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}{done ? "Copied" : label}</Button>
}

function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
	return <div className="flex items-start gap-2"><input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={`mt-1 size-4 ${FOCUS}`} /><label htmlFor={id} className="text-sm">{label}{hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}</label></div>
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const opener = document.activeElement as HTMLElement | null
		ref.current?.focus()
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
		document.addEventListener("keydown", onKey)
		return () => { document.removeEventListener("keydown", onKey); opener?.focus() }
	}, [onClose])
	return <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className={`max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border bg-background p-4 shadow-lg ${FOCUS}`}><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{title}</h3><Button onClick={onClose} title="Close"><X className="size-4" aria-hidden />Close</Button></div>{children}</div></div>
}

function Bar({ used, limit }: { used: number; limit: number }) {
	const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100))
	const over = used > limit
	return <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden><div className={`h-full ${over ? "bg-destructive" : pct > 85 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>
}

type Dlg = null | "shortcuts" | "history" | "presets"

export default function WordCharacterCounter() {
	const [input, setInput] = useState("")
	const [options, setOptions] = usePersisted<Options>("options", DEFAULTS)
	const [customPresets, setCustomPresets] = usePersisted<Array<{ id: string; label: string; values: Partial<Options> }>>("presets", [])
	const [selection, setSelection] = useState("")
	const [live, setLive] = useState("")
	const [dialog, setDialog] = useState<Dlg>(null)
	const [busy, setBusy] = useState(false)
	const [progress, setProgress] = useState(0)
	const [chunked, setChunked] = useState<TextStats | null>(null)
	const [fileNote, setFileNote] = useState("")
	const [sortKey, setSortKey] = useState<"index" | "words" | "chars">("index")
	const cancelRef = useRef(false)
	const areaRef = useRef<HTMLTextAreaElement>(null)
	const keywordsRef = useRef<HTMLDivElement>(null)
	const history = useHistory()
	const { draft, dismiss } = useDraft(input)
	const { undo, redo, canUndo, canRedo } = useUndoRedo(input, setInput)
	const announce = useCallback((m: string) => setLive(m), [])

	const set = useCallback(<K extends keyof Options>(key: K, value: Options[K]) => { setOptions({ ...options, [key]: value }) }, [options, setOptions])

	const usingSelection = options.countSelection && selection.trim().length > 0
	const source = usingSelection ? selection : input
	const debounced = useDebounced(source, 160)
	const locale = useMemo(() => resolveLocale(options.locale, debounced), [options.locale, debounced])
	const tooBig = debounced.length > MAX_CHARS
	const needsChunking = debounced.length > 250_000 && !tooBig

	const syncStats = useMemo<TextStats>(() => (tooBig || needsChunking ? EMPTY_STATS : countText(debounced, locale)), [debounced, locale, tooBig, needsChunking])
	const stats = needsChunking ? (chunked ?? EMPTY_STATS) : syncStats

	useEffect(() => {
		if (!needsChunking) { setChunked(null); setProgress(0); return }
		let alive = true
		cancelRef.current = false
		setBusy(true)
		void countTextChunked(debounced, locale, (r) => { if (alive) setProgress(r) }, () => cancelRef.current).then((res) => {
			if (!alive) return
			setBusy(false)
			if (!res.cancelled) { setChunked(res.stats); announce(`Counted ${res.stats.words.toLocaleString()} words.`) }
		})
		return () => { alive = false; cancelRef.current = true }
	}, [debounced, locale, needsChunking, announce])

	const sms = useMemo(() => countSmsSegments(debounced), [debounced])
	const readability = useMemo(() => computeReadability(stats, readabilityMeaningful(debounced)), [stats, debounced])
	const platforms = useMemo(() => getPlatformLimits(stats.graphemes, stats.words, sms).filter((p) => options.visiblePlatforms.includes(p.id)), [stats.graphemes, stats.words, sms, options.visiblePlatforms])
	const keywords = useMemo<KeywordRow[]>(() => (debounced.length > RENDER_LIMIT ? [] : keywordDensity(debounced, { excludeStopwords: options.excludeStopwords, topN: options.topKeywords, phraseLength: options.phraseLength, locale })), [debounced, options.excludeStopwords, options.topKeywords, options.phraseLength, locale])
	const rows = useMemo(() => (debounced.length > RENDER_LIMIT ? { rows: [] as BreakdownRow[], truncated: true } : breakdown(debounced, options.breakdownMode, locale)), [debounced, options.breakdownMode, locale])
	const sortedRows = useMemo(() => [...rows.rows].sort((a, b) => (sortKey === "index" ? a.index - b.index : b[sortKey] - a[sortKey])), [rows.rows, sortKey])
	const scripts = useMemo(() => detectScripts(debounced), [debounced])
	const ending = useMemo(() => detectLineEnding(debounced), [debounced])
	const longest = useMemo(() => (debounced.length > RENDER_LIMIT ? [] : longestWords(debounced, locale)), [debounced, locale])

	useEffect(() => { if (stats.words > 0 && !busy) announce(`${stats.words.toLocaleString()} words, ${stats.graphemes.toLocaleString()} characters.`) }, [stats.words, stats.graphemes, busy, announce])
	useEffect(() => { if (options.wordTarget > 0 && stats.words >= options.wordTarget) announce(`Word target of ${options.wordTarget.toLocaleString()} reached.`) }, [options.wordTarget, stats.words, announce])

	const summary = useMemo(() => summaryText(stats), [stats])

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const mod = e.metaKey || e.ctrlKey
			if (mod && e.shiftKey && e.key.toLowerCase() === "c") { e.preventDefault(); void navigator.clipboard.writeText(summary).then(() => announce("Summary copied.")).catch(() => announce("Copying failed.")) }
			else if (mod && e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); keywordsRef.current?.scrollIntoView({ block: "center" }) }
			else if (mod && e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); redo() }
			else if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); undo() }
			else if (e.key === "?" && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); setDialog("shortcuts") }
		}
		document.addEventListener("keydown", onKey)
		return () => document.removeEventListener("keydown", onKey)
	}, [summary, announce, undo, redo])

	useEffect(() => {
		if (typeof window === "undefined") return
		const p = new URLSearchParams(window.location.search)
		const next: Partial<Options> = {}
		const lc = p.get("lc")
		if (lc && LOCALES.some((l) => l.id === lc)) next.locale = lc
		const wt = Number(p.get("wt"))
		if (Number.isFinite(wt) && wt > 0) next.wordTarget = wt
		const i = p.get("i")
		if (i) setInput(i.slice(0, 1500))
		if (Object.keys(next).length > 0) setOptions({ ...DEFAULTS, ...next })
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const shareLink = useCallback(() => {
		const p = new URLSearchParams()
		p.set("lc", options.locale)
		if (options.wordTarget > 0) p.set("wt", String(options.wordTarget))
		if (options.shareInput && input.length > 0 && input.length <= 1500) p.set("i", input)
		const url = `${window.location.origin}${window.location.pathname}?${p.toString()}`
		void navigator.clipboard.writeText(url).then(() => announce("Share link copied.")).catch(() => announce("Copying failed."))
	}, [options, input, announce])

	const onFile = useCallback(async (file: File) => {
		try {
			const text = await file.text()
			if (text.includes("\uFFFD")) setFileNote(`${file.name} contains bytes that are not valid UTF-8. Those characters were replaced, so counts may be slightly off.`)
			else setFileNote(`Loaded ${file.name}.`)
			setInput(text.slice(0, MAX_CHARS))
			announce(`Loaded ${file.name}.`)
		} catch { setFileNote("That file could not be read.") }
	}, [announce])

	const doExport = useCallback((format: ExportFormat) => {
		const content = serialize(format, stats, { sms, readability, keywords, platforms }, options, locale)
		download(`text-stats-${stamp()}.${format}`, content, MIME[format])
		announce(`Downloaded ${format.toUpperCase()}.`)
	}, [stats, sms, readability, keywords, platforms, options, locale, announce])

	const jsonLd = useMemo(() => JSON.stringify({
		"@context": "https://schema.org",
		"@graph": [
			{ "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) },
			{ "@type": "HowTo", name: "How to count words and characters", step: HOW_TO.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text })) },
		],
	}), [])

	const reading = computeReadingTime(stats.words, options.readingWpm)
	const speaking = computeSpeakingTime(stats.words, options.speakingWpm)
	const writing = computeHandwritingTime(stats.words)
	const wordPct = options.wordTarget > 0 ? Math.min(100, Math.round((stats.words / options.wordTarget) * 100)) : 0
	const charPct = options.charTarget > 0 ? Math.min(100, Math.round((stats.graphemes / options.charTarget) * 100)) : 0

	return (
		<div className="space-y-6">
			<a href="#wcc-main" className={`sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-background focus:p-2 ${FOCUS}`}>Skip to the counter</a>
			<div aria-live="polite" aria-atomic className="sr-only">{live}</div>

			<main id="wcc-main" className="space-y-6">
				<section aria-labelledby="wcc-input-h" className="space-y-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 id="wcc-input-h" className="text-sm font-semibold">Your text</h2>
						<div className="flex flex-wrap gap-1.5">
							<label className={CHIP}><FileUp className="size-3.5" aria-hidden />Open a file<input type="file" accept=".txt,.md,.csv,.json,.log,text/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f) }} /></label>
							<Button onClick={undo} disabled={!canUndo} title="Undo"><Undo2 className="size-4" aria-hidden />Undo</Button>
							<Button onClick={redo} disabled={!canRedo} title="Redo"><Redo2 className="size-4" aria-hidden />Redo</Button>
							<Button onClick={() => { setInput(""); setSelection(""); announce("Cleared. Undo restores it.") }} disabled={input.length === 0}><Eraser className="size-4" aria-hidden />Clear</Button>
							<Button onClick={() => setDialog("history")}><SquareStack className="size-4" aria-hidden />Recent</Button>
							<Button onClick={() => setDialog("shortcuts")}><Keyboard className="size-4" aria-hidden />Keys</Button>
						</div>
					</div>

					<div className="flex flex-wrap gap-1.5">{SAMPLES.map((s) => <button key={s.label} type="button" className={CHIP} title={s.hint} onClick={() => { setInput(s.text); announce(`Loaded the ${s.label} sample.`) }}><Lightbulb className="size-3.5" aria-hidden />{s.label}</button>)}</div>

					{draft !== null && input.length === 0 ? <div className={`${BOX} flex flex-wrap items-center justify-between gap-2 text-sm`}><span>You have an unfinished text from an earlier visit.</span><span className="flex gap-1.5"><Button variant="primary" onClick={() => { setInput(draft); dismiss() }}>Restore it</Button><Button onClick={dismiss}>Discard</Button></span></div> : null}

					<textarea ref={areaRef} id="wcc-input" aria-label="Text to count" value={input} placeholder="Type or paste your text. You can also drop a file here." spellCheck={false} onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))} onSelect={(e) => { const t = e.currentTarget; setSelection(t.value.slice(t.selectionStart, t.selectionEnd)) }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void onFile(f) }} className={`min-h-[180px] resize-y ${INPUT} ${options.monospace ? "font-mono" : ""}`} />

					<p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
						<span>{input.length.toLocaleString()} characters typed</span>
						{ending !== "none" ? <span>Line endings: {ending}</span> : null}
						{scripts.length > 0 ? <span>Scripts: {scripts.join(", ")}</span> : null}
						<span>Locale in use: {locale}</span>
						{/\s$/u.test(input) ? <span>Ends with whitespace</span> : null}
					</p>

					{fileNote ? <p className="text-xs text-muted-foreground">{fileNote}</p> : null}
					{usingSelection ? <p role="status" className="text-xs">Counting your selection only — {selection.length.toLocaleString()} characters. Click once in the box to go back to the whole text.</p> : null}
					{stats.approximate ? <p className="flex items-start gap-1.5 text-xs"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />Your browser has no Intl.Segmenter, so words and characters are approximate.</p> : null}
					{debounced.length > WARN_CHARS && !tooBig ? <p className="flex items-start gap-1.5 text-xs"><Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />This is a large text. Counting runs in slices, and the keyword and per-line tables are switched off above {RENDER_LIMIT.toLocaleString()} characters.</p> : null}
					{tooBig ? <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />Over the {MAX_CHARS.toLocaleString()} character limit. Split the text and count it in parts.</p> : null}
					{busy ? <div className="flex items-center gap-2 text-xs"><progress value={progress} max={1} className="h-1.5 w-40" />Counting {Math.round(progress * 100)}%<Button onClick={() => { cancelRef.current = true; setBusy(false); announce("Counting stopped.") }}>Stop</Button></div> : null}
				</section>

				<section aria-labelledby="wcc-stats-h" className="space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 id="wcc-stats-h" className="text-sm font-semibold">Counts</h2>
						<div className="flex flex-wrap gap-1.5"><CopyButton value={summary} label="Copy summary" announce={announce} /><CopyButton value={summaryMarkdown(stats)} label="Copy as Markdown" announce={announce} /></div>
					</div>
					<dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
						{STAT_ROWS.map((r) => <div key={String(r.key)} className={BOX}><dt className="text-xs text-muted-foreground">{r.label}</dt><dd className="text-xl font-semibold tabular-nums">{Number(stats[r.key]).toLocaleString()}</dd>{r.hint ? <dd className="mt-0.5 text-[11px] text-muted-foreground">{r.hint}</dd> : null}</div>)}
					</dl>
					{stats.words === 0 ? <p className="text-xs text-muted-foreground">Add some text and every number above fills in.</p> : null}
				</section>

				<section aria-labelledby="wcc-time-h" className="space-y-3">
					<h2 id="wcc-time-h" className="text-sm font-semibold">Time and readability</h2>
					<div className="grid gap-3 sm:grid-cols-3">
						<div className={BOX}><p className="text-xs text-muted-foreground">Reading time</p><p className="text-lg font-semibold">{formatDuration(reading)}</p><label className="mt-2 block text-xs">Words per minute: {options.readingWpm}<input type="range" min={100} max={400} step={5} value={options.readingWpm} onChange={(e) => set("readingWpm", Number(e.target.value))} className={`mt-1 w-full ${FOCUS}`} /></label></div>
						<div className={BOX}><p className="text-xs text-muted-foreground">Speaking time</p><p className="text-lg font-semibold">{formatDuration(speaking)}</p><label className="mt-2 block text-xs">Words per minute: {options.speakingWpm}<input type="range" min={80} max={200} step={5} value={options.speakingWpm} onChange={(e) => set("speakingWpm", Number(e.target.value))} className={`mt-1 w-full ${FOCUS}`} /></label></div>
						<div className={BOX}><p className="text-xs text-muted-foreground">Handwriting time</p><p className="text-lg font-semibold">{formatDuration(writing)}</p><p className="mt-1 text-[11px] text-muted-foreground">At about 20 words a minute.</p></div>
					</div>
					{readability.meaningful ? <div className={`${BOX} space-y-1 text-sm`}><p>Flesch Reading Ease <strong className="tabular-nums">{readability.flesch}</strong> — {readability.band}</p><p>Flesch–Kincaid grade <strong className="tabular-nums">{readability.grade}</strong></p><p className="text-xs text-muted-foreground">{readability.longWordRatio}% of words have three or more syllables. Syllables counted: {stats.syllables.toLocaleString()}.</p></div> : <p className="text-xs text-muted-foreground">Readability scores are shown for Latin-script text only. Flesch was designed for English, so a number here would not mean anything for {scripts.length > 0 ? scripts.join(", ") : "this script"}.</p>}
				</section>

				<section aria-labelledby="wcc-target-h" className="space-y-3">
					<h2 id="wcc-target-h" className="text-sm font-semibold">Goals and platform limits</h2>
					<div className="grid gap-3 sm:grid-cols-2">
						<div className={BOX}><label className="block text-xs" htmlFor="wcc-wt">Word goal (0 turns it off)</label><input id="wcc-wt" type="number" min={0} value={options.wordTarget} onChange={(e) => set("wordTarget", Math.max(0, Number(e.target.value)))} className={`mt-1 ${INPUT}`} />{options.wordTarget > 0 ? <><p className="mt-2 text-sm">{stats.words.toLocaleString()} of {options.wordTarget.toLocaleString()} — {wordPct}%{stats.words < options.wordTarget ? ` · ${(options.wordTarget - stats.words).toLocaleString()} to go` : " · goal reached"}</p><Bar used={stats.words} limit={options.wordTarget} /></> : null}</div>
						<div className={BOX}><label className="block text-xs" htmlFor="wcc-ct">Character goal (0 turns it off)</label><input id="wcc-ct" type="number" min={0} value={options.charTarget} onChange={(e) => set("charTarget", Math.max(0, Number(e.target.value)))} className={`mt-1 ${INPUT}`} />{options.charTarget > 0 ? <><p className="mt-2 text-sm">{stats.graphemes.toLocaleString()} of {options.charTarget.toLocaleString()} — {charPct}%</p><Bar used={stats.graphemes} limit={options.charTarget} /></> : null}</div>
					</div>

					<div className={`${BOX} space-y-2`}>
						<p className="text-sm">SMS: <strong>{sms.segments}</strong> segment{sms.segments === 1 ? "" : "s"} · {sms.encoding} · {sms.charsPerSegment} per segment · {sms.remainingInSegment} left in this one</p>
						{sms.encoding === "UCS-2" && debounced.length > 0 ? <p className="text-xs text-muted-foreground">UCS-2 was forced by: {ucs2List(debounced)}. Removing those characters would roughly double how much fits in a segment.</p> : null}
					</div>

					<ul className="space-y-2">
						{platforms.map((p) => <li key={p.id} className={BOX}><div className="flex flex-wrap items-baseline justify-between gap-2 text-sm"><span>{p.label}{p.note ? <span className="text-xs text-muted-foreground"> · {p.note}</span> : null}</span><span className="tabular-nums">{p.used.toLocaleString()} / {p.limit.toLocaleString()} {p.unit === "words" ? "words" : "chars"}{p.over ? ` · over by ${(p.used - p.limit).toLocaleString()}` : ` · ${p.remaining.toLocaleString()} left`}</span></div><div className="mt-1.5"><Bar used={p.used} limit={p.limit} /></div></li>)}
					</ul>
					<details><summary className={`cursor-pointer text-sm ${FOCUS}`}>Choose which platforms to show</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{ALL_PLATFORM_IDS.map((id) => <Toggle key={id} id={`wcc-p-${id}`} checked={options.visiblePlatforms.includes(id)} onChange={(v) => set("visiblePlatforms", v ? [...options.visiblePlatforms, id] : options.visiblePlatforms.filter((x) => x !== id))} label={id} />)}</div></details>
				</section>

				<section aria-labelledby="wcc-set-h" className="space-y-3">
					<h2 id="wcc-set-h" className="text-sm font-semibold">Settings</h2>
					<div className="flex flex-wrap gap-1.5">{[...PRESETS, ...customPresets.map((p) => ({ ...p, description: "Your preset" }))].map((p) => <button key={p.id} type="button" className={CHIP} title={p.description} onClick={() => { setOptions({ ...options, ...p.values }); announce(`Applied the ${p.label} preset.`) }}>{p.label}</button>)}<Button onClick={() => { if (customPresets.length >= MAX_PRESETS) { announce(`You can keep ${MAX_PRESETS} presets. Delete one first.`); return } setCustomPresets([...customPresets, { id: `c${Date.now()}`, label: `My preset ${customPresets.length + 1}`, values: options }]); announce("Preset saved.") }}>Save these settings</Button><Button onClick={() => { setOptions(DEFAULTS); announce("Settings reset.") }}><RotateCcw className="size-4" aria-hidden />Reset</Button><Button onClick={shareLink}><Link2 className="size-4" aria-hidden />Share link</Button></div>
					<div className="grid gap-3 sm:grid-cols-2">
						<label className="block text-sm">Language for word breaking<select value={options.locale} onChange={(e) => set("locale", e.target.value)} className={`mt-1 ${INPUT}`}>{LOCALES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select><span className="mt-1 block text-xs text-muted-foreground">Japanese, Chinese and Thai have no spaces, so this changes the word count.</span></label>
						<label className="block text-sm">Detail table<select value={options.breakdownMode} onChange={(e) => set("breakdownMode", e.target.value === "paragraph" ? "paragraph" : "line")} className={`mt-1 ${INPUT}`}><option value="line">Per line</option><option value="paragraph">Per paragraph</option></select></label>
					</div>
					<div className="grid gap-2 sm:grid-cols-2">
						<Toggle id="wcc-sel" checked={options.countSelection} onChange={(v) => set("countSelection", v)} label="Count my selection when I select text" />
						<Toggle id="wcc-mono" checked={options.monospace} onChange={(v) => set("monospace", v)} label="Monospace input" hint="Useful for subtitles and code." />
						<Toggle id="wcc-stop" checked={options.excludeStopwords} onChange={(v) => set("excludeStopwords", v)} label="Ignore common words in the keyword table" />
						<Toggle id="wcc-share" checked={options.shareInput} onChange={(v) => set("shareInput", v)} label="Include my text in share links" hint="Off by default. Only short texts are included." />
					</div>
				</section>

				<section aria-labelledby="wcc-kw-h" className="space-y-3" ref={keywordsRef}>
					<h2 id="wcc-kw-h" className="text-sm font-semibold">Keywords</h2>
					<div className="flex flex-wrap items-end gap-3">
						<label className="text-sm">Phrase length<select value={options.phraseLength} onChange={(e) => set("phraseLength", Number(e.target.value))} className={`mt-1 ${INPUT}`}><option value={1}>Single words</option><option value={2}>Two words</option><option value={3}>Three words</option></select></label>
						<label className="text-sm">Rows<input type="number" min={3} max={50} value={options.topKeywords} onChange={(e) => set("topKeywords", Math.min(50, Math.max(3, Number(e.target.value))))} className={`mt-1 ${INPUT}`} /></label>
						<CopyButton value={["keyword,count,density_percent", ...keywords.map((k) => `${csvCell(k.word)},${k.count},${k.density}`)].join("\n")} label="Copy as CSV" announce={announce} />
					</div>
					{keywords.length > 0 ? <table className="w-full text-sm"><caption className="sr-only">Keyword frequency and density</caption><thead><tr className="text-left text-xs text-muted-foreground"><th scope="col" className="py-1">Keyword</th><th scope="col" className="py-1">Count</th><th scope="col" className="py-1">Density</th></tr></thead><tbody>{keywords.map((k) => <tr key={k.word} className="border-t"><td className="py-1">{k.word}</td><td className="py-1 tabular-nums">{k.count}</td><td className="py-1 tabular-nums">{k.density}%</td></tr>)}</tbody></table> : <p className="text-xs text-muted-foreground">{debounced.length > RENDER_LIMIT ? "The keyword table is switched off for very large texts so the page stays fast." : "No keywords yet."}</p>}
					{longest.length > 0 ? <p className="text-xs text-muted-foreground">Longest words: {longest.join(", ")}</p> : null}
				</section>

				<section aria-labelledby="wcc-br-h" className="space-y-2">
					<div className="flex flex-wrap items-center justify-between gap-2"><h2 id="wcc-br-h" className="text-sm font-semibold">Per {options.breakdownMode}</h2><label className="text-xs">Sort by <select value={sortKey} onChange={(e) => setSortKey(e.target.value as "index" | "words" | "chars")} className={`${INPUT} inline-block w-auto`}><option value="index">Order</option><option value="words">Most words</option><option value="chars">Most characters</option></select></label></div>
					{sortedRows.length > 0 ? <div className="max-h-72 overflow-auto rounded-lg border"><table className="w-full text-sm"><caption className="sr-only">Counts for each {options.breakdownMode}</caption><thead className="sticky top-0 bg-background"><tr className="text-left text-xs text-muted-foreground"><th scope="col" className="p-2">#</th><th scope="col" className="p-2">Text</th><th scope="col" className="p-2">Words</th><th scope="col" className="p-2">Chars</th><th scope="col" className="p-2">Sentences</th></tr></thead><tbody>{sortedRows.map((r) => <tr key={r.index} className="border-t align-top"><td className="p-2 tabular-nums">{r.index}</td><td className="max-w-[24rem] truncate p-2" title={r.text}>{r.text || <span className="text-muted-foreground">(empty)</span>}</td><td className="p-2 tabular-nums">{r.words}</td><td className="p-2 tabular-nums">{r.chars}</td><td className="p-2 tabular-nums">{r.sentences}</td></tr>)}</tbody></table></div> : <p className="text-xs text-muted-foreground">Nothing to break down yet.</p>}
					{rows.truncated ? <p className="text-xs text-muted-foreground">Only the first 500 rows are shown. Download the CSV for all of them.</p> : null}
				</section>

				<section aria-labelledby="wcc-dl-h" className="space-y-2">
					<h2 id="wcc-dl-h" className="text-sm font-semibold">Download</h2>
					<div className="flex flex-wrap gap-1.5">{(["txt", "md", "json", "csv", "html"] as ExportFormat[]).map((f) => <Button key={f} onClick={() => doExport(f)} disabled={stats.words === 0 && stats.graphemes === 0}><Download className="size-4" aria-hidden />{f.toUpperCase()}</Button>)}</div>
					<p className="text-xs text-muted-foreground">Every download includes a short note of the settings that produced it, so the numbers can be checked later.</p>
				</section>

				<section aria-labelledby="wcc-priv-h" className={`${BOX} space-y-2`}>
					<h2 id="wcc-priv-h" className="flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck className="size-4" aria-hidden />Privacy</h2>
					<p className="text-sm text-muted-foreground">Your text is counted in this browser tab. It is never uploaded, and this tool makes no network request at all — it works with the internet switched off. Settings, recent texts and the draft are stored on this device only.</p>
					<Button variant="danger" onClick={() => { clearAllStorage(); history.clearAll(); setOptions(DEFAULTS); setCustomPresets([]); announce("Everything stored by this tool was deleted.") }}><Trash2 className="size-4" aria-hidden />Delete everything stored</Button>
				</section>

				<section aria-labelledby="wcc-help-h" className="space-y-3">
					<h2 id="wcc-help-h" className="text-sm font-semibold">How to use it</h2>
					<ol className="list-decimal space-y-1 pl-5 text-sm">{HOW_TO.map((s) => <li key={s.name}><strong>{s.name}.</strong> {s.text}</li>)}</ol>
					<h3 className="text-sm font-semibold">Questions</h3>
					<dl className="space-y-2 text-sm">{FAQ.map((f) => <div key={f.question}><dt className="font-medium">{f.question}</dt><dd className="text-muted-foreground">{f.answer}</dd></div>)}</dl>
					<details><summary className={`cursor-pointer text-sm ${FOCUS}`}>What this tool assumes</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}</ul></details>
					<h3 className="text-sm font-semibold">Related tools</h3>
					<ul className="space-y-1 text-sm">{RELATED.map((r) => <li key={r.id}><a href={`/tools/${r.id}`} className={`underline ${FOCUS}`}>{r.label}</a> <span className="text-muted-foreground">— {r.why}</span></li>)}</ul>
					<p className="text-xs text-muted-foreground">Also known as: {ALIASES.join(", ")}.</p>
				</section>

				<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
			</main>

			{dialog === "shortcuts" ? <Dialog title="Keyboard shortcuts" onClose={() => setDialog(null)}><dl className="space-y-1 text-sm">{SHORTCUTS.map((s) => <div key={s.keys} className="flex justify-between gap-4"><dt className="font-mono text-xs">{s.keys}</dt><dd className="text-muted-foreground">{s.label}</dd></div>)}</dl></Dialog> : null}

			{dialog === "history" ? <Dialog title="Recent texts" onClose={() => setDialog(null)}>{history.entries.length === 0 ? <p className="text-sm text-muted-foreground">Nothing here yet. Counted texts are saved on this device so you can come back to them.</p> : <><ul className="space-y-2">{history.entries.map((e) => <li key={e.id} className="flex items-start justify-between gap-2 border-b pb-2 text-sm"><button type="button" className={`flex-1 text-left ${FOCUS}`} onClick={() => { setInput(e.snippet); setDialog(null); announce("Restored a recent text.") }}><span className="line-clamp-2">{e.snippet}</span><span className="text-xs text-muted-foreground">{e.words} words · {e.chars} characters</span></button><span className="flex gap-1"><Button onClick={() => history.togglePin(e.id)} title={e.pinned ? "Unpin" : "Pin"}><Pin className="size-4" aria-hidden /></Button><Button onClick={() => history.remove(e.id)} title="Delete"><Trash2 className="size-4" aria-hidden /></Button></span></li>)}</ul><div className="mt-3"><Button variant="danger" onClick={() => { history.clearAll(); announce("History cleared.") }}><Trash2 className="size-4" aria-hidden />Clear all</Button></div></>}<div className="mt-3"><Button onClick={() => { history.add(input, stats.words, stats.graphemes); announce("Saved to recent texts.") }} disabled={input.trim().length === 0}>Save the current text</Button></div></Dialog> : null}
		</div>
	)
}

function ucs2List(input: string): string {
	const found: string[] = []
	for (const ch of input) {
		if (ch.codePointAt(0)! > 0x24f && !found.includes(ch)) {
			found.push(ch)
			if (found.length >= 6) break
		}
	}
	return found.length > 0 ? found.join(" ") : "characters outside the GSM-7 set"
}
