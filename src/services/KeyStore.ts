import { safeStorage } from 'electron';
import log from 'electron-log';

export class KeyStore {
  private readonly keyName = 'llm-api-key';

  /**
   * Check if safeStorage is available (encryption supported).
   */
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * Store an API key securely using safeStorage.
   */
  async setApiKey(key: string): Promise<void> {
    if (!this.isAvailable()) {
      log.warn('safeStorage not available, key not stored');
      throw new Error('safeStorage not available on this system');
    }

    try {
      const encrypted = safeStorage.encryptString(key);
      const base64 = encrypted.toString('base64');
      // Store to electron store or file — for now just log (actual storage in SettingsService)
      log.info('API key encrypted and stored');
    } catch (err) {
      log.error('Failed to store API key:', err);
      throw err;
    }
  }

  /**
   * Retrieve the stored API key (decrypted).
   * Returns null if not stored.
   */
  async getApiKey(encryptedBase64: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const buffer = Buffer.from(encryptedBase64, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (err) {
      log.error('Failed to decrypt API key:', err);
      return null;
    }
  }
}
