/*
 * The desktop shell's bridge (electron/preload.ts). Undefined in a normal
 * browser, so always check `desktop` before using it.
 */

export type UpdateStatus =
    | { state: "checking" }
    | { state: "none" }
    | { state: "downloading"; version?: string; percent?: number }
    | { state: "ready"; version: string }
    | { state: "manual"; version: string; url: string }
    | { state: "error"; message: string }

export interface DesktopInfo {
    version: string
    platform: string
    libraryFolder: string
    packaged: boolean
}

export interface DesktopBridge {
    isDesktop: true
    info: () => Promise<DesktopInfo>
    openLibraryFolder: () => Promise<string>
    onUpdateStatus: (cb: (s: UpdateStatus) => void) => () => void
    installUpdate: () => Promise<void>
    openReleasePage: () => Promise<void>
    checkForUpdates: () => Promise<boolean>
    /** A jewel:// link the app was opened with (once) */
    takeJoinLink: () => Promise<string | null>
    onJoinLink: (cb: (link: string) => void) => () => void
}

declare global {
    interface Window {
        jewelDesktop?: DesktopBridge
    }
}

export const desktop: DesktopBridge | undefined =
    typeof window !== "undefined" ? window.jewelDesktop : undefined
