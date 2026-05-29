import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PetView from '../../src-renderer/components/PetView';

// Mock todoAPI before each test
beforeEach(() => {
  Object.defineProperty(window, 'todoAPI', {
    value: {
      onDailyReportGenerated: vi.fn(() => () => {}),
    },
    writable: true,
    configurable: true,
  });
});

describe('PetView', () => {
  it('renders default icon when no image provided', () => {
    render(<PetView petState="idle" images={{ idle: null, active: null, speaking: null }} />);
    const defaultIcon = document.querySelector('.pet-default-icon');
    expect(defaultIcon).toBeDefined();
  });

  it('renders idle image when provided', () => {
    render(<PetView petState="idle" images={{ idle: '/test/idle.png', active: null, speaking: null }} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/test/idle.png');
  });

  it('renders active image when state is active', () => {
    render(<PetView petState="active" images={{ idle: '/test/idle.png', active: '/test/active.png', speaking: null }} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/test/active.png');
  });

  it('renders speaking image when state is speaking', () => {
    render(<PetView petState="speaking" images={{ idle: null, active: null, speaking: '/test/speak.png' }} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/test/speak.png');
  });

  it('falls back to idle if state image not available', () => {
    render(<PetView petState="speaking" images={{ idle: '/test/idle.png', active: null, speaking: null }} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/test/idle.png');
  });
});
