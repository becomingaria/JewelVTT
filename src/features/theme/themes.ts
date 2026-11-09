/*
 * The interface themes. The colours live in tokens.css
 * (html[data-theme="<id>"]); the swatches here only draw the small previews
 * in the Settings panel, so keep them in step with tokens.css.
 */

export interface ThemeInfo {
    id: string
    label: string
    description: string
    /** Preview colours: window, title bar, text, accent, outline */
    preview: { panel: string; title: string; titleFg: string; fg: string; accent: string; border: string }
}

export const THEMES: ThemeInfo[] = [
    {
        id: "default",
        label: "Adventurer",
        description: "Warm grey windows with bevelled edges, purple title bars and a gold focus ring.",
        preview: { panel: "#d8d2c5", title: "#4b1f99", titleFg: "#ffffff", fg: "#1c1622", accent: "#6c2fcf", border: "#2a2133" },
    },
    {
        id: "ega",
        label: "16 colours",
        description: "Bright white windows, blue title bars and cyan wells from a sixteen-colour palette.",
        preview: { panel: "#ffffff", title: "#0000aa", titleFg: "#ffff55", fg: "#000000", accent: "#55ffff", border: "#000000" },
    },
    {
        id: "amber",
        label: "Amber terminal",
        description: "Glowing amber on black, like an old monochrome monitor. Easy on the eyes in a dark room.",
        preview: { panel: "#1a1206", title: "#ffb641", titleFg: "#1a1206", fg: "#ffb641", accent: "#ffd27a", border: "#c98a22" },
    },
    {
        id: "parchment",
        label: "Parchment",
        description: "Sepia paper and dark ink, with rubric-red highlights.",
        preview: { panel: "#ecdcb9", title: "#3a2610", titleFg: "#f6e6be", fg: "#2a1a0b", accent: "#7b2d12", border: "#3a2610" },
    },
    {
        id: "night",
        label: "Night",
        description: "A calm, dark slate theme with soft violet accents.",
        preview: { panel: "#1f2333", title: "#2b2552", titleFg: "#ece6ff", fg: "#e7e9f2", accent: "#7454dc", border: "#6b7496" },
    },
]

export const themeById = (id: string): ThemeInfo => THEMES.find((t) => t.id === id) ?? THEMES[0]
