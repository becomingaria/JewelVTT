import { logEvent, registerDiceEngine, type DiceResult, type RollOptions } from "../services"
import { playSfx } from "../sound"
import { DiceSyntaxError, describeRoll, rollExpression, type DetailedRoll } from "./notation"
import { describeTableRoll, rollTable, type RandomTable } from "./tables-core"
import { presentRecord, recordId, type RollRecord } from "./state"

/*
 * The dice engine behind services.rollDice(). Any feature can call
 * rollDice(expr, { label, show, log }); this shows the result (tray, board
 * or bubble), plays a sound and writes the session log.
 *
 * Hidden rolls (show: false) are silent, so a secret GM check gives nothing
 * away at the table.
 */

function toRecord(r: DetailedRoll, label?: string): RollRecord {
    return {
        id: recordId(),
        at: Date.now(),
        label,
        expression: r.expression,
        total: r.total,
        dice: r.rolls,
        breakdown: describeRoll(r),
        crit: r.crit,
        fumble: r.fumble,
    }
}

function logText(rec: RollRecord): string {
    const flag = rec.crit ? " (critical!)" : rec.fumble ? " (fumble!)" : ""
    return `${rec.label ? rec.label + ": " : ""}${rec.expression} = ${rec.total}${flag}`
}

export interface EngineOptions extends RollOptions {
    /** Always show the compact bubble (Shift+R quick roll) */
    bubble?: boolean
}

export function engine(expression: string, opts: EngineOptions = {}): DiceResult {
    const show = opts.show !== false
    let r: DetailedRoll
    try {
        r = rollExpression(expression)
    } catch (e) {
        const message = e instanceof DiceSyntaxError ? e.message : "That isn't a dice roll."
        if (show) {
            presentRecord(
                {
                    id: recordId(),
                    at: Date.now(),
                    label: opts.label,
                    expression,
                    total: 0,
                    dice: [],
                    breakdown: "",
                    error: message,
                },
                { bubble: opts.bubble }
            )
            playSfx("error")
        }
        return { expression, total: 0, rolls: [] }
    }
    const rec = toRecord(r, opts.label)
    if (show) {
        presentRecord(rec, { bubble: opts.bubble })
        playSfx(r.crit ? "dice-crit" : r.fumble ? "dice-fumble" : "dice")
    }
    if (opts.log !== false) logEvent({ kind: "roll", text: logText(rec), detail: rec.breakdown })
    return r
}

/** Roll a random table: result to the tray (or bubble / board) and the log */
export function rollTableAndShow(table: RandomTable) {
    const tr = rollTable(table)
    const dice = tr.parts.flatMap((p) => [...(p.roll?.rolls ?? []), ...p.inline.flatMap((i) => i.roll.rolls)])
    const first = tr.parts[0]?.roll
    const rec: RollRecord = {
        id: recordId(),
        at: Date.now(),
        expression: table.parts.map((p) => p.dice).join(" + "),
        total: first?.total ?? 0,
        dice,
        breakdown: describeTableRoll(tr),
        table: { id: table.id, name: table.name, text: tr.text },
    }
    presentRecord(rec)
    playSfx("dice")
    logEvent({ kind: "table", text: `${table.name}: ${tr.text}`, detail: rec.breakdown })
    return { record: rec, roll: tr }
}

registerDiceEngine(engine)
