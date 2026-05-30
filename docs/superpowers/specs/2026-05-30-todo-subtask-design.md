# 待办事项子任务支持设计

> Date: 2026-05-30
> Status: Approved

## 概述

支持将待办事项拆分成多个子任务，以树状结构展示。默认只展示父待办，用户可展开查看子待办。

## 数据结构

### 数据库

在 `todos` 表添加 `parent_id` 字段：

```sql
ALTER TABLE todos ADD COLUMN parent_id TEXT DEFAULT NULL REFERENCES todos(id) ON DELETE CASCADE;
```

- 顶级待办：`parent_id = NULL`
- 子待办：`parent_id = 父待办id`
- 删除父待办时，子待办级联删除（数据库 CASCADE）

### Todo 接口

```typescript
interface Todo {
  id: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isCompleted: boolean;
  parentId: string | null;  // 新增
}
```

## UI 呈现

```
[ ] 待办内容                    [▼] [+] [编辑] [删除]
   └── [ ] 子待办内容           [编辑] [删除]
```

- **展开/收起图标**：父待办左侧 ▶/▼ 图标，点击展开/收起子待办列表
- **缩进**：子待办向右缩进 20px
- **添加子待办按钮**：父待办右侧 "+" 图标，点击后在子待办列表底部显示输入框
- **子待办列表**：展开时显示在父待办下方

## 交互逻辑

| 操作 | 行为 |
|------|------|
| 点击展开图标 | 显示/隐藏子待办列表 |
| 点击 "+" 添加 | 底部出现输入框，回车添加子待办 |
| 父待办标记完成 | 仅当**所有子待办都完成**时才能完成 |
| 子待办全部完成 | 父待办自动变为可完成状态 |
| 删除父待办 | 级联删除所有子待办 |

## 限制

- 子待办仅支持**一层嵌套**（顶级 → 子待办）
- 子待办不支持再添加子待办

## 组件改动

### TodoItem.tsx

新增 props：
- `children: Todo[]` - 子待办列表
- `isExpanded: boolean` - 是否展开
- `onToggleExpand: () => void` - 展开/收起
- `onAddChild: (content: string) => void` - 添加子待办
- `onDeleteChild: (id: string) => void` - 删除子待办

### TodoList.tsx

- 嵌套渲染子待办
- 处理添加子待办逻辑

### TodoService.ts

```typescript
add(input: { content: string; parentId?: string }): Todo
getAll(): Todo[]  // 返回带 children 结构的树
toggle(id: string): Todo  // 检查子待办完成状态
delete(id: string): void  // 级联删除子待办
```

## 实现步骤

1. 数据库迁移：添加 `parent_id` 字段
2. 更新 Todo 接口和 TodoRow 类型
3. 更新 TodoService：add/getAll/toggle/delete 支持 parentId
4. 更新 TodoItem：添加展开/添加子待办 UI
5. 更新 TodoList：嵌套渲染子待办
6. 更新 useTodos hook：处理子待办状态
7. 测试验证