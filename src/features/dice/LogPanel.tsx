import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { logEvent, logStore, useLog, type LogEntry } from "../services"
import { pushUndo } from "../board-bridge"
import { usePrefs } from "../prefs"
import { useTableMode } from "../view-state"
import { showToast } from "../../utils/toast"
import { MOD } from "../../utils/hotkeys"
import { DockPanel } from "./DockPanel"
import { LogIcon, LogKindIcon } from "./icons"
import { KIND_LABEL, fmtTime, groupSessions, journalHtml, journalMarkdown, sessionTitle } from "./journal"
import { dateStamp, downloadText } from "./download"

const KINDS = Object.keys(KIND_LABEL) as LogEntry["kind"][]

function clearLog() {
    const removed = logStore.get()
    if (!removed.length) return
    const ids = new Set(removed.map((e) => e.id))
    logStore.set([])
    pushUndo({
        label: "Clear session log",
        undo: () =>
            logStore.set((cur) => [...removed, ...cur.filter((e) => !ids.has(e.id))].sort((a, b) => a.at - b.at)),
        redo: () => logStore.set((cur) => cur.filter((e) => !ids.has(e.id))),
    })
    showToast(`Log cleared. Undo with ${MOD}Z.`)
}

export const LogPanel: React.FC = () => {
    const log = useLog()
    const { confirmDestructive } = usePrefs()
    const tableMode = useTableMode()
    const [kinds, setKinds] = useState<Set<LogEntry["kind"]>>(new Set())
    const [note, setNote] = useState("")
    const [confirming, setConfirming] = useState(false)
    const listRef = useRef<HTMLDivElement>(null)
    const stick = useRef(true)

    const present = useMemo(() => new Set(log.map((e) => e.kind)), [log])
    const filtered = useMemo(() => (kinds.size ? log.filter((e) => kinds.has(e.kind)) : log), [log, kinds])
    const sessions = useMemo(() => groupSessions(filtered), [filtered])

    // Keep the newest entry in view unless the reader has scrolled up
    useLayoutEffect(() => {
        const el = listRef.current
        if (el && stick.current) el.scrollTop = el.scrollHeight
    }, [filtered])

    useEffect(() => {
        if (!log.length) setConfirming(false)
    }, [log.length])

    const toggleKind = (k: LogEntry["kind"]) =>
        setKinds((prev) => {
            const next = new Set(prev)
            if (next.has(k)) next.delete(k)
            else next.add(k)
            return next
        })

    const addNote = (e: React.FormEvent) => {
        e.preventDefault()
        const text = note.trim()
        if (!text) return
        stick.current = true
        logEvent({ kind: "note", text })
        setNote("")
    }

    const onClear = () => {
        if (confirmDestructive) setConfirming(true)
        else clearLog()
    }

    return (
        <DockPanel id='log' title='Session log' icon={<LogIcon />}>
            <div className='jv-filters' role='group' aria-label='Show only'>
                <button type='button' className='jv-chip' aria-pressed={kinds.size === 0} onClick={() => setKinds(new Set())}>
                    All
                </button>
                {KINDS.filter((k) => present.has(k) || kinds.has(k)).map((k) => (
                    <button
                        key={k}
                        type='button'
                        className='jv-chip'
                        aria-pressed={kinds.has(k)}
                        onClick={() => toggleKind(k)}
                    >
                        <span className='jv-chip-icon' aria-hidden='true'>
                            <LogKindIcon kind={k} />
                        </span>
                        {KIND_LABEL[k]}
                    </button>
                ))}
            </div>

            <div
                ref={listRef}
                className='jv-log-list'
                tabIndex={0}
                aria-label='Log entries'
                onScroll={(e) => {
                    const el = e.currentTarget
                    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
                }}
            >
                {sessions.length ? (
                    sessions.map((s) => (
                        <section key={s.start} className='jv-log-session' aria-label={sessionTitle(s)}>
                            <h3 className='jv-subhead'>{sessionTitle(s)}</h3>
                            <ol>
                                {s.entries.map((e) => (
                                    <li key={e.id} className={`jv-log-entry jv-log-entry--${e.kind}`}>
                                        <time dateTime={new Date(e.at).toISOString()}>{fmtTime(e.at)}</time>
                                        <span className='jv-log-kind' title={KIND_LABEL[e.kind]}>
                                            <span className='jv-chip-icon' aria-hidden='true'>
                                                <LogKindIcon kind={e.kind} />
                                            </span>
                                            <span className='jv-sr'>{KIND_LABEL[e.kind]}: </span>
                                        </span>
                                        <span className='jv-log-text'>
                                            {e.text}
                                            {e.detail && <span className='jv-log-detail'>{e.detail}</span>}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </section>
                    ))
                ) : (
                    <p className='jv-hint'>
                        {log.length ? "Nothing of that kind yet." : "Rolls, table results and notes will gather here."}
                    </p>
                )}
            </div>

            {!tableMode && (
                <>
                    <form className='jv-row' onSubmit={addNote}>
                        <label className='jv-sr' htmlFor='jv-log-note'>
                            Add a note
                        </label>
                        <input
                            id='jv-log-note'
                            data-autofocus
                            className='jv-input'
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder='Add a note…'
                            maxLength={1000}
                        />
                        <button type='submit' className='jv-btn' disabled={!note.trim()}>
                            Add
                        </button>
                    </form>
                    {confirming ? (
                        <div
                            className='jv-confirm'
                            role='group'
                            aria-label='Confirm clearing the log'
                            onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    setConfirming(false)
                                }
                            }}
                        >
                            <p>
                                Clear all {log.length} entries? You can undo with {MOD}Z.
                            </p>
                            <div className='jv-row'>
                                <button
                                    type='button'
                                    className='jv-btn jv-btn--danger'
                                    autoFocus
                                    onClick={() => {
                                        setConfirming(false)
                                        clearLog()
                                    }}
                                >
                                    Clear log
                                </button>
                                <button type='button' className='jv-btn' onClick={() => setConfirming(false)}>
                                    Keep it
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className='jv-row jv-row--wrap'>
                            <button
                                type='button'
                                className='jv-btn'
                                onClick={() =>
                                    downloadText(`adventure-journal-${dateStamp()}.html`, journalHtml(log), "text/html")
                                }
                                title='Download a parchment-style page you can open, print or share'
                            >
                                Export journal
                            </button>
                            <button
                                type='button'
                                className='jv-btn'
                                aria-label='Export journal as Markdown'
                                onClick={() =>
                                    downloadText(`adventure-journal-${dateStamp()}.md`, journalMarkdown(log), "text/markdown")
                                }
                            >
                                Markdown
                            </button>
                            <span className='jv-grow' />
                            <button type='button' className='jv-btn' disabled={!log.length} onClick={onClear}>
                                Clear log
                            </button>
                        </div>
                    )}
                </>
            )}
        </DockPanel>
    )
}
