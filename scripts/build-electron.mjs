// Bundle the Electron main process and preload into dist-electron/.
import { build } from "esbuild"

const shared = {
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    sourcemap: true,
    // Provided by Electron / packed as real dependencies
    external: ["electron", "electron-updater", "sharp"],
    logLevel: "info",
}

await build({ ...shared, entryPoints: ["electron/main.ts"], outfile: "dist-electron/main.cjs" })
await build({ ...shared, entryPoints: ["electron/preload.ts"], outfile: "dist-electron/preload.cjs" })
