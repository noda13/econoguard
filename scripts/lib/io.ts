import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = resolve(__dirname, '../../frontend/public/data');

export function readJson<T>(filename: string, fallback: T): T {
  try { return JSON.parse(readFileSync(resolve(DATA_DIR, filename), 'utf-8')); } catch { return fallback; }
}

export function writeJson(filename: string, data: unknown): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, filename), JSON.stringify(data, null, 2));
}
