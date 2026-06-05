import fs from 'fs';
import path from 'path';
import os from 'os';
import { KnowledgeWatcher } from '../../src/services/KnowledgeWatcher';

// Timing constants: chokidar `awaitWriteFinish.stabilityThreshold` is 200ms,
// plus the watcher's 50ms debounce and some scheduling slack. The pre-write
// settle lets chokidar finish its initial scan before the file appears.
const PRE_WRITE_SETTLE_MS = 100;
const POST_WRITE_SETTLE_MS = 500;

describe('KnowledgeWatcher', () => {
  let tmpDir: string;
  let watcher: KnowledgeWatcher;
  let enqueued: string[];

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-test-'));
    enqueued = [];
    watcher = new KnowledgeWatcher({
      enqueue: (filePath: string) => enqueued.push(filePath),
      debounceMs: 50,  // short for test
    });
  });
  afterEach(async () => {
    try {
      await watcher.stop();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('enqueues new .md files (debounced)', async () => {
    watcher.addDir(tmpDir);
    await watcher.start();
    await new Promise(r => setTimeout(r, PRE_WRITE_SETTLE_MS));
    fs.writeFileSync(path.join(tmpDir, 'a.md'), 'hello');
    await new Promise(r => setTimeout(r, POST_WRITE_SETTLE_MS));
    expect(enqueued).toContain(path.join(tmpDir, 'a.md'));
  });

  test('ignores non-markdown files', async () => {
    watcher.addDir(tmpDir);
    await watcher.start();
    await new Promise(r => setTimeout(r, PRE_WRITE_SETTLE_MS));
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'no');
    await new Promise(r => setTimeout(r, POST_WRITE_SETTLE_MS));
    expect(enqueued.find(p => p.endsWith('b.txt'))).toBeUndefined();
  });
});
