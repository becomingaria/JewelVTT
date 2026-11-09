import { useEffect, type RefObject } from "react"

/*
 * Panels move focus in when the user opens them and give it back on
 * close. A panel that is merely restored (open from last visit) never
 * grabs focus: the opener calls requestPanelFocus() first.
 */

let focusRequested = false

/** Call right before opening a panel from a click or hotkey */
export const requestPanelFocus = () => {
    focusRequested = true
}

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])"

export function usePanelFocus(ref: RefObject<HTMLElement | null>, selector = FOCUSABLE) {
    useEffect(() => {
        const el = ref.current
        const before = document.activeElement as HTMLElement | null
        if (focusRequested && el) {
            focusRequested = false
            el.querySelector<HTMLElement>(selector)?.focus()
        }
        return () => {
            const now = document.activeElement
            const lost = !now || now === document.body || (el?.contains(now) ?? false)
            if (lost && before && before !== document.body && document.contains(before)) before.focus()
        }
    }, [ref, selector])
}
