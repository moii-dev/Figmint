# Figmint

Figmint is a lightweight Figma-inspired vector editor built with React, TypeScript, Vite, and Tailwind CSS. Projects are stored locally in the browser and remain compatible with the existing `figma_clone_projects_v3` data format.

## Features

- Infinite canvas with pan, zoom, rulers, grid, and smart snapping
- Frames with nested shapes and text
- Multi-selection, group move/resize, layer ordering, and reparenting
- Undo/redo, keyboard shortcuts, presentation mode, and SVG/PNG/JSON export
- Responsive drawer panels for narrow screens

## Local development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

The editor is available at `http://localhost:3000`.

## Checks

```bash
npm run test
npm run lint
npm run build
```

No API keys or backend services are required.
