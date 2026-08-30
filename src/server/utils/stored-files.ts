import fs from 'node:fs';
import path from 'node:path';
import { attachmentsDir } from '../config/paths.js';

export function unlinkStoredFile(filename: string): void {
  const filePath = path.join(attachmentsDir, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}