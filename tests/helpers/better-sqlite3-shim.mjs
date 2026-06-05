// Test-only shim for better-sqlite3 (Node 24 compatibility workaround).
//
// better-sqlite3@9.6.0 has no prebuilt binary for Node 24 (NODE_MODULE_VERSION 137),
// and cannot be built from source in this environment due to C++20 / v8 API drift.
// Node 24 ships with experimental `node:sqlite` which is API-compatible for the
// surface used by KnowledgeBaseService tests. This shim re-exports node:sqlite
// under the better-sqlite3 module name so tests can run as written.
//
// Alias configured in vitest.config.ts (test-only, does not affect production build).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const nodeSqlite = require('node:sqlite');

const { DatabaseSync } = nodeSqlite;

class Database {
  constructor(path) {
    this._inner = new DatabaseSync(path);
  }
  exec(sql) {
    this._inner.exec(sql);
  }
  prepare(sql) {
    const stmt = this._inner.prepare(sql);
    return {
      get: (...args) => stmt.get(...args) ?? undefined,
      all: (...args) => stmt.all(...args),
      run: (...args) => {
        const r = stmt.run(...args);
        return { ...r, lastInsertRowid: Number(r.lastInsertRowid) };
      },
    };
  }
  close() {
    this._inner.close();
  }
}

export default Database;
