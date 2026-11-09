import type React from "react"
import { useEffect, useState } from "react"

/** Track the board container's size */
export function useContainerSize(el: HTMLElement | null) {
    const [size, setSize] = useState({ w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 })
    useEffect(() => {
        if (!el) return
        const update = () => setSize({ w: el.clientWidth, h: el.clientHeight })
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [el])
    return size
}

/**
 * Drag a panel by its header. `onMove` gets the new left/top in px,
 * clamped so the panel can't leave the window.
 */
export function usePanelDrag(
    panel: React.RefObject<HTMLElement | null>,
    onMove: (pos: { x: number; y: number }) => void
) {
    const [drag, setDrag] = useState<{ dx: number; dy: number; id: number } | null>(null)
    const clamp = (x: number, y: number) => {
        const el = panel.current
        const w = el?.offsetWidth ?? 200
        const h = el?.offsetHeight ?? 100
        return {
            x: Math.max(0, Math.min(window.innerWidth - Math.min(w, 120), x)),
            y: Math.max(0, Math.min(window.innerHeight - Math.min(h, 40), y)),
        }
    }
    return {
        dragging: !!drag,
        handlers: {
            onPointerDown: (e: React.PointerEvent) => {
                if (e.button !== 0 || (e.target as HTMLElement).closest("button, input, select")) return
                const r = panel.current?.getBoundingClientRect()
                if (!r) return
                ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                setDrag({ dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId })
            },
            onPointerMove: (e: React.PointerEvent) => {
                if (drag?.id === e.pointerId) onMove(clamp(e.clientX - drag.dx, e.clientY - drag.dy))
            },
            onPointerUp: (e: React.PointerEvent) => {
                if (drag?.id === e.pointerId) setDrag(null)
            },
        },
    }
}

/** Focus into a dialog on open, trap Tab, close on Esc, give focus back */
export function useDialogFocus(
    open: boolean,
    root: React.RefObject<HTMLElement | null>,
    onClose: () => void
) {
    useEffect(() => {
        if (!open) return
        const back = document.activeElement as HTMLElement | null
        const focusables = () =>
            Array.from(
                root.current?.querySelectorAll<HTMLElement>(
                    "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex='0']"
                ) ?? []
            )
        const first = root.current?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0]
        first?.focus()
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault()
                e.stopPropagation()
                onClose()
                return
            }
            if (e.key !== "Tab") return
            const list = focusables()
            if (!list.length) return
            const i = list.indexOf(document.activeElement as HTMLElement)
            if (e.shiftKey && i <= 0) {
                e.preventDefault()
                list[list.length - 1].focus()
            } else if (!e.shiftKey && i === list.length - 1) {
                e.preventDefault()
                list[0].focus()
            }
        }
        // Capture so Esc closes the dialog before the board sees it
        window.addEventListener("keydown", onKey, true)
        return () => {
            window.removeEventListener("keydown", onKey, true)
            if (back && document.contains(back)) back.focus()
        }
    }, [open, root, onClose])
}
