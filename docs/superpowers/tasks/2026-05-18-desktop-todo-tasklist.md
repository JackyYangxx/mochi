# Desktop Todo Agent — Task List

> Generated from: `docs/superpowers/plans/2026-05-18-desktop-todo-agent-implementation.md`
> Date: 2026-05-18

## Overview

23 tasks across 10 phases. Each task is implemented by a dedicated `dever-{N}` agent.

---

## Phase 1: Project Scaffolding

### Task 1: Initialize project with pnpm, Electron, React, Vite, TypeScript
**Priority:** 1 | **Status:** pending

**Files to create:**
- `package.json`
- `tsconfig.json`
- `tsconfig.node.json`
- `vite.config.ts`
- `electron-builder.yml`
- `index.html`
- `src/shared/types.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src-renderer/main.tsx`
- `src-renderer/App.tsx`
- `src-renderer/App.css`

**Steps:** 18 steps (init pnpm → install deps → write configs → write files → add scripts → verify dev mode → commit)

**Assigned to:** `dever-1`

---

## Phase 2: Core Window & Pet

### Task 2: Floating window with transparency, always-on-top, click-through
**Priority:** 1 | **Status:** pending

**Files:** `src/main/window.ts` (create), `src/main/index.ts` (modify)

**Steps:** 3 steps (write window.ts → update index.ts → commit)

**Assigned to:** `dever-2`

### Task 3: Pet view component with default icon and state display
**Priority:** 2 | **Status:** pending

**Files:** `src-renderer/components/PetView.tsx`, `src-renderer/components/PetView.css` (create), `src-renderer/App.tsx`, `src-renderer/App.css` (modify), `tests/components/PetView.test.tsx` (create)

**Steps:** 9 steps (write test → run test (fail) → write PetView → write CSS → run test (pass) → update App → update App.css → configure Vitest → commit)

**Assigned to:** `dever-3`

### Task 4: System tray with show/quit menu
**Priority:** 2 | **Status:** pending

**Files:** `src/main/tray.ts` (create), `src/main/index.ts` (modify)

**Steps:** 4 steps (write tray.ts → update index.ts → fix close behavior → commit)

**Assigned to:** `dever-4`

---

## Phase 3: Database & Todo CRUD

### Task 5: SQLite database connection, schema, and migration system
**Priority:** 3 | **Status:** pending

**Files:** `src/database/connection.ts`, `src/database/migrations/001_initial.ts`

**Steps:** 3 steps (write 001_initial.ts → write connection.ts → commit)

**Assigned to:** `dever-5`

### Task 6: TodoService — CRUD operations with tests
**Priority:** 3 | **Status:** pending

**Files:** `tests/unit/TodoService.test.ts`, `src/services/TodoService.ts`

**Steps:** 3 steps (write test → run test (fail) → write TodoService → commit)

**Assigned to:** `dever-6`

### Task 7: SettingsService — persistence for all app settings
**Priority:** 3 | **Status:** pending

**Files:** `src/services/SettingsService.ts`

**Steps:** 2 steps (write service → commit)

**Assigned to:** `dever-7`

### Task 8: IPC handlers — wire all services to main process
**Priority:** 3 | **Status:** pending

**Files:** `src/main/ipc.ts` (create), `src/main/index.ts` (modify)

**Steps:** 2 steps (write ipc.ts → update index.ts → commit)

**Assigned to:** `dever-8`

---

## Phase 4: Todo List UI

### Task 9: TodoList and TodoItem components with drag-sort
**Priority:** 4 | **Status:** pending

**Files:** `src-renderer/components/TodoList.tsx`, `src-renderer/components/TodoList.css`, `src-renderer/components/TodoItem.tsx`, `src-renderer/components/TodoItem.css`, `src-renderer/hooks/useTodos.ts`, `tests/components/TodoList.test.tsx`

**Assigned to:** `dever-9`

### Task 10: TodoSearch — real-time search filter
**Priority:** 4 | **Status:** pending

**Files:** `src-renderer/components/TodoSearch.tsx`, `src-renderer/store/index.ts`

**Assigned to:** `dever-10`

### Task 11: TodoList integration — hook up CRUD to UI
**Priority:** 4 | **Status:** pending

**Files:** `src-renderer/App.tsx`, `src-renderer/App.css`

**Assigned to:** `dever-11`

---

## Phase 5: Voice Input

