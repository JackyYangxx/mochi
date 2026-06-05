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

describe('WikiIngestService.worker', () => {
  let tmpDir: string; let wikiDir: string; let db: Database.Database; let mockLlm: any; let svc: WikiIngestService;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-worker-src-'));
    wikiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-worker-wiki-'));
    db = new Database(':memory:');
    db.exec(`CREATE TABLE kb_ingest_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, file_path TEXT NOT NULL, enqueued_at DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT NOT NULL DEFAULT 'pending', retry_count INTEGER DEFAULT 0, error TEXT);`);
    mockLlm = { chat: vi.fn() };
    svc = new WikiIngestService(db, { llm: mockLlm, wikiDir });
  });
  afterEach(() => {
    svc.stopWorker();
    try { db.close(); } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(wikiDir, { recursive: true, force: true });
    }
  });

  test('startWorker drains queue: enqueued file is processed and marked done', async () => {
    // Arrange: a real .md source file in tmpDir
    const sourcePath = path.join(tmpDir, 'sample.md');
    fs.writeFileSync(sourcePath, '# source content', 'utf-8');

    // Step 1 mock
    mockLlm.chat.mockResolvedValueOnce(JSON.stringify({
      summary: '...', entities: [], concepts: [], keyPoints: ['x'], linksTo: [], contradicts: [],
    }));
    // Step 2 mock
    mockLlm.chat.mockResolvedValueOnce(JSON.stringify({
      sourcePage: { path: 'sources/sample.md', content: '# generated' },
      entityPages: [], conceptPages: [], logEntries: [],
    }));

    svc.enqueue(sourcePath);

    // Act: start worker with 50ms poll for fast test
    svc.startWorker(50);

    // Wait for job to reach 'done' status
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const row = db.prepare('SELECT status FROM kb_ingest_queue WHERE file_path = ?').get(sourcePath) as { status: string } | undefined;
      if (row?.status === 'done') break;
      await new Promise(r => setTimeout(r, 50));
    }

    // Assert: status=done
    const finalRow = db.prepare('SELECT status, error FROM kb_ingest_queue WHERE file_path = ?').get(sourcePath) as { status: string; error: string | null };
    expect(finalRow.status).toBe('done');
    expect(finalRow.error).toBeNull();

    // Assert: file written to wikiDir with the right path + content
    const writtenPath = path.join(wikiDir, 'sources', 'sample.md');
    expect(fs.existsSync(writtenPath)).toBe(true);
    expect(fs.readFileSync(writtenPath, 'utf-8')).toBe('# generated');
  });

  test('startWorker is idempotent: calling twice does not create two loops', () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    svc.startWorker(50);
    const callsAfterFirst = setTimeoutSpy.mock.calls.length;
    svc.startWorker(50);  // should be a no-op
    expect(setTimeoutSpy.mock.calls.length).toBe(callsAfterFirst);
    setTimeoutSpy.mockRestore();
  });

  test('stopWorker halts the loop and prevents further processing', async () => {
    svc.enqueue('/nonexistent.md');  // will fail in step1
    svc.startWorker(50);
    // Let it tick once and process (fails because file doesn't exist)
    await new Promise(r => setTimeout(r, 100));
    // The job that ran before stop should be marked as 'failed' (readFileSync error)
    const firstJob = db.prepare(`SELECT status FROM kb_ingest_queue WHERE file_path = ?`).get('/nonexistent.md') as { status: string };
    expect(firstJob.status).toBe('failed');
    svc.stopWorker();
    // Re-enqueue and verify it does NOT get processed after stop
    const callsBefore = mockLlm.chat.mock.calls.length;
    svc.enqueue('/another-nonexistent.md');
    await new Promise(r => setTimeout(r, 200));
    expect(mockLlm.chat.mock.calls.length).toBe(callsBefore);
  });

  test('absolute path returned by LLM is rejected and job marked failed', async () => {
    // Arrange: a real source file
    const sourcePath = path.join(tmpDir, 'sample.md');
    fs.writeFileSync(sourcePath, '# source content', 'utf-8');

    // Step 1 mock
    mockLlm.chat.mockResolvedValueOnce(JSON.stringify({
      summary: '...', entities: [], concepts: [], keyPoints: ['x'], linksTo: [], contradicts: [],
    }));
    // Step 2 mock returns an ABSOLUTE path (a potential arbitrary-write attack)
    const evilPath = path.join(tmpDir, 'evil-target.md');
    mockLlm.chat.mockResolvedValueOnce(JSON.stringify({
      sourcePage: { path: evilPath, content: 'malicious content' },
      entityPages: [], conceptPages: [], logEntries: [],
    }));

    svc.enqueue(sourcePath);
    svc.startWorker(50);

    // Wait for the job to be marked failed
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const row = db.prepare('SELECT status FROM kb_ingest_queue WHERE file_path = ?').get(sourcePath) as { status: string } | undefined;
      if (row?.status === 'failed') break;
      await new Promise(r => setTimeout(r, 50));
    }

    const finalRow = db.prepare('SELECT status, error FROM kb_ingest_queue WHERE file_path = ?').get(sourcePath) as { status: string; error: string | null };
    expect(finalRow.status).toBe('failed');
    expect(finalRow.error).toMatch(/absolute path/i);

    // Critical security assertion: the evil target file must NOT have been written
    expect(fs.existsSync(evilPath)).toBe(false);
  });
});

