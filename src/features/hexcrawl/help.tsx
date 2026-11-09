import type { HelpSection } from "../types"

/* How-to guide section for hex crawling */

export const HEXCRAWL_HELP: HelpSection = {
    id: "hexcrawl",
    title: "Hex crawling",
    icon: "hex",
    body: (
        <>
            <p>
                An <strong>Overland hex crawl</strong> board is a map of 6-mile hexes to explore. Its tools sit in the
                dock on the left.
            </p>
            <p>
                <strong>Terrain</strong> (<kbd className='how-to-kbd'>E</kbd>): pick a terrain from the strip at the bottom and click or drag
                over hexes. Sizes 1–3 paint wider brushes. <em>River</em> and <em>Road</em> draw links as you drag
                from hex to hex; the two erasers clear terrain or links. Each stroke is one undo step.
            </p>
            <p>
                <strong>Hex features</strong> (<kbd className='how-to-kbd'>Shift+E</kbd>): place villages, towns, castles, ruins, dungeon
                entrances, lairs and more. Give a label before you click, and tick <em>Add hex number</em> to show
                its number (column then row, like 0304). Right-click a marker and choose <em>Hex label…</em> to
                change it later. <em>Show hex numbers</em> writes every hex's number faintly on the map.
            </p>
            <p>
                <strong>Travel</strong> (<kbd className='how-to-kbd'>X</kbd>): select the party's token first (or click it with the tool).
                Then click a neighbouring hex, or use the arrow buttons in the travel panel. A day's march is 24
                miles of clear ground (4 hexes). Forest, hills, desert, tundra and badlands cost ×1.5; mountains,
                swamp and jungle ×2; following a road halves the cost. Water needs a boat. Bad weather can slow
                the day. You can always push on past the limit: the panel marks it as a forced march.
            </p>
            <p>
                Entering a hex lifts the fog from it and its neighbours and rolls a d6 encounter check: 1 in 6 on
                open ground, desert, tundra or water; 2 in 6 in forest, jungle, swamp, hills or badlands; 3 in 6
                in mountains. Everything goes in the session log. <em>End day / make camp</em> starts the next day
                and rolls its weather from the season and climate you set in the panel. Moves and camps undo
                like any other change.
            </p>
            <p>
                <strong>Generate</strong> (<kbd className='how-to-kbd'>Shift+X</kbd>): make a whole region from a seed. Choose its size,
                climate, water level, mountains and how many settlements and sites to place, and check the
                preview. The same seed always makes the same map. <em>Generate</em> fills hexes from 0101 and can
                hide them all under fog of war. Undo takes it back.
            </p>
        </>
    ),
}
