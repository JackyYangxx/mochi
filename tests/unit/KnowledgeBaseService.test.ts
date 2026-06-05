import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { KnowledgeBaseService } from '../../src/services/KnowledgeBaseService';

describe('KnowledgeBaseService', () => {
  let tmpDir: string;
  let db: Database.Database;
  let service: KnowledgeBaseService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-test-'));
    db = new Database(':memory:');
    db.exec(`CREATE TABLE kb_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1, added_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
    db.exec(`CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);`);
    db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`).run('kb_max_dirs', '5');
    db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`).run('kb_max_files', '30');
    const settingsGet = (k: string) => db.prepare('SELECT value FROM settings WHERE key=?').get(k)?.value ?? null;
    const settingsSet = (k: string, v: string) => { db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(k, v); };
    service = new KnowledgeBaseService(db, { get: settingsGet, set: settingsSet });
  });
  afterEach(() => { db.close(); fs.rmSync(tmpDir, { recursive: true, force: true }); });

  test('addSource() rejects when source dir contains wiki dir (F4)', () => {
    const wikiDir = path.join(tmpDir, 'wiki');
    const sourceDir = path.join(tmpDir, 'notes');
    fs.mkdirSync(wikiDir, { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(path.join(sourceDir, '__wiki__'), { recursive: true });
    const badWiki = path.join(sourceDir, '__wiki__');
    (service as any).settings.set('kb_wiki_dir', badWiki);

    expect(() => service.addSource(sourceDir)).toThrow(/wiki/);
  });

  test('addSource() rejects when wiki dir contains source dir (F4 reverse)', () => {
    const wikiDir = path.join(tmpDir, 'wiki');
    const sourceDir = path.join(wikiDir, 'sub', 'notes');
    fs.mkdirSync(sourceDir, { recursive: true });
    (service as any).settings.set('kb_wiki_dir', wikiDir);

    expect(() => service.addSource(sourceDir)).toThrow(/wiki/);
  });

  test('addSource() enforces max_dirs limit', () => {
    (service as any).settings.set('kb_wiki_dir', path.join(tmpDir, 'wiki'));
    for (let i = 0; i < 5; i++) {
      const d = path.join(tmpDir, `dir${i}`);
      fs.mkdirSync(d, { recursive: true });
      service.addSource(d);
    }
    const overflow = path.join(tmpDir, 'dir5');
    fs.mkdirSync(overflow, { recursive: true });
    expect(() => service.addSource(overflow)).toThrow(/目录数|kb_max_dirs/);
  });

  test('addSource() enforces max_files limit (sum across dirs)', () => {
    (service as any).settings.set('kb_wiki_dir', path.join(tmpDir, 'wiki'));
    const d1 = path.join(tmpDir, 'd1');
    fs.mkdirSync(d1, { recursive: true });
    for (let i = 0; i < 20; i++) fs.writeFileSync(path.join(d1, `f${i}.md`), 'x');
    service.addSource(d1);

    const d2 = path.join(tmpDir, 'd2');
    fs.mkdirSync(d2, { recursive: true });
    for (let i = 0; i < 15; i++) fs.writeFileSync(path.join(d2, `g${i}.md`), 'x');
    expect(() => service.addSource(d2)).toThrow(/文件数|kb_max_files/);
  });

  test('removeSource() deletes the row', () => {
    (service as any).settings.set('kb_wiki_dir', path.join(tmpDir, 'wiki'));
    const d = path.join(tmpDir, 'd1');
    fs.mkdirSync(d, { recursive: true });
    service.addSource(d);
    service.removeSource(d);
    expect(service.listSources()).toHaveLength(0);
  });
});
