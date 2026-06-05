import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import log from 'electron-log';

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
}
