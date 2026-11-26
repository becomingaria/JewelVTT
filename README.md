# Jewel VTT

An infinite whiteboard application built with React, TypeScript, and Vite. Features an expandable canvas with zoom and pan capabilities, similar to Miro.

## Features

-   **Infinite Canvas**: Expand in all directions from center origin (0,0)
-   **Zoom Controls**: Scroll to zoom in/out (10% - 500%)
-   **Pan Navigation**: Click and drag to navigate the canvas
-   **Grid System**: 32x32 pixel squares with coordinate display
-   **Coordinate System**: Centered at origin with red axis markers
-   **Responsive**: Adapts to window size changes

## Getting Started

### Prerequisites

-   Node.js (v20.19.0 or >=22.12.0 recommended)
-   npm

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd jewel-vtt
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Controls

-   **Mouse Wheel**: Zoom in/out
-   **Click + Drag**: Pan around the canvas
-   **Grid Coordinates**: Displayed when zoomed in enough

## Development

This project uses:

-   **React 18** with TypeScript
-   **Vite** for fast development and building
-   **Canvas API** for rendering the infinite grid
-   **ESLint** for code quality

### Project Structure

```
src/
├── components/
│   ├── InfiniteWhiteboard.tsx    # Main whiteboard component
│   └── InfiniteWhiteboard.css    # Whiteboard styles
├── App.tsx                       # Main application component
├── App.css                       # Application styles
├── index.css                     # Global styles
└── main.tsx                      # Application entry point
```

## Scripts

-   `npm run dev` - Start development server on port 3000
-   `npm run build` - Build for production
-   `npm run preview` - Preview production build
-   `npm run lint` - Run ESLint

## On the web (Netlify)

The same app runs as a website: `netlify.toml` builds it (`npm run build` →
`dist/`, Node 22, no Electron download). Everything works in the browser,
including hosting and joining games, except:

-   the built-in art libraries (local files, too big to host): the drawer
    says so and offers **My Folder** (pick a folder on your computer, in
    Chrome and Edge) instead; uploads and image links work as usual;
-   cropping an image from a site that blocks it (the dev server's image
    fetcher isn't on the website);
-   auto-updates and `jewel://` links (desktop only).

Boards are kept in the browser that made them.

## Desktop app (Windows, macOS, Linux)

Jewel VTT also runs as a desktop app built with Electron.

-   `npm run electron:dev` opens the desktop app on the dev server.
-   `npm run electron:start` builds and opens the desktop app.
-   `npm run dist` builds installers for your own platform into `release/`.

Art libraries live in `Documents/Jewel VTT/Token_Library` and `Maps_Library`
in the desktop app (the command palette has "Open art library folder").

### Releasing an update

1. Bump `version` in `package.json` and commit.
2. Tag and push: `git tag v0.2.0 && git push origin v0.2.0`.
3. GitHub Actions (`.github/workflows/release.yml`) builds all three
   platforms and publishes one GitHub Release when they're all uploaded.

Installed apps check for a new release when they open:

-   **Windows / Linux (AppImage):** the update downloads in the background
    and a small notice offers **Restart now** (it also installs next time the
    app closes).
-   **macOS:** Jewel VTT is freeware without an Apple Developer certificate,
    so the Mac app can't install updates itself. The notice links to the new
    download instead. The first time, open it via System Settings → Privacy &
    Security → **Open Anyway**.

## Playing together (peer-to-peer)

Open **Multiplayer** in the tool dock.

-   **GM:** "Host this board", then send players the room link. On the
    website it's a web address (`https://<site>/#join/...`) that opens the
    game in the player's browser with the join form filled in, nothing to
    install; keep the GM's tab open while playing. The desktop app shares
    `jewel://join/...` links, or web links too when built with
    `VITE_WEB_URL=https://<site>/` (e.g. in the release workflow), so a GM on
    the desktop app can invite players who only have a browser. Knock to join, private labels, device and IP
    display, kick, ban (device and IP), new room code (keep or drop
    players), and "Share my view". Each player's tokens are listed under
    their name; right-click any token to **Give to** a player, **Pause** a
    player (or everyone), set tokens per player, require approval for new
    tokens, and keep moves to where the party can see.
-   **Players:** open the link (or paste it, web or `jewel://`) and Join. Save characters in **My
    characters** (kept in your app), **Place on map** on a spot the party
    can see, move (and undo), rename, take off the table, choose light and
    vision, roll dice, look around, and follow the GM's shared view. The
    person button next to home (or `J`) jumps to your token. A player's own
    saved board comes back when they leave.

Sight is blocked by walls: dungeon walls, **Sight walls** the GM draws over
a map picture (`Shift+B`), closed doors, and any object with **Blocks
sight** on (Edit dialog or right-click). Light stops at walls too.

No servers: apps find each other through free public Nostr relays (the room
secret encrypts that), then connect directly with WebRTC. The GM's app
filters what players receive, so GM-only objects, unrevealed areas and exact
monster HP never leave the GM's computer. Each side can see the other's IP
address, as with any direct connection. Some strict networks block direct
connections.

## Technical Details

-   **Grid Size**: 32x32 pixels per square
-   **Coordinate System**: Origin at center (0,0)
-   **Zoom Range**: 10% to 500%
-   **Performance**: Efficient viewport culling for large canvases
    ],
    languageOptions: {
    parserOptions: {
    project: ['./tsconfig.node.json', './tsconfig.app.json'],
    tsconfigRootDir: import.meta.dirname,
    },
    // other options...
    },
    },
    ])

````

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
````
