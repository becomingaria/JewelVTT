import { createElement } from "react"
import type { FeatureModule, HumbugMenuItem } from "../types"
import { DARK_TOOL_ID, FEATURE_ID, FOG_KINDS, FOG_TOOL_ID, LIGHT_KINDS, WALLS_TOOL_ID } from "./ids"
import { coverBoard, revealEverything, setFogEnabled, toggleFog } from "./fog-store"
import { DARKNESS_LABEL, LIGHT_PRESETS, applyLight, cycleDarkness, darkPressed, darknessStore } from "./light-store"
import { FogLightLayer } from "./FogLightLayer"
import { FogLightOverlays } from "./FogLightOverlays"
import { LightBadge } from "./LightBadge"
import { FogHelp, LightHelp } from "./help"
import { VISION_PRESETS, applyVision, visionFeet } from "./vision"
import { blocksSight, setBlocksSight } from "./sight"
import {
    CandleIcon,
    DarknessIcon,
    FlameIcon,
    FogIcon,
    LanternIcon,
    NoLightIcon,
    SparkleIcon,
    WallIcon,
} from "./icons"

/* Feature: fog-light (dithered fog of war + torchlight) — see src/features/README.md */

const PRESET_ICONS = {
    torch: FlameIcon,
    lantern: LanternIcon,
    candle: CandleIcon,
    magic: SparkleIcon,
}

/** Maps are terrain; lights go on tokens, pins, notes and objects */
const canCarryLight = (h: { type: string }) => h.type !== "map"

const lightMenu: HumbugMenuItem[] = [
    ...LIGHT_PRESETS.map(
        (p): HumbugMenuItem => ({
            id: `${FEATURE_ID}:light-${p.id}`,
            label: `Light: ${p.label}`,
            icon: createElement(PRESET_ICONS[p.id]),
            when: canCarryLight,
            run: (h) => applyLight(h, p.light),
        })
    ),
    {
        id: `${FEATURE_ID}:light-none`,
        label: "Light: None",
        icon: createElement(NoLightIcon),
        when: (h) => !!h.light,
        run: (h) => applyLight(h, undefined),
    },
    // Vision: how far a token sees through the fog (shared with the party)
    ...VISION_PRESETS.map(
        (p): HumbugMenuItem => ({
            id: `${FEATURE_ID}:vision-${p.feet}`,
            label: `Vision: ${p.label}`,
            icon: "eye",
            when: (h) => h.type === "token" && visionFeet(h) !== p.feet,
            run: (h) => applyVision(h, p.feet),
        })
    ),
    // Line of sight: walls, pillars, closed doors... (switch per object)
    {
        id: `${FEATURE_ID}:blocks-sight-on`,
        label: "Block sight",
        icon: "eye-off",
        when: (h) => h.type !== "map" && !blocksSight(h),
        run: (h) => setBlocksSight(h, true),
    },
    {
        id: `${FEATURE_ID}:blocks-sight-off`,
        label: "Let sight through",
        icon: "eye",
        when: (h) => blocksSight(h),
        run: (h) => setBlocksSight(h, false),
    },
]

export const feature: FeatureModule = {
    id: FEATURE_ID,
    AppLayer: FogLightLayer,
    // Darkness (the README's "light 20") then fog (30), as one overlay: the
    // host mounts one per feature and nothing else sits between 20 and 30
    BoardOverlay: FogLightOverlays,
    overlayZ: 30,
    HumbugBadge: LightBadge,
    tools: [
        {
            id: FOG_TOOL_ID,
            label: "Fog brush",
            icon: createElement(FogIcon),
            hint: "Drag to reveal; Alt-drag to hide",
            hotkey: { key: "g" },
            mapKinds: FOG_KINDS,
            group: "play",
            kind: "mode",
        },
        {
            id: WALLS_TOOL_ID,
            label: "Sight walls",
            icon: createElement(WallIcon),
            hint: "Draw walls on a map picture that block sight and light",
            hotkey: { key: "b", shift: true },
            mapKinds: FOG_KINDS,
            group: "play",
            kind: "mode",
        },
        {
            id: DARK_TOOL_ID,
            // Read on each dock render, so it names the current state
            get label() {
                return `Scene light: ${DARKNESS_LABEL[darknessStore.get()]}`
            },
            icon: createElement(DarknessIcon),
            hint: "Cycle Daylight, Dim and Dark",
            mapKinds: LIGHT_KINDS,
            group: "play",
            kind: "action",
            onTrigger: cycleDarkness,
            pressed: darkPressed,
        },
    ],
    commands: [
        {
            id: `${FEATURE_ID}:cover`,
            label: "Cover board with fog",
            keywords: "fog of war hide all cover",
            mapKinds: FOG_KINDS,
            run: coverBoard,
        },
        {
            id: `${FEATURE_ID}:reveal-all`,
            label: "Reveal everything",
            keywords: "fog of war clear uncover",
            mapKinds: FOG_KINDS,
            run: revealEverything,
        },
        {
            id: `${FEATURE_ID}:off`,
            label: "Turn fog off",
            keywords: "fog of war disable remove",
            mapKinds: FOG_KINDS,
            run: () => setFogEnabled(false),
        },
        {
            id: `${FEATURE_ID}:toggle`,
            label: "Toggle fog on this board",
            keywords: "fog of war on off show hide",
            hotkey: { key: "g", shift: true },
            mapKinds: FOG_KINDS,
            run: toggleFog,
        },
        {
            id: `${FEATURE_ID}:darkness`,
            label: "Cycle scene light (Daylight / Dim / Dark)",
            keywords: "darkness night torch light dim dark daylight",
            mapKinds: LIGHT_KINDS,
            run: cycleDarkness,
        },
    ],
    humbugMenu: lightMenu,
    help: [
        { id: `${FEATURE_ID}:fog`, title: "Fog of war", icon: "eye-off", body: createElement(FogHelp) },
        { id: `${FEATURE_ID}:light`, title: "Darkness & light", icon: "eye", body: createElement(LightHelp) },
    ],
}
