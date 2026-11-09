import { Icon } from "../../components/Icon"
import { MOD } from "../../utils/hotkeys"
import type { HelpSection } from "../types"

/* How-to guide sections for the workflow feature */

/** Keycap (plain function, not a component: this file exports data) */
const key = (k: string) => <kbd className="how-to-kbd">{k}</kbd>
const MOD_NAME = MOD.replace("+", "")

export const WORKFLOW_HELP: HelpSection[] = [
    {
        id: "workflow-layers",
        title: "Layers",
        icon: "layers",
        body: (
            <>
                <p>
                    Everything on the board sits on one of four layers:{" "}
                    <strong>Map</strong>, <strong>Objects</strong>,{" "}
                    <strong>Tokens</strong> and <strong>GM only</strong>. Open the{" "}
                    <Icon name='layers' size={16} /> <em>Layers</em> button in the
                    tool dock to see how many objects each one holds.
                </p>
                <p>
                    The <Icon name='eye' size={16} /> eye hides or shows a layer; the{" "}
                    <Icon name='lock' size={16} /> lock stops anything on it from being
                    picked up, so you can lock the map and drag tokens over it freely.
                    Hidden and locked objects are skipped by the selection box,{" "}
                    {key(`${MOD}A`)}, copy and the arrow keys. Layer settings are saved
                    with the board, and both toggles can be undone.
                </p>
                <p>
                    Right-click an object and choose <em>Move to layer</em> to change
                    its layer. <strong>GM only</strong> objects disappear in Table Mode.
                </p>
                <p>
                    The panel also sets the board's <strong>map type</strong> (freeform,
                    dungeon, hex crawl, slides), which decides the tools in the dock. It
                    offers to switch the grid and board style to match.
                </p>
            </>
        ),
    },
    {
        id: "workflow-group-align",
        title: "Grouping & aligning",
        icon: "select",
        body: (
            <>
                <p>
                    Select several objects (drag a box, or {key(MOD_NAME)}-click) and
                    press {key(`${MOD}G`)} to <strong>group</strong> them. Clicking
                    any member then picks up the whole group, and dragging moves it
                    together. {key(MOD_NAME)}-click still picks out a single member.{" "}
                    {key(`${MOD}Shift+G`)} ungroups.
                </p>
                <p>
                    With two or more selected, press {key("Shift+A")} for the{" "}
                    <strong>align bar</strong>: line up left edges, centres, right
                    edges, tops, middles or bottoms; spread three or more out with equal
                    gaps; or snap everything to the grid. Groups move as one piece.
                    Each button is a single undo step. Use {key("←")} {key("→")} to
                    move between buttons, and {key("Esc")} to close.
                </p>
            </>
        ),
    },
    {
        id: "workflow-palette",
        title: "Command palette",
        icon: "help",
        body: (
            <>
                <p>
                    Press {key(`${MOD}K`)} and start typing to find any command, tool
                    or object. A few letters are enough: <em>cmt</em> finds{" "}
                    <em>Change map type</em>, and a token's name flies the camera to it
                    and selects it.
                </p>
                <p>
                    {key("↑")} {key("↓")} move, {key("Enter")} runs,{" "}
                    {key("Esc")} closes. Shortcuts are shown next to each result, and
                    the commands you used last are listed first.
                </p>
            </>
        ),
    },
    {
        id: "workflow-radial",
        title: "Radial menu",
        icon: "select",
        body: (
            <>
                <p>
                    Right-clicking an object opens a <strong>ring of actions</strong>{" "}
                    around the pointer: edit, lock, bring to front, send to back,
                    delete, plus extras from other tools. If they don't all fit,{" "}
                    <em>More…</em> opens the full list.
                </p>
                <p>
                    From the keyboard, focus starts on the first action. Arrows or{" "}
                    {key("Tab")} go round the ring, {key("Enter")} picks, and{" "}
                    {key("Esc")} closes.
                </p>
                <p>
                    Prefer the classic list? Switch <em>Right-click menu</em> to{" "}
                    <strong>List</strong> at the bottom of the Layers panel, or search
                    for it in the command palette.
                </p>
            </>
        ),
    },
]
