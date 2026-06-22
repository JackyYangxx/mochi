import { useEffect, useCallback, useState, useReducer } from 'react';
import { flushSync } from 'react-dom';
import { useStore } from '../store';
import { filterTodosForForeground } from '../data/todoFilters';

declare global {
  interface Window {
    todoAPI?: {
      getTodos: () => Promise<any[]>;
      addTodo: (input: { content: string }) => Promise<any>;
      toggleTodo: (id: string) => Promise<any>;
      updateTodo: (id: string, content: string) => Promise<any>;
      updateTodoNotes: (id: string, notes: string) => Promise<any>;
      deleteTodo: (id: string) => Promise<void>;
      updateSortOrder: (ids: string[]) => Promise<void>;
      searchTodos: (query: string) => Promise<any[]>;
      onTriggerInput: (callback: () => void) => () => void;
      onOpenSettings: (callback: () => void) => () => void;
      onRefreshPetImages: (callback: () => void) => () => void;
      getPetImages: () => Promise<{ idle: string | null; active: string | null; speaking: string | null }>;
      uploadPetImage: (state: string, filePath: string) => Promise<string>;
      getSettings: () => Promise<Record<string, string>>;
      getApiKey: () => Promise<string | null>;
      updateSetting: (key: string, value: string) => Promise<void>;
      setApiKey: (apiKey: string) => Promise<void>;
      closeSettingsWindow: () => Promise<void>;
    };
  }
}

export function useTodos() {
  const { todos, searchQuery, setTodos, addTodo, toggleTodo, deleteTodo, updateTodo, updateTodoNotes, setShowInput } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  // 驱动 filterTodosForForeground 重算: 跨过本地零点后, "昨天完成的"应当从
  // 前台消失, 但 store 里的 todos 没变, 不主动重渲染就一直是旧 cutoff。
  // 每分钟 + 窗口 focus 时各刷一次。
  // 用 useReducer + flushSync: forceTick 只触发重渲染, 真正的时间戳每次 render 时
  // 现场读 (避免 stale state 把 cutoff 锁在旧值), flushSync 强制同步 re-render —
  // 同步事件回调 (focus) 中 React 不会自动 flush update, 必须 flushSync。
  const [, forceTick] = useReducer((x: number) => x + 1, 0);

  const loadTodos = useCallback(async () => {
    if (!window.todoAPI) {
      console.log('[useTodos] todoAPI not available yet, waiting...');
      return;
    }
    setIsLoading(true);
    try {
      const data = await window.todoAPI.getTodos();
      setTodos(data);
    } catch (e) {
      console.error('[useTodos] Failed to load todos:', e);
    } finally {
      setIsLoading(false);
    }
  }, [setTodos]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    if (!window.todoAPI) {
      console.log('[useTodos] todoAPI not available for onTriggerInput');
      return;
    }
    const cleanup = window.todoAPI.onTriggerInput(() => {
      setShowInput(true);
    });
    return cleanup;
  }, [setShowInput]);

  useEffect(() => {
    const tick = () => {
      flushSync(() => forceTick());
    };
    const id = setInterval(tick, 60_000);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', tick);
    };
  }, []);

  const handleAdd = async (content: string) => {
    if (!window.todoAPI) {
      console.error('[useTodos] todoAPI not available');
      return;
    }
    const todo = await window.todoAPI.addTodo({ content });
    addTodo(todo);
    setShowInput(false);
  };

  const handleToggle = async (id: string) => {
    if (!window.todoAPI) {
      console.error('[useTodos] todoAPI not available');
      return;
    }
    await window.todoAPI.toggleTodo(id);
    toggleTodo(id);
  };

  const handleDelete = async (id: string) => {
    if (!window.todoAPI) {
      console.error('[useTodos] todoAPI not available');
      return;
    }
    await window.todoAPI.deleteTodo(id);
    deleteTodo(id);
  };

  const handleUpdate = async (id: string, content: string) => {
    if (!window.todoAPI) {
      console.error('[useTodos] todoAPI not available');
      return;
    }
    await window.todoAPI.updateTodo(id, content);
    updateTodo(id, content);
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    if (!window.todoAPI) {
      console.error('[useTodos] todoAPI not available');
      return;
    }
    await window.todoAPI.updateTodoNotes(id, notes);
    updateTodoNotes(id, notes);
  };

  const handleAddChild = async (parentId: string, content: string) => {
    if (!window.todoAPI) {
      console.error('[useTodos] todoAPI not available');
      return;
    }
    const todo = await window.todoAPI.addTodo({ content, parentId });
    addTodo(todo);
  };

  const handleDeleteChild = async (parentId: string, childId: string) => {
    if (!window.todoAPI) {
      console.error('[useTodos] todoAPI not available');
      return;
    }
    await window.todoAPI.deleteTodo(childId);
    deleteTodo(childId);
  };

  const filteredTodos = searchQuery
    ? todos.filter((t) => t.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : filterTodosForForeground(todos, new Date());

  return {
    todos: filteredTodos,
    handleAdd,
    handleToggle,
    handleDelete,
    handleUpdate,
    handleUpdateNotes,
    handleAddChild,
    handleDeleteChild,
    loadTodos,
    isLoading,
  };
}