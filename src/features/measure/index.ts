import type { Humbug } from "../../types/humbug.types"
import type { FeatureModule, HumbugMenuItem } from "../types"
import type { MapKind } from "../map-kind"
import { clearAllTemplates, setTokenSize } from "./actions"
import { currentSizeCategory, SIZE_CATEGORIES } from "./geometry"
import { MEASURE_HELP } from "./help"
import { RulerIcon, SizeCheckedIcon, SizeIcon, SpeedIcon, TemplateIcon } from "./icons"
import { MeasureLayer } from "./MeasureLayer"
import { MeasureOverlay } from "./MeasureOverlay"
import { RULER_TOOL, speedPopoverStore, TEMPLATE_TOOL } from "./state"

/*
 * Feature: measure. Ruler (L), area templates (Shift+L, Q clears) and
 * token size categories. See src/features/README.md.
 */

const PLAY_KINDS: MapKind[] = ["freeform", "dungeon", "hexcrawl"]

const sizeOf = (h: Humbug) => (h.type === "token" ? currentSizeCategory(h.sizeCategory, h.size) : null)

/**
 * Two entries per size: the plain one, and a ticked one shown for the
 * token's current size (menu items have no checked state of their own).
 */
const sizeItems: HumbugMenuItem[] = SIZE_CATEGORIES.flatMap((cat) => [
    {
        id: `measure:size-${cat.id}`,
        label: `Size: ${cat.label}`,
        icon: SizeIcon,
        when: (h: Humbug) => h.type === "token" && sizeOf(h) !== cat.id,
        run: (h: Humbug) => setTokenSize(h, cat.id),
    },
    {
        id: `measure:size-${cat.id}-current`,
        label: `Size: ${cat.label} ✓`,
        icon: SizeCheckedIcon,
        when: (h: Humbug) => h.type === "token" && sizeOf(h) === cat.id,
        // Re-applying fixes a footprint that drifted from the category
        run: (h: Humbug) => setTokenSize(h, cat.id),
    },
])

export const feature: FeatureModule = {
    id: "measure",
    AppLayer: MeasureLayer,
    BoardOverlay: MeasureOverlay,
    overlayZ: 50,
    tools: [
        {
            id: RULER_TOOL,
            label: "Measure",
            icon: RulerIcon,
            hint: "Drag to measure; click for waypoints",
            hotkey: { key: "l" },
            mapKinds: PLAY_KINDS,
            group: "play",
            kind: "mode",
        },
        {
            id: TEMPLATE_TOOL,
            label: "Area templates",
            icon: TemplateIcon,
            hint: "Cones, lines, bursts and squares",
            hotkey: { key: "l", shift: true },
            mapKinds: PLAY_KINDS,
            group: "play",
            kind: "mode",
        },
    ],
    commands: [
        {
            id: "measure:clear-templates",
            label: "Clear all templates",
            keywords: "area template cone burst remove delete",
            hotkey: { key: "q" },
            mapKinds: PLAY_KINDS,
            run: clearAllTemplates,
        },
    ],
    humbugMenu: [
        {
            id: "measure:speed",
            label: "Movement rate…",
            icon: SpeedIcon,
            when: (h) => h.type === "token",
            run: (h) => speedPopoverStore.set({ tokenId: h.id }),
        },
        ...sizeItems,
    ],
    help: MEASURE_HELP,
}
