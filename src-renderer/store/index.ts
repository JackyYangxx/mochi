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

interface PetImages {
  idle: string | null;
  active: string | null;
  speaking: string | null;
}

interface TodoStore {
  todos: Todo[];
  searchQuery: string;
  showInput: boolean;
  showSettings: boolean;
  petState: 'idle' | 'active' | 'speaking';
  petSize: 'small' | 'medium' | 'large';
  petImages: PetImages;
  setTodos: (todos: Todo[]) => void;
  addTodo: (todo: Todo) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  updateTodo: (id: string, content: string) => void;
  updateSortOrder: (ids: string[]) => void;
  setSearchQuery: (query: string) => void;
  setShowInput: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setPetState: (state: 'idle' | 'active' | 'speaking') => void;
  setPetSize: (size: 'small' | 'medium' | 'large') => void;
  setPetImages: (images: PetImages) => void;
}

export const useStore = create<TodoStore>((set) => ({
  todos: [],
  searchQuery: '',
  showInput: false,
  showSettings: false,
  petState: 'idle',
  petSize: 'medium',
  petImages: { idle: null, active: null, speaking: null },
  setTodos: (todos) => set({ todos }),
  addTodo: (todo) => set((s) => ({ todos: [...s.todos, todo] })),
  toggleTodo: (id) =>
    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === id ? { ...t, isCompleted: !t.isCompleted, completedAt: !t.isCompleted ? new Date().toISOString() : null } : t
      ),
    })),
  deleteTodo: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),
  updateTodo: (id, content) =>
    set((s) => ({
      todos: s.todos.map((t) => (t.id === id ? { ...t, content, updatedAt: new Date().toISOString() } : t)),
    })),
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
  setShowSettings: (show) => set({ showSettings: show }),
  setPetState: (state) => set({ petState: state }),
  setPetSize: (size) => set({ petSize: size }),
  setPetImages: (images) => set({ petImages: images }),
}));
