/*
 * A simple generated portrait for characters made without a picture: a
 * dithered class-coloured tile with a pixel bust and the name's initial.
 */

const PALETTE: Record<string, [bg: string, fg: string]> = {
    fighter: ["#7a2626", "#e2b04a"],
    cleric: ["#24477a", "#ece4c4"],
    "magic-user": ["#45267a", "#9fd4ff"],
    thief: ["#2a2a33", "#a8d08f"],
    dwarf: ["#6a4626", "#e6b878"],
    elf: ["#24663f", "#e4f2a4"],
    halfling: ["#82552a", "#f4d6a6"],
}

export function defaultPortrait(classId: string, name: string, classLabel: string): string {
    const [bg, fg] = PALETTE[classId] ?? ["#3a3a4a", "#e0e0e8"]
    const first = (name.trim()[0] ?? "").toUpperCase()
    const letter = /^[A-Z0-9]$/.test(first) ? first : (classLabel[0] ?? "?").toUpperCase()
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
<defs><pattern id="d" width="2" height="2" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="${fg}" opacity=".28"/></pattern></defs>
<rect width="32" height="32" fill="${bg}"/>
<rect y="16" width="32" height="16" fill="url(#d)"/>
<rect x="12" y="6" width="8" height="9" fill="#14141c"/>
<rect x="13" y="7" width="6" height="7" fill="${fg}"/>
<rect x="8" y="16" width="16" height="10" fill="#14141c"/>
<rect x="9" y="17" width="14" height="9" fill="${fg}"/>
<rect x="20" y="22" width="10" height="9" fill="#14141c"/>
<text x="25" y="30" font-family="monospace" font-weight="bold" font-size="9" text-anchor="middle" fill="#fff">${letter}</text>
</svg>`
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
