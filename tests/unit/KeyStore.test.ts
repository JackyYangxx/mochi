import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyStore } from '../../src/services/KeyStore';

// Mock electron safeStorage
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(true),
  },
}));

describe('KeyStore', () => {
  let keyStore: KeyStore;

  beforeEach(() => {
    vi.clearAllMocks();
    keyStore = new KeyStore();
  });

  it('reports availability of safeStorage', () => {
    const available = keyStore.isAvailable();
    expect(typeof available).toBe('boolean');
  });
});