### Task 12: Speech recognition hook (press-to-talk)
**Priority:** 5 | **Status:** pending

**Files:** `src-renderer/hooks/useSpeechRecognition.ts`, `src-renderer/components/VoiceButton.tsx`

**Assigned to:** `dever-12`

### Task 13: InputModal — add-todo modal with voice button
**Priority:** 5 | **Status:** pending

**Files:** `src-renderer/components/InputModal.tsx`, `src-renderer/components/InputModal.css`, `tests/components/InputModal.test.tsx`

**Assigned to:** `dever-13`

---

## Phase 6: CLI Executor & API Key

### Task 14: CLIExecutor — safe child_process wrapper with tests
**Priority:** 6 | **Status:** pending

**Files:** `src/services/CLIExecutor.ts`, `tests/unit/CLIExecutor.test.ts`

**Assigned to:** `dever-14`

### Task 15: KeyStore — safeStorage API key management with tests
**Priority:** 6 | **Status:** pending

**Files:** `src/services/KeyStore.ts`, `tests/unit/KeyStore.test.ts`

**Assigned to:** `dever-15`

---

## Phase 7: Reminders

### Task 16: ReminderService — schedule + dispatch with LLM fallback
**Priority:** 7 | **Status:** pending

**Files:** `src/services/ReminderService.ts`, `src/services/LLMService.ts`, `src/services/SettingsService.ts` (modify)

**Assigned to:** `dever-16`

### Task 17: NetworkStatus — online/offline indicator
**Priority:** 7 | **Status:** pending

**Files:** `src-renderer/components/NetworkStatus.tsx`

**Assigned to:** `dever-17`

---

## Phase 8: Settings Panel

### Task 18: SettingsPanel — full settings UI
**Priority:** 8 | **Status:** pending

**Files:** `src-renderer/components/SettingsPanel.tsx`, `src-renderer/store/index.ts` (modify)

**Assigned to:** `dever-18`

### Task 19: Auto-launch — app.setLoginItemSettings
**Priority:** 8 | **Status:** pending

**Files:** `src/main/shortcut.ts`, `src/main/index.ts` (modify)

**Assigned to:** `dever-19`

---

## Phase 9: Integration & Polish

### Task 20: Global shortcut — CmdOrCtrl+Shift+T to trigger input
**Priority:** 9 | **Status:** pending

**Files:** `src/main/shortcut.ts` (modify), `src/main/index.ts` (modify)

**Assigned to:** `dever-20`

### Task 21: Window position memory — save/restore on move
**Priority:** 9 | **Status:** pending

**Files:** `src/main/window.ts` (modify), `src/main/index.ts` (modify)

**Assigned to:** `dever-21`

---

## Phase 10: Testing

### Task 22: Unit tests for services (LLMService, TodoService, CLIExecutor, KeyStore)
**Priority:** 10 | **Status:** pending

**Files:** `tests/unit/LLMService.test.ts`, `tests/unit/KeyStore.test.ts`, `tests/unit/CLIExecutor.test.ts`, `tests/unit/TodoService.test.ts` (already exists from Task 6)

**Assigned to:** `dever-22`

### Task 23: E2E tests — Playwright for critical user flows
**Priority:** 10 | **Status:** pending

**Files:** `tests/e2e/todo-flow.spec.ts`

**Assigned to:** `dever-23`

---

## Task Assignment Summary

| Task | Assigned to | Phase |
|------|-------------|-------|
| 1 | dever-1 | 1 |
| 2 | dever-2 | 2 |
| 3 | dever-3 | 2 |
| 4 | dever-4 | 2 |
| 5 | dever-5 | 3 |
| 6 | dever-6 | 3 |
| 7 | dever-7 | 3 |
| 8 | dever-8 | 3 |
| 9 | dever-9 | 4 |
| 10 | dever-10 | 4 |
| 11 | dever-11 | 4 |
| 12 | dever-12 | 5 |
| 13 | dever-13 | 5 |
| 14 | dever-14 | 6 |
| 15 | dever-15 | 6 |
| 16 | dever-16 | 7 |
| 17 | dever-17 | 7 |
| 18 | dever-18 | 8 |
| 19 | dever-19 | 8 |
| 20 | dever-20 | 9 |
| 21 | dever-21 | 9 |
| 22 | dever-22 | 10 |
| 23 | dever-23 | 10 |