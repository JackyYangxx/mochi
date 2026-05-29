# 删除确认对话框设计

## 概述

为 TodoItem 删除操作添加确认对话框，避免误删。

## 设计

### 交互流程

1. 用户点击删除按钮 (×)
2. 弹出确认对话框，显示"确定删除该待办？"
3. 用户点击"确定" → 执行删除
4. 用户点击"取消" → 关闭对话框，不删除

### 组件结构

```
ConfirmModal/
  ConfirmModal.tsx    # 确认弹窗组件
  ConfirmModal.css   # 样式
```

### API

```typescript
interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}
```

### 样式

- 居中显示的卡片式弹窗
- 半透明黑色遮罩层
- 与 InputModal 一致的视觉风格
- 确定按钮用红色突出（危险操作）

### 实现位置

- 新建 `src-renderer/components/ConfirmModal/`
- TodoItem.tsx 引入并使用