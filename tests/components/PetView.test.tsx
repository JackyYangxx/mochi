import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import PetView from '../../src-renderer/components/PetView';
import { useStore } from '../../src-renderer/store';

// Mock todoAPI before each test
let petGifReloadListeners: Array<() => void> = [];
beforeEach(() => {
  petGifReloadListeners = [];
  useStore.setState({ isCollapsed: false });
  Object.defineProperty(window, 'todoAPI', {
    value: {
      onDailyReportGenerated: vi.fn(() => () => {}),
      onPetGifReload: vi.fn((cb: () => void) => {
        petGifReloadListeners.push(cb);
        return () => {
          petGifReloadListeners = petGifReloadListeners.filter((l) => l !== cb);
        };
      }),
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

  it('nudges the GIF decoder when window regains focus (Windows fix)', async () => {
    render(<PetView petState="idle" images={{ idle: '/test/idle.png', active: null, speaking: null }} />);
    const img = screen.getByRole('img') as HTMLImageElement;
    expect(petGifReloadListeners.length).toBe(1);

    // Simulate window regaining focus.
    act(() => {
      petGifReloadListeners.forEach((cb) => cb());
    });

    // src is briefly blanked to force the decoder to drop its frames.
    expect(img.getAttribute('src')).toBe('');

    // Next animation frame, src is restored so the decoder restarts.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(img.src).toContain('/test/idle.png');
  });

  it('renders a collapse toggle button on the pet image', () => {
    render(<PetView petState="idle" images={{ idle: '/test/idle.png', active: null, speaking: null }} />);
    const btn = document.querySelector('.collapse-toggle');
    expect(btn).toBeTruthy();
  });

  it('toggles isCollapsed in the store when the collapse button is clicked', () => {
    render(<PetView petState="idle" images={{ idle: '/test/idle.png', active: null, speaking: null }} />);
    const btn = document.querySelector('.collapse-toggle') as HTMLButtonElement;
    expect(useStore.getState().isCollapsed).toBe(false);
    fireEvent.click(btn);
    expect(useStore.getState().isCollapsed).toBe(true);
    fireEvent.click(btn);
    expect(useStore.getState().isCollapsed).toBe(false);
  });
});
