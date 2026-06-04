# Knowledge Base & Personalized LLM — Task List

> Generated from: `docs/superpowers/plans/2026-06-04-knowledge-base-implementation.md`
> Date: 2026-06-04
> Spec: `docs/superpowers/specs/2026-06-04-knowledge-base-design.md` (Draft; P0 fixes F1-F6 applied)

## Overview

10 tasks across 4 phases. Each task maps 1:1 to a task in the implementation plan. Spec fix markers (F1-F6) are inline in the plan and must be honored.

| Fix | Resolved in | Summary |
|---|---|---|
| F1 | Task 1 | Migration `004`; register in `connection.ts:64-68` hardcoded array |
| F2 | Task 9 | `LLMService.chat()` + thin wrappers; callers unchanged |
| F3 | Task 4 + 6 + 10 | Block hot-swap save; detect on startup; reindex async |
| F4 | Task 3 | Bidirectional `startsWith` check in `addSource()` |
| F5 | Task 7 + 8 | Atomic write; zod-validated two-step CoT; 429 backoff 30s |
| F6 | Task 5 | Pin `chokidar@^3.6.0`; add `@types/chokidar` |

---

## Phase 1: Foundation

### Task 1: Database Migration for KB
**Priority:** 1 | **Status:** pending | **Implements:** F1
**Files:** `src/database/migrations/004_knowledge_base.ts` (create), `src/database/connection.ts:64-68` (modify)
**Steps:** 4 (create migration → register → verify tables → commit)

### Task 2: RoleService
**Priority:** 1 | **Status:** pending
**Files:** `src/services/RoleService.ts` (create), `tests/unit/RoleService.test.ts` (create)
**Steps:** 5 (test → run fail → implement → run pass → commit)

### Task 3: KnowledgeBaseService (F4 critical)
**Priority:** 1 | **Status:** pending | **Implements:** F4
**Files:** `src/services/KnowledgeBaseService.ts` (create), `tests/unit/KnowledgeBaseService.test.ts` (create)
**Steps:** 5 (test w/ F4 validation → run fail → implement → run pass → commit)
**Key risk:** validation MUST reject both `wikiDir ⊃ sourceDir` and `sourceDir ⊃ wikiDir`

### Task 4: Settings KB Tab UI
**Priority:** 2 | **Status:** pending | **Implements:** F3 (block-save side)
**Files:** 6 (types/store/IPC/preload/panel/css)
**Steps:** 8 (types → store → IPC handlers → preload → tab render → CSS → build verify → commit)

---

## Phase 2: Watch + Index

### Task 5: KnowledgeWatcher
**Priority:** 1 | **Status:** pending | **Implements:** F6
**Files:** `package.json` (modify), `src/services/KnowledgeWatcher.ts` (create), `tests/unit/KnowledgeWatcher.test.ts` (create)
**Steps:** 6 (pin chokidar → install → test → run fail → implement → run pass → commit)
**Hard rule:** do NOT install chokidar@4.x

### Task 6: WikiIndexService
**Priority:** 1 | **Status:** pending | **Implements:** F3 (startup detect side)
**Files:** `src/services/WikiIndexService.ts` (create), `tests/unit/WikiIndexService.test.ts` (create)
**Steps:** 5 (test tokenize+search → run fail → implement w/ F3 init → run pass → commit)
**Key risk:** bigram regex uses `[一-龥]`; verify against CJK test data

---

## Phase 3: Ingest Pipeline

### Task 7: WikiIngestService - Queue & Atomic Write
**Priority:** 1 | **Status:** pending | **Implements:** F5 (atomic write)
**Files:** `src/services/WikiIngestService.ts` (create), `tests/unit/WikiIngestService.test.ts` (create)
**Steps:** 5 (test → run fail → implement queue+atomicWrite → run pass → commit)

### Task 8: WikiIngestService - Two-Step CoT
**Priority:** 1 | **Status:** pending | **Implements:** F5 (state machine + 429)
**Files:** `src/services/WikiIngestService.ts` (extend), `tests/unit/WikiIngestService.test.ts` (extend)
**Steps:** 6 (zod schemas → tests → run fail → implement withRetry/step1/step2 → run pass → commit)

---

## Phase 4: LLM Integration

### Task 9: LLMService.chat() + Thin Wrappers
**Priority:** 1 | **Status:** pending | **Implements:** F2
**Files:** `src/services/LLMService.ts` (refactor), `tests/unit/LLMService.test.ts` (create)
**Steps:** 5 (test → run fail → refactor → run pass → commit)
**Key risk:** ReminderService/DailyReportService MUST stay unchanged

### Task 10: Wire Up in Main Process
**Priority:** 1 | **Status:** pending
**Files:** `src/main/index.ts` (modify), `src/main/ipc.ts` (modify, partial — see Task 4 for full list)
**Steps:** 3 (wire up all services + LLM context → e2e manual test → commit)
**E2E checklist:** add source → ingest → wiki files appear → reminder uses KB → restart preserves state

---

## Total

- 10 tasks
- 4 phases
- ~50 atomic TDD steps
- 6 spec fixes resolved
- Estimated: 5 focused work sessions (one per phase + Task 10)
