import fs from 'fs';
import Database from 'better-sqlite3';
import log from 'electron-log';

export interface WikiPage { path: string; title: string; content: string; }

const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of', 'and', 'or', 'in', 'on', 'at', 'for', 'with', 'as', 'by', 'this', 'that', 'it']);

export class WikiIndexService {
  private pageIndex = new Map<string, WikiPage>();
  private invertedIndex = new Map<string, Set<string>>();  // token -> set of page paths
  private lowerTitleCache = new Map<string, string>();  // page path -> lowercased title (for title-bonus perf)

  static tokenize(text: string): string[] {
    const tokens: string[] = [];
    // English: lowercase, split on non-alphanumeric (allowing CJK chars through as separate runs)
    const asciiWords = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    tokens.push(...asciiWords.filter(w => !STOP_WORDS.has(w)));
    // CJK bigrams
    const cjk = text.match(/[一-鿿]/g) || [];
    for (let i = 0; i < cjk.length - 1; i++) {
      tokens.push(cjk[i] + cjk[i + 1]);
    }
    return tokens;
  }

  loadFromPages(pages: WikiPage[]): void {
    this.pageIndex.clear();
    this.invertedIndex.clear();
    this.lowerTitleCache.clear();
    for (const p of pages) {
      this.pageIndex.set(p.path, p);
      this.lowerTitleCache.set(p.path, p.title.toLowerCase());
      for (const t of WikiIndexService.tokenize(p.title + ' ' + p.content)) {
        if (!this.invertedIndex.has(t)) this.invertedIndex.set(t, new Set());
        this.invertedIndex.get(t)!.add(p.path);
      }
    }
  }

  search(query: string, topK: number = 5): WikiPage[] {
    const qTokens = WikiIndexService.tokenize(query);
    const scores = new Map<string, number>();
    for (const t of qTokens) {
      const pages = this.invertedIndex.get(t);
      if (pages) for (const p of pages) scores.set(p, (scores.get(p) ?? 0) + 1);
    }
    // Title bonus
    for (const t of qTokens) {
      for (const [pPath, lowerTitle] of this.lowerTitleCache) {
        if (lowerTitle.includes(t)) {
          scores.set(pPath, (scores.get(pPath) ?? 0) + 10);
        }
      }
    }
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([p]) => this.pageIndex.get(p)!)
      .filter(Boolean);
  }

  // F3: detect wiki dir change, drop stale pages, rebuild
  async initFromDbAndDisk(db: Database.Database, wikiDir: string, lastIndexedDir: string | null): Promise<void> {
    if (lastIndexedDir && lastIndexedDir !== wikiDir) {
      log.warn(`[WikiIndex] Wiki dir changed from ${lastIndexedDir} to ${wikiDir}; dropping stale pages`);
    }
    if (!fs.existsSync(wikiDir)) {
      log.warn(`[WikiIndex] Wiki dir does not exist: ${wikiDir}`);
      return;
    }
    const rows = db.prepare(`SELECT path, title, content FROM kb_pages`).all() as WikiPage[];
    // F3: also drop rows whose file no longer exists in the new dir
    const live = rows.filter(r => fs.existsSync(r.path));
    const dead = rows.filter(r => !fs.existsSync(r.path));
    // Wrap all kb_pages writes in a single transaction for atomicity + speedup
    const txn = db.transaction(() => {
      if (lastIndexedDir && lastIndexedDir !== wikiDir) {
        db.prepare(`DELETE FROM kb_pages`).run();
      }
      if (dead.length > 0) {
        const stmt = db.prepare(`DELETE FROM kb_pages WHERE path = ?`);
        for (const d of dead) stmt.run(d.path);
      }
    });
    txn();
    this.loadFromPages(live);
    // update last-indexed
    db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('kb_wiki_dir_last_indexed', ?)`).run(wikiDir);
    log.info(`[WikiIndex] Loaded ${live.length} pages from ${wikiDir}`);
  }
}
