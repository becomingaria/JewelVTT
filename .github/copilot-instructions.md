# Copilot Instructions for Jewel VTT

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This is a React + TypeScript + Vite project for creating an infinite whiteboard application similar to Miro.

## Project Context

-   **Framework**: React with TypeScript
-   **Build Tool**: Vite
-   **Purpose**: Infinite whiteboard with zoom and pan capabilities
-   **Grid System**: 32x32 pixel squares
-   **Coordinate System**: Centered at origin (0,0) expanding in all directions

## Key Features

-   Infinite canvas that expands in all directions
-   Zoom in/out functionality
-   Pan/drag to navigate
-   Grid-based coordinate system (32px squares)
-   Touch and mouse support

## Development Guidelines

-   Use TypeScript for all new components
-   Follow React functional component patterns with hooks
-   Use CSS Modules or styled-components for styling
-   Optimize for performance with large canvases
-   Consider using Canvas API or SVG for rendering
-   Implement efficient viewport culling for performance
