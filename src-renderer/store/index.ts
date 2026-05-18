import { create } from 'zustand';

export interface Todo {
  id: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isCompleted: boolean;
}

interface TodoStore {
  todos: Todo[];
  searchQuery: string;
  showInput: boolean;
  petState: 'idle' | 'active' | 'speaking';
  setTodos: (todos: Todo[]) => void;
  addTodo: (todo: Todo) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  updateSortOrder: (ids: string[]) => void;
  setSearchQuery: (query: string) => void;
  setShowInput: (show: boolean) => void;
  setPetState: (state: 'idle' | 'active' | 'speaking') => void;
}

export const useStore = create<TodoStore>((set) => ({
  todos: [],
  searchQuery: '',
  showInput: false,
  petState: 'idle',
  setTodos: (todos) => set({ todos }),
  addTodo: (todo) => set((s) => ({ todos: [...s.todos, todo] })),
  toggleTodo: (id) =>
    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === id ? { ...t, isCompleted: !t.isCompleted, completedAt: !t.isCompleted ? new Date().toISOString() : null } : t
      ),
    })),
  deleteTodo: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),
  updateSortOrder: (ids) =>
    set((s) => ({
      todos: ids
        .map((id, index) => {
          const todo = s.todos.find((t) => t.id === id);
          return todo ? { ...todo, sortOrder: index } : null;
        })
        .filter(Boolean) as Todo[],
    })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setShowInput: (show) => set({ showInput: show }),
  setPetState: (state) => set({ petState: state }),
}));
