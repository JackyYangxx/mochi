import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { z } from 'zod';
import log from 'electron-log';

const Step1Output = z.object({
  summary: z.string(),
  entities: z.array(z.object({ name: z.string(), type: z.string(), isNew: z.boolean() })),
  concepts: z.array(z.object({ name: z.string(), description: z.string() })),
  keyPoints: z.array(z.string()),
  linksTo: z.array(z.string()),
  contradicts: z.array(z.string()),
});

const Step2Output = z.object({
  sourcePage: z.object({ path: z.string(), content: z.string() }),
  entityPages: z.array(z.object({ name: z.string(), content: z.string(), mergeWithExisting: z.boolean() })),
  conceptPages: z.array(z.object({ name: z.string(), content: z.string(), mergeWithExisting: z.boolean() })),
  indexUpdate: z.string().optional(),
  overviewUpdate: z.string().optional(),
  logEntries: z.array(z.string()),
});

interface IngestDeps { llm: any; wikiDir: string; }
export class WikiIngestService {
  private workerTimer: NodeJS.Timeout | null = null;
  private workerRunning = false;
  private workerShouldStop = false;

  constructor(private db: Database.Database, private deps: IngestDeps) {}

  enqueue(filePath: string): void {
    this.db.prepare(`INSERT INTO kb_ingest_queue (file_path) VALUES (?)`).run(filePath);
  }

  pickNextJob(): { id: number; file_path: string } | null {
    const tx = this.db.transaction(() => {
      const job = this.db.prepare(`SELECT id, file_path FROM kb_ingest_queue WHERE status='pending' ORDER BY enqueued_at LIMIT 1`).get() as { id: number; file_path: string } | undefined;
      if (job) this.db.prepare(`UPDATE kb_ingest_queue SET status='processing' WHERE id=?`).run(job.id);
      return job ?? null;
    });
    return tx();
  }

  // F5: atomic write via tmp + rename
  async atomicWrite(filePath: string, content: string): Promise<void> {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = filePath + '.tmp';
    await fs.promises.writeFile(tmpPath, content, 'utf-8');
    const fh = await fs.promises.open(tmpPath, 'r');
    try { await fh.sync(); } finally { await fh.close(); }
    await fs.promises.rename(tmpPath, filePath);
  }

  async step1(sourceContent: string, roleContent: string, overviewContent: string, jobId = 0): Promise<z.infer<typeof Step1Output>> {
    return this.withRetry(async () => {
      // F5: kbContext=false to avoid recursion
      const response = await this.deps.llm.chat({
        systemPrompt: `${roleContent}\n\n${overviewContent}`,
        userPrompt: `分析以下源材料:\n\n${sourceContent}`,
        kbContext: false,
      });
      return Step1Output.parse(JSON.parse(response));
    }, jobId);
  }

  async step2(sourceContent: string, step1Data: z.infer<typeof Step1Output>, jobId = 0): Promise<z.infer<typeof Step2Output>> {
    return this.withRetry(async () => {
      const response = await this.deps.llm.chat({
        systemPrompt: '基于 Step 1 分析生成 wiki 页面。返回 JSON。',
        userPrompt: `Step 1: ${JSON.stringify(step1Data)}\n源: ${sourceContent}`,
        kbContext: false,
      });
      return Step2Output.parse(JSON.parse(response));
    }, jobId);
  }

