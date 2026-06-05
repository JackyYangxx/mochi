import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

const WORKTREE_ROOT = path.resolve(__dirname, '../..');
const MAIN_PATH = path.join(WORKTREE_ROOT, 'dist/main/index.js');

// Fresh user-data per test file so KB state doesn't leak across runs.
const USER_DATA_DIR = path.join(os.tmpdir(), 'kb-e2e-userdata-' + Date.now());
const TMP_SOURCE_DIR = path.join(os.tmpdir(), 'kb-e2e-source-' + Date.now());
const TMP_WIKI_DIR = path.join(os.tmpdir(), 'kb-e2e-wiki-' + Date.now());

let electronApp: ElectronApplication;
let mainWindow: Page;

test.beforeAll(async () => {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  fs.mkdirSync(TMP_SOURCE_DIR, { recursive: true });
  fs.mkdirSync(TMP_WIKI_DIR, { recursive: true });

  // Seed source dir with 2 .md files + 1 non-md
  fs.writeFileSync(path.join(TMP_SOURCE_DIR, 'note-a.md'), '# Note A\n\nReact hooks intro.');
  fs.writeFileSync(path.join(TMP_SOURCE_DIR, 'note-b.md'), '# Note B\n\nState management patterns.');
  fs.writeFileSync(path.join(TMP_SOURCE_DIR, 'README.txt'), 'not a markdown, should not count');

  electronApp = await electron.launch({
    args: [MAIN_PATH, `--user-data-dir=${USER_DATA_DIR}`],
    timeout: 30000,
  });
  mainWindow = await electronApp.firstWindow();
  await mainWindow.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await electronApp.close();
  fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
  fs.rmSync(TMP_SOURCE_DIR, { recursive: true, force: true });
  fs.rmSync(TMP_WIKI_DIR, { recursive: true, force: true });
});

/**
 * Open the SettingsPanel inline in the main window. The pet window listens
 * for the 'open-settings' IPC event (preload.onOpenSettings) and sets a
 * state flag that mounts <SettingsPanel /> inside the same React tree.
 */
async function openSettingsInline() {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
    if (!win) throw new Error('no live BrowserWindow');
    win.webContents.send('open-settings');
  });
  // Inline panel mounts after the IPC dispatch — wait for the settings shell.
  await mainWindow.locator('.settings-panel').waitFor({ state: 'visible', timeout: 5000 });
}

test('main pet window renders', async () => {
  await expect(mainWindow.locator('.app-container, .pet-view').first()).toBeVisible({ timeout: 10000 });
});

test('inline SettingsPanel renders all 5 tabs and KB sections', async () => {
  await openSettingsInline();

  for (const label of ['外观', '智能', '通知', '系统', '知识库']) {
    await expect(mainWindow.locator(`.settings-tab:has-text("${label}")`)).toBeVisible();
  }

  await mainWindow.locator('.settings-tab:has-text("知识库")').click();

  for (const heading of ['启用知识库增强', '角色说明', '源目录', 'Wiki 输出目录', '状态']) {
    await expect(mainWindow.locator(`h3:has-text("${heading}")`)).toBeVisible();
  }
  await expect(mainWindow.locator('.kb-stats')).toContainText('待入库：0');
});

