# Figmint

Figmint is a free, open-source, local-first vector editor inspired by professional interface design tools. It is an independent project built with React, TypeScript, Vite, and Tailwind CSS. Projects stay in the browser and remain compatible with the existing `figma_clone_projects_v3` data format.

## Features

- Infinite canvas with pan, zoom, rulers, grid, and smart snapping
- Frames with nested shapes and text
- Reusable main components, linked instances, overrides, reset, and detach
- Auto Layout with horizontal/vertical flow, gap, padding, alignment, Hug, Fill, and absolute children
- Editable color, spacing, and radius tokens with live bindings
- Built-in open UI kit with buttons, fields, controls, cards, and navigation elements
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

## License

[MIT](./LICENSE) © 2026 Moii-gh. Figmint is not affiliated with Figma.