  private async withRetry<T>(fn: () => Promise<T>, jobId: number): Promise<T> {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        const is429 = err?.status === 429;
        if (is429) {
          const backoffMs = 30000;
          log.warn(`[WikiIngest] HTTP 429, backoff ${backoffMs}ms (attempt ${attempt + 1})`);
          await new Promise(r => setTimeout(r, backoffMs));
        } else {
          log.warn(`[WikiIngest] LLM error (attempt ${attempt + 1}):`, err);
        }
        this.db.prepare(`UPDATE kb_ingest_queue SET retry_count = retry_count + 1, error = ? WHERE id = ?`).run(String(err), jobId);
      }
    }
    this.db.prepare(`UPDATE kb_ingest_queue SET status = 'failed' WHERE id = ?`).run(jobId);
    log.error('[WikiIngest] LLM retries exhausted for job', jobId);
    throw new Error('LLM retries exhausted');
  }

  // Phase 4: worker loop that drains the queue.
  // Polls pickNextJob() every `pollIntervalMs` and runs step1 -> step2 -> atomicWrite.
  // Idempotent: calling startWorker() multiple times is a no-op while already running.
  startWorker(pollIntervalMs = 2000): void {
    if (this.workerRunning) return;
    this.workerRunning = true;
    this.workerShouldStop = false;
    const tick = async () => {
      if (this.workerShouldStop) {
        this.workerRunning = false;
        return;
      }
      try {
        await this.processNext();
      } catch (err) {
        log.error('[WikiIngest] worker tick error:', err);
      }
      if (!this.workerShouldStop) {
        this.workerTimer = setTimeout(tick, pollIntervalMs);
      } else {
        this.workerRunning = false;
      }
    };
    tick();
  }

  stopWorker(): void {
    this.workerShouldStop = true;
    if (this.workerTimer) {
      clearTimeout(this.workerTimer);
      this.workerTimer = null;
    }
  }

  private async processNext(): Promise<void> {
    const job = this.pickNextJob();
    if (!job) return;
    try {
      const sourceContent = fs.readFileSync(job.file_path, 'utf-8');
      const role = '';  // Phase 4 closure: role injection happens via LLMService.chat() kbContext path
      const step1Data = await this.step1(sourceContent, role, '', job.id);
      const step2Data = await this.step2(sourceContent, step1Data, job.id);
      // Security: LLM is untrusted. Reject absolute paths so path.join can't be coerced
      // into writing outside wikiDir (e.g. /etc/passwd). Relative paths only.
      const sourcePagePath = step2Data.sourcePage.path;
      if (path.isAbsolute(sourcePagePath)) {
        throw new Error(`LLM returned absolute path for sourcePage: ${sourcePagePath} (must be relative)`);
      }
      await this.atomicWrite(
        path.join(this.deps.wikiDir, sourcePagePath),
        step2Data.sourcePage.content,
      );
      this.db.prepare(`UPDATE kb_ingest_queue SET status = 'done' WHERE id = ?`).run(job.id);
      log.info(`[WikiIngest] job ${job.id} done: ${job.file_path}`);
    } catch (err) {
      log.error(`[WikiIngest] job ${job.id} failed:`, err);
      this.db.prepare(`UPDATE kb_ingest_queue SET status = 'failed', error = ? WHERE id = ?`).run(String(err), job.id);
    }
  }

  // Phase 4: stats for IPC handler `kb:getStats`.
  getStats(): { pending: number; processing: number; failed: number; lastIngestedAt: string | null } {
    const counts = this.db.prepare(`
      SELECT status, COUNT(*) as n FROM kb_ingest_queue GROUP BY status
    `).all() as Array<{ status: string; n: number }>;
    let pending = 0, processing = 0, failed = 0;
    for (const r of counts) {
      if (r.status === 'pending') pending = r.n;
      else if (r.status === 'processing') processing = r.n;
      else if (r.status === 'failed') failed = r.n;
    }
    const lastRow = this.db.prepare(`
      SELECT enqueued_at FROM kb_ingest_queue WHERE status = 'done' ORDER BY enqueued_at DESC LIMIT 1
    `).get() as { enqueued_at: string } | undefined;
    return { pending, processing, failed, lastIngestedAt: lastRow?.enqueued_at ?? null };
  }

  // Phase 4: re-enqueue every .md file under every enabled source. Used by
  // IPC handler `kb:rebuild`. Idempotent: removes any pending duplicates
  // before re-enqueuing so a second call does not double-insert.
  async rebuildAll(): Promise<{ reEnqueued: number }> {
    const rows = this.db.prepare(`SELECT path FROM kb_sources WHERE enabled = 1`).all() as { path: string }[];
    const files: string[] = [];
    for (const r of rows) {
      if (!fs.existsSync(r.path)) continue;
      const walk = (d: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, entry.name);
          if (entry.isDirectory()) walk(p);
          else if (/\.(md|markdown|mdx)$/i.test(entry.name)) files.push(p);
        }
      };
      try { walk(r.path); } catch (e) { log.warn(`[WikiIngest] rebuildAll: skipping unreadable source ${r.path}: ${(e as Error).message}`); }
    }
    let n = 0;
    const tx = this.db.transaction((paths: string[]) => {
      // Remove pending duplicates so rebuildAll is idempotent on retry.
      const del = this.db.prepare(`DELETE FROM kb_ingest_queue WHERE file_path = ? AND status = 'pending'`);
      const ins = this.db.prepare(`INSERT INTO kb_ingest_queue (file_path) VALUES (?)`);
      for (const p of paths) {
        del.run(p);
        ins.run(p);
        n++;
      }
    });
    tx(files);
    return { reEnqueued: n };
  }
}
