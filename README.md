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
