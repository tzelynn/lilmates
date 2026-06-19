# LilMate

A VS Code extension that puts a cute animated cat companion in your sidebar. It reacts to your typing with a bouncy ping-pong animation, and you can unlock new cats and accessories through a gacha system powered by your keystrokes.

## Features

- **Typing animation** -- Your cat animates through a 3-frame ping-pong loop (1 -> 2 -> 3 -> 2 -> 1) every time you type. Returns to a resting pose after 3 seconds of inactivity.
- **Gacha system** -- Spend "meows" (earned by typing) to randomly unlock new cats and accessories. Each pull costs 100 meows and guarantees a new item you haven't unlocked yet.
- **Accessories** -- Equip accessories on your cats. Accessories overlay on top of the cat animation across all frames.
- **Collection panel** -- Browse all cats and accessories, see what's locked/unlocked, switch your active cat, and toggle accessories on/off.

## Getting started

### Prerequisites

- Node.js
- VS Code 1.85+

### Install dependencies

```
npm install
```

### Build

```
npm run build
```

### Development

```
npm run watch
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

### Lint

```
npm run lint
```

## Adding new cats

### Obtaining the SVGs from PNGs

1. Save each animal and hat frame separate (3 each, 6 in total for a single gif)
2. Upload png to https://tosvg.com/
3. Resize to 512 x 512 and export as .svg file


Place a new folder under `assets/mates/<cat-name>/` with:

| File | Purpose |
|------|---------|
| `1.SVG` | Frame 1 |
| `2.SVG` | Frame 2 |
| `3.SVG` | Frame 3 |
| `asc/<asc_name>/1.SVG` | Optional accessory overlay |
| `asc/<asc_name>/2.SVG` | Optional accessory overlay |
| `asc/<asc_name>/3.SVG` | Optional accessory overlay |

The extension auto-discovers all cat folders at startup. The folder name becomes the cat's ID and display name (capitalized).

## Project structure

```
src/
  extension.ts        -- Entry point; tracks text changes, wires up components
  catViewProvider.ts   -- Webview sidebar provider
  stateManager.ts      -- Persists unlock state and type count via VS Code globalState
  gachaSystem.ts       -- Gacha pull logic and available item pool
  assetDiscovery.ts    -- Scans assets/mates/ for cats and accessories at startup
  types.ts             -- Shared TypeScript types and message interfaces
media/
  webview.js           -- Webview frontend (animation, controls, collection UI)
  webview.css          -- Webview styles (uses VS Code theme variables)
assets/
  icon.svg             -- Activity bar icon
  mates/               -- Cat sprite folders
```
