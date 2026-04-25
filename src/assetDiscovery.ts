import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CatAsset, CatAccessory } from './types';

const FRAME_FILE_NAMES = ['1.svg', '2.svg', '3.svg'];

function titleCase(id: string): string {
  return id
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

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

    // Require all 3 cat frames as SVG
    const hasAllFrames = FRAME_FILE_NAMES.every((f) => catFiles.includes(f));
    if (!hasAllFrames) {
      continue;
    }

    const accessories: CatAccessory[] = [];
    const acsDir = path.join(catDir, 'acs');
    if (fs.existsSync(acsDir) && fs.statSync(acsDir).isDirectory()) {
      const acsEntries = fs.readdirSync(acsDir, { withFileTypes: true });
      for (const acsEntry of acsEntries) {
        if (!acsEntry.isDirectory()) {
          continue;
        }
        const acsSubDir = path.join(acsDir, acsEntry.name);
        const acsFiles = fs.readdirSync(acsSubDir);
        const acsHasAllFrames = FRAME_FILE_NAMES.every((f) => acsFiles.includes(f));
        if (!acsHasAllFrames) {
          continue;
        }
        accessories.push({
          id: acsEntry.name,
          displayName: titleCase(acsEntry.name),
          frameFileNames: [...FRAME_FILE_NAMES],
        });
      }
      accessories.sort((a, b) => a.id.localeCompare(b.id));
    }

    cats.push({
      id: entry.name,
      displayName: titleCase(entry.name),
      frameFileNames: [...FRAME_FILE_NAMES],
      accessories,
    });
  }

  cats.sort((a, b) => a.id.localeCompare(b.id));
  return cats;
}
