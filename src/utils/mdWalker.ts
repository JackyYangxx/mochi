import fs from 'fs';
import path from 'path';

const MD_EXT = /\.(md|markdown|mdx)$/i;

export function isMarkdownPath(p: string): boolean {
  return MD_EXT.test(p);
}

// Recursively collect every .md/.markdown/.mdx file under `dir`. Returns
// absolute paths. Skips unreadable subtrees silently so a single permission
// error doesn't abort the whole walk.
export function walkMdFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (isMarkdownPath(entry.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}
