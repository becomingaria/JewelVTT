import type { LogEntry } from "../services"

/*
 * Session grouping and journal export. Pure (no DOM) apart from Intl dates.
 */

/** A gap this long between entries starts a new session */
export const SESSION_GAP_MS = 3 * 60 * 60 * 1000

export interface Session {
    index: number
    start: number
    end: number
    entries: LogEntry[]
}

export function groupSessions(entries: readonly LogEntry[]): Session[] {
    const sorted = [...entries].sort((a, b) => a.at - b.at)
    const sessions: Session[] = []
    for (const e of sorted) {
        const cur = sessions[sessions.length - 1]
        if (cur && e.at - cur.end < SESSION_GAP_MS) {
            cur.entries.push(e)
            cur.end = e.at
        } else {
            sessions.push({ index: sessions.length + 1, start: e.at, end: e.at, entries: [e] })
        }
    }
    return sessions
}

export const KIND_LABEL: Record<LogEntry["kind"], string> = {
    roll: "Roll",
    table: "Table",
    turn: "Turn",
    travel: "Travel",
    weather: "Weather",
    encounter: "Encounter",
    note: "Note",
    scene: "Scene",
    system: "System",
}

export const fmtDay = (t: number) =>
    new Date(t).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
export const fmtTime = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

export function sessionTitle(s: Session): string {
    return `Session ${s.index} · ${fmtDay(s.start)}`
}

const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

/** A self-contained, printable "Adventure Journal" page */
export function journalHtml(entries: readonly LogEntry[], title = "Adventure Journal"): string {
    const sessions = groupSessions(entries)
    const body = sessions.length
        ? sessions
              .map(
                  (s) => `
<section class="session">
  <h2><span class="rule" aria-hidden="true">❦</span> ${esc(sessionTitle(s))}</h2>
  <ol>
${s.entries
    .map(
        (e) => `    <li class="k-${e.kind}">
      <time datetime="${new Date(e.at).toISOString()}">${esc(fmtTime(e.at))}</time>
      <span class="kind">${esc(KIND_LABEL[e.kind] ?? e.kind)}</span>
      <span class="text">${esc(e.text)}${e.detail ? `<span class="detail">${esc(e.detail)}</span>` : ""}</span>
    </li>`
    )
    .join("\n")}
  </ol>
</section>`
              )
              .join("\n")
        : `<p class="empty">Nothing has been written in this journal yet.</p>`
    const range = sessions.length
        ? `${fmtDay(sessions[0].start)}${sessions.length > 1 ? ` – ${fmtDay(sessions[sessions.length - 1].end)}` : ""}`
        : ""
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --ink: #2b2014; --faded: #5d4a33; --parch: #f3e6c4; --edge: #8a6a3b; --mark: #7a2e1d; }
  * { box-sizing: border-box; }
  html { background: #5a4630; }
  body {
    margin: 24px auto; max-width: 780px; padding: 48px 56px 64px;
    color: var(--ink); font: 17px/1.6 Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", serif;
    background:
      radial-gradient(ellipse at 12% 8%, rgba(255,255,255,.35), transparent 40%),
      radial-gradient(ellipse at 90% 95%, rgba(120,80,30,.18), transparent 45%),
      radial-gradient(circle at 70% 30%, rgba(160,110,50,.08), transparent 30%),
      var(--parch);
    border: 3px double var(--edge);
    box-shadow: 0 0 0 6px var(--parch), 0 0 0 8px var(--edge), 0 12px 40px rgba(0,0,0,.45), inset 0 0 80px rgba(120,80,30,.25);
  }
  header { text-align: center; margin-bottom: 32px; }
  h1 { font-size: 2.4rem; font-variant: small-caps; letter-spacing: .06em; margin: 0; color: var(--mark); }
  .range { color: var(--faded); font-style: italic; margin: 4px 0 0; }
  .flourish { color: var(--edge); letter-spacing: .5em; margin: 12px 0 0; }
  h2 { font-size: 1.25rem; font-variant: small-caps; letter-spacing: .04em; border-bottom: 1px solid var(--edge); padding-bottom: 4px; margin: 36px 0 12px; }
  .rule { color: var(--mark); }
  ol { list-style: none; margin: 0; padding: 0; }
  li { display: grid; grid-template-columns: 4.2em 6.5em 1fr; gap: 10px; padding: 5px 0; border-bottom: 1px dotted rgba(138,106,59,.45); }
  time { color: var(--faded); font-variant-numeric: tabular-nums; }
  .kind { font-variant: small-caps; color: var(--faded); }
  .k-note .text { font-style: italic; }
  .k-roll .kind, .k-table .kind { color: var(--mark); }
  .detail { display: block; font-size: .85em; color: var(--faded); }
  .empty { text-align: center; font-style: italic; }
  footer { margin-top: 40px; text-align: center; color: var(--faded); font-size: .85rem; }
  @media (max-width: 640px) { body { padding: 28px 20px; margin: 0; } li { grid-template-columns: 4em 1fr; } .kind { grid-column: 2; grid-row: 1; } .text { grid-column: 1 / -1; } }
  @media print { html { background: none; } body { box-shadow: none; margin: 0; max-width: none; } section { break-inside: avoid-page; } }
</style>
</head>
<body>
<header>
  <h1>${esc(title)}</h1>
  ${range ? `<p class="range">${esc(range)}</p>` : ""}
  <p class="flourish" aria-hidden="true">✦ ✦ ✦</p>
</header>
<main>
${body}
</main>
<footer>Kept with Jewel VTT</footer>
</body>
</html>
`
}

const mdEsc = (s: string) => s.replace(/([\\`*_[\]#|<>])/g, "\\$1")

export function journalMarkdown(entries: readonly LogEntry[], title = "Adventure Journal"): string {
    const sessions = groupSessions(entries)
    const lines = [`# ${title}`, ""]
    if (!sessions.length) lines.push("_Nothing has been written in this journal yet._")
    for (const s of sessions) {
        lines.push(`## ${sessionTitle(s)}`, "")
        for (const e of s.entries) {
            const text = e.kind === "note" ? `_${mdEsc(e.text)}_` : mdEsc(e.text)
            lines.push(`- **${fmtTime(e.at)}** · ${KIND_LABEL[e.kind] ?? e.kind}: ${text}`)
            if (e.detail) lines.push(`  - ${mdEsc(e.detail)}`)
        }
        lines.push("")
    }
    return lines.join("\n")
}
