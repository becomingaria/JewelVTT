import type React from "react"
import type { IconName } from "../../components/Icon"
import type { HumbugMenuItem } from "../types"
import { playSfx, type SfxName } from "../sound"
import { dungeonExt, setStampState } from "./humbugs"
import { barIcon, doorIcon, doorOpenIcon, gateIcon, trapIcon } from "./icons"
import type { StatefulStampId, StampState } from "./model"

/*
 * Right-click entries that change a stamp's state. Each change swaps the
 * sprite (and the layer, for hidden things) in one undoable update.
 */

function stateItem(
    id: string,
    label: string,
    icon: IconName | React.ReactElement,
    stamp: StatefulStampId,
    from: StampState[],
    to: StampState,
    sfx: SfxName
): HumbugMenuItem {
    return {
        id: `dungeon-${id}`,
        label,
        icon,
        when: (h) => {
            const d = dungeonExt(h)
            return !!d && d.stamp === stamp && !!d.state && from.includes(d.state)
        },
        run: (h) => {
            setStampState(h, to)
            playSfx(sfx)
        },
    }
}

export const HUMBUG_MENU: HumbugMenuItem[] = [
    stateItem("door-open", "Open door", doorOpenIcon, "door", ["closed"], "open", "door"),
    stateItem("door-close", "Close door", doorIcon, "door", ["open"], "closed", "door"),
    stateItem("door-lock", "Lock door", "lock", "door", ["closed"], "locked", "door"),
    stateItem("door-unlock", "Unlock door", "unlock", "door", ["locked"], "closed", "door"),
    stateItem("door-bar", "Bar door", barIcon, "door", ["closed"], "barred", "door"),
    stateItem("door-unbar", "Remove bar", doorIcon, "door", ["barred"], "closed", "door"),
    stateItem("door-lower", "Lower portcullis", gateIcon, "door", ["open"], "portcullis", "door"),
    stateItem("door-raise", "Raise portcullis", doorOpenIcon, "door", ["portcullis"], "open", "door"),
    stateItem("secret-reveal", "Reveal secret door", "eye", "secret", ["hidden"], "found", "reveal"),
    stateItem("secret-hide", "Hide secret door", "eye-off", "secret", ["found"], "hidden", "ui"),
    stateItem("trap-reveal", "Reveal trap", "eye", "trap", ["hidden"], "armed", "reveal"),
    stateItem("trap-spring", "Spring trap", trapIcon, "trap", ["hidden", "armed"], "sprung", "alert"),
    stateItem("trap-reset", "Reset trap", trapIcon, "trap", ["sprung"], "armed", "ui"),
    stateItem("trap-hide", "Hide trap", "eye-off", "trap", ["armed"], "hidden", "ui"),
]
