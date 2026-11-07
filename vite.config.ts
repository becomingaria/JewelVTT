import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { tokenLibrary } from "./vite-plugins/token-library"

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tokenLibrary()],
    server: {
        port: 3000,
    },
})
