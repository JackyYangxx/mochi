# Desktop Todo Agent — 功能增强实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现4个功能：设置入口、窗口拖拽、宠物图标尺寸可调、删除搜索栏

**Architecture:**
- 托盘菜单新增 Settings 项，发送 IPC 到渲染进程打开设置面板
- 全窗口 CSS `-webkit-app-region: drag` 实现拖拽，交互元素标记 `no-drag`
- 宠物图标支持 5 档尺寸，设置面板添加选择器，状态管理新增 petSize
- 删除 TodoSearch 组件及相关引用

**Tech Stack:** Electron, React, Zustand, CSS

---

## File Structure

| File | Action |
|------|--------|
| `src/main/tray.ts` | 修改 - 添加 Settings 菜单项 |
| `src/main/ipc.ts` | 修改 - 添加 settings:open handler |
| `src/preload/index.ts` | 修改 - 暴露 onOpenSettings |
| `src-renderer/store/index.ts` | 修改 - 添加 petSize 状态 |
| `src-renderer/App.tsx` | 修改 - 删除 TodoSearch，添加 drag 区域 |
| `src-renderer/App.css` | 修改 - 添加 drag 样式 |
| `src-renderer/components/TodoSearch.tsx` | 删除 |
| `src-renderer/components/TodoSearch.css` | 删除 |
| `src-renderer/components/PetView.tsx` | 修改 - 支持 size prop |
| `src-renderer/components/SettingsPanel.tsx` | 修改 - 添加图标大小选择器 |

---

## Task 1: 修改托盘菜单 — 添加 Settings 入口

**Files:**
- Modify: `src/main/tray.ts:16-34`

- [ ] **Step 1: 读取 tray.ts 当前内容**

查看 `src/main/tray.ts` 第16-34行 contextMenu 部分

- [ ] **Step 2: 修改托盘菜单**

将：
```typescript
const contextMenu = Menu.buildFromTemplate([
  {
    label: 'Show',
    click: () => { /* ... */ },
  },
  { type: 'separator' },
  {
    label: 'Quit',
    click: () => { app.quit(); },
  },
]);
```

改为：
```typescript
const contextMenu = Menu.buildFromTemplate([
  {
    label: 'Show',
    click: () => {
      const win = getMainWindow();
      if (win) {
        win.show();
        win.focus();
      }
    },
  },
  {
    label: 'Settings',
    click: () => {
      const win = getMainWindow();
      if (win) {
        win.show();
        win.focus();
        win.webContents.send('open-settings');
      }
    },
  },
  { type: 'separator' },
  {
    label: 'Quit',
    click: () => {
      app.quit();
    },
  },
]);
```

- [ ] **Step 3: Commit**

```bash
git add src/main/tray.ts
git commit -m "feat: add Settings menu item to tray context menu"
```

---

## Task 2: Preload 暴露 onOpenSettings

**Files:**
- Modify: `src/preload/index.ts:24-35`

- [ ] **Step 1: 添加 onOpenSettings API**

在 preload 的 api 对象中，`onPetStateChange` 之后添加：

```typescript
onOpenSettings: (callback: () => void) => {
  const listener = () => callback();
  ipcRenderer.on('open-settings', listener);
  return () => ipcRenderer.removeListener('open-settings', listener);
},
```

- [ ] **Step 2: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat: expose onOpenSettings API in preload"
```

---

## Task 3: App.tsx 监听 open-settings 并打开设置面板

**Files:**
- Modify: `src-renderer/App.tsx:1-43`

- [ ] **Step 1: 读取 App.tsx**

- [ ] **Step 2: 修改 App.tsx**

1. 添加 `showSettings` state
2. 导入 `useEffect` 和 `useState`（已导入 useState）
3. 添加 `useEffect` 监听 `onOpenSettings`
4. 删除 TodoSearch 引用和渲染
5. 删除搜索相关的 import

修改后：
```typescript
import React, { useState, useEffect } from 'react';
import './App.css';

