import { formatHotkeySpec } from "../registry"
import { SETTINGS_HOTKEY } from "./hotkeys"
import { THEMES } from "./themes"

const Key = ({ k }: { k: string }) => <kbd className='how-to-kbd'>{k}</kbd>

/** The "Themes & accessibility" guide section (rendered when the guide opens) */
export const ThemeHelp = () => (
    <>
        <p>
            Open <strong>Settings</strong> with the gear in the tool dock or{" "}
            <Key k={formatHotkeySpec(SETTINGS_HOTKEY)} />. Settings belong to this screen and this
            browser; they never change the board, so a shared table display can be set up once.
        </p>
        <h4 className='jv-help-h'>Themes</h4>
        <ul className='jv-help-list'>
            {THEMES.map((t) => (
                <li key={t.id}>
                    <strong>{t.label}</strong>: {t.description}
                </li>
            ))}
        </ul>
        <h4 className='jv-help-h'>Reading and seeing</h4>
        <ul className='jv-help-list'>
            <li>
                <strong>Interface size</strong> makes panels, menus and buttons bigger for a screen
                viewed from across the table.
            </li>
            <li>
                <strong>High contrast</strong> uses solid backgrounds, thicker borders and a bolder
                focus ring, on top of any theme.
            </li>
            <li>
                <strong>Readable font</strong> swaps the pixel headings for a plain typeface.
            </li>
            <li>
                <strong>Colour-blind safe</strong> adds patterns, shapes and labels wherever colour
                carries meaning.
            </li>
        </ul>
        <h4 className='jv-help-h'>Motion and effects</h4>
        <ul className='jv-help-list'>
            <li>
                <strong>Motion</strong> follows your device by default. Choose “Reduce motion” to
                make every change instant: no fades, slides or shimmer.
            </li>
            <li>
                <strong>CRT effect</strong> (off by default) adds faint, still scanlines. It never
                flickers.
            </li>
            <li>
                <strong>Title cards</strong> show a board's or scene's name for a moment when it
                opens. Click the card or press <Key k='Esc' /> to skip it.
            </li>
            <li>
                <strong>Animated water, lava, magic and acid</strong>: right-click a colour block or a
                map and choose <em>Animate</em>. The shimmer slides slowly in small steps and stands
                still when motion is reduced. Choose <em>Animate: None</em> to stop it; undo works
                too.
            </li>
        </ul>
        <h4 className='jv-help-h'>Keyboard</h4>
        <p>
            Everything can be reached with <Key k='Tab' />; the focused control has a thick gold
            ring. <Key k='Esc' /> closes dialogs and puts tools down.
        </p>
        <p className='how-to-note'>
            Sound is off until you turn it on in Settings, and nothing ever plays by itself.
        </p>
    </>
)
