import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PetView from '../../src-renderer/components/PetView';

describe('PetView', () => {
  it('renders default icon when no image provided', () => {
    render(<PetView petState="idle" images={{ idle: null, active: null, speaking: null }} />);
    const img = screen.getByRole('img');
    expect(img).toBeDefined();
    // Default icon is an SVG data URL
    expect(img.getAttribute('src')).toContain('data:image/svg+xml');
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
