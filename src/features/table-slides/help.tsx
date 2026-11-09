import type { HelpSection } from "../types"

const k = (key: string) => <kbd className="how-to-kbd">{key}</kbd>

export const HELP: HelpSection[] = [
    {
        id: "table-mode",
        title: "Table Mode (players' view)",
        icon: "eye",
        body: (
            <>
                <p>
                    Turn the screen round for the players with <strong>Table Mode</strong> ({k("Shift")}+
                    {k("T")}, or the screen button in the dock's View group). GM-only things disappear, the
                    menus and editing handles tuck away, and the board fills the whole screen.
                </p>
                <p>
                    The pointer hides after a few seconds of stillness and comes back when you move it. Move the
                    mouse (or press {k("Tab")}) to show the small <em>Exit Table Mode</em> button in the
                    top-right corner, or press {k("Shift")}+{k("T")} again. {k("Esc")} doesn't leave
                    Table Mode, so a stray key press can't spoil a reveal.
                </p>
            </>
        ),
    },
    {
        id: "slides",
        title: "Slides and presenting",
        icon: "flag",
        body: (
            <>
                <p>
                    A <strong>frame</strong> marks part of the board as a slide. Pick the Frame tool (
                    {k("O")}) and drag a rectangle. Drag a frame's numbered tab to move it, drag its corners
                    to resize it (hold {k("Alt")} to skip snapping), and double-click the tab to rename it.
                    Press {k("Esc")} to put the tool down.
                </p>
                <p>
                    The <strong>Frames</strong> panel lists the frames in order. Rename them, reorder them by
                    dragging the number or with {k("Alt")}+{k("↑")}/{k("↓")}, jump to one, fit one to
                    what's on screen, or add a new frame from the current view. Every change can be undone.
                </p>
                <p>
                    <strong>Present</strong> with {k("Shift")}+{k("P")}. The screen clears and frame 1
                    fills it. {k("Page Down")}, {k("→")}, {k("Space")} or a click goes to the next
                    frame; {k("Page Up")}, {k("←")} or a right-click goes back; {k("Home")} and{" "}
                    {k("End")} jump to the first and last. {k("Esc")} takes you back to where you were.
                    Boards without frames present their spots instead. Presenting also hides GM-only things, as
                    Table Mode does.
                </p>
            </>
        ),
    },
    {
        id: "flowcharts",
        title: "Flowcharts",
        icon: "connector",
        body: (
            <>
                <p>
                    The <strong>Flowchart shapes</strong> button in the dock (on freeform and slide boards) adds a
                    box in the middle of the view: start/end, process, decision, input/output, document or note.
                    They're ordinary text boxes, so double-click to edit the words and colours.
                </p>
                <p>
                    Right-click any text box and choose <em>Shape ▸ …</em> to change its shape or turn it back
                    into a plain box. Link shapes with arrows by dragging from the dots on their edges; the
                    arrows meet each shape's outline.
                </p>
            </>
        ),
    },
]
