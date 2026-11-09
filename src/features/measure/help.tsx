import type { HelpSection } from "../types"

export const MEASURE_HELP: HelpSection[] = [
    {
        id: "measure",
        title: "Measuring distance",
        icon: "trail",
        body: (
            <>
                <p>
                    Pick the <strong>ruler</strong> in the tool dock (or press <kbd className='how-to-kbd'>L</kbd>), then{" "}
                    <strong>drag</strong> across the board. The label shows the distance in squares (or hexes) and
                    in real units: 10 ft squares on dungeon maps, 5 ft on freeform boards and 6 miles per hex on
                    hex crawls.
                </p>
                <p>
                    For a winding path, <strong>click</strong> to start and click again at each corner. You can
                    also hold <kbd className='how-to-kbd'>Shift</kbd> as you let go of a drag to keep going. <strong>Double-click</strong>{" "}
                    or press <kbd className='how-to-kbd'>Enter</kbd> to finish, <kbd className='how-to-kbd'>Backspace</kbd> takes back the last corner, and{" "}
                    <kbd className='how-to-kbd'>Esc</kbd> puts the ruler away. Measurements are never saved.
                </p>
                <p>
                    On square grids the strip at the bottom offers two ways to count diagonals:{" "}
                    <strong>1-2-1</strong> (every second diagonal counts double) or <strong>Simple</strong>{" "}
                    (every step counts one). Hex grids count hexes.
                </p>
                <p>
                    Start a measurement on a <strong>token</strong> to see the move against its movement rate,
                    for example “60 of 120 ft”. Set the rate with right-click → <em>Movement rate…</em> (120 ft,
                    exploration pace, if you haven't).
                </p>
            </>
        ),
    },
    {
        id: "measure-templates",
        title: "Area templates",
        icon: "swatch",
        body: (
            <>
                <p>
                    The <strong>template</strong> tool (<kbd className='how-to-kbd'>Shift+L</kbd>) marks the area of a spell, breath or
                    blast. Choose a <strong>cone</strong>, <strong>line</strong>, <strong>burst</strong> or{" "}
                    <strong>square</strong> and its size in the strip at the bottom, then click the board to place
                    it. Keep the button held and drag to aim a cone or line (it turns in 15° steps; hold{" "}
                    <kbd className='how-to-kbd'>Alt</kbd> to aim freely).
                </p>
                <p>
                    Templates stay on the board and are saved with it. They're hatched with a solid edge, the
                    squares they cover are outlined, and a card lists the tokens caught inside.
                </p>
                <p>
                    With the tool on, click a template to select it: drag to move it, drag the small square
                    handle to turn it, and press <kbd className='how-to-kbd'>Delete</kbd> or × to remove it. From the keyboard,{" "}
                    <strong>Place</strong> drops one in the middle of the view, <strong>Next</strong> selects
                    each template in turn, the arrow keys move it and the turn buttons rotate it. <kbd className='how-to-kbd'>Q</kbd>{" "}
                    clears every template. Everything can be undone.
                </p>
            </>
        ),
    },
    {
        id: "measure-sizes",
        title: "Token sizes",
        icon: "token",
        body: (
            <>
                <p>
                    Right-click a token and choose a <strong>Size</strong>: Tiny (half a square), Small and Medium
                    (one square), Large (2×2), Huge (3×3) or Gargantuan (4×4). The tick shows the current size.
                    The token grows or shrinks around its centre.
                </p>
                <p>
                    Big tokens snap so they cover whole squares; tiny ones sit in the middle of a square. On hex
                    grids a token's centre always lands on a hex centre.
                </p>
            </>
        ),
    },
]
