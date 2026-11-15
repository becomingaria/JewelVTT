import React from "react"

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className='how-to-kbd'>{children}</kbd>
)

export const FogHelp: React.FC = () => (
    <>
        <p>
            Fog of war hides the parts of the map the players haven't
            explored. It follows the board's grid, squares or hexes.
        </p>
        <p>
            Pick the <strong>Fog brush</strong> in the tool dock (or press{" "}
            <Key>G</Key>) and drag on the board to <strong>reveal</strong>{" "}
            cells. Hold <Key>Alt</Key> or drag with the right button to{" "}
            <strong>hide</strong> them again. The strip next to the dock sets
            Reveal or Hide and the brush size (1 to 5 cells). Each stroke is
            one undo step. Hold <Key>Shift</Key> to pan while the brush is on,
            and press <Key>Esc</Key> to put it down.
        </p>
        <p>
            <strong>Cover</strong> fogs the whole board, <strong>Reveal all</strong>{" "}
            clears it (you can still paint fog back on), and <Key>Shift+G</Key>{" "}
            turns fog on or off for this board without losing what you
            revealed. These are also in the command palette, and undo works
            for all of them.
        </p>
        <p>
            In your normal view the fog is see-through with a hatch, so you can
            still work underneath. In <strong>Table Mode</strong> it turns
            into solid stone that hides everything. The edge of the explored
            area fades out in chunky dithered pixels, and nothing hidden ever
            shows through it.
        </p>
        <p>
            <strong>Line of sight.</strong> Tokens with vision (right-click:{" "}
            <em>Vision</em>) or a light see through the fog, but not through
            walls. Dungeon rooms have walls already. For a map picture, pick{" "}
            <strong>Sight walls</strong> in the dock (<Key>Shift+B</Key>) and
            drag along the walls in the picture; ends snap to grid corners
            (hold <Key>Alt</Key> to draw freely, right-drag to erase). Only you
            see these lines.
        </p>
        <p>
            Any object can <strong>block sight</strong>: tick it in the
            object's Edit dialog, or right-click it and choose{" "}
            <em>Block sight</em> / <em>Let sight through</em>. Pillars,
            statues, crates and closed or secret doors block sight already;
            open a door and the party sees through it. Lights stop at walls
            too.
        </p>
    </>
)

export const LightHelp: React.FC = () => (
    <>
        <p>
            The <strong>Scene light</strong> button in the tool dock (sun and
            moon) switches this board between <strong>Daylight</strong>,{" "}
            <strong>Dim</strong> and <strong>Dark</strong>. In Dim and Dark
            scenes only the areas around light sources can be seen.
        </p>
        <p>
            Right-click a token (or a selection) and choose a light:{" "}
            <em>Torch</em> (30 ft bright, 10 ft more dim, flickers, burns for
            6 turns), <em>Lantern</em> (30 ft bright, 30 ft dim),{" "}
            <em>Candle</em> (5 ft bright, 5 ft dim), or <em>Magic light</em>{" "}
            (30 ft, cool glow). <em>Light: None</em> puts it out. Bright light
            is fully lit and dim light half lit; dungeon squares are 10 ft.
        </p>
        <p>
            A small flame on a token shows it carries a light, with the
            number of turns left for torches. The turn tracker counts torches
            down. Put a light on a GM-only object to light a room without
            showing a token.
        </p>
        <p>
            You still see the board through the dark in your normal view;{" "}
            <strong>Table Mode</strong> makes it fully dark. Flicker is gentle
            and stops when reduced motion is on.
        </p>
    </>
)
