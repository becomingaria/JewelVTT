// Run the Vite dev server and open the desktop shell on it.
import { spawn } from "node:child_process"
import { createServer } from "vite"
import electronPath from "electron"

const server = await createServer()
await server.listen()
const url = server.resolvedUrls?.local?.[0] ?? "http://localhost:3000/"

await import("./build-electron.mjs")

// VS Code's terminal sets ELECTRON_RUN_AS_NODE, which would start Electron
// as plain Node; the app needs the real thing
const env = { ...process.env, VITE_DEV_SERVER_URL: url }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electronPath, ["."], { stdio: "inherit", env })
child.on("exit", async (code) => {
    await server.close()
    process.exit(code ?? 0)
})
