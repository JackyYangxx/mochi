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
}
