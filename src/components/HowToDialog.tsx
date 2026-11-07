import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Icon, type IconName } from "./Icon"
import { HOTKEYS, MOD, formatHotkey, type HotkeyDef } from "../utils/hotkeys"
import "./HowToDialog.css"

interface HowToDialogProps {
    isOpen: boolean
    onClose: () => void
}

interface Section {
    id: string
    title: string
    icon: IconName
    body: React.ReactNode
}

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className='how-to-kbd'>{children}</kbd>
)

const SECTIONS: Section[] = [
    {
        id: "basics",
        title: "Getting around",
        icon: "hand",
        body: (
            <>
                <p>
                    Your board is endless. <strong>Drag</strong> empty space to
                    pan, <strong>scroll</strong> to zoom, and hold{" "}
                    <Key>Shift</Key> to pan even over objects.
                </p>
                <p>
                    The <Icon name='home' size={16} /> house next to the menu
                    (or <Key>H</Key>) flies you back to the centre.
                </p>
                <p>
                    <strong>Spots</strong> are bookmarks: right-click and
                    choose <em>Snap to Spot</em> (or press <Key>F</Key>) to
                    plant a flag. Each spot gets a tab in the top bar. Click a
                    tab to fly there, double-click to rename, and use × to
                    remove it.
                </p>
            </>
        ),
    },
    {
        id: "adding",
        title: "Adding things",
        icon: "token",
        body: (
            <>
                <p>
                    <strong>Right-click</strong> the board to add a text box,
                    image, map, token, map pin, solid colour, or document. Or
                    point at a spot and press a letter key (see shortcuts
                    below).
                </p>
                <p>
                    Tokens and maps can come from your own files, a URL, or
                    the built-in libraries: pick <em>Select from Library</em>,
                    browse the folders or search, and click one.
                </p>
                <p>
                    Select an object to move, resize and rotate it.
                    Right-click it to edit, lock, reorder or delete it.
                </p>
            </>
        ),
    },
    {
        id: "documents",
        title: "Documents & links",
        icon: "document",
        body: (
            <>
                <p>
                    Keep session notes, rules and lore on the board. Right-click
                    and choose <em>Document / Link</em> (or press <Key>D</Key>
                    ).
                </p>
                <p>
                    Paste a <strong>link</strong> (a Notion page, Google Doc,
                    wiki: any address starting with <code>https://</code>) or
                    attach a <strong>file</strong> such as a PDF. The card's{" "}
                    <em>Open ↗</em> button opens it in a new tab.
                </p>
                <p className='how-to-note'>
                    Attached files are stored inside the board, so very large
                    files make saving slower.
                </p>
            </>
        ),
    },
    {
        id: "scribble",
        title: "Scribble layers",
        icon: "scribble",
        body: (
            <>
                <p>
                    Choose <em>Add Scribble Layer</em> in the menu (or press{" "}
                    <Key>B</Key>) and draw on the board with a pencil at 50%
                    opacity. Pick a colour, a size, or the eraser from the
                    toolbar that appears.
                </p>
                <p>
                    Each layer gets a tab in the top bar. Click the tab to draw
                    on that layer (click again to stop), use the{" "}
                    <Icon name='eye' size={16} /> eye to show or hide it, and ×
                    to remove it. Press <Key>Esc</Key> or <em>Done</em> to put
                    the pencil down. <Key>{MOD}Z</Key> undoes strokes.
                </p>
            </>
        ),
    },
    {
        id: "select",
        title: "Selecting many things",
        icon: "select",
        body: (
            <>
                <p>
                    Hold the <strong>middle mouse button</strong> (press the
                    scroll wheel) and drag a box over the board. Everything it
                    touches is selected with a dashed purple outline. Hold{" "}
                    <Key>Shift</Key> to add to the selection, or press{" "}
                    <Key>{MOD}A</Key> to select everything.
                </p>
                <p>
                    Drag any selected object to move the whole group. Use{" "}
                    <Key>Delete</Key> to remove them and <Key>{MOD}C</Key> to
                    copy them. <Key>Esc</Key> or a click on empty board clears
                    the selection.
                </p>
            </>
        ),
    },
    {
        id: "connectors",
        title: "Connecting lines",
        icon: "connector",
        body: (
            <>
                <p>
                    Point at an object and four small dots appear just outside
                    its edges. Drag from a dot onto another object to draw an
                    arrow between them, ready for flowcharts and quest maps.
                    The arrows follow when you move things.
                </p>
                <p>
                    Click an arrow to select it, then press <Key>Delete</Key>{" "}
                    or its × button to remove it.
                </p>
            </>
        ),
    },
    {
        id: "styles",
        title: "Board styles & painting",
        icon: "brush",
        body: (
            <>
                <p>
                    Open the <strong>menu</strong> and choose a board style:
                    Parchment, Cave, Space, Grass, Stone or Blank. You can also
                    upload your own texture.
                </p>
                <p>
                    Turn on the <strong>Tool Apron</strong> in the menu to
                    paint grid squares, erase them, or fill the board.
                </p>
            </>
        ),
    },
    {
        id: "saving",
        title: "Saving your work",
        icon: "save",
        body: (
            <>
                <p>
                    Jewel VTT <strong>autosaves</strong> in this browser as you
                    work, so an accidental refresh won't lose anything.
                </p>
                <p>
                    To keep a copy or move it to another computer, use{" "}
                    <em>Save Board</em> (<Key>{MOD}S</Key>). That downloads a{" "}
                    <code>.jvtt.json</code> file. <em>Open Board</em> (
                    <Key>{MOD}O</Key>) loads one back. <em>Export as PNG</em> (
                    <Key>{MOD}E</Key>) saves a picture of the board.
                </p>
                <p className='how-to-note'>
                    Images you upload are stored inside the file. Library
                    tokens and maps are stored as links to the library, so the
                    other computer needs the same library folders.
                </p>
            </>
        ),
    },
]

const GROUP_ORDER: HotkeyDef["group"][] = ["Board", "Add", "Navigate", "Edit"]

export const HowToDialog: React.FC<HowToDialogProps> = ({ isOpen, onClose }) => {
    const [active, setActive] = useState(SECTIONS[0].id)
    const bodyRef = useRef<HTMLDivElement>(null)
    const closeRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (!isOpen) return
        closeRef.current?.focus()
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [isOpen, onClose])

    if (!isOpen) return null

    const jump = (id: string) => {
        setActive(id)
        bodyRef.current
            ?.querySelector(`#how-to-${id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    return createPortal(
        <div className='how-to-backdrop' onClick={onClose}>
            <div
                className='how-to-dialog'
                role='dialog'
                aria-modal='true'
                aria-labelledby='how-to-title'
                onClick={(e) => e.stopPropagation()}
            >
                <header className='how-to-header'>
                    <img src='/jewelvtt.svg' alt='' width={44} height={34} />
                    <h2 id='how-to-title'>How to use Jewel VTT</h2>
                    <button
                        ref={closeRef}
                        type='button'
                        className='how-to-close'
                        onClick={onClose}
                        aria-label='Close guide'
                    >
                        <Icon name='close' size={20} />
                    </button>
                </header>

                <div className='how-to-layout'>
                    <nav className='how-to-nav' aria-label='Guide sections'>
                        {[...SECTIONS, { id: "keys", title: "Keyboard shortcuts", icon: "help" as IconName }].map(
                            (s) => (
                                <button
                                    key={s.id}
                                    type='button'
                                    className={`how-to-nav-item ${
                                        active === s.id ? "active" : ""
                                    }`}
                                    onClick={() => jump(s.id)}
                                >
                                    <Icon name={s.icon} size={20} />
                                    {s.title}
                                </button>
                            )
                        )}
                    </nav>

                    <div className='how-to-body' ref={bodyRef}>
                        {SECTIONS.map((s) => (
                            <section key={s.id} id={`how-to-${s.id}`}>
                                <h3>
                                    <Icon name={s.icon} size={22} className='jicon-play' />
                                    {s.title}
                                </h3>
                                {s.body}
                            </section>
                        ))}

                        <section id='how-to-keys'>
                            <h3>
                                <Icon name='help' size={22} />
                                Keyboard shortcuts
                            </h3>
                            {GROUP_ORDER.map((group) => (
                                <div key={group} className='how-to-keys-group'>
                                    <h4>{group}</h4>
                                    <table>
                                        <tbody>
                                            {HOTKEYS.filter(
                                                (h) => h.group === group
                                            ).map((h) => (
                                                <tr key={h.action}>
                                                    <td>
                                                        <Key>{formatHotkey(h)}</Key>
                                                    </td>
                                                    <td>{h.label}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                            <p className='how-to-note'>
                                Also: <Key>{MOD}Z</Key> undo,{" "}
                                <Key>{MOD}Shift+Z</Key> redo, <Key>{MOD}C</Key>{" "}
                                / <Key>{MOD}X</Key> / <Key>{MOD}V</Key> copy,
                                cut and paste.
                            </p>
                        </section>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