describe('WikiIngestService.statsAndRebuild', () => {
  let tmpDir: string; let wikiDir: string; let db: Database.Database; let mockLlm: any; let svc: WikiIngestService;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-stats-'));
    wikiDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ingest-stats-wiki-'));
    db = new Database(':memory:');
    db.exec(`CREATE TABLE kb_ingest_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, file_path TEXT NOT NULL, enqueued_at DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT NOT NULL DEFAULT 'pending', retry_count INTEGER DEFAULT 0, error TEXT);`);
    db.exec(`CREATE TABLE kb_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1, added_at DATETIME DEFAULT CURRENT_TIMESTAMP);`);
    mockLlm = { chat: vi.fn() };
    svc = new WikiIngestService(db, { llm: mockLlm, wikiDir });
  });
  afterEach(() => {
    svc.stopWorker();
    try { db.close(); } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(wikiDir, { recursive: true, force: true });
    }
  });

  test('getStats returns counts grouped by status', () => {
    svc.enqueue('/a.md');
    svc.enqueue('/b.md');
    db.prepare(`UPDATE kb_ingest_queue SET status = 'failed' WHERE file_path = '/a.md'`).run();
    const stats = svc.getStats();
    expect(stats.pending).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.processing).toBe(0);
  });

  test('getStats returns lastIngestedAt when there is a done row', () => {
    db.prepare(`INSERT INTO kb_ingest_queue (file_path, enqueued_at, status) VALUES (?, '2026-01-01 00:00:00', 'done')`).run('/done1.md');
    db.prepare(`INSERT INTO kb_ingest_queue (file_path, enqueued_at, status) VALUES (?, '2026-02-15 12:34:56', 'done')`).run('/done2.md');
    db.prepare(`INSERT INTO kb_ingest_queue (file_path, enqueued_at, status) VALUES (?, '2026-03-01 00:00:00', 'pending')`).run('/pending.md');
    const stats = svc.getStats();
    expect(stats.lastIngestedAt).toBe('2026-02-15 12:34:56');  // most recent done
    expect(stats.pending).toBe(1);
  });

  test('getStats returns lastIngestedAt = null when there are no done rows', () => {
    svc.enqueue('/a.md');
    const stats = svc.getStats();
    expect(stats.lastIngestedAt).toBeNull();
  });

  test('rebuildAll re-enqueues every .md file under every enabled source', async () => {
    // rebuildAll walks each source dir for .md files. Use real temp dirs.
    const src1 = fs.mkdtempSync(path.join(tmpDir, 'src1-'));
    const src2 = fs.mkdtempSync(path.join(tmpDir, 'src2-'));
    const src3Disabled = fs.mkdtempSync(path.join(tmpDir, 'src3-'));
    fs.writeFileSync(path.join(src1, 'a.md'), '# A');
    fs.writeFileSync(path.join(src1, 'b.md'), '# B');
    fs.writeFileSync(path.join(src2, 'c.md'), '# C');
    fs.writeFileSync(path.join(src3Disabled, 'd.md'), '# D (disabled)');

    db.prepare(`INSERT INTO kb_sources (path, enabled) VALUES (?, 1)`).run(src1);
    db.prepare(`INSERT INTO kb_sources (path, enabled) VALUES (?, 1)`).run(src2);
    db.prepare(`INSERT INTO kb_sources (path, enabled) VALUES (?, 0)`).run(src3Disabled);

    const result = await svc.rebuildAll();
    expect(result.reEnqueued).toBe(3); // 2 + 1, disabled source excluded
    const pending = db.prepare(`SELECT COUNT(*) as n FROM kb_ingest_queue WHERE status = 'pending'`).get() as { n: number };
    expect(pending.n).toBe(3);
  });

  test('rebuildAll is idempotent: calling twice does not double-insert pending rows', async () => {
    const src1 = fs.mkdtempSync(path.join(tmpDir, 'src1-'));
    const src2 = fs.mkdtempSync(path.join(tmpDir, 'src2-'));
    fs.writeFileSync(path.join(src1, 'a.md'), '# A');
    fs.writeFileSync(path.join(src2, 'b.md'), '# B');
    db.prepare(`INSERT INTO kb_sources (path, enabled) VALUES (?, 1)`).run(src1);
    db.prepare(`INSERT INTO kb_sources (path, enabled) VALUES (?, 1)`).run(src2);
    await svc.rebuildAll();
    await svc.rebuildAll();
    const pending = db.prepare(`SELECT COUNT(*) as n FROM kb_ingest_queue WHERE status = 'pending'`).get() as { n: number };
    expect(pending.n).toBe(2);  // still 2, not 4
  });
});
