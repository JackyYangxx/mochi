import React from 'react';
import { useStore } from '../store';
import './TodoSearch.css';

export default function TodoSearch() {
  const searchQuery = useStore((s) => s.searchQuery);
  const setSearchQuery = useStore((s) => s.setSearchQuery);

  return (
    <div className="todo-search">
      <input
        type="text"
        placeholder="搜索待办..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="todo-search-input"
      />
      {searchQuery && (
        <button
          className="todo-search-clear"
          onClick={() => setSearchQuery('')}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
