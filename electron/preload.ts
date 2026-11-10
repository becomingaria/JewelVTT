import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron"

/*
 * The only bridge between the web app and the desktop shell. Exposed as
 * window.jewelDesktop (typed in src/desktop.ts). Absent in the browser.
 */

const listen = <T>(channel: string, cb: (value: T) => void) => {
    const handler = (_e: IpcRendererEvent, value: T) => cb(value)
    ipcRenderer.on(channel, handler)
    return () => {
        ipcRenderer.removeListener(channel, handler)
    }
}

contextBridge.exposeInMainWorld("jewelDesktop", {
    isDesktop: true,
    info: () => ipcRenderer.invoke("app:info"),
    openLibraryFolder: () => ipcRenderer.invoke("library:open"),
    onUpdateStatus: (cb: (s: unknown) => void) => listen("update:status", cb),
    installUpdate: () => ipcRenderer.invoke("update:install"),
    openReleasePage: () => ipcRenderer.invoke("update:open-page"),
    checkForUpdates: () => ipcRenderer.invoke("update:check"),
    takeJoinLink: () => ipcRenderer.invoke("join:take"),
    onJoinLink: (cb: (link: string) => void) => listen("join:link", cb),
})
