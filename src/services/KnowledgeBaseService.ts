import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import Database from 'better-sqlite3';

interface SettingsReader { get(key: string): string | null; set(key: string, value: string): void; }

export interface KbSource { id: number; path: string; enabled: boolean; addedAt: string; fileCount: number; }

export class KnowledgeBaseService {
  constructor(
    private db: Database.Database,
    private settings: SettingsReader,
  ) {}

  private validateIsolation(sourceDir: string): void {
    const wikiDir = this.settings.get('kb_wiki_dir');
    if (!wikiDir) return;
    const norm = (p: string) => path.resolve(p);
    if (norm(wikiDir).startsWith(norm(sourceDir)) || norm(sourceDir).startsWith(norm(wikiDir))) {
      throw new Error('源目录不能与 wiki 目录重叠（避免 ingest 自循环）');
    }
  }

  private countMdFiles(dir: string): number {
    let n = 0;
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(md|markdown|mdx)$/i.test(entry.name)) n++;
      }
    };
    walk(dir);
    return n;
  }

  addSource(dirPath: string): KbSource {
    this.validateIsolation(dirPath);
    const maxDirs = parseInt(this.settings.get('kb_max_dirs') ?? '5', 10);
    const maxFiles = parseInt(this.settings.get('kb_max_files') ?? '30', 10);

    const existing = this.db.prepare('SELECT COUNT(*) AS n FROM kb_sources').get() as { n: number };
    if (existing.n >= maxDirs) throw new Error(`已达源目录上限 ${maxDirs}（kb_max_dirs）`);

    const currentTotal = this.totalEnabledFiles();
    const newCount = this.countMdFiles(dirPath);
    if (currentTotal + newCount > maxFiles) {
      throw new Error(`添加后将超源文件上限 ${maxFiles}（kb_max_files），当前已用 ${currentTotal}，本次将添加 ${newCount}`);
    }

    const stmt = this.db.prepare('INSERT INTO kb_sources (path, enabled) VALUES (?, 1)');
    const result = stmt.run(dirPath);
    log.info(`[KB] Added source: ${dirPath} (${newCount} files)`);
    return { id: Number(result.lastInsertRowid), path: dirPath, enabled: true, addedAt: new Date().toISOString(), fileCount: newCount };
  }

  removeSource(dirPath: string): void {
    this.db.prepare('DELETE FROM kb_sources WHERE path = ?').run(dirPath);
    log.info(`[KB] Removed source: ${dirPath}`);
  }

  listSources(): KbSource[] {
    const rows = this.db
      .prepare('SELECT id, path, enabled, added_at AS addedAt FROM kb_sources ORDER BY id')
      .all() as Array<{ id: number; path: string; enabled: number; addedAt: string }>;
    return rows.map((row) => ({
      id: row.id,
      path: row.path,
      enabled: Boolean(row.enabled),
      addedAt: row.addedAt,
      // Walk the dir to compute live file count; if the source dir was removed
      // or is unreadable we report 0 instead of crashing the whole list.
      fileCount: this.safeCount(row.path),
    }));
  }

  private safeCount(dir: string): number {
    try {
      if (!fs.existsSync(dir)) return 0;
      return this.countMdFiles(dir);
    } catch {
      return 0;
    }
  }

  private totalEnabledFiles(): number {
    const sources = this.db.prepare('SELECT path FROM kb_sources WHERE enabled = 1').all() as { path: string }[];
    let total = 0;
    for (const s of sources) {
      if (fs.existsSync(s.path)) total += this.countMdFiles(s.path);
    }
    return total;
  }
}
