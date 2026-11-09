import type { HelpSection } from "../types"

export const DUNGEON_HELP: HelpSection = {
    id: "dungeon",
    title: "Building dungeons",
    icon: "map",
    body: (
        <>
            <p>
                Dungeon crawl boards start on blue graph paper. One square is 10 ft. Walls and cross-hatching are drawn
                for you around every floor square.
            </p>
            <h4>Rooms and corridors (W)</h4>
            <ul>
                <li>Drag on the grid to add a room. Pick Corridor in the strip at the top for a one-square passage with a bend.</li>
                <li>Pick Erase, or hold Alt while you drag, to remove floor.</li>
                <li>Each drag is one undo step. Press Esc or W again to finish.</li>
                <li>
                    No mouse? Click Use keys (or Tab to the board), move the cursor with the arrow keys, press Enter on one
                    corner and Enter again on the opposite corner.
                </li>
            </ul>
            <h4>Stamps (S)</h4>
            <ul>
                <li>Open the stamp palette, pick a stamp, then click squares to place it. Esc stops placing.</li>
                <li>Stamps are ordinary board items: drag, rotate, copy and delete them like anything else.</li>
                <li>
                    Right-click a door to open, close, lock, bar it or lower a portcullis. Right-click a trap or secret
                    door to reveal, spring or hide it.
                </li>
                <li>
                    Hidden secret doors and traps sit on the GM-only layer, so players never see them in Table Mode until
                    you reveal them.
                </li>
            </ul>
            <h4>Generator (Shift+W) and starter dungeons (Shift+S)</h4>
            <ul>
                <li>
                    Choose a seed, size, number of rooms and corridor style, and what to include. The minimap updates as
                    you go. The same seed always gives the same dungeon.
                </li>
                <li>Build places it at the centre of the view, with numbered rooms. Undo twice to take it away again.</li>
                <li>Starter dungeons are ready-made seeds with a short description. Customise opens one in the generator.</li>
            </ul>
        </>
    ),
}
