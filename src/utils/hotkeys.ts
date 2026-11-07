import { useEffect, useRef } from "react"

/*
 * Keyboard shortcuts. HOTKEYS is the single source of truth: the handler
 * below and the How-to page both read it, so they can't drift apart.
 */

export const IS_MAC =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
/** Label for the platform's command key, e.g. "⌘" or "Ctrl+" */
export const MOD = IS_MAC ? "⌘" : "Ctrl+"

export type HotkeyAction =
    | "save"
    | "open"
    | "export"
    | "help"
    | "home"
    | "view"
    | "spot"
    | "add-text"
    | "add-image"
    | "add-map"
    | "add-token"
    | "add-pin"
    | "add-color"
    | "add-document"
    | "scribble"
    | "select-all"
    | "delete"
    | "nudge"

export interface HotkeyDef {
    action: HotkeyAction
    /** KeyboardEvent.key, lower-case for letters */
    key: string
    mod?: boolean
    shift?: boolean
    label: string
    group: "Board" | "Add" | "Navigate" | "Edit"
}

export const HOTKEYS: HotkeyDef[] = [
    { action: "save", key: "s", mod: true, label: "Save board to a file", group: "Board" },
    { action: "open", key: "o", mod: true, label: "Open a board file", group: "Board" },
    { action: "export", key: "e", mod: true, label: "Export board as PNG", group: "Board" },
    { action: "help", key: "?", label: "Open this guide", group: "Board" },

    { action: "add-text", key: "t", label: "Add a text box", group: "Add" },
    { action: "add-image", key: "i", label: "Add an image", group: "Add" },
    { action: "add-map", key: "m", label: "Add a map", group: "Add" },
    { action: "add-token", key: "k", label: "Add a token", group: "Add" },
    { action: "add-pin", key: "p", label: "Add a map pin", group: "Add" },
    { action: "add-color", key: "c", label: "Add a solid colour", group: "Add" },
    { action: "add-document", key: "d", label: "Add a document or link", group: "Add" },

    { action: "home", key: "h", label: "Fly home to the centre", group: "Navigate" },
    { action: "spot", key: "f", label: "Drop a spot flag at the cursor", group: "Navigate" },
    { action: "view", key: "v", label: "Switch between 2D and 2.5D views", group: "Navigate" },

    { action: "scribble", key: "b", label: "Pencil on/off (scribble layer)", group: "Edit" },
    { action: "select-all", key: "a", mod: true, label: "Select everything", group: "Edit" },
    { action: "delete", key: "Delete", label: "Delete selection", group: "Edit" },
    // Handled in HumbugManager; listed here so the guide shows it
    { action: "nudge", key: "Arrows", label: "Move selection one square (two arrows = diagonal)", group: "Edit" },
]

/** Human-readable key combo, e.g. "⌘S" or "Shift+?" */
export function formatHotkey(def: HotkeyDef) {
    const key =
        def.key === "Delete"
            ? "Delete / ⌫"
            : def.key === "Arrows"
            ? "← ↑ → ↓"
            : def.key.length === 1
            ? def.key.toUpperCase()
            : def.key
    return `${def.mod ? MOD : ""}${def.shift ? "Shift+" : ""}${key}`
}

const isTyping = (target: EventTarget | null) => {
    const el = target as HTMLElement | null
    return (
        !!el &&
        (el.tagName === "INPUT" ||
            el.tagName === "TEXTAREA" ||
            el.tagName === "SELECT" ||
            el.isContentEditable)
    )
}

function matches(def: HotkeyDef, e: KeyboardEvent) {
    const mod = IS_MAC ? e.metaKey : e.ctrlKey
    if (!!def.mod !== mod) return false
    if (def.key === "Arrows") return false // handled by HumbugManager
    if (def.key === "Delete") return e.key === "Delete" || e.key === "Backspace"
    if (def.key === "?") return e.key === "?" || (e.key === "/" && e.shiftKey)
    if (!!def.shift !== e.shiftKey) return false
    if (e.altKey) return false
    return e.key.toLowerCase() === def.key
}

/**
 * Listen for the shortcuts in HOTKEYS. Handlers return false to let the
 * key through (e.g. Delete with nothing selected). Ignored while typing or
 * while a modal dialog is open (unless `allowInModal`).
 */
export function useHotkeys(
    handlers: Partial<Record<HotkeyAction, () => boolean | void>>
) {
    const latest = useRef(handlers)
    useEffect(() => {
        latest.current = handlers
    })

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.repeat || isTyping(e.target)) return
            // Leave keys alone while a dialog/drawer is open
            if (
                document.querySelector(
                    ".humbug-modal, .image-cropper-modal, .token-library-drawer, .how-to-dialog, .board-file-dialog"
                )
            ) {
                return
            }
            for (const def of HOTKEYS) {
                if (!matches(def, e)) continue
                const handler = latest.current[def.action]
                if (!handler) return
                if (handler() !== false) e.preventDefault()
                return
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [])
}
