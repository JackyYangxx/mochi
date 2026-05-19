import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InputModal from '../../src-renderer/components/InputModal';

describe('InputModal', () => {
  it('renders input field with placeholder', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={onClose} />);

    const input = screen.getByPlaceholderText('输入待办事项...');
    expect(input).toBeDefined();
  });

  it('accepts text input', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={onClose} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Test todo item' } });
    expect((input as HTMLInputElement).value).toBe('Test todo item');
  });

  it('calls onAdd with trimmed text on Enter key', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={onClose} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  Test todo  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onAdd).toHaveBeenCalledWith('Test todo');
  });

  it('truncates text to 500 characters on Enter', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={onClose} />);

    const input = screen.getByRole('textbox');
    const longText = 'a'.repeat(550);
    fireEvent.change(input, { target: { value: longText } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onAdd).toHaveBeenCalledWith('a'.repeat(500));
  });

  it('does not call onAdd on Enter when input is empty', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={onClose} />);

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape key', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={onClose} />);

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={onClose} />);

    const overlay = document.querySelector('.input-modal-overlay');
    if (overlay) {
      fireEvent.click(overlay);
    }

    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when modal content is clicked', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={onClose} />);

    const modal = document.querySelector('.input-modal');
    if (modal) {
      fireEvent.click(modal);
    }

    expect(onClose).not.toHaveBeenCalled();
  });

  it('enforces maxLength of 500 on input', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={onClose} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.maxLength).toBe(500);
  });

  it('focuses input on mount', () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={onClose} />);

    const input = screen.getByRole('textbox');
    expect(document.activeElement).toBe(input);
  });
});