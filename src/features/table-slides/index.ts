import type { FeatureModule } from "../types"
import type { Store } from "../store"
import { cameraStore } from "../board-bridge"
import { tableModeStore } from "../view-state"
import { TableSlidesLayer } from "./AppLayer"
import { FramesUnderlay } from "./FramesUnderlay"
import { FramesOverlay } from "./FramesOverlay"
import { FrameIcon, PresentIcon, ShapesIcon, TableModeIcon } from "./icons"
import { HELP } from "./help"
import {
    addFrameFromView,
    FRAME_TOOL_ID,
    pickerStore,
    presentStore,
    toggleFramesPanel,
    toggleTableMode,
    togglePresenting,
} from "./state"
import "./table-slides.css"

/* Feature: table-slides (Table Mode, slide frames and presenting, flowcharts).
   See src/features/README.md */

/** Read-only boolean view of another store (for the dock's aria-pressed) */
function derived<T>(source: Store<T>, pick: (v: T) => boolean): Store<boolean> {
    return { get: () => pick(source.get()), set: () => {}, subscribe: source.subscribe }
}

const presentingStore = derived(presentStore, (s) => !!s)
const paletteOpenStore = derived(pickerStore, (p) => p?.mode === "place")

const togglePalette = () => pickerStore.set((p) => (p?.mode === "place" ? null : { mode: "place" }))

export const feature: FeatureModule = {
    id: "table-slides",
    AppLayer: TableSlidesLayer,
    BoardUnderlay: FramesUnderlay,
    underlayZ: 15,
    BoardOverlay: FramesOverlay,
    overlayZ: 45,
    tools: [
        {
            id: FRAME_TOOL_ID,
            label: "Frame",
            icon: FrameIcon,
            hint: "Drag to mark a slide frame",
            hotkey: { key: "o" },
            mapKinds: ["slides", "freeform"],
            group: "build",
            kind: "mode",
        },
        {
            id: "table-slides:shapes",
            label: "Flowchart shapes",
            icon: ShapesIcon,
            hint: "Add a process, decision, start/end... box",
            mapKinds: ["slides", "freeform"],
            group: "build",
            kind: "action",
            onTrigger: togglePalette,
            pressed: paletteOpenStore,
        },
        {
            id: "table-slides:table-mode",
            label: "Table Mode",
            icon: TableModeIcon,
            hint: "Players' view: hide GM notes and editing chrome",
            hotkey: { key: "t", shift: true },
            group: "view",
            kind: "action",
            onTrigger: toggleTableMode,
            pressed: tableModeStore,
        },
        {
            id: "table-slides:present",
            label: "Present",
            icon: PresentIcon,
            hint: "Step through the frames like slides",
            hotkey: { key: "p", shift: true },
            group: "view",
            kind: "action",
            onTrigger: togglePresenting,
            pressed: presentingStore,
        },
    ],
    commands: [
        {
            id: "table-slides:cmd-table-mode",
            label: "Table Mode (players' view)",
            keywords: "player view screen hide gm toggle shift+t",
            run: toggleTableMode,
        },
        {
            id: "table-slides:cmd-present",
            label: "Present frames",
            keywords: "slides slideshow presentation shift+p",
            run: togglePresenting,
        },
        {
            id: "table-slides:cmd-frames-panel",
            label: "Frames panel",
            keywords: "slides frames list order rename",
            run: toggleFramesPanel,
        },
        {
            id: "table-slides:cmd-add-frame",
            label: "Add frame from current view",
            keywords: "slide frame new",
            run: () => void addFrameFromView(),
        },
        {
            id: "table-slides:cmd-shapes",
            label: "Flowchart shapes",
            keywords: "flowchart diagram process decision box",
            mapKinds: ["slides", "freeform"],
            run: togglePalette,
        },
    ],
    humbugMenu: [
        {
            id: "table-slides:shape",
            label: "Shape ▸ …",
            icon: ShapesIcon,
            when: (h) => h.type === "text",
            run: (h) => {
                const cam = cameraStore.get()
                const el = cam?.container
                const r = el?.getBoundingClientRect()
                const w = h.type === "text" ? h.size.width : 0
                const p = cam && r ? cam.worldToScreen(h.position.x + w, h.position.y) : { x: 0, y: 0 }
                pickerStore.set({
                    mode: "change",
                    humbugId: h.id,
                    at: { x: (r?.left ?? 0) + p.x + 12, y: (r?.top ?? 0) + p.y },
                })
            },
        },
    ],
    help: HELP,
    mapKindDefaults: { slides: { boardStyle: "blank", showGrid: false } },
}
