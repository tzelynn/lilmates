# CLAUDE.md

## Project overview

LilMate is a VS Code extension (TypeScript + webview). It shows an animated cat in the sidebar that reacts to typing, with a gacha system for unlocking cats and accessories.

## Build and run

```bash
npm run build      # esbuild bundle -> out/extension.js
npm run watch      # esbuild watch mode
npm run lint       # tsc --noEmit (type checking only)
```

Press F5 in VS Code to launch the Extension Development Host.

## Architecture

- **Extension host** (`src/`): TypeScript compiled via esbuild. Entry point is `src/extension.ts` which activates on startup, listens for `onDidChangeTextDocument`, and registers the webview provider.
- **Webview** (`media/`): Plain JS/CSS loaded into a VS Code sidebar webview. Communicates with the extension host via `postMessage`. The message types are defined in `src/types.ts` (`ExtToWebviewMessage` and `WebviewToExtMessage`).
- **Assets** (`assets/mates/`): Each subfolder is a cat. Must contain `1.svg`, `2.svg`, `3.svg` for frames. Accessories live in `<cat>/acs/<accessoryName>/{1,2,3}.svg` — each accessory has its own 3 frames that match the cat's 3 frames 1-to-1 (frame N of the accessory is overlaid while frame N of the cat is showing). Discovered at activation by `src/assetDiscovery.ts`.

## Key conventions

- State is persisted via `vscode.Memento` (globalState), not files on disk. The `StateManager` batches type count writes on a 5-second interval.
- The webview preloads all images into an in-memory cache before rendering, so animation remains smooth at fast typing speeds.
- The gacha pool is computed dynamically from what's still locked. Pull cost is 100 meows. Users are guaranteed a new item per pull.
- Frame animation follows a ping-pong pattern: indices [0, 1, 2, 1] repeating. After 3 seconds idle, resets to frame 0. The equipped accessory's frames are driven by the same index so they stay in sync with the cat.
- At most one accessory can be equipped per cat at a time. State is `activeAccessory: Record<string, string | null>`; the webview sends `set-accessory` with a nullable `accessoryId` (null to unequip). The collection UI uses radio buttons with an explicit "None" option, and reclicking the equipped accessory deselects it.
- The webview uses VS Code CSS variables (`--vscode-*`) for theming -- do not hardcode colors.
- CSP is enforced in the webview HTML with a per-render nonce.

## File layout

```
src/extension.ts        -- activation, event wiring
src/catViewProvider.ts   -- webview provider, HTML generation, message routing
src/stateManager.ts      -- state persistence (globalState memento)
src/gachaSystem.ts       -- gacha logic (pool, cost, pull)
src/assetDiscovery.ts    -- filesystem scan for cat assets
src/types.ts             -- all shared types and message interfaces
media/webview.js         -- webview frontend logic
media/webview.css        -- webview styles
```
