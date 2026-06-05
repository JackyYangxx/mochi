import fs from 'fs';
import path from 'path';
import os from 'os';
import { vi } from 'vitest';
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

describe('WikiIngestService.twoStepCoT', () => {
  let tmpDir: string; let db: Database.Database; let mockLlm: any; let svc: WikiIngestService;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-cot-'));
    db = new Database(':memory:');
    db.exec(`CREATE TABLE kb_pages (path TEXT PRIMARY KEY, title TEXT NOT NULL, page_type TEXT NOT NULL, content TEXT NOT NULL, source_path TEXT, sha256 TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
    db.exec(`CREATE TABLE kb_ingest_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, file_path TEXT NOT NULL, enqueued_at DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT NOT NULL DEFAULT 'pending', retry_count INTEGER DEFAULT 0, error TEXT);`);
    mockLlm = { chat: vi.fn() };
    svc = new WikiIngestService(db, { llm: mockLlm, wikiDir: tmpDir });
  });
  afterEach(() => {
    try { db.close(); } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
  });

  test('Step 1 calls LLM and validates JSON with zod', async () => {
    mockLlm.chat.mockResolvedValueOnce(JSON.stringify({
      summary: '...', entities: [{ name: 'Git', type: 'tool', isNew: true }], concepts: [],
      keyPoints: ['x'], linksTo: [], contradicts: [],
    }));
    const result = await svc.step1('source content', '# role', '## overview');
    expect(result.entities[0].name).toBe('Git');
    expect(mockLlm.chat).toHaveBeenCalledTimes(1);
  });

  test('Step 1 throws on invalid LLM JSON (zod parse failure)', async () => {
    mockLlm.chat.mockResolvedValueOnce('not json {{{');
    await expect(svc.step1('content', '', '')).rejects.toThrow();
  });

  test('Step 2 receives Step 1 output and returns wiki page contents', async () => {
    mockLlm.chat.mockResolvedValueOnce(JSON.stringify({
      sourcePage: { path: 'sources/abc.md', content: '# A' },
      entityPages: [], conceptPages: [], logEntries: ['created A'],
    }));
    const result = await svc.step2('source', { summary: 'x', entities: [], concepts: [], keyPoints: [], linksTo: [], contradicts: [] });
    expect(result.sourcePage.path).toBe('sources/abc.md');
  });

  test('retry logic: HTTP 429 triggers backoff then re-call', async () => {
    mockLlm.chat
      .mockRejectedValueOnce(Object.assign(new Error('rate'), { status: 429 }))
      .mockResolvedValueOnce(JSON.stringify({ summary: 'x', entities: [], concepts: [], keyPoints: [], linksTo: [], contradicts: [] }));
    // F5: 30s backoff is the spec; use fake timers to avoid waiting in tests.
    vi.useFakeTimers();
    try {
      const promise = svc.step1('content', '', '');
      // advance past the 30s backoff window
      await vi.advanceTimersByTimeAsync(30_000);
      await promise;
    } finally {
      vi.useRealTimers();
    }
    expect(mockLlm.chat).toHaveBeenCalledTimes(2);
  });
});
