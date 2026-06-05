import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { WikiIngestService } from '../../src/services/WikiIngestService';

describe('WikiIngestService.queue', () => {
  let tmpDir: string; let db: Database.Database; let svc: WikiIngestService;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-test-'));
    db = new Database(':memory:');
    db.exec(`CREATE TABLE kb_ingest_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, file_path TEXT NOT NULL, enqueued_at DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT NOT NULL DEFAULT 'pending', retry_count INTEGER DEFAULT 0, error TEXT);`);
    svc = new WikiIngestService(db, { llm: {} as any, wikiDir: tmpDir });
  });
  afterEach(() => {
    try { db.close(); } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
  });

  test('enqueue adds a pending job', () => {
    svc.enqueue('/a.md');
    const jobs = db.prepare(`SELECT * FROM kb_ingest_queue`).all() as any[];
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('pending');
  });

  test('pickNextJob returns oldest pending job and marks processing', () => {
    svc.enqueue('/a.md');
    svc.enqueue('/b.md');
    const job = svc.pickNextJob();
    expect(job?.file_path).toBe('/a.md');
    const row = db.prepare('SELECT status FROM kb_ingest_queue WHERE id = ?').get(job!.id) as { status: string };
    expect(row.status).toBe('processing');
  });
});

describe('WikiIngestService.atomicWrite', () => {
  let tmpDir: string; let db: Database.Database; let svc: WikiIngestService;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-aw-'));
    db = new Database(':memory:');
    db.exec(`CREATE TABLE kb_pages (path TEXT PRIMARY KEY, title TEXT NOT NULL, page_type TEXT NOT NULL, content TEXT NOT NULL);`);
    svc = new WikiIngestService(db, { llm: {} as any, wikiDir: tmpDir });
  });
  afterEach(() => {
    try { db.close(); } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
  });

  test('atomicWrite creates file and leaves no .tmp residue', async () => {
    const target = path.join(tmpDir, 'page.md');
    await (svc as any).atomicWrite(target, '# hello');
    expect(fs.readFileSync(target, 'utf-8')).toBe('# hello');
    expect(fs.existsSync(target + '.tmp')).toBe(false);
  });
});
