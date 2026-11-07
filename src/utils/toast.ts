/** Toast notifications: call showToast() anywhere; <ToastHost /> renders them */

export type ToastKind = "info" | "error"

export interface ToastItem {
    id: number
    message: string
    kind: ToastKind
}

export const TOAST_EVENT = "jewel:toast"
let nextId = 1

export function showToast(message: string, kind: ToastKind = "info") {
    window.dispatchEvent(
        new CustomEvent<ToastItem>(TOAST_EVENT, {
            detail: { id: nextId++, message, kind },
        })
    )
}
