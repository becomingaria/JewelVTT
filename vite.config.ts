import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { tokenLibrary } from "./vite-plugins/token-library"
import { imageProxy } from "./vite-plugins/image-proxy"

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tokenLibrary(), imageProxy()],
    server: {
        port: 3000,
    },
})
