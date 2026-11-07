/** Looks for the line drawn behind a humbug while it's dragged */
export type DragTailStyleId =
    | "ruler"
    | "footprints"
    | "arrow"
    | "breadcrumbs"
    | "magic"
    | "chalk"

export const DRAG_TAIL_STYLES: { id: DragTailStyleId; label: string }[] = [
    { id: "ruler", label: "Ruler" },
    { id: "footprints", label: "Footprints" },
    { id: "arrow", label: "Arrow" },
    { id: "breadcrumbs", label: "Breadcrumbs" },
    { id: "magic", label: "Magic" },
    { id: "chalk", label: "Chalk" },
]

const STORAGE_KEY = "jewel-vtt:dragTailStyle"

/** Per-viewer preference (falls back to Ruler if storage is unavailable) */
export function loadDragTailStyle(): DragTailStyleId {
    try {
        const v = localStorage.getItem(STORAGE_KEY)
        if (DRAG_TAIL_STYLES.some((s) => s.id === v)) return v as DragTailStyleId
    } catch {
        /* private mode etc. */
    }
    return "ruler"
}

export function saveDragTailStyle(id: DragTailStyleId) {
    try {
        localStorage.setItem(STORAGE_KEY, id)
    } catch {
        /* ignore */
    }
}
