import { createElement } from "react"
import type { FeatureModule } from "../types"
import { logStore } from "../services"
import "./sfx"
import { engine } from "./roller"
import { clearBoardDice, diceSettings, panelOpen, togglePanel } from "./state"
import { DiceLayer } from "./DiceLayer"
import { BoardDiceOverlay } from "./BoardDice"
import { DiceTrayIcon, LogIcon, TablesIcon } from "./icons"
import { AuditIcon } from "./icons-audit"
import { AuditHelp, LogHelp, NotationHelp, SoundHelp, TablesHelp, TrayHelp } from "./help"
import { journalHtml } from "./journal"
import { dateStamp, downloadText } from "./download"
import "./dice.css"

/*
 * Feature: dice. Chiptune sound engine, dice engine (rollDice), dice tray,
 * dice on the board, random tables, and the session log / journal.
 * See src/features/README.md.
 */
export const feature: FeatureModule = {
    id: "dice",
    AppLayer: DiceLayer,
    BoardOverlay: BoardDiceOverlay,
    overlayZ: 55,
    tools: [
        {
            id: "dice:tray",
            label: "Dice tray",
            icon: createElement(DiceTrayIcon),
            hint: "Roll dice",
            hotkey: { key: "r" },
            group: "play",
            kind: "action",
            onTrigger: () => togglePanel("tray"),
            pressed: panelOpen.tray,
        },
        {
            id: "dice:tables",
            label: "Random tables",
            icon: createElement(TablesIcon),
            hint: "Roll on and edit random tables",
            hotkey: { key: "y" },
            group: "play",
            kind: "action",
            onTrigger: () => togglePanel("tables"),
            pressed: panelOpen.tables,
        },
        {
            id: "dice:log",
            label: "Session log",
            icon: createElement(LogIcon),
            hint: "Rolls, notes and events; export a journal",
            hotkey: { key: "y", shift: true },
            group: "play",
            kind: "action",
            onTrigger: () => togglePanel("log"),
            pressed: panelOpen.log,
        },
        {
            id: "dice:audit",
            label: "Roll audit",
            icon: createElement(AuditIcon),
            hint: "Every roll at the table: who, dice and totals",
            group: "play",
            kind: "action",
            onTrigger: () => togglePanel("audit"),
            pressed: panelOpen.audit,
        },
    ],
    commands: [
        {
            id: "dice:quick-d20",
            label: "Quick roll a d20",
            keywords: "dice roll twenty bubble",
            hotkey: { key: "r", shift: true },
            run: () => {
                engine("1d20", { bubble: true })
            },
        },
        {
            id: "dice:roll-adv",
            label: "Roll with advantage (2d20, keep higher)",
            keywords: "dice advantage d20",
            run: () => {
                engine("adv", {})
            },
        },
        {
            id: "dice:roll-dis",
            label: "Roll with disadvantage (2d20, keep lower)",
            keywords: "dice disadvantage d20",
            run: () => {
                engine("dis", {})
            },
        },
        {
            id: "dice:board-toggle",
            label: "Toggle rolling dice onto the board",
            keywords: "dice board sprites show",
            run: () => diceSettings.set((s) => ({ ...s, boardDice: !s.boardDice })),
        },
        {
            id: "dice:clear-board",
            label: "Clear dice from the board",
            keywords: "dice remove sprites",
            run: clearBoardDice,
        },
        {
            id: "dice:export-journal",
            label: "Export adventure journal",
            keywords: "log session journal html download",
            run: () => downloadText(`adventure-journal-${dateStamp()}.html`, journalHtml(logStore.get()), "text/html"),
        },
    ],
    help: [
        { id: "dice-notation", title: "Dice notation", icon: "text", body: createElement(NotationHelp) },
        { id: "dice-tray", title: "Dice tray", icon: "token", body: createElement(TrayHelp) },
        { id: "dice-tables", title: "Random tables", icon: "library", body: createElement(TablesHelp) },
        { id: "dice-log", title: "Session log & journal", icon: "document", body: createElement(LogHelp) },
        { id: "dice-audit", title: "Roll audit", icon: "select", body: createElement(AuditHelp) },
        { id: "dice-sound", title: "Sound", icon: "gear", body: createElement(SoundHelp) },
    ],
}
