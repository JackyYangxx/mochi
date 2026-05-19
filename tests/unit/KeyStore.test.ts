import { describe, it, expect } from 'vitest';
import { KeyStore } from '../../src/services/KeyStore';

describe('KeyStore', () => {
  let keyStore: KeyStore;

  beforeEach(() => {
    keyStore = new KeyStore();
  });

  it('reports availability of safeStorage', () => {
    const available = keyStore.isAvailable();
    // safeStorage availability depends on OS encryption support
    expect(typeof available).toBe('boolean');
  });
});
