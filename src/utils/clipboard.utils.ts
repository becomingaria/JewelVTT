import type { Humbug } from "../types/humbug.types"

export class ClipboardManager {
    private clipboard: Humbug[] = []
    private isCutOperation = false

    // Copy humbugs to clipboard
    copy(humbugs: Humbug[]) {
        this.clipboard = humbugs.map((humbug) => ({ ...humbug })) // Deep copy
        this.isCutOperation = false
    }

    // Cut humbugs to clipboard
    cut(humbugs: Humbug[]) {
        this.clipboard = humbugs.map((humbug) => ({ ...humbug })) // Deep copy
        this.isCutOperation = true
    }

    // Paste humbugs from clipboard
    paste(offsetX: number = 20, offsetY: number = 20): Humbug[] {
        if (this.clipboard.length === 0) return []

        // Generate new IDs and apply offset
        const pastedHumbugs = this.clipboard.map((humbug) => ({
            ...humbug,
            id: `humbug-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 9)}`,
            position: {
                x: humbug.position.x + offsetX,
                y: humbug.position.y + offsetY,
            },
        }))

        // If it was a cut operation, clear clipboard after paste
        if (this.isCutOperation) {
            this.clear()
        }

        return pastedHumbugs
    }

    // Check if clipboard has content
    hasContent(): boolean {
        return this.clipboard.length > 0
    }

    // Check if last operation was cut
    wasCutOperation(): boolean {
        return this.isCutOperation
    }

    // Clear clipboard
    clear() {
        this.clipboard = []
        this.isCutOperation = false
    }

    // Get clipboard content (for debugging)
    getClipboard(): Humbug[] {
        return [...this.clipboard]
    }
}
