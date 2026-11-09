/** Offer a text file to the viewer as a download */
export function downloadText(filename: string, text: string, mime: string) {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.rel = "noopener"
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** "2026-11-09" in local time, for file names */
export function dateStamp(d = new Date()): string {
    const p = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
