import React from "react"
import { MOD } from "../../utils/hotkeys"

/* How-to guide sections for the dice feature */

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => <kbd className='how-to-kbd'>{children}</kbd>
const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => <code className='jv-help-code'>{children}</code>

export const NotationHelp: React.FC = () => (
    <>
        <p>Type dice the way you'd say them. Spaces and capitals don't matter.</p>
        <ul>
            <li>
                <Code>3d6</Code>: three six-sided dice added up. <Code>d8</Code> is one die.
            </li>
            <li>
                <Code>1d20+5</Code>, <Code>2d6-1</Code>: add or take away a number.
            </li>
            <li>
                <Code>1d8+1d6+2</Code>: mix dice and numbers.
            </li>
            <li>
                <Code>d%</Code> or <Code>d100</Code>: percentile, 1 to 100.
            </li>
            <li>
                <Code>4d6kh3</Code>: keep the highest 3. <Code>2d20kl1</Code>: keep the lowest 1. You can
                also drop: <Code>4d6dl1</Code>.
            </li>
            <li>
                <Code>adv</Code> / <Code>dis</Code>: advantage or disadvantage (two d20s, keep the higher or
                lower). <Code>adv+4</Code> works too.
            </li>
        </ul>
        <p>
            A natural 20 on a single d20 is marked <strong>★ Critical!</strong> and a natural 1{" "}
            <strong>Fumble!</strong>, with an icon and text as well as colour.
        </p>
    </>
)

export const TrayHelp: React.FC = () => (
    <>
        <p>
            Press <Key>R</Key> (or the d20 button in the dock) to open the <strong>dice tray</strong>. Type an
            expression and press <Key>Enter</Key>, or click a quick die. <Key>↑</Key> <Key>↓</Key> in the box
            bring back earlier rolls, and clicking a recent roll rolls it again.
        </p>
        <p>
            <Key>Shift</Key>+<Key>R</Key> rolls a d20 straight away and shows it in a small bubble beside the
            dock, even with the tray closed.
        </p>
        <p>
            Turn on <strong>Roll onto the board</strong> to throw pixel dice where your pointer is (or the middle
            of the view). They tumble, land, and fade after a few seconds. With reduced motion they simply
            appear.
        </p>
        <p>Drag a panel by its title bar to move it; double-click the title bar to dock it back.</p>
    </>
)

export const TablesHelp: React.FC = () => (
    <>
        <p>
            Press <Key>Y</Key> for <strong>random tables</strong>. Click <em>Roll</em> on a table: the result
            shows in the dice tray (or a bubble) and goes in the session log.
        </p>
        <p>
            <em>New table</em> or <em>Edit</em> opens the editor. Give it dice and one entry per line, like{" "}
            <Code>1-2: Goblins (2d4)</Code>. Dice inside an entry are rolled too. Add a second part to roll two
            columns and join them, like the tavern-name table.
        </p>
        <p>
            Your tables are kept in this browser, separate from boards. Use <em>Export all</em> and{" "}
            <em>Import…</em> to move them as a JSON file. Deleting a table can be undone with {MOD}Z.
        </p>
    </>
)

export const LogHelp: React.FC = () => (
    <>
        <p>
            Press <Key>Shift</Key>+<Key>Y</Key> for the <strong>session log</strong>. Rolls, table results,
            turns and travel land here, grouped into sessions. Filter by kind with the buttons on top, and type
            in the box at the bottom to add your own note.
        </p>
        <p>
            The log is saved with the board. <em>Export journal</em> downloads an Adventure Journal page you can
            open, print or share; <em>Markdown</em> gives plain text. <em>Clear log</em> can be undone with{" "}
            {MOD}Z.
        </p>
    </>
)

export const SoundHelp: React.FC = () => (
    <>
        <p>
            Jewel VTT has chiptune sound effects (dice, doors, turns) and quiet ambient loops for dungeons,
            wilderness and taverns. Sound is <strong>off</strong> until you turn it on in Settings (
            <Key>{MOD},</Key>), where you also set the volume and switch ambience on or off.
        </p>
        <p>Nothing plays until you have clicked or pressed a key on the page.</p>
    </>
)

export const AuditHelp: React.FC = () => (
    <>
        <p>
            The <strong>Roll audit</strong> (magnifying glass over a die, in the dock) keeps every roll made at
            this table: who rolled, when, the expression, every die face (dropped dice in brackets) and the total.
            It's saved with the board, so it goes back across sessions, keeping the newest 10,000 rolls.
        </p>
        <p>
            Filter by person, search (“d20”, “Stealth”, “17”), show only criticals and fumbles, or open{" "}
            <em>Numbers per person</em> for each roller's d20 average and natural 20s and 1s. <em>Export CSV</em>{" "}
            downloads the lot as a spreadsheet.
        </p>
        <p>
            In a shared game everyone sees every public roll. The GM's secret rolls (ones not shown at the table)
            appear only in the GM's audit, marked 🔒. Only the GM can clear the audit, and it can be undone.
            Players' rolls are made on their own computers; the audit records what each app reported.
        </p>
    </>
)
