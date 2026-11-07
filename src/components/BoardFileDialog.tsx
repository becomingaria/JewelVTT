import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Icon } from "./Icon"
import type { BoardDialog } from "../utils/use-local-boards"
import "./BoardFileDialog.css"

interface BoardFileDialogProps {
    dialog: BoardDialog
    folderName: string
    /** File names already open as scene tabs */
    openFiles: string[]
    onClose: () => void
    onSaveAs: (name: string, replace: boolean) => Promise<"saved" | "exists" | "failed">
    onOpen: (fileName: string) => void
    onBrowse: () => void
    onAddScenes: (fileNames: string[]) => void
}

const ago = (t: number) => {
    const s = (Date.now() - t) / 1000
    if (s < 60) return "just now"
    if (s < 3600) return `${Math.round(s / 60)} min ago`
    if (s < 86400) return `${Math.round(s / 3600)} h ago`
    return new Date(t).toLocaleDateString()
}

/** Save as / Open / Prepared scenes, all working with the local folder */
export const BoardFileDialog: React.FC<BoardFileDialogProps> = ({
    dialog,
    folderName,
    openFiles,
    onClose,
    onSaveAs,
    onOpen,
    onBrowse,
    onAddScenes,
}) => {
    const [name, setName] = useState("")
    const [exists, setExists] = useState(false)
    const [busy, setBusy] = useState(false)
    const [picked, setPicked] = useState<Set<string>>(new Set())
    const inputRef = useRef<HTMLInputElement>(null)

    // Latest close handler without re-running the reset below (the parent
    // passes a new function every render, which used to wipe typed names)
    const onCloseRef = useRef(onClose)
    useEffect(() => {
        onCloseRef.current = onClose
    })

    // Reset only when a dialog opens (or switches kind)
    useEffect(() => {
        if (!dialog) return
        setExists(false)
        setBusy(false)
        setPicked(new Set())
        if (dialog.kind === "save") {
            setName(dialog.suggestedName || `Board ${new Date().toLocaleDateString()}`)
            setTimeout(() => inputRef.current?.select(), 30)
        }
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current()
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [dialog])

    if (!dialog) return null

    const title =
        dialog.kind === "save" ? "Save board" : dialog.kind === "open" ? "Open board" : "Prepared scenes"
    const icon = dialog.kind === "save" ? "save" : dialog.kind === "open" ? "open" : "layers"

    const submitSave = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!name.trim() || busy) return
        setBusy(true)
        const result = await onSaveAs(name.trim(), exists)
        setBusy(false)
        if (result === "exists") setExists(true)
    }

    const boards = dialog.kind === "save" ? [] : dialog.boards

    return createPortal(
        <div className='board-file-backdrop' onClick={onClose}>
            <div
                className='board-file-dialog'
                role='dialog'
                aria-modal='true'
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
            >
                <header>
                    <Icon name={icon} size={22} className='jicon-play' />
                    <h3>{title}</h3>
                    <button type='button' className='board-file-close' onClick={onClose} aria-label='Close'>
                        <Icon name='close' size={18} />
                    </button>
                </header>
                <p className='board-file-folder'>
                    <Icon name='open' size={16} /> {folderName}
                </p>

                {dialog.kind === "save" && (
                    <form onSubmit={submitSave} className='board-file-body'>
                        <label htmlFor='board-name'>Board name</label>
                        <input
                            id='board-name'
                            ref={inputRef}
                            value={name}
                            maxLength={80}
                            onChange={(e) => {
                                setName(e.target.value)
                                setExists(false)
                            }}
                        />
                        {exists && (
                            <p className='board-file-warning'>
                                A board called “{name.trim()}” is already in this folder.
                                Save again to replace it.
                            </p>
                        )}
                        <div className='board-file-actions'>
                            <button type='button' className='secondary' onClick={onClose}>
                                Cancel
                            </button>
                            <button type='submit' className={exists ? "danger" : ""} disabled={!name.trim() || busy}>
                                {exists ? "Replace" : "Save"}
                            </button>
                        </div>
                    </form>
                )}

                {dialog.kind !== "save" && (
                    <div className='board-file-body'>
                        {boards.length === 0 ? (
                            <p className='board-file-empty'>
                                No boards in this folder yet. Use <strong>Save Board</strong> to add one.
                            </p>
                        ) : (
                            <ul className='board-file-list'>
                                {boards.map((b) => {
                                    const isOpen = openFiles.includes(b.fileName)
                                    if (dialog.kind === "open") {
                                        return (
                                            <li key={b.fileName}>
                                                <button type='button' className='board-file-row' onClick={() => onOpen(b.fileName)}>
                                                    <Icon name='document' size={20} />
                                                    <span className='board-file-name'>{b.name}</span>
                                                    <span className='board-file-meta'>
                                                        {isOpen ? "open in a tab" : ago(b.lastModified)}
                                                    </span>
                                                </button>
                                            </li>
                                        )
                                    }
                                    const checked = isOpen || picked.has(b.fileName)
                                    return (
                                        <li key={b.fileName}>
                                            <label className={`board-file-row ${isOpen ? "is-open" : ""}`}>
                                                <input
                                                    type='checkbox'
                                                    checked={checked}
                                                    disabled={isOpen}
                                                    onChange={(e) =>
                                                        setPicked((prev) => {
                                                            const next = new Set(prev)
                                                            if (e.target.checked) next.add(b.fileName)
                                                            else next.delete(b.fileName)
                                                            return next
                                                        })
                                                    }
                                                />
                                                <span className='board-file-name'>{b.name}</span>
                                                <span className='board-file-meta'>
                                                    {isOpen ? "already a tab" : ago(b.lastModified)}
                                                </span>
                                            </label>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                        <div className='board-file-actions'>
                            {dialog.kind === "open" ? (
                                <button type='button' className='secondary' onClick={onBrowse}>
                                    Browse for a file instead…
                                </button>
                            ) : (
                                <>
                                    <button type='button' className='secondary' onClick={onClose}>
                                        Cancel
                                    </button>
                                    <button
                                        type='button'
                                        disabled={picked.size === 0}
                                        onClick={() => onAddScenes([...picked])}
                                    >
                                        Add {picked.size || ""} {picked.size === 1 ? "scene" : "scenes"}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
