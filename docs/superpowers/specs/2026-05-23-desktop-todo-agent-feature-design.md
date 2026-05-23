# Desktop Todo Agent — 功能增强设计

> Date: 2026-05-23
> Status: Approved

## Overview

本次增强包含4个需求：
1. Windows 任务栏图标
2. 设置面板宠物图片上传入口
3. 窗口拖拽移动 + 宠物图标尺寸可调
4. 删除搜索栏功能

---

## 1. Taskbar Icon (需求1)

### 目标
应用打开后，在 Windows 任务栏中显示用户上传的宠物图片作为图标，而非空白。

### 实现方案

**图标来源**：
- 检查用户是否上传了 `idle` 状态的宠物图
- 如果有，使用该图片作为任务栏图标
- 如果没有，使用内置的默认猫咪图标

**图标格式转换**：
- Windows 要求 `.ico` 格式
- 需要将用户上传的图片（可能是 png/jpg/gif）转换为 ico
- 使用 `png-to-ico` 或类似库在主进程启动时转换

**electron-builder 配置**：
```yaml
win:
  target:
    - target: nsis
      arch: x64
  icon: build/icon.ico  # fallback 默认图标
```

**运行时动态图标**：
- 应用启动后，检测是否有自定义 idle 图片
- 如果有，复制/转换到 `userData` 目录作为持久化图标
- 使用 `app.setOverlayIcon()` API 设置任务栏图标（如果支持）
- 或者使用 `BrowserWindow.setIcon()` 动态设置

### 简化方案
由于动态设置任务栏图标较为复杂，采用以下简化方案：
- 使用默认猫咪图标作为 build/icon.ico
- 如果用户上传了 idle 图片，可以在设置面板中预览，但任务栏保持默认图标
- 这样避免运行时图标转换的复杂性

**推荐：简化方案，暂不实现运行时图标切换。后续可优化。**

---

## 2. 设置入口 (需求2)

### 目标
用户可以通过托盘右键菜单访问设置面板。

### 实现方案

**托盘菜单修改** (`src/main/tray.ts`)：
```typescript
contextMenu = Menu.buildFromTemplate([
  { label: 'Show', click: () => mainWindow?.show() },
  { label: 'Settings', click: () => mainWindow?.webContents.send('open-settings') },
  { type: 'separator' },
  { label: 'Quit', click: () => app.quit() }
]);
```

**IPC 通信**：
- 新增 channel: `settings:open`
- 主进程托盘点击 Settings 时，发送事件到渲染进程
- 渲染进程监听并打开设置面板

**Preload 暴露**：
```typescript
contextBridge.exposeInMainWorld('todoAPI', {
  // ... existing APIs
  onOpenSettings: (callback) => { /* ... */ }
});
```

**PetView 点击行为**：
- 保持现有行为：点击打开 InputModal
- 不再承担打开设置的功能

---

## 3. 窗口拖拽 + 宠物图标尺寸 (需求3)

### 目标
- 整个窗口可拖拽移动
- 宠物图标支持 5 档固定尺寸

### 窗口拖拽实现

**CSS 配置** (`src-renderer/App.css`)：
```css
.app-container {
  -webkit-app-region: drag;
}

/* 交互元素禁止拖拽 */
button, input, .pet-view, .todo-item {
  -webkit-app-region: no-drag;
}
```

**注意事项**：
- 透明区域仍然可以拖拽
- 所有可点击元素需要标记 `no-drag` 防止误触发

### 宠物图标尺寸实现

**尺寸档位**：
| 档位 | 尺寸 |
|------|------|
| XS | 48px |
| S | 64px |
| M | 96px |
| L | 128px |
| XL | 192px |

**设置面板 UI** (`SettingsPanel.tsx`)：
- 在 Pet Images 区域下方添加"图标大小"选择器
- 5 个按钮横向排列，当前选中项高亮
- 实时预览尺寸变化
- 保存到设置: `petSize: 'M'`

**PetView 组件**：
```typescript
interface PetViewProps {
  // ... existing props
  size?: 'XS' | 'S' | 'M' | 'L' | 'XL';
}
```

**尺寸映射**：
```typescript
const SIZE_MAP = {
  XS: 48,
  S: 64,
  M: 96,
  L: 128,
  XL: 192
};
```

---

## 4. 删除搜索栏 (需求4)

### 目标
应用默认只展示宠物图标和待办列表，移除搜索功能。

### 删除范围

**组件删除**：
- `src-renderer/components/TodoSearch.tsx`
- `src-renderer/components/TodoSearch.css`

**App.tsx 修改**：
- 删除 `<TodoSearch />` 引用
- 删除相关 import

**Settings 删除**：
- 如果设置中有"显示搜索栏"选项，移除

**数据库**：
- 如果 `todos` 表有搜索相关索引，保留（不影响功能）

**IPC**：
- 如果存在 `todos:search` handler，保留（兼容未来可能的需求）

---

## 5. 文件变更清单

| 文件 | 操作 |
|------|------|
| `src/main/tray.ts` | 修改托盘菜单 |
| `src/main/ipc.ts` | 添加 `settings:open` handler |
| `src/preload/index.ts` | 暴露 `onOpenSettings` |
| `src-renderer/App.tsx` | 删除 TodoSearch 引用 |
| `src-renderer/App.css` | 添加 `-webkit-app-region: drag` |
| `src-renderer/components/TodoSearch.tsx` | 删除 |
| `src-renderer/components/TodoSearch.css` | 删除 |
| `src-renderer/components/PetView.tsx` | 添加 size prop |
| `src-renderer/components/SettingsPanel.tsx` | 添加图标大小选择器 |
| `src-renderer/store/index.ts` | 添加 petSize 状态 |

---

## 6. 测试验证

1. **托盘菜单**：右键点击托盘图标，显示 Show/Settings/Quit
2. **设置入口**：点击 Settings 打开设置面板
3. **窗口拖拽**：按住窗口任意位置可拖拽移动，但按钮不可拖拽
4. **图标尺寸**：在设置中选择不同档位，宠物图标尺寸实时变化
5. **搜索栏**：应用启动后不显示搜索栏

---

## 7. 优先级

1. 设置入口 + 删除搜索栏（基础 UI 调整）
2. 窗口拖拽（交互改进）
3. 宠物图标尺寸（视觉改进）
4. Taskbar 图标（可选，暂不实现）