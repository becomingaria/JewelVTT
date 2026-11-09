import React, { useEffect, useId, useMemo, useRef, useState } from "react"
import { MOD } from "../../utils/hotkeys"
import { useHumbugs } from "../board-bridge"
import { useMapKind } from "../map-kind"
import { playSfx } from "../sound"
import { rankItems } from "./fuzzy"
import { buildPaletteItems, type PaletteItem } from "./palette-items"
import { paletteOpenStore, rememberRecent, useWorkflowPrefs } from "./state"

/*
 * Command palette (#26): ⌘K / Ctrl+K. The one modal the app has, because
 * the user asked for it. Type to fuzzy-search, ↑/↓ to move, Enter to run,
 * Esc to close; focus goes back where it was.
 */

const MAX_RESULTS = 60

const Highlight: React.FC<{ text: string; indices: number[] }> = ({ text, indices }) => {
    if (!indices.length) return <>{text}</>
    const set = new Set(indices)
    const parts: React.ReactNode[] = []
    let run = ""
    let marked = false
    const flush = (k: number) => {
        if (!run) return
        parts.push(marked ? <mark key={k}>{run}</mark> : <React.Fragment key={k}>{run}</React.Fragment>)
        run = ""
    }
    for (let i = 0; i < text.length; i++) {
        const m = set.has(i)
        if (m !== marked) {
            flush(i)
            marked = m
        }
        run += text[i]
    }
    flush(text.length)
    return <>{parts}</>
}

export const CommandPalette: React.FC = () => {
    const kind = useMapKind()
    const humbugs = useHumbugs()
    const { recent } = useWorkflowPrefs()
    const [query, setQuery] = useState("")
    const [active, setActive] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLUListElement>(null)
    const returnFocus = useRef<HTMLElement | null>(null)
    const titleId = useId()
    const listId = useId()

    // Remember where focus was, then take it; give it back on unmount
    useEffect(() => {
        returnFocus.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        inputRef.current?.focus()
        const back = returnFocus
        return () => {
            const el = back.current
            if (el?.isConnected && (document.activeElement === document.body || !document.activeElement))
                el.focus()
        }
    }, [])

    const items = useMemo(() => buildPaletteItems(kind, humbugs), [kind, humbugs])

    const results = useMemo(() => {
        if (query.trim()) {
            return rankItems(items, query, recent).slice(0, MAX_RESULTS).map((r) => ({
                ...r,
                recent: recent.includes(r.item.id),
            }))
        }
        // Empty query: recently used first (in order), then everything else
        const byId = new Map(items.map((i) => [i.id, i]))
        const first = recent.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))
        const firstIds = new Set(first.map((i) => i.id))
        return [...first, ...items.filter((i) => !firstIds.has(i.id))]
            .slice(0, MAX_RESULTS)
            .map((item) => ({ item, indices: [] as number[], recent: firstIds.has(item.id) }))
    }, [items, query, recent])

    const current = Math.min(active, Math.max(0, results.length - 1))

    useEffect(() => {
        listRef.current
            ?.querySelector(`[data-index="${current}"]`)
            ?.scrollIntoView({ block: "nearest" })
    }, [current])

    const close = () => {
        const el = returnFocus.current
        paletteOpenStore.set(false)
        // Restore focus first, so a command that opens a panel can take it
        if (el?.isConnected) el.focus()
        else inputRef.current?.blur()
    }

    const runItem = (item: PaletteItem) => {
        close()
        rememberRecent(item.id)
        playSfx("ui")
        item.run()
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        const n = results.length
        switch (e.key) {
            case "ArrowDown":
                if (n) setActive((current + 1) % n)
                break
            case "ArrowUp":
                if (n) setActive((current - 1 + n) % n)
                break
            case "PageDown":
                if (n) setActive(Math.min(n - 1, current + 8))
                break
            case "PageUp":
                if (n) setActive(Math.max(0, current - 8))
                break
            case "Enter":
                if (results[current]) runItem(results[current].item)
                break
            case "Escape":
                close()
                break
            case "Tab":
                // The search box is the only control: keep focus in the dialog
                break
            default:
                // ⌘K / Ctrl+K again closes it
                if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
                    close()
                    break
                }
                return
        }
        e.preventDefault()
        e.stopPropagation()
    }

    const activeId = results[current] ? `${listId}-${current}` : undefined

    return (
        <div
            className='wf-palette-backdrop workflow-palette'
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) close()
            }}
        >
            <div
                className='wf-window wf-palette'
                role='dialog'
                aria-modal='true'
                aria-labelledby={titleId}
                onKeyDown={onKeyDown}
            >
                <div className='wf-palette-head'>
                    <h2 className='wf-title' id={titleId}>
                        Command palette
                    </h2>
                    <span className='wf-palette-key' aria-hidden='true'>
                        {MOD}K · Esc
                    </span>
                </div>
                <input
                    ref={inputRef}
                    className='wf-palette-input'
                    type='text'
                    role='combobox'
                    aria-expanded='true'
                    aria-controls={listId}
                    aria-activedescendant={activeId}
                    aria-autocomplete='list'
                    aria-label='Search commands, tools and objects'
                    placeholder='Type a command, a tool, or a name…'
                    spellCheck={false}
                    autoComplete='off'
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        setActive(0)
                    }}
                />
                <span className='wf-sr' aria-live='polite'>
                    {results.length ? `${results.length} results` : "No matches"}
                </span>
                {results.length ? (
                    <ul className='wf-palette-list' id={listId} role='listbox' ref={listRef} aria-label='Results'>
                        {results.map(({ item, indices, recent: isRecent }, i) => (
                            <li
                                key={item.id}
                                id={`${listId}-${i}`}
                                data-index={i}
                                role='option'
                                aria-selected={i === current}
                                className='wf-palette-opt'
                                // Keep focus in the search box while clicking
                                onMouseDown={(e) => e.preventDefault()}
                                onMouseMove={() => i !== current && setActive(i)}
                                onClick={() => runItem(item)}
                            >
                                <span className='wf-opt-label'>
                                    <Highlight text={item.label} indices={indices} />
                                </span>
                                <span className='wf-opt-tag'>{isRecent ? "Recent" : item.tag}</span>
                                {item.hotkey ? (
                                    <kbd className='wf-opt-key'>{item.hotkey}</kbd>
                                ) : (
                                    <span aria-hidden='true' />
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className='wf-palette-empty'>
                        Nothing matches “{query}”. Try fewer letters.
                    </p>
                )}
            </div>
        </div>
    )
}
