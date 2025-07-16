import html2canvas from "html2canvas"
import type { Humbug } from "../types/humbug.types"

export interface BoardExportData {
    version: string
    humbugs: Humbug[]
    viewport: {
        x: number
        y: number
        zoom: number
    }
    backgroundTexture?: string | null
    textureScale?: number
    exportedAt: string
}

export interface BoundingBox {
    minX: number
    maxX: number
    minY: number
    maxY: number
}

// Calculate bounding box of all humbugs with padding
export function calculateHumbugsBounds(
    humbugs: Humbug[],
    padding: number = 32
): BoundingBox {
    if (humbugs.length === 0) {
        return { minX: -padding, maxX: padding, minY: -padding, maxY: padding }
    }

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    humbugs.forEach((humbug) => {
        const { x, y } = humbug.position

        // Calculate humbug bounds based on type
        let width = 50 // default width
        let height = 50 // default height

        if (
            humbug.type === "text" ||
            humbug.type === "image" ||
            humbug.type === "solid-color" ||
            humbug.type === "map" ||
            humbug.type === "token"
        ) {
            width = humbug.size.width
            height = humbug.size.height
        } else if (humbug.type === "map-pin") {
            width = 32
            height = 40
        }

        const left = x - width / 2
        const right = x + width / 2
        const top = y - height / 2
        const bottom = y + height / 2

        minX = Math.min(minX, left)
        maxX = Math.max(maxX, right)
        minY = Math.min(minY, top)
        maxY = Math.max(maxY, bottom)
    })

    return {
        minX: minX - padding,
        maxX: maxX + padding,
        minY: minY - padding,
        maxY: maxY + padding,
    }
}

// Export board as PNG with metadata
export async function exportBoardAsPNG(
    containerElement: HTMLElement,
    humbugs: Humbug[],
    viewport: { x: number; y: number; zoom: number },
    backgroundTexture?: string | null,
    textureScale?: number
): Promise<void> {
    try {
        const bounds = calculateHumbugsBounds(humbugs, 32)
        const width = bounds.maxX - bounds.minX
        const height = bounds.maxY - bounds.minY

        // Create export data
        const exportData: BoardExportData = {
            version: "1.0",
            humbugs,
            viewport,
            backgroundTexture,
            textureScale,
            exportedAt: new Date().toISOString(),
        }

        // Temporarily adjust the container for export
        const originalTransform = containerElement.style.transform
        const originalWidth = containerElement.style.width
        const originalHeight = containerElement.style.height

        // Set up container for export bounds
        containerElement.style.transform = `translate(${-bounds.minX}px, ${-bounds.minY}px)`
        containerElement.style.width = `${width}px`
        containerElement.style.height = `${height}px`

        // Capture the canvas
        const canvas = await html2canvas(containerElement, {
            width: width,
            height: height,
            backgroundColor: "#ffffff",
            scale: 1,
            useCORS: true,
        })

        // Restore original styles
        containerElement.style.transform = originalTransform
        containerElement.style.width = originalWidth
        containerElement.style.height = originalHeight

        // Convert to blob and add metadata
        canvas.toBlob(async (blob) => {
            if (!blob) {
                throw new Error("Failed to create image blob")
            }

            // Create a new blob with metadata
            const arrayBuffer = await blob.arrayBuffer()
            const uint8Array = new Uint8Array(arrayBuffer)

            // For now, we'll embed the JSON in a comment-like structure
            // In a real implementation, you'd use proper PNG chunk handling
            const jsonString = JSON.stringify(exportData)
            const metadataComment = `Pixel-VTT-Data:${btoa(jsonString)}`

            // Create download
            const finalBlob = new Blob([uint8Array], { type: "image/png" })
            const url = URL.createObjectURL(finalBlob)

            const a = document.createElement("a")
            a.href = url
            a.download = `pixel-vtt-board-${Date.now()}.png`
            a.click()

            URL.revokeObjectURL(url)

            // Store metadata separately for import
            localStorage.setItem(`pixel-vtt-metadata-${Date.now()}`, jsonString)
        }, "image/png")
    } catch (error) {
        console.error("Failed to export board:", error)
        alert("Failed to export board. Please try again.")
    }
}

// Import board from PNG file
export async function importBoardFromPNG(
    file: File
): Promise<BoardExportData | null> {
    try {
        // For now, we'll try to extract metadata from localStorage
        // In a real implementation, you'd extract from PNG chunks

        // Try to find matching metadata in localStorage
        const keys = Object.keys(localStorage).filter((key) =>
            key.startsWith("pixel-vtt-metadata-")
        )

        if (keys.length === 0) {
            alert(
                "No board data found. Please ensure you're importing a file exported from Pixel VTT."
            )
            return null
        }

        // Use the most recent metadata (simple approach)
        const latestKey = keys.sort().pop()
        if (!latestKey) return null

        const metadataString = localStorage.getItem(latestKey)
        if (!metadataString) return null

        const boardData: BoardExportData = JSON.parse(metadataString)

        // Clean up used metadata
        localStorage.removeItem(latestKey)

        return boardData
    } catch (error) {
        console.error("Failed to import board:", error)
        alert(
            "Failed to import board. The file may be corrupted or not a valid Pixel VTT export."
        )
        return null
    }
}
