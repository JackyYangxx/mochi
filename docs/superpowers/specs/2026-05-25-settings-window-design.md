# Settings Window Design

## Overview

将设置面板从主窗口的 React Overlay 改为独立的 Electron BrowserWindow，可自由调整大小、拖动到其他显示器。

## Architecture

### Components

1. **SettingsWindow (Main Process)** - `src/main/settingsWindow.ts`
   - 创建独立的 BrowserWindow
   - 管理窗口生命周期
   - 保存/恢复窗口位置和大小

2. **Settings Page (Renderer)** - `src-renderer/settings/SettingsApp.tsx`
   - 独立入口，复用现有 SettingsPanel 组件
   - 独立 HTML 模板

3. **IPC 通信**
   - `settings:window:open` - 打开设置窗口
   - `settings:window:close` - 关闭设置窗口
   - `settings:saved` - 设置保存后通知主窗口刷新宠物图片

### Window Configuration

```typescript
{
  width: 480,
  height: 600,
  minWidth: 400,
  minHeight: 500,
  resizable: true,
  frame: true,  // 标准窗口边框
  title: 'Desktop Todo - Settings',
  show: false,   // 先创建后显示，避免闪烁
}
```

### Data Flow

1. Tray "Settings" → IPC `settings:window:open` → 主进程创建/显示 SettingsWindow
2. 用户在 SettingsWindow 修改设置 → 保存到数据库
3. 设置保存时 → IPC `settings:saved` → 主窗口刷新宠物图片
4. 用户关闭 SettingsWindow → 窗口隐藏/销毁

## File Changes

### New Files

- `src/main/settingsWindow.ts` - 设置窗口创建和管理
- `src-renderer/settings.html` - 设置页面 HTML 模板
- `src-renderer/settings/SettingsApp.tsx` - 设置页面 React 入口

### Modified Files

- `src/main/index.ts` - 导入 settingsWindow，注册 IPC handler
- `src/main/tray.ts` - Settings 点击改为打开独立窗口
- `src/main/window.ts` - 可选：隐藏主窗口而非关闭

## Implementation Steps

1. 创建 `src/main/settingsWindow.ts`，实现窗口创建、显示、隐藏、销毁
2. 创建 `src-renderer/settings/SettingsApp.tsx`，复用 SettingsPanel 组件
3. 创建 `src-renderer/settings.html` 入口页面
4. 修改 `src/main/index.ts` 注册窗口 IPC
5. 修改 `src/main/tray.ts` 调用 `openSettingsWindow()`
6. Vite 配置添加 settings 页面构建
7. electron-builder 配置添加 settings 页面

## Testing

- Tray 点击 Settings 打开独立窗口
- 设置窗口可调整大小、拖动到其他显示器
- 修改宠物图片后，关闭设置窗口，主窗口图片已更新
- 窗口位置和大小在关闭后保存，重新打开时恢复
