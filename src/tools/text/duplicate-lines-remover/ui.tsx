"use client"

/**
 * Duplicate Lines Remover — interface half of the 100x rebuild.
 * Copy to: src/tools/text/duplicate-lines-remover/ui.tsx
 * Imports only react, lucide-react and ./logic. Nothing from the project.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	AlertTriangle, Check, Copy, Download, Eraser, FileUp, Info, Keyboard, Lightbulb,
	Link2, Pin, Redo2, RotateCcw, ShieldCheck, SquareStack, Trash2, Undo2, X,
} from "lucide-react"
import {
	ALIASES, ASSUMPTIONS, BLANK_CHOICES, CHUNK_THRESHOLD, DEFAULT_OPTIONS, EMPTY_RESULT, EXT, FAQ,
	HOW_TO, MAX_CHARS, MAX_FILE_BYTES, MAX_PRESETS, MIME, MODES, PRESETS, RELATED, RENDER_LIMIT,
	SAMPLES, SHORTCUTS, SORT_MODES, UNITS, WARN_CHARS, clearAllStorage, download, previewKeys,
	removeDuplicateLines, removeDuplicateLinesChunked, serialize, stamp, statsToCsv, useDebounced,
	useDraft, useHistory, usePersisted, useUndoRedo,
	type BlankLines, type DedupeOptions, type DedupeResult, type ExportFormat, type Keep, type Mode,
	type SortMode, type Unit,
} from "./logic"

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
const BOX = "rounded-lg border bg-card p-4"
const CHIP = `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors hover:bg-accent ${FOCUS}`
const INPUT = `w-full rounded-md border bg-background px-3 py-2 text-sm ${FOCUS}`

function Button({ children, onClick, variant = "ghost", disabled, title, type = "button" }: {
	children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"
	disabled?: boolean; title?: string; type?: "button" | "submit"
}) {
	const styles = variant === "primary" ? "bg-primary text-primary-foreground hover:opacity-90"
		: variant === "danger" ? "border border-destructive/40 text-destructive hover:bg-destructive/10"
		: "border hover:bg-accent"
	return (
		<button type={type} onClick={onClick} disabled={disabled} title={title}
			className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${styles} ${FOCUS}`}>
			{children}
		</button>
	)
}

function CopyBtn({ getText, label = "Copy" }: { getText: () => string; label?: string }) {
	const [done, setDone] = useState(false)
	return (
		<Button onClick={() => {
			const text = getText()
			if (!text) return
			void navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1400) })
		}} title={label}>
			{done ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
			{done ? "Copied" : label}
		</Button>
	)
}

function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
	return (
		<div className="flex items-start gap-2">
			<input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
				className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${FOCUS}`}
				aria-describedby={hint ? `${id}-hint` : undefined} />
			<div className="min-w-0">
				<label htmlFor={id} className="cursor-pointer text-sm">{label}</label>
				{hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
			</div>
		</div>
	)
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-1">
			<label htmlFor={id} className="text-xs font-medium">{label}</label>
			{children}
			{hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
		</div>
	)
}

function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
	const opener = useRef<Element | null>(null)
	useEffect(() => {
		if (open) opener.current = document.activeElement
		else if (opener.current instanceof HTMLElement) opener.current.focus()
	}, [open])
	useEffect(() => {
		if (!open) return undefined
		const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose() }
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [open, onClose])
	if (!open) return null
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
			<div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg border bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
				<div className="mb-3 flex items-center justify-between gap-2">
					<h3 className="text-sm font-semibold">{title}</h3>
					<Button onClick={onClose} title="Close"><X className="h-4 w-4" aria-hidden />Close</Button>
				</div>
				{children}
			</div>
		</div>
	)
}

const num = (n: number): string => n.toLocaleString()

export default function DuplicateLinesRemover() {
	const [input, setInput] = useState("")
	const [opts, setOpts] = usePersisted<DedupeOptions>("options", DEFAULT_OPTIONS)
	const [saved, setSaved] = usePersisted<Array<{ id: string; label: string; values: DedupeOptions }>>("presets", [])
	const [shareInput, setShareInput] = useState(false)
	const [showKeys, setShowKeys] = useState(false)
	const [format, setFormat] = useState<ExportFormat>("txt")
	const [heavy, setHeavy] = useState<{ running: boolean; ratio: number }>({ running: false, ratio: 0 })
	const [heavyResult, setHeavyResult] = useState<DedupeResult | null>(null)
	const [announce, setAnnounce] = useState("")
	const [notice, setNotice] = useState("")
	const [dialog, setDialog] = useState<"none" | "shortcuts" | "history" | "presets" | "report">("none")
	const cancelled = useRef(false)
	const fileRef = useRef<HTMLInputElement | null>(null)
	const history = useHistory()
	const { draft, dismiss } = useDraft(input)
	const undoRedo = useUndoRedo(input, setInput)

	const set = useCallback(<K extends keyof DedupeOptions>(k: K, v: DedupeOptions[K]) => { setOpts({ ...opts, [k]: v }) }, [opts, setOpts])

	const tooBig = input.length > MAX_CHARS
	const isHeavy = input.length > CHUNK_THRESHOLD
	const debounced = useDebounced(input, 160)
	const debouncedOpts = useDebounced(opts, 160)

	const result: DedupeResult = useMemo(() => {
		if (tooBig) return EMPTY_RESULT
		if (isHeavy) return heavyResult ?? EMPTY_RESULT
		if (!debounced) return EMPTY_RESULT
		return removeDuplicateLines(debounced, debouncedOpts)
	}, [debounced, debouncedOpts, tooBig, isHeavy, heavyResult])

	const keyPreview = useMemo(() => (showKeys && !tooBig ? previewKeys(debounced.slice(0, 20_000), debouncedOpts) : []), [showKeys, debounced, debouncedOpts, tooBig])

	const run = useCallback(async () => {
		if (!input || tooBig) return
		cancelled.current = false
		setHeavy({ running: true, ratio: 0 })
		const { result: r, cancelled: stopped } = await removeDuplicateLinesChunked(
			input, opts, (ratio) => setHeavy({ running: true, ratio }), () => cancelled.current,
		)
		setHeavy({ running: false, ratio: 0 })
		if (stopped) { setNotice("Stopped. Nothing was changed."); return }
		setHeavyResult(r)
		setAnnounce(`Done. ${num(r.removedCount)} removed, ${num(r.remainingCount)} remaining.`)
	}, [input, opts, tooBig])

	useEffect(() => {
		if (!result.output) return
		setAnnounce(`${num(result.removedCount)} removed, ${num(result.remainingCount)} remaining, ${num(result.distinctCount)} distinct values.`)
	}, [result.removedCount, result.remainingCount, result.distinctCount, result.output])

	/* URL hydration: settings only, and the text only if it was shared on purpose. */
	useEffect(() => {
		if (typeof window === "undefined") return
		const p = new URLSearchParams(window.location.search)
		const next: Partial<DedupeOptions> = {}
		const m = p.get("m")
		if (m && MODES.some((x) => x.v === m)) next.mode = m as Mode
		const u = p.get("u")
		if (u && UNITS.some((x) => x.v === u)) next.unit = u as Unit
		if (p.get("ci") === "1") next.caseSensitive = false
		if (p.get("tr") === "1") next.trim = true
		const b = p.get("b")
		if (b && BLANK_CHOICES.some((x) => x.v === b)) next.blankLines = b as BlankLines
		if (Object.keys(next).length > 0) setOpts({ ...DEFAULT_OPTIONS, ...next })
		const t = p.get("t")
		if (t) setInput(t.slice(0, 1500))
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const shareLink = useCallback(() => {
		if (typeof window === "undefined") return
		const p = new URLSearchParams()
		p.set("m", opts.mode ?? "remove")
		p.set("u", opts.unit ?? "lines")
		if (!opts.caseSensitive) p.set("ci", "1")
		if (opts.trim) p.set("tr", "1")
		p.set("b", opts.blankLines ?? "keep")
		if (shareInput && input.length > 0) p.set("t", input.slice(0, 1500))
		const url = `${window.location.origin}${window.location.pathname}?${p.toString()}`
		void navigator.clipboard.writeText(url)
		setNotice(shareInput ? "Link copied, including the first 1,500 characters of your text." : "Link copied. It carries your settings only, not your text.")
	}, [opts, shareInput, input])

	const onFile = useCallback((file: File) => {
		if (file.size > MAX_FILE_BYTES) { setNotice(`That file is ${Math.round(file.size / 1024)} KB. The limit is ${Math.round(MAX_FILE_BYTES / 1024)} KB so the tab stays responsive.`); return }
		const reader = new FileReader()
		reader.onload = () => { undoRedo.push(String(reader.result ?? "")); setNotice(`Loaded ${file.name}.`) }
		reader.onerror = () => setNotice("That file could not be read.")
		reader.readAsText(file)
	}, [undoRedo])

	useEffect(() => {
		const onKey = (e: KeyboardEvent): void => {
			const mod = e.metaKey || e.ctrlKey
			const typing = document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLInputElement
			if (mod && e.key === "Enter") { e.preventDefault(); void run() }
			else if (mod && e.shiftKey && e.key.toLowerCase() === "c") { e.preventDefault(); void navigator.clipboard.writeText(result.output) }
			else if (mod && e.shiftKey && e.key.toLowerCase() === "r") { e.preventDefault(); if (result.output) undoRedo.push(result.output) }
			else if (mod && e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); undoRedo.redo() }
			else if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); undoRedo.undo() }
			else if (e.key === "?" && !typing) { e.preventDefault(); setDialog("shortcuts") }
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [run, result.output, undoRedo])

	const renderedOutput = result.output.length > 200_000 ? result.output.slice(0, 200_000) : result.output
	const sortIrrelevant = opts.sort && (opts.keep === "first" || opts.keep === "last")
	const usingColumn = (opts.unit ?? "lines") === "csv-row" || (opts.column ?? 0) > 0

	const jsonLd = useMemo(() => JSON.stringify({
		"@context": "https://schema.org",
		"@graph": [
			{ "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) },
			{ "@type": "HowTo", name: "How to remove duplicate lines", step: HOW_TO.map((s) => ({ "@type": "HowToStep", name: s.name, text: s.text })) },
		],
	}), [])

	return (
		<div className="space-y-4"
			onDragOver={(e) => e.preventDefault()}
			onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}>

			<a href="#dlr-result" className={`sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded focus:border focus:bg-card focus:px-3 focus:py-1.5 focus:text-sm ${FOCUS}`}>Skip to the result</a>
			<div aria-live="polite" aria-atomic="true" className="sr-only">{announce}</div>

			{notice ? (
				<div className="flex items-start justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm" role="status">
					<span className="flex items-start gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{notice}</span>
					<button type="button" onClick={() => setNotice("")} className={`rounded p-0.5 ${FOCUS}`} aria-label="Dismiss"><X className="h-4 w-4" aria-hidden /></button>
				</div>
			) : null}

			{draft && input.length === 0 ? (
				<div className={`${BOX} flex flex-wrap items-center justify-between gap-2 text-sm`}>
					<span className="flex items-center gap-2"><RotateCcw className="h-4 w-4" aria-hidden />You have unfinished text from a previous visit. It has not been applied.</span>
					<span className="flex gap-2">
						<Button variant="primary" onClick={() => { setInput(draft); dismiss() }}>Restore it</Button>
						<Button onClick={dismiss}>Discard</Button>
					</span>
				</div>
			) : null}

			{/* Presets */}
			<div className={BOX}>
				<div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Lightbulb className="h-4 w-4" aria-hidden />Start from a preset</div>
				<div className="flex flex-wrap gap-2">
					{PRESETS.map((p) => (
						<button key={p.id} type="button" className={CHIP} title={p.description}
							onClick={() => { setOpts({ ...DEFAULT_OPTIONS, ...p.values }); setNotice(p.description) }}>{p.label}</button>
					))}
					{saved.map((p) => (
						<button key={p.id} type="button" className={CHIP} onClick={() => setOpts(p.values)}><Pin className="h-3 w-3" aria-hidden />{p.label}</button>
					))}
				</div>
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<Button onClick={() => {
						if (saved.length >= MAX_PRESETS) { setNotice(`You can keep ${MAX_PRESETS} presets. Delete one first.`); return }
						const label = window.prompt("Name this preset")
						if (label) { setSaved([...saved, { id: `${Date.now()}`, label, values: opts }]); setNotice(`Saved “${label}”.`) }
					}}><Pin className="h-4 w-4" aria-hidden />Save these settings</Button>
					<Button onClick={() => setDialog("presets")} disabled={saved.length === 0}>Manage presets</Button>
					<Button onClick={() => { setOpts(DEFAULT_OPTIONS); setNotice("Settings reset.") }}><RotateCcw className="h-4 w-4" aria-hidden />Reset</Button>
					<Button onClick={shareLink}><Link2 className="h-4 w-4" aria-hidden />Copy a link to these settings</Button>
					<Toggle id="dlr-share" checked={shareInput} onChange={setShareInput} label="Include my text in the link" />
				</div>
			</div>

			{/* What counts as the same */}
			<div className={BOX}>
				<h2 className="mb-3 text-sm font-semibold">What counts as the same line</h2>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<Toggle id="dlr-cs" checked={opts.caseSensitive} onChange={(v) => set("caseSensitive", v)} label="Case-sensitive" hint="Turn off so Apple and apple match." />
					<Toggle id="dlr-fold" checked={!!opts.foldCase} onChange={(v) => set("foldCase", v)} label="Fold case properly" hint="German ß matches ss." />
					<Toggle id="dlr-acc" checked={!!opts.ignoreAccents} onChange={(v) => set("ignoreAccents", v)} label="Ignore accents" hint="Café matches Cafe." />
					<Toggle id="dlr-trim" checked={opts.trim} onChange={(v) => set("trim", v)} label="Trim whitespace" hint="Ignore spaces at each end." />
					<Toggle id="dlr-inner" checked={!!opts.collapseInnerWhitespace} onChange={(v) => set("collapseInnerWhitespace", v)} label="Collapse inner spaces" hint="Runs of spaces or tabs count as one." />
					<Toggle id="dlr-punct" checked={!!opts.ignorePunctuation} onChange={(v) => set("ignorePunctuation", v)} label="Ignore punctuation" hint="A trailing comma stops mattering." />
					<Field id="dlr-pre" label="Ignore this leading text">
						<input id="dlr-pre" className={INPUT} value={opts.ignorePrefix ?? ""} onChange={(e) => set("ignorePrefix", e.target.value)} placeholder="e.g. - " />
					</Field>
					<Field id="dlr-suf" label="Ignore this trailing text">
						<input id="dlr-suf" className={INPUT} value={opts.ignoreSuffix ?? ""} onChange={(e) => set("ignoreSuffix", e.target.value)} placeholder="e.g. ," />
					</Field>
				</div>

				<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<Field id="dlr-from" label="Compare from character" hint="0 means the start.">
						<input id="dlr-from" type="number" min={0} className={INPUT} value={opts.compareFrom ?? 0} onChange={(e) => set("compareFrom", Math.max(0, Number(e.target.value)))} aria-describedby="dlr-from-hint" />
					</Field>
					<Field id="dlr-to" label="Compare to character" hint="0 means the end.">
						<input id="dlr-to" type="number" min={0} className={INPUT} value={opts.compareTo ?? 0} onChange={(e) => set("compareTo", Math.max(0, Number(e.target.value)))} aria-describedby="dlr-to-hint" />
					</Field>
					<Field id="dlr-col" label="Compare only column" hint="0 means the whole line.">
						<input id="dlr-col" type="number" min={0} className={INPUT} value={opts.column ?? 0} onChange={(e) => set("column", Math.max(0, Number(e.target.value)))} aria-describedby="dlr-col-hint" />
					</Field>
					<Field id="dlr-delim" label="Column delimiter" hint="Leave empty to detect it.">
						<input id="dlr-delim" className={INPUT} value={opts.delimiter ?? ""} onChange={(e) => set("delimiter", e.target.value)} placeholder="auto" aria-describedby="dlr-delim-hint" />
					</Field>
					<Field id="dlr-pat" label="Compare using a pattern" hint="A regular expression. Invalid ones are reported, not applied.">
						<input id="dlr-pat" className={INPUT} value={opts.pattern ?? ""} onChange={(e) => set("pattern", e.target.value)} placeholder="e.g. ^\\w+" aria-describedby="dlr-pat-hint" />
					</Field>
					<Field id="dlr-grp" label="Pattern group" hint="0 means the whole match.">
						<input id="dlr-grp" type="number" min={0} className={INPUT} value={opts.patternGroup ?? 0} onChange={(e) => set("patternGroup", Math.max(0, Number(e.target.value)))} aria-describedby="dlr-grp-hint" />
					</Field>
					{usingColumn ? <Toggle id="dlr-hdr" checked={!!opts.hasHeader} onChange={(v) => set("hasHeader", v)} label="First row is a header" hint="It is kept and never compared." /> : null}
					<Toggle id="dlr-keys" checked={showKeys} onChange={setShowKeys} label="Show what is being compared" hint="See the key for the first few lines." />
				</div>

				{showKeys && keyPreview.length > 0 ? (
					<div className="mt-3 overflow-auto rounded-md border">
						<table className="w-full text-xs">
							<caption className="px-3 py-2 text-left text-xs text-muted-foreground">The line, and the text actually compared under your current rules.</caption>
							<thead className="bg-muted/40"><tr><th scope="col" className="px-3 py-1.5 text-left">Line</th><th scope="col" className="px-3 py-1.5 text-left">Compared as</th></tr></thead>
							<tbody>
								{keyPreview.map((k, i) => (
									<tr key={i} className="border-t">
										<td className="px-3 py-1 font-mono">{k.line.slice(0, 60) || <span className="text-muted-foreground">(blank)</span>}</td>
										<td className="px-3 py-1 font-mono">{k.key.slice(0, 60) || <span className="text-muted-foreground">(nothing)</span>}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : null}
			</div>

			{/* What to do */}
			<div className={BOX}>
				<h2 className="mb-3 text-sm font-semibold">What to do with matches</h2>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<Field id="dlr-mode" label="Action" hint={MODES.find((m) => m.v === (opts.mode ?? "remove"))?.hint}>
						<select id="dlr-mode" className={INPUT} value={opts.mode ?? "remove"} onChange={(e) => set("mode", e.target.value as Mode)} aria-describedby="dlr-mode-hint">
							{MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
						</select>
					</Field>
					<Field id="dlr-unit" label="Work on">
						<select id="dlr-unit" className={INPUT} value={opts.unit ?? "lines"} onChange={(e) => set("unit", e.target.value as Unit)}>
							{UNITS.map((u) => <option key={u.v} value={u.v}>{u.label}</option>)}
						</select>
					</Field>
					<Field id="dlr-keep" label="Which one survives" hint="Matters when your rules ignore case or spacing.">
						<select id="dlr-keep" className={INPUT} value={opts.keep} onChange={(e) => set("keep", e.target.value as Keep)} aria-describedby="dlr-keep-hint">
							<option value="first">The first one</option><option value="last">The last one</option>
							<option value="longest">The longest one</option><option value="shortest">The shortest one</option>
						</select>
					</Field>
					<Field id="dlr-pos" label="Where the survivor sits">
						<select id="dlr-pos" className={INPUT} value={opts.survivorPosition ?? "first"} onChange={(e) => set("survivorPosition", e.target.value === "last" ? "last" : "first")}>
							<option value="first">At the first position</option><option value="last">At the last position</option>
						</select>
					</Field>
					<Field id="dlr-blank" label="Blank lines" hint={BLANK_CHOICES.find((b) => b.v === (opts.blankLines ?? "keep"))?.hint}>
						<select id="dlr-blank" className={INPUT} value={opts.blankLines ?? "keep"} onChange={(e) => set("blankLines", e.target.value as BlankLines)} aria-describedby="dlr-blank-hint">
							{BLANK_CHOICES.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
						</select>
					</Field>
					<Field id="dlr-eol" label="Line endings" hint={`Your text uses ${result.detectedEnding.toUpperCase()}.`}>
						<select id="dlr-eol" className={INPUT} value={opts.lineEnding ?? "auto"} onChange={(e) => set("lineEnding", e.target.value as DedupeOptions["lineEnding"])} aria-describedby="dlr-eol-hint">
							<option value="auto">Keep what I gave you</option><option value="lf">LF, Unix</option>
							<option value="crlf">CRLF, Windows</option><option value="cr">CR, classic Mac</option>
						</select>
					</Field>
					{(opts.mode ?? "remove") === "mark" ? (
						<Field id="dlr-mark" label="Mark duplicates with">
							<input id="dlr-mark" className={INPUT} value={opts.markPrefix ?? ""} onChange={(e) => set("markPrefix", e.target.value)} />
						</Field>
					) : null}
					<Toggle id="dlr-strip" checked={!!opts.stripTrailingWhitespace} onChange={(v) => set("stripTrailingWhitespace", v)} label="Strip trailing whitespace" hint="Cleans the output, not just the comparison." />
				</div>

				<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<Toggle id="dlr-sort" checked={opts.sort} onChange={(v) => set("sort", v)} label="Sort the result" hint="Replaces the original order." />
					<Field id="dlr-sortmode" label="Sort by" hint={SORT_MODES.find((s) => s.v === opts.sortMode)?.hint}>
						<select id="dlr-sortmode" className={INPUT} value={opts.sortMode} onChange={(e) => set("sortMode", e.target.value as SortMode)} disabled={!opts.sort} aria-describedby="dlr-sortmode-hint">
							{SORT_MODES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
						</select>
					</Field>
					<Field id="dlr-dir" label="Direction">
						<select id="dlr-dir" className={INPUT} value={opts.direction ?? "asc"} onChange={(e) => set("direction", e.target.value === "desc" ? "desc" : "asc")} disabled={!opts.sort}>
							<option value="asc">Ascending</option><option value="desc">Descending</option>
						</select>
					</Field>
					<Field id="dlr-loc" label="Language for sorting" hint="Leave empty for your browser's language.">
						<input id="dlr-loc" className={INPUT} value={opts.locale ?? ""} onChange={(e) => set("locale", e.target.value)} placeholder="e.g. de, tr, hi" disabled={!opts.sort} aria-describedby="dlr-loc-hint" />
					</Field>
				</div>

				{sortIrrelevant ? (
					<p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />Sorting replaces the original order, so the keep-first or keep-last choice no longer decides where lines end up. It still decides which text survives.</p>
				) : null}
			</div>

			{/* Input */}
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div className="flex flex-col gap-1.5">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<label htmlFor="dlr-input" className="text-sm font-medium">Your text</label>
						<div className="flex flex-wrap items-center gap-1.5">
							<Button onClick={undoRedo.undo} disabled={!undoRedo.canUndo} title="Undo"><Undo2 className="h-4 w-4" aria-hidden />Undo</Button>
							<Button onClick={undoRedo.redo} disabled={!undoRedo.canRedo} title="Redo"><Redo2 className="h-4 w-4" aria-hidden />Redo</Button>
							<Button onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" aria-hidden />Load a file</Button>
							<Button onClick={() => undoRedo.push("")} disabled={input.length === 0}><Eraser className="h-4 w-4" aria-hidden />Clear</Button>
						</div>
					</div>
					<input ref={fileRef} type="file" accept=".txt,.csv,.md,.log,.tsv,text/*" className="sr-only"
						onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = "" }} aria-label="Load a text file" />
					<textarea id="dlr-input" value={input} onChange={(e) => setInput(e.target.value)}
						placeholder="Paste your list, or drop a file anywhere on this tool…"
						className={`min-h-[220px] resize-y rounded-md border bg-background p-3 font-mono text-sm ${FOCUS}`}
						aria-invalid={tooBig} aria-describedby="dlr-input-meta" spellCheck={false} />
					<p id="dlr-input-meta" className={`text-xs ${tooBig ? "text-destructive" : "text-muted-foreground"}`}>
						{tooBig ? `That is ${num(input.length)} characters. The limit is ${num(MAX_CHARS)} so the tab stays responsive. Split the text and run it in parts.`
							: `${num(input.length)} characters${input.length > WARN_CHARS ? " — large, this may take a moment" : ""}. ${result.detectedEnding.toUpperCase()} line endings.`}
					</p>
					<div className="flex flex-wrap gap-1.5">
						{SAMPLES.map((s) => <button key={s.label} type="button" className={CHIP} onClick={() => { undoRedo.push(s.text); setNotice(`Loaded the “${s.label}” sample.`) }}>{s.label}</button>)}
					</div>
				</div>

				{/* Result */}
				<div className="flex flex-col gap-1.5" id="dlr-result">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 className="text-sm font-medium">Result</h2>
						<div className="flex flex-wrap items-center gap-1.5">
							{isHeavy ? <Button variant="primary" onClick={() => void run()} disabled={heavy.running || tooBig}>Run</Button> : null}
							{heavy.running ? <Button variant="danger" onClick={() => { cancelled.current = true }}>Stop</Button> : null}
							<CopyBtn getText={() => result.output} />
							<Button onClick={() => { if (result.output) { undoRedo.push(result.output); setNotice("The result is now your input.") } }} disabled={!result.output}><SquareStack className="h-4 w-4" aria-hidden />Use as input</Button>
						</div>
					</div>

					{heavy.running ? (
						<div className="rounded-md border p-3">
							<div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(heavy.ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
								<div className="h-full bg-primary transition-all" style={{ width: `${Math.round(heavy.ratio * 100)}%` }} />
							</div>
							<p className="mt-1.5 text-xs text-muted-foreground">{Math.round(heavy.ratio * 100)}% — you can stop this at any time.</p>
						</div>
					) : null}

					<pre className="min-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/30 p-3 font-mono text-sm" tabIndex={0} aria-label="Result">
						{renderedOutput || <span className="text-muted-foreground">{isHeavy ? "Large text. Press Run when you are ready." : "Your cleaned text will appear here…"}</span>}
					</pre>
					{result.output.length > renderedOutput.length ? (
						<p className="text-xs text-muted-foreground">Showing the first {num(renderedOutput.length)} characters. Copy and download always give you the whole result.</p>
					) : null}
				</div>
			</div>

			{result.warnings.length > 0 ? (
				<ul className="space-y-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
					{result.warnings.map((w, i) => <li key={i} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{w}</li>)}
				</ul>
			) : null}

			{/* Counts that reconcile */}
			<div className={BOX}>
				<h2 className="mb-3 text-sm font-semibold">What happened</h2>
				<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
					{[
						["In", num(result.originalCount)], ["Duplicates removed", num(result.removedCount)],
						["Blank lines removed", num(result.blanksRemoved)], ["Out", num(result.remainingCount)],
						["Distinct values", num(result.distinctCount)], ["Appear once only", num(result.uniqueCount)],
						["Duplicate rate", `${result.duplicateRate}%`], ["Characters", `${num(result.inputChars)} → ${num(result.outputChars)}`],
						["Bytes", `${num(result.inputBytes)} → ${num(result.outputBytes)}`], ["Line endings", result.detectedEnding.toUpperCase()],
					].map(([k, v]) => (
						<div key={k} className="rounded-md border p-2">
							<dt className="text-xs text-muted-foreground">{k}</dt>
							<dd className="text-sm font-semibold tabular-nums">{v}</dd>
						</div>
					))}
				</dl>
				<p className="mt-3 text-xs text-muted-foreground">
					{num(result.originalCount)} in − {num(result.removedCount)} duplicates − {num(result.blanksRemoved)} blank lines = {num(result.remainingCount)} out.
					{result.reconciles ? " Every line is accounted for." : " These numbers do not reconcile, which is a bug — please report it."}
				</p>
			</div>

			{/* Removal report */}
			{result.removed.length > 0 || result.groups.length > 0 ? (
				<div className={BOX}>
					<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
						<h2 className="text-sm font-semibold">What was removed</h2>
						<div className="flex flex-wrap gap-1.5">
							<CopyBtn getText={() => result.removed.map((r) => r.line).join("\n")} label="Copy removed lines" />
							<Button onClick={() => download(`duplicate-report-${stamp()}.txt`, serialize("report", result, opts), MIME.report)}><Download className="h-4 w-4" aria-hidden />Download the report</Button>
							<Button onClick={() => setDialog("report")}>See all {num(result.removed.length)}</Button>
						</div>
					</div>
					<div className="overflow-auto rounded-md border">
						<table className="w-full text-xs">
							<caption className="px-3 py-2 text-left text-xs text-muted-foreground">The most repeated values, with the lines they came from.</caption>
							<thead className="bg-muted/40"><tr>
								<th scope="col" className="px-3 py-1.5 text-left">Times</th>
								<th scope="col" className="px-3 py-1.5 text-left">Value</th>
								<th scope="col" className="px-3 py-1.5 text-left">Lines</th>
							</tr></thead>
							<tbody>
								{result.groups.slice(0, 20).map((g, i) => (
									<tr key={i} className="border-t">
										<td className="px-3 py-1 tabular-nums">×{g.count}</td>
										<td className="px-3 py-1 font-mono">{g.text.slice(0, 80)}</td>
										<td className="px-3 py-1 tabular-nums text-muted-foreground">{g.lineNumbers.slice(0, 12).join(", ")}{g.lineNumbers.length > 12 ? "…" : ""}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			) : null}

			{/* Downloads */}
			<div className={BOX}>
				<h2 className="mb-3 text-sm font-semibold">Take it away</h2>
				<div className="flex flex-wrap items-end gap-3">
					<Field id="dlr-fmt" label="Format">
						<select id="dlr-fmt" className={INPUT} value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
							<option value="txt">Plain text</option><option value="md">Markdown</option><option value="csv">CSV</option>
							<option value="json">JSON</option><option value="html">HTML</option><option value="report">Removal report</option>
						</select>
					</Field>
					<Button variant="primary" disabled={!result.output}
						onClick={() => download(`deduplicated-${stamp()}.${EXT[format]}`, serialize(format, result, opts), MIME[format])}>
						<Download className="h-4 w-4" aria-hidden />Download as {EXT[format].toUpperCase()}
					</Button>
					<Button disabled={!result.output} onClick={() => download(`duplicate-stats-${stamp()}.csv`, statsToCsv(result, opts), MIME.csv)}>
						<Download className="h-4 w-4" aria-hidden />Download the numbers
					</Button>
					<Button onClick={() => { history.add(opts, `${MODES.find((m) => m.v === (opts.mode ?? "remove"))?.label ?? "Run"}, ${num(result.removedCount)} removed`); setNotice("Saved to history.") }} disabled={!result.output}>
						<Pin className="h-4 w-4" aria-hidden />Save this run
					</Button>
					<Button onClick={() => setDialog("history")}><RotateCcw className="h-4 w-4" aria-hidden />History</Button>
					<Button onClick={() => setDialog("shortcuts")}><Keyboard className="h-4 w-4" aria-hidden />Shortcuts</Button>
				</div>
				<p className="mt-2 text-xs text-muted-foreground">Every download carries a short note of the settings used, so a colleague can tell what was done.</p>
			</div>

			{/* Privacy */}
			<div className={`${BOX} flex flex-wrap items-center justify-between gap-3 text-xs`}>
				<span className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
					<span><strong>Private by design.</strong> Your text is processed in this tab. There is no upload, no tracking and no network request in this tool, and it works offline. Settings, presets and history are stored in this browser only.</span>
				</span>
				<Button variant="danger" onClick={() => { clearAllStorage(); setNotice("Everything this tool had stored has been deleted.") }}>
					<Trash2 className="h-4 w-4" aria-hidden />Delete everything stored
				</Button>
			</div>

			{/* Help */}
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div className={BOX}>
					<h2 className="mb-2 text-sm font-semibold">How to use it</h2>
					<ol className="space-y-1.5 text-sm">
						{HOW_TO.map((s, i) => <li key={s.name} className="flex gap-2"><span className="text-muted-foreground tabular-nums">{i + 1}.</span><span><strong>{s.name}.</strong> {s.text}</span></li>)}
					</ol>
					<h3 className="mb-2 mt-4 text-sm font-semibold">What this tool assumes</h3>
					<ul className="space-y-1 text-sm text-muted-foreground">
						{ASSUMPTIONS.map((a) => <li key={a} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{a}</li>)}
					</ul>
				</div>
				<div className={BOX}>
					<h2 className="mb-2 text-sm font-semibold">Questions</h2>
					<div className="space-y-1">
						{FAQ.map((f) => (
							<details key={f.question} className="rounded-md border p-2">
								<summary className={`cursor-pointer text-sm font-medium ${FOCUS}`}>{f.question}</summary>
								<p className="mt-1.5 text-sm text-muted-foreground">{f.answer}</p>
							</details>
						))}
					</div>
					<h3 className="mb-2 mt-4 text-sm font-semibold">Related tools</h3>
					<ul className="space-y-1 text-sm">
						{RELATED.map((r) => <li key={r.id}><strong>{r.label}</strong> <span className="text-muted-foreground">— {r.why}</span></li>)}
					</ul>
					<p className="mt-3 text-xs text-muted-foreground"><strong>Also known as:</strong> {ALIASES.join(", ")}.</p>
				</div>
			</div>

			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

			<Dialog open={dialog === "shortcuts"} onClose={() => setDialog("none")} title="Keyboard shortcuts">
				<table className="w-full text-sm">
					<caption className="sr-only">Keyboard shortcuts for this tool</caption>
					<thead><tr><th scope="col" className="py-1 text-left">Keys</th><th scope="col" className="py-1 text-left">Action</th></tr></thead>
					<tbody>{SHORTCUTS.map((s) => <tr key={s.keys} className="border-t"><td className="py-1 pr-4 font-mono text-xs">{s.keys}</td><td className="py-1">{s.label}</td></tr>)}</tbody>
				</table>
			</Dialog>

			<Dialog open={dialog === "history"} onClose={() => setDialog("none")} title="Recent runs">
				{history.entries.length === 0 ? <p className="text-sm text-muted-foreground">Nothing saved yet. Runs are only saved when you press Save this run, and they are never applied on their own.</p> : (
					<ul className="space-y-2">
						{history.entries.map((e) => (
							<li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
								<span className="min-w-0"><span className="font-medium">{e.summary}</span><span className="ml-2 text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</span></span>
								<span className="flex gap-1.5">
									<Button onClick={() => { setOpts(e.options); setDialog("none"); setNotice("Settings restored from history.") }}>Restore</Button>
									<Button onClick={() => history.togglePin(e.id)}><Pin className="h-4 w-4" aria-hidden />{e.pinned ? "Unpin" : "Pin"}</Button>
									<Button variant="danger" onClick={() => history.remove(e.id)}><X className="h-4 w-4" aria-hidden />Remove</Button>
								</span>
							</li>
						))}
					</ul>
				)}
			</Dialog>

			<Dialog open={dialog === "presets"} onClose={() => setDialog("none")} title="Your saved presets">
				<ul className="space-y-2">
					{saved.map((p) => (
						<li key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
							<span>{p.label}</span>
							<span className="flex gap-1.5">
								<Button onClick={() => { setOpts(p.values); setDialog("none") }}>Use</Button>
								<Button variant="danger" onClick={() => setSaved(saved.filter((x) => x.id !== p.id))}><Trash2 className="h-4 w-4" aria-hidden />Delete</Button>
							</span>
						</li>
					))}
				</ul>
			</Dialog>

			<Dialog open={dialog === "report"} onClose={() => setDialog("none")} title="Every removed line">
				<table className="w-full text-xs">
					<caption className="sr-only">Removed lines with their original line numbers</caption>
					<thead className="bg-muted/40"><tr>
						<th scope="col" className="px-2 py-1 text-left">Line</th>
						<th scope="col" className="px-2 py-1 text-left">Text</th>
						<th scope="col" className="px-2 py-1 text-left">Kept instead</th>
					</tr></thead>
					<tbody>
						{result.removed.slice(0, RENDER_LIMIT).map((r, i) => (
							<tr key={i} className="border-t">
								<td className="px-2 py-1 tabular-nums">{r.lineNumber}</td>
								<td className="px-2 py-1 font-mono">{r.line.slice(0, 90)}</td>
								<td className="px-2 py-1 tabular-nums text-muted-foreground">{r.keptLineNumber > 0 ? `line ${r.keptLineNumber}` : "—"}</td>
							</tr>
						))}
					</tbody>
				</table>
				{result.removed.length > RENDER_LIMIT ? (
					<p className="mt-2 text-xs text-muted-foreground">Showing the first {num(RENDER_LIMIT)} of {num(result.removed.length)}. Download the report for all of them.</p>
				) : null}
			</Dialog>
		</div>
	)
}
