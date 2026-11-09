import { createElement } from "react"
import type { FeatureModule } from "../types"
import { TrackerLayer } from "./TrackerLayer"
import { TrackerBadge } from "./TrackerBadge"
import { CharactersHelp, DungeonTurnsHelp, HitPointsHelp, InitiativeHelp } from "./help"
import { AddInitiativeIcon, HeartIcon, InitiativeIcon, NewCharacterIcon, SwirlIcon } from "./icons"
import { chargenOpenStore, popoverStore, stripOpenStore } from "./state"
import {
    addAllToInitiative,
    addSelectedToInitiative,
    addToInitiative,
    advanceDungeonTurn,
    clearInitiative,
    flyToActive,
    isInInitiative,
    isToken,
    nextTurn,
    removeFromInitiative,
    rollInitiative,
    toggleStrip,
} from "./actions"

/*
 * Feature: tracker. Initiative (side or individual), hit points and
 * conditions on tokens, dungeon turns, and a character generator.
 * See src/features/README.md.
 */
export const feature: FeatureModule = {
    id: "tracker",
    AppLayer: TrackerLayer,
    HumbugBadge: TrackerBadge,
    tools: [
        {
            id: "tracker:initiative",
            label: "Initiative",
            icon: createElement(InitiativeIcon),
            hint: "Turn order along the top of the board",
            hotkey: { key: "u" },
            group: "play",
            kind: "action",
            onTrigger: toggleStrip,
            pressed: stripOpenStore,
        },
        {
            id: "tracker:new-character",
            label: "New character",
            icon: createElement(NewCharacterIcon),
            hint: "Roll up a first-level adventurer",
            group: "play",
            kind: "action",
            onTrigger: () => chargenOpenStore.set(true),
        },
    ],
    commands: [
        {
            id: "tracker:add-selected",
            label: "Add selected tokens to initiative",
            keywords: "combat turn order",
            hotkey: { key: "u", shift: true },
            run: addSelectedToInitiative,
        },
        {
            id: "tracker:next-turn",
            label: "Next turn",
            keywords: "initiative combat round",
            hotkey: { key: "n" },
            run: nextTurn,
        },
        {
            id: "tracker:dungeon-turn",
            label: "Advance dungeon turn",
            keywords: "exploration time torch wandering monster",
            hotkey: { key: "n", shift: true },
            mapKinds: ["dungeon"],
            run: advanceDungeonTurn,
        },
        { id: "tracker:add-all", label: "Add all tokens to initiative", keywords: "combat", run: addAllToInitiative },
        { id: "tracker:roll", label: "Roll initiative", keywords: "combat d6 d20 side", run: rollInitiative },
        { id: "tracker:fly-active", label: "Fly to whoever has the turn", keywords: "initiative", run: flyToActive },
        { id: "tracker:clear", label: "Clear initiative", keywords: "combat end", run: clearInitiative },
        {
            id: "tracker:new-character-command",
            label: "New character…",
            keywords: "chargen roll stats 3d6 class adventurer",
            run: () => chargenOpenStore.set(true),
        },
    ],
    humbugMenu: [
        {
            id: "tracker:add",
            label: "Add to initiative",
            icon: createElement(AddInitiativeIcon),
            when: (h) => isToken(h) && !isInInitiative(h.id),
            run: (h) => addToInitiative([h.id]),
        },
        {
            id: "tracker:remove",
            label: "Remove from initiative",
            icon: createElement(InitiativeIcon),
            when: (h) => isToken(h) && isInInitiative(h.id),
            run: (h) => removeFromInitiative(h.id),
        },
        {
            id: "tracker:hp",
            label: "Hit points…",
            icon: createElement(HeartIcon),
            when: isToken,
            run: (h) => popoverStore.set({ kind: "hp", id: h.id }),
        },
        {
            id: "tracker:conditions",
            label: "Conditions…",
            icon: createElement(SwirlIcon),
            when: isToken,
            run: (h) => popoverStore.set({ kind: "conditions", id: h.id }),
        },
    ],
    help: [
        { id: "tracker-initiative", title: "Initiative", icon: "flag", body: createElement(InitiativeHelp) },
        { id: "tracker-hp", title: "Hit points & conditions", icon: "token", body: createElement(HitPointsHelp) },
        { id: "tracker-dungeon-turns", title: "Dungeon turns", icon: "map", body: createElement(DungeonTurnsHelp) },
        { id: "tracker-characters", title: "New characters", icon: "token", body: createElement(CharactersHelp) },
    ],
}
