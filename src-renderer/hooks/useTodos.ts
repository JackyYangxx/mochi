import { useEffect, useCallback, useState } from 'react';
import { useStore } from '../store';

declare global {
  interface Window {
    todoAPI?: {
      getTodos: () => Promise<any[]>;
      addTodo: (input: { content: string }) => Promise<any>;
      toggleTodo: (id: string) => Promise<any>;
      deleteTodo: (id: string) => Promise<void>;
      updateSortOrder: (ids: string[]) => Promise<void>;
      searchTodos: (query: string) => Promise<any[]>;
      onTriggerInput: (callback: () => void) => () => void;
    };
  }
}

export function useTodos() {
  const { todos, searchQuery, setTodos, addTodo, toggleTodo, deleteTodo, updateSortOrder, setShowInput } = useStore();
  const [isLoading, setIsLoading] = useState(false);

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

  const filteredTodos = searchQuery
    ? todos.filter((t) => t.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : todos;

  return {
    todos: filteredTodos,
    handleAdd,
    handleToggle,
    handleDelete,
    loadTodos,
    isLoading,
  };
}