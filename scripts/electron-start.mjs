// Open the desktop shell on the built app (run `npm run build` first).
import { spawn } from "node:child_process"
import electronPath from "electron"

// VS Code's terminal sets ELECTRON_RUN_AS_NODE; the app needs real Electron
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
spawn(electronPath, ["."], { stdio: "inherit", env }).on("exit", (code) => process.exit(code ?? 0))
