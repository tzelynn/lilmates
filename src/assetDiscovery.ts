import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CatAsset, CatAccessory } from './types';

export function discoverAssets(extensionUri: vscode.Uri): CatAsset[] {
  const matesDir = path.join(extensionUri.fsPath, 'assets', 'mates');

  if (!fs.existsSync(matesDir)) {
    return [];
  }

  const entries = fs.readdirSync(matesDir, { withFileTypes: true });
  const cats: CatAsset[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const catDir = path.join(matesDir, entry.name);
    const catFiles = fs.readdirSync(catDir);

    // Check that all 3 frames exist
    const frameFileNames = ['1.PNG', '2.PNG', '3.PNG'];
    const hasAllFrames = frameFileNames.every((f) => catFiles.includes(f));
    if (!hasAllFrames) {
      continue;
    }

    // Discover accessories: files matching acs_*.PNG
    const accessories: CatAccessory[] = catFiles
      .filter((f: string) => f.startsWith('acs_') && f.endsWith('.PNG'))
      .map((f: string) => {
        const id = f.replace('acs_', '').replace('.PNG', '');
        return {
          id,
          displayName: id.charAt(0).toUpperCase() + id.slice(1),
          fileName: f,
        };
      });

    cats.push({
      id: entry.name,
      displayName: entry.name.charAt(0).toUpperCase() + entry.name.slice(1),
      frameFileNames,
      accessories,
    });
  }

  // Sort alphabetically for consistent ordering
  cats.sort((a, b) => a.id.localeCompare(b.id));
  return cats;
}
