import React from "react"

/* How-to guide sections for the tracker (wired up in index.ts) */

export const InitiativeHelp: React.FC = () => (
    <>
        <p>
            Press <kbd>U</kbd> (or the initiative button in the dock) to show the turn-order strip along the top of
            the board. Add tokens with <kbd>Shift</kbd>+<kbd>U</kbd> (the selected tokens), with{" "}
            <strong>Add to initiative</strong> in a token's right-click menu, or with <strong>Add all</strong>.
        </p>
        <p>
            <strong>Sides</strong> is the classic way: one d6 for the party, one for the monsters, and the higher side
            acts first. Tokens from My Party and generated characters count as the party; everyone else is a foe. Pick
            a portrait to change its side. <strong>Individual</strong> rolls a d20 (or d6) for each creature, plus a
            modifier you can set per creature.
        </p>
        <p>
            <kbd>N</kbd> passes the turn. After the last creature the round counter goes up. The token whose turn it is
            gets a ring on the board, and the target button flies the view to it. Drag portraits to reorder them, or
            pick one and use the arrow buttons. Removing, clearing and reordering can all be undone.
        </p>
        <p className='how-to-note'>In Table Mode the strip stays up for the players, but its editing controls hide.</p>
    </>
)

export const HitPointsHelp: React.FC = () => (
    <>
        <p>
            Right-click a token and choose <strong>Hit points…</strong> to set its maximum, then use −5, −1, +1 and +5
            or type an amount for damage and healing. The bar under the token is split into segments, and its pattern
            changes as the token is wounded, so it reads without colour too.
        </p>
        <p>
            <strong>Conditions…</strong> is a checklist: poisoned, asleep, paralysed, charmed, frightened, prone,
            blinded, invisible, cursed and dead. Each one shows as a small pixel icon above the token, with its name
            when you hover it. At 0 HP the tracker suggests marking the token dead, but leaves the call to you.
        </p>
        <p className='how-to-note'>
            In Table Mode, players see only the bar for monsters, not the exact numbers. Every change can be undone.
        </p>
    </>
)

export const DungeonTurnsHelp: React.FC = () => (
    <>
        <p>
            On dungeon maps a small turn tracker sits at the top right. Each exploration turn is ten minutes; press{" "}
            <kbd>Shift</kbd>+<kbd>N</kbd> to advance one.
        </p>
        <p>
            Every turn, torches and other lights with a limited life burn down by one, and you get a note when one goes
            out. Every two turns (you can change this) the tracker rolls a d6 for wandering monsters: a 1 means
            something is coming, shown in the tracker and as a notice. Every six turns it reminds you that the party
            should rest.
        </p>
    </>
)

export const CharactersHelp: React.FC = () => (
    <>
        <p>
            <strong>New character…</strong> (in the dock and the command palette) rolls a first-level adventurer: 3d6
            in order for Strength, Intelligence, Wisdom, Dexterity, Constitution and Charisma, or 4d6 dropping the
            lowest. Tick <strong>GM allows re-rolls</strong> to re-roll single scores.
        </p>
        <p>
            Choose a class (Fighter d8, Cleric d6, Magic-User d4, Thief d4, Dwarf d8, Elf d6 or Halfling d6), roll hit
            points with the Constitution modifier (−1 for 8 or less, +1 for 13 or more), name them and pick a portrait.
            <strong> Place on board</strong> drops the token in the middle of the view, ready for initiative, and can
            add it to My Party. Every roll goes into the session log.
        </p>
    </>
)