import PetView from './components/PetView';
import TodoList from './components/TodoList';
import InputModal from './components/InputModal';
import SettingsPanel from './components/SettingsPanel';  // 新增
import { useStore } from './store';
import { useTodos } from './hooks/useTodos';

export default function App() {
  const petState = useStore((s) => s.petState);
  const showInput = useStore((s) => s.showInput);
  const setShowInput = useStore((s) => s.setShowInput);
  const setPetState = useStore((s) => s.setPetState);
  const { todos, handleAdd, handleToggle, handleDelete } = useTodos();
  const [images] = useState({ idle: null, active: null, speaking: null });
  const [showSettings, setShowSettings] = useState(false);  // 新增

  useEffect(() => {
    const cleanup = window.todoAPI.onOpenSettings(() => {
      setShowSettings(true);
    });
    return cleanup;
  }, []);

  return (
    <div
      className="app-container"
      onMouseEnter={() => setPetState('active')}
      onMouseLeave={() => setPetState('idle')}
    >
      <PetView
        petState={petState}
        images={images}
        onClick={() => setShowInput(true)}
      />
      <div className="app-content">
        <TodoList
          todos={todos}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      </div>
      {showInput && (
        <InputModal
          onAdd={handleAdd}
          onClose={() => setShowInput(false)}
        />
      )}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src-renderer/App.tsx
git commit -m "feat: add onOpenSettings listener and SettingsPanel modal"
```

---

## Task 4: 删除 TodoSearch 组件

**Files:**
- Delete: `src-renderer/components/TodoSearch.tsx`
- Delete: `src-renderer/components/TodoSearch.css`

- [ ] **Step 1: 删除文件**

```bash
rm src-renderer/components/TodoSearch.tsx
rm src-renderer/components/TodoSearch.css
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: remove TodoSearch component (not needed per spec)"
```

---

## Task 5: App.css 添加拖拽样式

**Files:**
- Modify: `src-renderer/App.css`

- [ ] **Step 1: 读取 App.css**

- [ ] **Step 2: 添加 drag 样式**

在 `.app-container` 样式中添加：
```css
.app-container {
  /* ... existing styles ... */
  -webkit-app-region: drag;
}

/* 交互元素禁止拖拽 */
.app-content,
button,
input,
.pet-view,
.todo-item {
  -webkit-app-region: no-drag;
}
```

- [ ] **Step 3: Commit**

```bash
git add src-renderer/App.css
git commit -m "feat: add -webkit-app-region drag styles to App"
```

---

## Task 6: Zustand store 添加 petSize 状态

**Files:**
- Modify: `src-renderer/store/index.ts`

- [ ] **Step 1: 添加 petSize 到 store**

在 `TodoStore` 接口中添加：
```typescript
petSize: 'XS' | 'S' | 'M' | 'L' | 'XL';
```

在 store 初始状态添加：
```typescript
petSize: 'M',
```

添加 setter：
```typescript
setPetSize: (size: 'XS' | 'S' | 'M' | 'L' | 'XL') => set({ petSize: size }),
```

- [ ] **Step 2: Commit**

```bash
git add src-renderer/store/index.ts
git commit -m "feat: add petSize state to Zustand store"
```

---

## Task 7: PetView 支持 size prop

**Files:**
- Modify: `src-renderer/components/PetView.tsx`
- Modify: `src-renderer/components/PetView.css`

- [ ] **Step 1: 修改 PetView.tsx**

接口改为：
```typescript
type PetSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

interface PetViewProps {
  petState: PetState;
  images: PetImages;
  size?: PetSize;
  onClick?: () => void;
}

const SIZE_MAP: Record<PetSize, number> = {
  XS: 48,
  S: 64,
  M: 96,
  L: 128,
  XL: 192,
};
```

PetView 函数组件添加 size 使用：
```typescript
export default function PetView({ petState, images, size = 'M', onClick }: PetViewProps) {
  const src = getImageSrc(petState, images);
  const dimension = SIZE_MAP[size];

  return (
    <div
      className={`pet-view pet-state-${petState}`}
      onClick={onClick}
      data-testid="pet-view"
    >
      <img
        src={src}
        alt="pet"
        className="pet-image"
        draggable={false}
        style={{ width: dimension, height: dimension }}
      />
    </div>
  );
}
```

- [ ] **Step 2: 修改 PetView.css**

添加尺寸相关样式：
```css
.pet-image {
  object-fit: contain;
}
```

- [ ] **Step 3: Commit**

```bash
git add src-renderer/components/PetView.tsx src-renderer/components/PetView.css
git commit -m "feat: PetView supports size prop with 5 size options"
```

---

## Task 8: App.tsx 传递 size 给 PetView

**Files:**
- Modify: `src-renderer/App.tsx`

- [ ] **Step 1: 从 store 获取 petSize 并传递给 PetView**

```typescript
const petSize = useStore((s) => s.petSize);

return (
  <div className="app-container" ...>
    <PetView
      petState={petState}
      images={images}
      size={petSize}
      onClick={() => setShowInput(true)}
    />
    ...
  </div>
);
```

- [ ] **Step 2: Commit**

```bash
git add src-renderer/App.tsx
git commit -m "feat: pass petSize from store to PetView component"
```

---

## Task 9: SettingsPanel 添加图标大小选择器

**Files:**
- Modify: `src-renderer/components/SettingsPanel.tsx`
- Modify: `src-renderer/components/SettingsPanel.css`

- [ ] **Step 1: 读取 SettingsPanel.tsx 第1-50行**

查看当前的 state 和 import 结构

- [ ] **Step 2: 修改 SettingsPanel.tsx**

1. 添加 petSize state：
```typescript
const [petSize, setPetSize] = useState<'XS' | 'S' | 'M' | 'L' | 'XL'>('M');
```

2. 在 loadSettings 中加载 petSize：
```typescript
setPetSize((all.petSize as 'XS' | 'S' | 'M' | 'L' | 'XL') || 'M');
```

3. 在 Pet Images section 之后添加大小选择器：
```typescript
{/* Pet Size */}
<section className="settings-section">
  <h3>Pet Icon Size</h3>
  <div className="pet-size-selector">
    {(['XS', 'S', 'M', 'L', 'XL'] as const).map((size) => (
      <button
        key={size}
        className={`pet-size-btn ${petSize === size ? 'active' : ''}`}
        onClick={() => {
          setPetSize(size);
          saveSetting('petSize', size);
        }}
      >
        {size}
      </button>
    ))}
  </div>
</section>
```

- [ ] **Step 3: 修改 SettingsPanel.css**

添加选择器样式：
```css
.pet-size-selector {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.pet-size-btn {
  width: 48px;
  height: 32px;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-weight: 500;
}

.pet-size-btn.active {
  background: var(--primary-color, #7c3aed);
  color: white;
  border-color: var(--primary-color, #7c3aed);
}
```

- [ ] **Step 4: Commit**

```bash
git add src-renderer/components/SettingsPanel.tsx src-renderer/components/SettingsPanel.css
git commit -m "feat: add pet size selector (5 options) to SettingsPanel"
```

---

## Task 10: 验证功能

- [ ] **Step 1: 启动开发服务器**

```bash
pnpm dev
```

- [ ] **Step 2: 验证托盘菜单**

右键点击托盘图标，确认显示 Show / Settings / Quit

- [ ] **Step 3: 验证设置入口**

点击 Settings，确认设置面板打开

- [ ] **Step 4: 验证窗口拖拽**

按住窗口任意位置（除按钮外），拖拽移动窗口

- [ ] **Step 5: 验证图标尺寸调整**

在设置面板 Pet Images 区域下方，点击不同的尺寸按钮，确认宠物图标大小变化

- [ ] **Step 6: 验证搜索栏已删除**

确认界面中没有搜索栏

- [ ] **Step 7: Commit 所有剩余更改**

```bash
git add -A
git commit -m "feat: complete all feature enhancements"
```

---

## Task 11: 构建验证

- [ ] **Step 1: 运行生产构建**

```bash
pnpm build
```

- [ ] **Step 2: 验证 .exe 文件生成在 dist 目录**