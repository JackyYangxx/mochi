import chokidar, { FSWatcher } from 'chokidar';
import log from 'electron-log';

export interface WatcherDeps {
  enqueue: (filePath: string) => void;
  debounceMs?: number;  // default 5000
}

export class KnowledgeWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(private deps: WatcherDeps) {}

  addDir(dir: string): void {
    if (!this.watcher) {
      this.watcher = chokidar.watch(dir, {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      });
      this.watcher.on('add', (p) => this.handle(p));
      this.watcher.on('change', (p) => this.handle(p));
      this.watcher.on('unlink', (p) => this.handle(p));
    }
  }

  private handle(filePath: string): void {
    if (!/\.(md|markdown|mdx)$/i.test(filePath)) return;
    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.deps.enqueue(filePath);
      this.debounceTimers.delete(filePath);
    }, this.deps.debounceMs ?? 5000);
    this.debounceTimers.set(filePath, timer);
  }

  async start(): Promise<void> {
    if (!this.watcher) throw new Error('addDir() must be called before start()');
    // chokidar starts watching on .add() automatically; nothing to do
    log.info('[KnowledgeWatcher] Started');
  }

  async stop(): Promise<void> {
    for (const t of this.debounceTimers.values()) clearTimeout(t);
    this.debounceTimers.clear();
    if (this.watcher) {
      try {
        await this.watcher.close();
      } finally {
        this.watcher = null;
      }
    }
    log.info('[KnowledgeWatcher] Stopped');
  }
}
