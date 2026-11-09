import type { CommandDef, FeatureModule } from "../types"
import { MAP_KINDS, mapKindStore } from "../map-kind"
import { LAYERS, layerOf } from "../view-state"
import {
    applyMapDefaults,
    changeMapKind,
    groupSelection,
    moveToLayer,
    openAlignBar,
    runAlign,
    snapSelectionToGrid,
    toggleMenuStyle,
    ungroupSelection,
} from "./actions"
import type { AlignOp } from "./align"
import { WORKFLOW_HELP } from "./help"
import { layersOpenStore, toggleLayersPanel, togglePalette } from "./state"
import { WorkflowLayer } from "./WorkflowLayer"

/*
 * Feature: workflow. See src/features/README.md.
 *
 * Layers panel (#22), group / align / distribute (#23), command palette
 * (#26), radial right-click menu (#27), and changing the board's map type.
 * Hotkeys: ⌘K palette, ⌘G group, ⌘⇧G ungroup, Shift+A align bar.
 */

const ALIGN_COMMANDS: { op: AlignOp; label: string }[] = [
    { op: "left", label: "Align left edges" },
    { op: "centre", label: "Align centres horizontally" },
    { op: "right", label: "Align right edges" },
    { op: "top", label: "Align top edges" },
    { op: "middle", label: "Align middles vertically" },
    { op: "bottom", label: "Align bottom edges" },
    { op: "distribute-h", label: "Distribute horizontally" },
    { op: "distribute-v", label: "Distribute vertically" },
]

const ALL_KINDS = MAP_KINDS.map((k) => k.id)

const MAP_KIND_COMMANDS: CommandDef[] = MAP_KINDS.flatMap((k) => {
    const others = ALL_KINDS.filter((id) => id !== k.id)
    return [
        {
            id: `workflow.kind.${k.id}`,
            label: `Change map type: ${k.label}`,
            keywords: `board kind ${k.description}`,
            mapKinds: others,
            run: () => changeMapKind(k.id),
        },
        {
            id: `workflow.kind-defaults.${k.id}`,
            label: `Change map type: ${k.label}, with its grid & style`,
            keywords: `board kind defaults ${k.description}`,
            mapKinds: others,
            run: () => changeMapKind(k.id, { applyDefaults: true }),
        },
    ]
})

export const feature: FeatureModule = {
    id: "workflow",
    AppLayer: WorkflowLayer,
    tools: [
        {
            id: "workflow.layers",
            label: "Layers",
            icon: "layers",
            hint: "Show, hide and lock layers; map type",
            group: "view",
            kind: "action",
            onTrigger: toggleLayersPanel,
            pressed: layersOpenStore,
        },
    ],
    commands: [
        {
            id: "workflow.palette",
            label: "Command palette",
            hotkey: { key: "k", mod: true },
            run: togglePalette,
        },
        {
            id: "workflow.group",
            label: "Group selection",
            keywords: "combine join bundle",
            hotkey: { key: "g", mod: true },
            run: groupSelection,
        },
        {
            id: "workflow.ungroup",
            label: "Ungroup selection",
            keywords: "split separate break apart",
            hotkey: { key: "g", mod: true, shift: true },
            run: ungroupSelection,
        },
        {
            id: "workflow.align",
            label: "Align bar",
            keywords: "align distribute line up arrange tidy snap",
            hotkey: { key: "a", shift: true },
            run: openAlignBar,
        },
        ...ALIGN_COMMANDS.map(
            (a): CommandDef => ({
                id: `workflow.align.${a.op}`,
                label: a.label,
                keywords: "align arrange line up",
                run: () => runAlign(a.op),
            })
        ),
        {
            id: "workflow.snap",
            label: "Snap selection to grid",
            keywords: "align tidy",
            run: snapSelectionToGrid,
        },
        {
            id: "workflow.layers-panel",
            label: "Layers panel",
            keywords: "show hide lock gm only map objects tokens",
            run: toggleLayersPanel,
        },
        {
            id: "workflow.menu-style",
            label: "Right-click menu: switch Radial / List",
            keywords: "context menu ring pie wheel",
            run: toggleMenuStyle,
        },
        ...MAP_KIND_COMMANDS,
        {
            id: "workflow.apply-defaults",
            label: "Use this map type's grid & style",
            keywords: "map kind defaults reset board style",
            run: () => applyMapDefaults(mapKindStore.get()),
        },
    ],
    humbugMenu: LAYERS.map((l) => ({
        id: `workflow.layer.${l.id}`,
        label: `Move to layer: ${l.label}`,
        icon: "layers",
        when: (h) => layerOf(h) !== l.id,
        run: (h) => moveToLayer(h, l.id),
    })),
    help: WORKFLOW_HELP,
}