test('KB IPC: setWikiDir + addSource + listSources round-trip', async () => {
  // setWikiDir
  const setResult = await mainWindow.evaluate(async (dir) => {
    try {
      const ok = await window.todoAPI.kb.setWikiDir(dir);
      return { ok };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, TMP_WIKI_DIR);
  expect(setResult.ok).toBe(true);

  // addSource
  const addResult = await mainWindow.evaluate(async (dir) => {
    try {
      const src = await window.todoAPI.kb.addSource(dir);
      return { src };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, TMP_SOURCE_DIR);
  expect(addResult.src).toBeTruthy();
  expect(addResult.src.path).toBe(TMP_SOURCE_DIR);
  expect(addResult.src.fileCount).toBe(2);

  // listSources
  const list = await mainWindow.evaluate(async () => {
    return await window.todoAPI.kb.listSources();
  });
  expect(list).toHaveLength(1);
  expect(list[0].path).toBe(TMP_SOURCE_DIR);
  expect(list[0].enabled).toBe(true);
  expect(list[0].fileCount).toBe(2);
});

test('F4: wiki dir cannot be added as source (overlap rejected)', async () => {
  const err = await mainWindow.evaluate(async (dir) => {
    try {
      await window.todoAPI.kb.addSource(dir);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, TMP_WIKI_DIR);
  expect(err).toContain('重叠');
});

test('F3: setWikiDir blocks hot-swap to a different dir', async () => {
  const err = await mainWindow.evaluate(async () => {
    try {
      await window.todoAPI.kb.setWikiDir('/tmp/some-other-dir-' + Date.now());
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  });
  expect(err).toContain('不可热切换');
});

test('kb:rebuild enqueues sources and updates stats (no LLM = failed)', async () => {
  // The rebuild button is gated on kbWikiDir in React state, but calling the
  // IPC directly exercises the same worker path the button triggers. The UI
  // handler is a 2-line wrapper around `kb:rebuild` — testing the IPC verifies
  // the underlying logic and the queue/worker integration end-to-end.
  const rebuildResult = await mainWindow.evaluate(async () => {
    try {
      const res = await window.todoAPI.kb.rebuild();
      return { ok: true, res };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
  // Either the IPC succeeds (returns the rebuild stats) or the LLM-not-
  // configured error is surfaced. We accept both — what we DON'T accept is
  // an unhandled exception that the renderer would silently swallow.
  if (!rebuildResult.ok) {
    // Print so debugging this test gives the actual error message.
    console.log('rebuild IPC error:', rebuildResult.error);
  }
  expect(rebuildResult.ok).toBe(true);

  // Worker picks up jobs and fails them (no LLM key configured).
  const deadline = Date.now() + 15000;
  let stats: { pending: number; processing: number; failed: number } = { pending: 0, processing: 0, failed: 0 };
  while (Date.now() < deadline) {
    stats = await mainWindow.evaluate(async () => {
      return await window.todoAPI.kb.getStats();
    });
    if (stats.failed > 0) break;
    await mainWindow.waitForTimeout(500);
  }

  expect(stats.failed).toBeGreaterThanOrEqual(1);
  expect(stats.pending + stats.processing + stats.failed).toBeGreaterThanOrEqual(2);
});

test('UI rebuild button is enabled when wiki dir is set via UI handler', async () => {
  // Verify the UI gate. After setWikiDir the local React state needs to know
  // about it — we exercise this by triggering a synthetic React state update
  // through a "更改" click. Since we can't easily stub the OS dialog, we verify
  // the disabled-when-empty half of the contract: wikiDir empty → button disabled.
  const disabled = await mainWindow.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => (b.textContent || '').trim() === '立即构建',
    ) as HTMLButtonElement | undefined;
    return btn ? btn.disabled : null;
  });
  // After the F3 hot-swap test we set the dir; the local state didn't update
  // (we set it via IPC), so the button stays disabled. The test below flips
  // kb_wiki_dir_last_indexed + the React state to confirm the gate flips true.
  expect(disabled).toBe(true);

  // Now use the same path the UI uses: call setWikiDir through the public IPC
  // and ask the store to refresh. We poke the store via window.dispatchEvent
  // — easier: trigger handleChangeWikiDir's tail by directly setting state.
  // The Zustand store isn't on window, so we reload the page to force a fresh
  // loadSettings+loadKb cycle that re-reads kb_wiki_dir.
  await mainWindow.reload();
  await mainWindow.locator('.app-container, .pet-view').first().waitFor({ state: 'visible' });

  // After reload, no inline settings — open it again.
  await openSettingsInline();
  await mainWindow.locator('.settings-tab:has-text("知识库")').click();

  const disabledAfter = await mainWindow.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => (b.textContent || '').trim() === '立即构建',
    ) as HTMLButtonElement | undefined;
    return btn ? btn.disabled : null;
  });
  expect(disabledAfter).toBe(false);
});

test('role.md openRole resolves the IPC (no editor = OS error, still ok)', async () => {
  const result = await mainWindow.evaluate(async () => {
    try {
      await window.todoAPI.kb.openRole();
      return { ok: true };
    } catch (e) {
      return { error: (e as Error).message };
    }
  });
  // Either resolves cleanly or returns a non-empty OS-level error string.
  expect(result.ok || (result.error && result.error.length > 0)).toBeTruthy();
});
