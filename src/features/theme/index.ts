import { createElement } from "react"
import type { FeatureModule, HumbugMenuItem } from "../types"
import { setPref, prefsStore } from "../prefs"
import { updateHumbugs } from "../board-bridge"
import { ThemeLayer } from "./ThemeLayer"
import { CycleBadge } from "./CycleBadge"
import { ThemeHelp } from "./ThemeHelp"
import { SETTINGS_HOTKEY } from "./hotkeys"
import { CYCLES, canCycle, cycleOf, extWithCycle, type CycleId } from "./cycle"
import { AcidIcon, LavaIcon, MagicIcon, StillIcon, WaterIcon } from "./icons"
import { settingsOpenStore, toggleSettings } from "./theme-store"
import { THEMES } from "./themes"
import "./tokens.css"
import "./chrome.css"

/* Feature: theme — look and feel, Settings, global accessibility.
   See src/features/README.md */

export { THEMES, themeById, type ThemeInfo } from "./themes"

const CYCLE_ICONS: Record<CycleId, HumbugMenuItem["icon"]> = {
    water: WaterIcon,
    lava: LavaIcon,
    magic: MagicIcon,
    acid: AcidIcon,
}

/** Set (or clear) the colour cycle on a humbug: one undo step */
const setCycle = (cycle: CycleId | null) => (h: Parameters<HumbugMenuItem["run"]>[0]) =>
    updateHumbugs([{ id: h.id, changes: { ext: extWithCycle(h, cycle) } }])

const humbugMenu: HumbugMenuItem[] = [
    ...CYCLES.map((c) => ({
        id: `theme-cycle-${c.id}`,
        label: `Animate: ${c.label}`,
        icon: CYCLE_ICONS[c.id],
        when: (h: Parameters<HumbugMenuItem["run"]>[0]) => canCycle(h) && cycleOf(h) !== c.id,
        run: setCycle(c.id),
    })),
    {
        id: "theme-cycle-none",
        label: "Animate: None",
        icon: StillIcon,
        when: (h) => canCycle(h) && cycleOf(h) !== null,
        run: setCycle(null),
    },
]

const nextTheme = () => {
    const i = THEMES.findIndex((t) => t.id === prefsStore.get().theme)
    setPref("theme", THEMES[(i + 1) % THEMES.length].id)
}

export const feature: FeatureModule = {
    id: "theme",
    AppLayer: ThemeLayer,
    HumbugBadge: CycleBadge,
    tools: [
        {
            id: "theme-settings",
            label: "Settings",
            icon: "gear",
            hint: "Themes, interface size, motion, sound and accessibility",
            hotkey: SETTINGS_HOTKEY,
            group: "view",
            kind: "action",
            onTrigger: toggleSettings,
            pressed: settingsOpenStore,
        },
    ],
    commands: [
        {
            id: "theme-open-settings",
            label: "Open Settings",
            keywords: "preferences options accessibility theme sound motion",
            run: () => settingsOpenStore.set(true),
        },
        {
            id: "theme-next",
            label: "Next interface theme",
            keywords: "theme colours palette look",
            run: nextTheme,
        },
        {
            id: "theme-high-contrast",
            label: "Toggle high contrast",
            keywords: "accessibility contrast borders",
            run: () => setPref("highContrast", !prefsStore.get().highContrast),
        },
        {
            id: "theme-readable-font",
            label: "Toggle readable font",
            keywords: "accessibility font dyslexia pixel",
            run: () => setPref("readableFont", !prefsStore.get().readableFont),
        },
        {
            id: "theme-crt",
            label: "Toggle CRT effect",
            keywords: "scanlines retro monitor",
            run: () => setPref("crt", !prefsStore.get().crt),
        },
    ],
    humbugMenu,
    help: [
        {
            id: "theme-settings",
            title: "Themes & accessibility",
            icon: "gear",
            body: createElement(ThemeHelp),
        },
    ],
}
