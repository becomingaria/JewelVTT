import type { FeatureModule } from "../types"
import { desktop } from "../../desktop"
import { showToast } from "../../utils/toast"
import { UpdateNotice } from "./UpdateNotice"

/*
 * Desktop app extras: the update notice and library-folder commands.
 * Renders nothing in a plain browser.
 */

export const feature: FeatureModule = {
    id: "desktop",
    AppLayer: desktop ? UpdateNotice : undefined,
    commands: desktop
        ? [
              {
                  id: "desktop:check-updates",
                  label: "Check for updates",
                  keywords: "version upgrade release",
                  run: () => {
                      void desktop!.checkForUpdates().then((ok) =>
                          showToast(ok ? "Checking for updates…" : "Updates are checked in the installed app only.")
                      )
                  },
              },
              {
                  id: "desktop:library-folder",
                  label: "Open art library folder",
                  keywords: "tokens maps images Token_Library Maps_Library",
                  run: () => {
                      void desktop!.openLibraryFolder()
                      void desktop!.info().then((i) =>
                          showToast(`Put token and map images in ${i.libraryFolder}`)
                      )
                  },
              },
          ]
        : undefined,
}
